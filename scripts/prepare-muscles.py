"""Export muscle bellies from the same pinned source and frozen bone registration.
Run with Blender --background --factory-startup --disable-autoexec --python.
Tendon material faces are removed before smoothing; boundary loops are capped.
"""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models'
source=json.loads((ROOT/'assets/source/source-manifest.json').read_text())
bones=json.loads((OUT/'bones.manifest.json').read_text())
path=ROOT/'assets/source/Startup.blend'
assert hashlib.sha256(path.read_bytes()).hexdigest()==bones['sourceBlendSha256']
bpy.ops.wm.open_mainfile(filepath=str(path),use_scripts=False)
bpy.context.view_layer.update()
transform=Matrix(bones['registration']['sourceWorldToBlenderRowMajor'])
mapping={'anterior':'Tibialis anterior muscle.r','fibularis':'Fibularis longus muscle.r','fibularis-brevis':'Fibularis brevis muscle.r','soleus-distal':'Soleus muscle.r','ehl':'Extensor hallucis longus.r','edl':'Extensor digitorum longus.r','edb':'Extensor digitorum brevis.r','abductor-hallucis':'Abductor hallucis.r','abductor-digiti':'Abductor digiti minimi of foot.r','tibialis-posterior':'Tibialis posterior muscle.r','fdl':'Flexor digitorum longus.r','fhl':'Flexor hallucis longus.r'}
prepared=[]
for atlas,name in mapping.items():
    src=bpy.data.objects[name]; mesh=src.data.copy(); mesh.transform(transform@src.matrix_world)
    bm=bmesh.new(); bm.from_mesh(mesh)
    tendon_slots={i for i,m in enumerate(mesh.materials) if m and m.name=='Tendon'}
    # In these two objects the material seam is non-manifold and cuts through
    # the belly surface. Retain the source surface and separate the distal
    # tendon at a documented seam-level plane instead of voxelizing fragments.
    spatial_cut=atlas in ['abductor-hallucis','fhl']
    removed=[] if spatial_cut else [f for f in bm.faces if f.material_index in tendon_slots]
    if removed:bmesh.ops.delete(bm,geom=removed,context='FACES')
    if atlas=='fhl':
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=Vector((0,0,0.031)),plane_no=Vector((0,0,1)),clear_inner=True,clear_outer=False)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    if atlas in ['edb','abductor-hallucis']:
        # Some distal extensor slips have muscle material upstream. Restrict EDB
        # to its dorsal belly before reconstructing the separate tendon slips.
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=Vector((0.065,0,0)),plane_no=Vector((1,0,0)),clear_outer=True,clear_inner=False)
    boundary=[e for e in bm.edges if e.is_boundary]
    rim=list({v for e in boundary for v in e.verts})
    # Infer distal junction from the material seam, never a label centroid.
    points=[Vector((v.co.x,v.co.z,-v.co.y))*1000 for v in rim or list(bm.verts)]
    intrinsic=atlas in ['edb','abductor-hallucis','abductor-digiti']
    extreme=(max(p.x for p in points) if intrinsic else min(p.y for p in points))
    selected=[p for p in points if (p.x>extreme-5 if intrinsic else p.y<extreme+5)]
    junction=sum(selected,Vector())/len(selected)
    bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
    bmesh.ops.dissolve_degenerate(bm,dist=1e-9,edges=list(bm.edges))
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    print('PREP',atlas,'volume',bm.calc_volume(signed=True),'bad edges',sum(not e.is_manifold for e in bm.edges),flush=True)
    bm.to_mesh(mesh); bm.free()
    prepared.append((atlas,name,mesh,len(removed),list(junction)))
bpy.data.batch_remove(ids=list(bpy.data.objects))
bpy.data.batch_remove(ids=list(bpy.data.collections))
bpy.data.batch_remove(ids=list(bpy.data.texts))
scene=bpy.context.scene
for other in list(bpy.data.scenes):
    if other!=scene:bpy.data.scenes.remove(other)
scene.name='Right foot and lower leg muscles';scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
collection=bpy.data.collections.new(scene.name);scene.collection.children.link(collection)
records=[];objects=[]
for atlas,name,mesh,removed,junction in prepared:
    obj=bpy.data.objects.new(atlas,mesh);collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);mesh.materials.clear()
    mesh.calc_loop_triangles();original=len(mesh.loop_triangles);levels=0
    check=bmesh.new();check.from_mesh(mesh)
    input_volume=abs(check.calc_volume(signed=True))
    needs_repair=atlas=='soleus-distal' or any(not e.is_manifold for e in check.edges);check.free()
    if needs_repair:
        mod=obj.modifiers.new('Repair source topology','REMESH');mod.mode='VOXEL';mod.voxel_size=0.0006;mod.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=mod.name);obj.data.calc_loop_triangles()
    while len(obj.data.loop_triangles)<6000:
        mod=obj.modifiers.new('Surface subdivision','SUBSURF');mod.levels=1;mod.render_levels=1
        bpy.ops.object.modifier_apply(modifier=mod.name);obj.data.calc_loop_triangles();levels+=1
    if len(obj.data.loop_triangles)>12000:
        mod=obj.modifiers.new('Triangle budget','DECIMATE');mod.ratio=12000/len(obj.data.loop_triangles);mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(obj.data)
    fins=[f for f in bm.faces if sum(e.is_boundary for e in f.edges)>=2 and any(len(e.link_faces)>2 for e in f.edges)]
    if fins:bmesh.ops.delete(bm,geom=fins,context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    boundary=[e for e in bm.edges if e.is_boundary]
    if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
    bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    # Remove tiny detached repair artifacts, while preserving EDB's three bellies.
    remaining=set(bm.verts);components=[]
    while remaining:
        todo=[remaining.pop()];component=set(todo)
        while todo:
            for edge in todo.pop().link_edges:
                for vert in edge.verts:
                    if vert in remaining:remaining.remove(vert);component.add(vert);todo.append(vert)
        components.append(component)
    largest=max(map(len,components))
    tiny=[v for component in components if len(component)<largest*0.01 for v in component]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='VERTS')
    component_count=sum(len(c)>=largest*0.01 for c in components)
    bm.to_mesh(obj.data);bm.free();obj.data.validate(clean_customdata=True);obj.data.update()
    check=bmesh.new();check.from_mesh(obj.data)
    nonmanifold=sum(not e.is_manifold for e in check.edges)
    volume=abs(check.calc_volume(signed=True));check.free()
    assert nonmanifold==0,(atlas,nonmanifold)
    assert component_count<=3,(atlas,component_count)
    assert 0.5<volume/input_volume<1.5,(atlas,'lost belly volume',volume/input_volume)
    for p in obj.data.polygons:p.use_smooth=True
    for key in list(obj.keys()):del obj[key]
    obj['atlasId']=atlas;obj['sourceObject']=name;obj['license']='CC-BY-SA-4.0';obj['sourceRevision']=source['revision']
    obj.data.name=atlas
    exported=[Vector((v.co.x,v.co.z,-v.co.y))*1000 for v in obj.data.vertices]
    # Move seam estimate to the processed belly's nearest surface vertex.
    junction=list(min(exported,key=lambda p:(p-Vector(junction)).length_squared))
    bounds=[[min(v[i] for v in exported) for i in range(3)],[max(v[i] for v in exported) for i in range(3)]]
    triangles=len(obj.data.polygons);assert 5000<=triangles<=20000
    records.append({'atlasId':atlas,'sourceObject':name,'sourceBellyTriangles':original,'removedTendonFaces':removed,'bellyCropXMaxMm':65 if atlas in ['edb','abductor-hallucis'] else None,'bellyCropYMinMm':31 if atlas=='fhl' else None,'extractionMethod':'seam-level spatial cut; retain belly aponeuroses' if atlas in ['abductor-hallucis','fhl'] else 'tendon-material separation','subdivisionLevels':levels,'triangles':triangles,'components':component_count,'volumeMm3':volume*1e9,'retainedVolumeRatio':volume/input_volume,'nonManifoldEdges':nonmanifold,'voxelRepairMm':0.6 if needs_repair else None,'boundsMm':bounds,'junctionMm':junction,'junctionMethod':'Distal material seam or documented seam-level cut, projected onto processed belly; illustrative junction, not measured attachment','license':'CC-BY-SA-4.0'})
    objects.append(obj);obj.select_set(False);print(atlas,triangles,flush=True)
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
for block in bpy.data.user_map():
    if hasattr(block,'use_fake_user'):block.use_fake_user=False
bpy.data.batch_remove(ids=[m for m in bpy.data.meshes if m not in {o.data for o in objects}]);bpy.data.orphans_purge(do_recursive=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/muscles.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'muscles.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
manifest={k:bones[k] for k in ['sourceRevision','sourceUrl','sourceBlendSha256','license','attribution','sourceUnits','gltfUnits','runtimeUnits','coordinateConvention','registration']}
manifest.update({'processing':['Right-side muscle selection; native scale and complete bellies','Remove Tendon material faces, cap muscle boundaries; FHL/abductor hallucis use documented seam-level cuts to preserve source belly surfaces','EDB distal slips cropped at X=65 mm; soleus repaired at 0.6 mm voxel resolution; remove tiny repair artifacts','Validate connected components, retained volume and manifold edges after mesh validation','Clean, outward normals, subdivision and decimation using Phase 2 budget','Identity transforms; same frozen source-to-GLB matrix as bones'],'limitations':['Seam-derived junctions are approximate','Subdivision adds no measured detail','Proximal origins outside this regional skeleton are not reconstructed'],'muscles':records,'glbSha256':hashlib.sha256((OUT/'muscles.glb').read_bytes()).hexdigest()})
(OUT/'muscles.manifest.json').write_text(json.dumps(manifest,indent=2))
(ROOT/'src/muscleLandmarks.json').write_text(json.dumps({r['atlasId']:{'junctionMm':r['junctionMm'],'boundsMm':r['boundsMm']} for r in records},indent=2))
print('EXPORTED',len(objects),(OUT/'muscles.glb').stat().st_size)

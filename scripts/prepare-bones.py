"""Run in Blender through scripts/blender-command.py (or Blender --background --python).
Reproducibly prepares the pinned right-side source without modifying the original.
"""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/Startup.blend'
OUT=ROOT/'public/models'
source_manifest=json.loads((ROOT/'assets/source/source-manifest.json').read_text())
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_manifest['files'][-1]['sha256']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),use_scripts=False)
bpy.context.view_layer.update()
source_units={'system':bpy.context.scene.unit_settings.system,'metersPerUnit':bpy.context.scene.unit_settings.scale_length}
assert source_units=={'system':'METRIC','metersPerUnit':1.0}
mapping={'tibia':'Tibia.r','fibula':'Fibula.r','talus':'Talus.r','calcaneus':'Calcaneus.r','navicular':'Navicular bone.r','cuboid':'Cuboid bone.r','cuneiform-medial':'Medial cuneiform bone.r','cuneiform-intermediate':'Intermediate cuneiform bone.r','cuneiform-lateral':'Lateral cuneiform bone.r'}
ordinals=['first','second','third','fourth','fifth']
for i,word in enumerate(ordinals,1):
    mapping[f'metatarsal-{i}']=word.title()+' metatarsal bone.r'
    for segment in (['proximal','distal'] if i==1 else ['proximal','middle','distal']):
        mapping[f'phalanx-{i}-{segment}']=f'{segment.title()} phalanx of {word} finger of foot.r'
assert len(mapping)==28
# Freeze the source talus bounding-box center BEFORE surface processing. This
# registration point is a display datum, not a measured anatomical joint center.
talus=bpy.data.objects['Talus.r']
datum=sum((talus.matrix_world@Vector(v) for v in talus.bound_box),Vector())/8
# Source: -Y anterior, +Z superior, -X subject-right. Proper rotation, meters.
source_to_gltf=Matrix(((0,-1,0,datum.y),(0,0,1,-datum.z),(-1,0,0,datum.x),(0,0,0,1)))
# Blender exporter maps (x,y,z) -> (x,z,-y). Undo that here so exported GLB
# coordinates are exactly +X anterior, +Y superior, +Z subject-right.
gltf_to_blender=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
source_to_blender=gltf_to_blender@source_to_gltf
prepared=[]
for atlas_id,source_name in [*mapping.items(),('sesamoids','Sesamoid bones of foot.r')]:
    src=bpy.data.objects[source_name]
    mesh=src.data.copy()
    mesh.transform(source_to_blender@src.matrix_world)
    prepared.append((atlas_id,source_name,mesh))
# Remove the full-body scene only after all 29 source meshes have been copied.
bpy.data.batch_remove(ids=list(bpy.data.objects))
print("Removed source objects",flush=True)
bpy.data.batch_remove(ids=list(bpy.data.collections))
bpy.data.batch_remove(ids=list(bpy.data.texts))
scene=bpy.context.scene
for other in list(bpy.data.scenes):
    if other!=scene: bpy.data.scenes.remove(other)
scene.name='Right foot and ankle bones'
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
collection=bpy.data.collections.new('Right foot and ankle bones');scene.collection.children.link(collection)
records=[]
objects=[]
for atlas_id,source_name,mesh in prepared:
    bm=bmesh.new();bm.from_mesh(mesh)
    loose=[v for v in bm.verts if not v.link_faces]
    loose_count=len(loose)
    if loose: bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bmesh.ops.dissolve_degenerate(bm,dist=1e-9,edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0: bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(mesh);bm.free()
    pieces=[]
    if atlas_id=='sesamoids':
        adjacency=[set() for _ in mesh.vertices]
        for e in mesh.edges:
            a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
        remaining=set(range(len(mesh.vertices)));components=[]
        while remaining:
            todo=[remaining.pop()];component=set(todo)
            while todo:
                for v in adjacency[todo.pop()]&remaining:
                    remaining.remove(v);component.add(v);todo.append(v)
            components.append(component)
        assert len(components)==2, f'Expected two sesamoids, found {len(components)}'
        # Blender Y = -anatomical Z: the more positive Y component is medial.
        components.sort(key=lambda c:sum(mesh.vertices[v].co.y for v in c)/len(c),reverse=True)
        for name,component in zip(['sesamoid-medial','sesamoid-lateral'],components):
            indices=sorted(component);remap={old:new for new,old in enumerate(indices)}
            part=bpy.data.meshes.new(name)
            part.from_pydata([mesh.vertices[i].co[:] for i in indices],[],[[remap[v] for v in p.vertices] for p in mesh.polygons if set(p.vertices)<=component])
            part.update();pieces.append((name,part))
    else: pieces=[(atlas_id,mesh)]
    for name,part in pieces:
        obj=bpy.data.objects.new(name,part);collection.objects.link(obj)
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        part.materials.clear()
        part.calc_loop_triangles();original_triangles=len(part.loop_triangles)
        levels=0
        # The pinned source is a coarse control mesh. Smooth only enough to meet
        # the requested surface budget; subdivision is not new anatomical data.
        while len(part.loop_triangles)<6000:
            mod=obj.modifiers.new('Surface subdivision','SUBSURF');mod.levels=1;mod.render_levels=1
            bpy.ops.object.modifier_apply(modifier=mod.name)
            part=obj.data;part.calc_loop_triangles();levels+=1
        if len(part.loop_triangles)>12000:
            mod=obj.modifiers.new('Triangle budget','DECIMATE');mod.ratio=12000/len(part.loop_triangles);mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bm=bmesh.new();bm.from_mesh(obj.data)
        fins=[f for f in bm.faces if sum(e.is_boundary for e in f.edges)>=2 and any(len(e.link_faces)>2 for e in f.edges)]
        removed_fins=len(fins)
        if fins: bmesh.ops.delete(bm,geom=fins,context="FACES")
        loose=[v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm,geom=loose,context="VERTS")
        boundary_edges=[e for e in bm.edges if e.is_boundary]
        filled=bmesh.ops.holes_fill(bm,edges=boundary_edges,sides=3) if boundary_edges else {"faces":[]}
        repaired_holes=len(filled["faces"])
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        if bm.calc_volume(signed=True)<0: bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        loose_final=sum(1 for v in bm.verts if not v.link_faces)
        boundary=sum(1 for e in bm.edges if not e.is_manifold)
        bm.to_mesh(obj.data);bm.free();obj.data.update()
        for p in obj.data.polygons:p.use_smooth=True
        obj.data.name=name
        for key in list(obj.keys()):del obj[key]
        obj['atlasId']=name
        obj['sourceObject']=source_name
        obj['license']='CC-BY-SA-4.0'
        obj['sourceRevision']=source_manifest['revision']
        triangles=len(obj.data.polygons)
        assert 5000<=triangles<=20000,(name,triangles)
        assert loose_final==0
        assert boundary==0,(name,boundary)
        assert obj.matrix_world==Matrix.Identity(4)
        exported=[Vector((v.co.x,v.co.z,-v.co.y)) for v in obj.data.vertices]
        bounds=[[min(v[i] for v in exported) for i in range(3)],[max(v[i] for v in exported) for i in range(3)]]
        records.append({'atlasId':name,'sourceObject':source_name,'sourceTriangles':original_triangles,'subdivisionLevels':levels,'triangles':triangles,'removedLooseVertices':loose_count,'removedDanglingFaces':removed_fins,'repairedTriangularHoles':repaired_holes,'nonManifoldEdges':boundary,'boundsMeters':bounds,'license':'CC-BY-SA-4.0','provenance':'Z-Anatomy / BodyParts3D; skeletal subset under upstream blanket model license; unrelated exception objects excluded'})
        objects.append(obj);obj.select_set(False)
        print(name,triangles,flush=True)
assert len(objects)==30
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in objects if o.name=='talus')
# Remove unused source blocks, including materials and curves not exported.
for block in bpy.data.user_map():
    if hasattr(block,"use_fake_user"): block.use_fake_user=False
used_meshes={o.data for o in objects}
bpy.data.batch_remove(ids=[m for m in bpy.data.meshes if m not in used_meshes])
bpy.data.orphans_purge(do_recursive=True)
scene.world=bpy.data.worlds.new('Bone study world') if scene.world is None else scene.world
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=Vector((0.05,0,0.12))
            area.spaces.active.region_3d.view_distance=0.75
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/bones.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'bones.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
manifest={'sourceRevision':source_manifest['revision'],'sourceUrl':f"https://github.com/Z-Anatomy/Models-of-human-anatomy/tree/{source_manifest['revision']}",'sourceBlendSha256':source_manifest['files'][-1]['sha256'],'license':'CC-BY-SA-4.0','attribution':['Z-Anatomy — The libre 3D atlas of anatomy — Gauthier Kervyn — CC BY-SA 4.0','BodyParts3D — The Database Center for Life Science — Kousaku Okubo — CC BY-SA 2.1 Japan'],'sourceUnits':source_units,'gltfUnits':'meters','runtimeUnits':'millimeters; multiply by 1000 once','coordinateConvention':'Phase 1: +X anterior, +Y superior, +Z subject-right; fixed talus reference origin','registration':{'method':'Proper basis rotation and translation; native physical scale, no per-bone repositioning or nonuniform scaling','sourceTalusDatumMeters':list(datum),'datumDefinition':'Source Talus.r world bounding-box center frozen before surface processing, mapped to the Phase 1 authored talus datum [0,0,0]; display registration, not a measured joint center','sourceWorldToGltfRowMajor':[list(row) for row in source_to_gltf],'sourceWorldToBlenderRowMajor':[list(row) for row in source_to_blender],'exportYUp':True},'processing':['Right-side source selection only; full tibia and fibula retained','Separate two connected sesamoid surfaces, identify medial/lateral by anatomical transverse coordinate','Remove loose vertices and degenerate edges; recalculate outward normals','Catmull-Clark subdivision of coarse source surfaces then decimation when above 12000 triangles; no new anatomical detail claimed','Bake all source world transforms and registration into geometry; identity object transforms','Export meter-scale GLB with atlas IDs as node names and extras.atlasId'],'limitations':['Source surface smoothing is a visual adaptation, not a higher resolution scan','Existing procedural soft tissues are not registered or anatomically validated against these bones'],'bones':records,'glbSha256':hashlib.sha256((OUT/'bones.glb').read_bytes()).hexdigest()}
(OUT/'bones.manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('EXPORTED',len(objects),(OUT/'bones.glb').stat().st_size)

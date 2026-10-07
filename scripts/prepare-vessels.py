"""Export explicit right-foot vessels/nerves using the frozen bone registration.
Run: Blender 5.2 --background --factory-startup --disable-autoexec --python scripts/prepare-vessels.py
The catalog is an explicit source-name allowlist; discovery is never used to export.
"""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models'
bones=json.loads((OUT/'bones.manifest.json').read_text())
catalog=json.loads((ROOT/'src/neurovascularCatalog.json').read_text())
source=ROOT/'assets/source/Startup.blend'
assert bpy.app.version[:2]==(5,2), 'Use Blender 5.2 for reproducible curve tessellation'
assert hashlib.sha256(source.read_bytes()).hexdigest()==bones['sourceBlendSha256']
assert len(catalog)==49 and len({r['id'] for r in catalog})==49 and len({r['sourceObject'] for r in catalog})==49
bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
bpy.context.view_layer.update()
transform=Matrix(bones['registration']['sourceWorldToBlenderRowMajor'])
crop_y=max(r['boundsMeters'][1][1] for r in bones['bones'] if r['atlasId']=='tibia')
prepared=[]
source_copies=[]
for record in catalog:
 src=bpy.data.objects[record['sourceObject']]
 assert src.type=='CURVE'
 expected='5: Cardiovascular system' if record['tissue']!='nerve' else '7: Nervous system & Sense organs'
 assert expected in [c.name for c in src.users_collection]
 corners=[src.matrix_world@Vector(p) for p in src.bound_box]
 assert max(p.x for p in corners)<0 and min(p.z for p in corners)<.2
 source_copies.append((record,src.data.copy(),src.matrix_world.copy(),[m.name for m in src.data.materials if m]))
# Remove unrelated source dependency cycles before evaluating copied curves.
bpy.data.batch_remove(ids=list(bpy.data.objects));bpy.data.batch_remove(ids=list(bpy.data.texts))
for record,curve,world,materials in source_copies:
 # Round bevel resolution 1 yields six sides; retain the source bevel depth
 # and per-control-point radii. Resolution 6 samples each longitudinal segment.
 curve.resolution_u=6;curve.render_resolution_u=6;curve.bevel_resolution=1;curve.use_fill_caps=False
 obj=bpy.data.objects.new(record['id'],curve);bpy.context.scene.collection.objects.link(obj)
 obj.matrix_world=world;obj.hide_render=False
 bpy.context.view_layer.update()
 mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
 mesh.transform(transform@obj.matrix_world)
 bm=bmesh.new();bm.from_mesh(mesh)
 # Independent spline tubes must not be welded at branch intersections.
 pre_crop=sum(v.co.z>crop_y+1e-7 for v in bm.verts)
 if pre_crop:
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-8,plane_co=Vector((0,0,crop_y)),plane_no=Vector((0,0,1)),clear_outer=True,clear_inner=False)
 loose=[v for v in bm.verts if not v.link_faces]
 if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
 rim=[e for e in bm.edges if e.is_boundary]
 caps=bmesh.ops.holes_fill(bm,edges=rim,sides=0).get('faces',[]) if rim else []
 capped=sum(all(abs(v.co.z-crop_y)<1e-7 for v in f.verts) for f in caps)
 bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 assert all(e.is_manifold for e in bm.edges),(record['id'],'uncapped edge')
 bm.to_mesh(mesh);bm.free();mesh.materials.clear();mesh.update()
 radii=[p.radius*curve.bevel_depth*1000 for s in curve.splines for p in (s.bezier_points if s.type=='BEZIER' else s.points)]
 points=[Vector((v.co.x,v.co.z,-v.co.y))*1000 for v in mesh.vertices]
 bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
 metadata={**record,'atlasId':record['id'],'boundsMm':bounds,'triangles':len(mesh.polygons),'vertices':len(mesh.vertices),'tubeSides':6,'resolutionU':6,'sourceBevelDepthMeters':curve.bevel_depth,'sourceRadiusRangeMm':[min(radii),max(radii)],'cropped':bool(pre_crop),'cutCapFaces':capped,'endCapFaces':len(caps),'nonManifoldEdges':0,'sourceMaterials':materials,'license':'CC-BY-SA-4.0'}
 prepared.append((metadata,mesh))
 bpy.data.objects.remove(obj,do_unlink=True)
# Drop source objects and embedded scripts before creating the export scene.
bpy.data.batch_remove(ids=list(bpy.data.objects));bpy.data.batch_remove(ids=list(bpy.data.texts))
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
objects=[]
for record,mesh in prepared:
 obj=bpy.data.objects.new(record['atlasId'],mesh);scene.collection.objects.link(obj)
 for p in mesh.polygons:p.use_smooth=True
 for key in ['atlasId','sourceObject','tissue','license']:obj[key]=record[key]
 obj['sourceRevision']=bones['sourceRevision'];obj.select_set(True);objects.append(obj)
 print(record['atlasId'],record['triangles'],'cropped',record['cropped'],flush=True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'neurovascular.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
manifest={k:bones[k] for k in ['sourceRevision','sourceUrl','sourceBlendSha256','license','attribution','sourceUnits','gltfUnits','runtimeUnits','coordinateConvention','registration']}
manifest.update({'blenderVersion':bpy.app.version_string,'cropYMaxMm':crop_y*1000,'selection':'Explicit sourceObject allowlist in src/neurovascularCatalog.json; 33 vessel objects and 16 nerve objects','sourceNameException':'Common plantar digital branches of medial plantar nerve has no .r suffix in the pinned source; its world bounds and collection place it in the right foot.','processing':['Copy source CURVE data with original bevel_depth and per-point radius; round bevel resolution 1 (six sides), resolution_u 6, filled ends','Convert evaluated curves to mesh, bake the unchanged source-world-to-Blender bone registration','Crop superior extent at full processed tibia top; cap cut boundaries and triangulate','Identity object transforms, outward normals, smooth shading; GLB Y-up meter export; runtime multiplies by 1000 once'],'limitations':['Source vessels and nerves are schematic tubes; curvature tessellation adds no measured detail','The viewer exterior is illustrative, not source skin; source anatomy is never distorted to fit it','Lymphatic vessels are unavailable in this source region; the three mid-shin lymph nodes are excluded'],'excludedLicenseExceptions':'Allowlist contains only named lower-limb vessels and peripheral nerves. No Brainder, Washington white-matter, Dundee cranial-nerve/foramina or inner-ear, or Lissie Cowley kidney exception objects are included.','exteriorBoundsValidation':{'toleranceMm':1,'reason':'Illustrative exterior uses 1.2 mm voxel construction. Plantar digital veins extend 0.533 mm below its AABB; all vertices fit a 1 mm expanded AABB. This is not a source-skin containment claim.'},'structures':[r for r,m in prepared],'glbSha256':hashlib.sha256((OUT/'neurovascular.glb').read_bytes()).hexdigest()})
(OUT/'neurovascular.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('EXPORTED',len(objects),(OUT/'neurovascular.glb').stat().st_size)

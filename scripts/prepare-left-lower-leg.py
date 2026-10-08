"""Mirror the existing registered right lower-leg study assets using Blender MCP.
This creates a left-oriented derivative, not an independently measured subject.
"""
import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Matrix
root=Path(__file__).resolve().parents[1]
out=root/'public/models/left-lower-leg';out.mkdir(parents=True,exist_ok=True)
records=[]
for name in ['bones','muscles','exterior','neurovascular']:
 bpy.data.batch_remove(ids=list(bpy.data.objects))
 bpy.ops.import_scene.gltf(filepath=str(root/'public/models'/f'{name}.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in meshes:
  # glTF +Z subject-right maps to Blender -Y; reflect the world Y plane.
  o.data.transform(Matrix.Diagonal((1,-1,1,1))@o.matrix_world)
  o.matrix_world=Matrix.Identity(4)
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  o['adaptation']='Mirrored right-side study model';o['anatomicalSide']='left'
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0]
 target=out/f'{name}.glb'
 bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
 record={'asset':name,'objects':len(meshes),'sourceAsset':f'../{name}.glb','sourceSha256':hashlib.sha256((root/'public/models'/f'{name}.glb').read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
 records.append(record)
(out/'manifest.json').write_text(json.dumps({**{k:json.loads((root/'public/models/bones.manifest.json').read_text())[k] for k in ['sourceRevision','sourceUrl','sourceBlendSha256','attribution']},'side':'left','license':'CC-BY-SA-4.0','adaptation':'Anatomical-Z reflection of the registered right lower-leg assets with reversed triangle winding and recalculated normals. Not an independent left specimen.','assets':records},indent=2))
result={'assets':records}


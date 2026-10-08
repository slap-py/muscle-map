"""Finish a prepared upper-leg export in a fresh Blender MCP context."""
import bpy,json,hashlib
from pathlib import Path
globals().update(bpy.app.driver_namespace['muscle_map_upper_export'])
for side in ['left','right']:
 out=ROOT/'public/models'/f'{side}-upper-leg';out.mkdir(parents=True,exist_ok=True)
 exports=[]
 for group,items in objects[side].items():
  bpy.ops.object.select_all(action='DESELECT')
  for obj in items:obj.select_set(True)
  bpy.context.view_layer.objects.active=items[0];path=out/f'{group}.glb'
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
  exports.append({'group':group,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 manifest={'side':side,'sourceRevision':bone_manifest['sourceRevision'],'sourceBlendSha256':bone_manifest['sourceBlendSha256'],'license':'CC-BY-SA-4.0','attribution':bone_manifest['attribution'],'sourceUrl':bone_manifest['sourceUrl'],'registration':frames[side],'sourceCropMeters':[.32,1.025],'axes':{'x':'anterior','y':'superior','z':'subject-right'},'units':'mm at runtime; meters in GLB','processing':['Original side-specific source objects, no reflection','Muscle tendon and bone cartilage material separation','Regional crop and boundary caps; source surface subdivision and triangle budgets','Source curves preserve tube radii; GLB Y-up export'],'limitations':['Surface subdivision adds no measured detail','Regional exterior comprises source body-region surface patches; not histologic skin','Psoas and proximal nerves are cropped at the superior boundary; their full origins are outside this region','Some source connective-tissue sheets have open borders; no clinical measurements or biomechanical simulation','Open exterior surface patches are displayed double-sided to preserve their source coverage.'],'exports':exports,'structures':records[side]}
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
 target=ROOT/'src/regions/upper-leg';target.mkdir(parents=True,exist_ok=True)
 (target/f'{side}-manifest.json').write_text(json.dumps({'side':side,'structures':records[side]},indent=2))
from collections import Counter
for side in ['left','right']:
 unique={r['id']:r for r in records[side]}
 counts={'total':len(unique),'byTissue':dict(Counter(r['tissue'] for r in unique.values()))}
 (ROOT/'src/regions/upper-leg'/f'{side}-counts.json').write_text(json.dumps(counts,indent=2))
result={'exported':{side:len(records[side]) for side in records},'missingSourceObjects':missing}




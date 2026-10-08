import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/source/Startup.blend'),use_scripts=False)
bpy.context.view_layer.update()
records=[]
for o in bpy.data.objects:
 if o.type not in ['MESH','CURVE']: continue
 pts=[o.matrix_world@Vector(v) for v in o.bound_box]
 bounds=[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]
 records.append({'name':o.name,'type':o.type,'bounds':bounds,'collections':[c.name for c in o.users_collection],'materials':[m.name if m else '' for m in o.data.materials]})
(root/'validation/whole-body-inventory.json').write_text(json.dumps(records,indent=2))
result={'objects':len(records),'inventory':str(root/'validation/whole-body-inventory.json')}

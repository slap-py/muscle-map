import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(r/'assets/source/Startup.blend'),use_scripts=False)
bpy.context.view_layer.update()
records=[]
for o in bpy.data.objects:
 if o.type!='CURVE' or (not o.name.endswith('.r') and o.name!='Common plantar digital branches of medial plantar nerve'):continue
 if not any(c.name in ['5: Cardiovascular system','7: Nervous system & Sense organs'] for c in o.users_collection):continue
 pts=[o.matrix_world@Vector(v) for v in o.bound_box]
 bounds=[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]
 if bounds[1][0]>=0 or bounds[0][2]>=.2:continue
 records.append({'sourceObject':o.name,'collections':[c.name for c in o.users_collection],'materials':[m.name for m in o.data.materials if m],'bounds':bounds,'bevelDepth':o.data.bevel_depth,'resolution':o.data.resolution_u,'bevelResolution':o.data.bevel_resolution})
(r/'validation/neurovascular-source-inventory.json').write_text(json.dumps(records,indent=2))
print(json.dumps(records,indent=2))

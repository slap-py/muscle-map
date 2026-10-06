import bpy, json
from pathlib import Path
from mathutils import Matrix, Vector
root = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/source/Startup.blend'), use_scripts=False)
bpy.context.view_layer.update()
matrix = Matrix(json.loads((root/'public/models/bones.manifest.json').read_text())['registration']['sourceWorldToGltfRowMajor'])
records=[]
for obj in bpy.data.objects:
    if obj.type!='MESH' or not obj.name.endswith('.r'): continue
    if not any(s in obj.name.lower() for s in ['tibialis','fibularis','perone','soleus','halluc','digitor','digiti','retinac','plantar','talo','calcaneo','tibio','achill']): continue
    points=[matrix@obj.matrix_world@Vector(v) for v in obj.bound_box]
    records.append({'name':obj.name,'boundsMm':[[round(min(p[i] for p in points)*1000,2) for i in range(3)],[round(max(p[i] for p in points)*1000,2) for i in range(3)]],'vertices':len(obj.data.vertices)})
(root/'validation/soft-source-inventory.json').write_text(json.dumps(records,indent=2))
print(json.dumps(records,indent=2))

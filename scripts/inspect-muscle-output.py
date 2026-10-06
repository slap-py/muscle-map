import bpy,bmesh,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/muscles.blend'),use_scripts=False)
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(obj.data)
 remaining=set(bm.verts);components=[]
 while remaining:
  todo=[remaining.pop()];component=set(todo)
  while todo:
   for e in todo.pop().link_edges:
    for vert in e.verts:
     if vert in remaining:remaining.remove(vert);component.add(vert);todo.append(vert)
  components.append(len(component))
 print(obj.name,'components',sorted(components,reverse=True)[:20],'volume',bm.calc_volume(signed=True),'bounds', [list(p) for p in obj.bound_box][:2])
 bm.free()

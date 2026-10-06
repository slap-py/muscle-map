"""Inspect source exterior candidates without exporting or inventing a skin surface.
Run through scripts/blender-command.py after saving any open Blender work.
"""
import bpy, json
from pathlib import Path
from mathutils import Matrix
ROOT = Path(__file__).resolve().parents[1]
meta = json.loads((ROOT / 'public/models/bones.manifest.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/source/Startup.blend'), use_scripts=False)
bpy.context.view_layer.update()
transform = Matrix(meta['registration']['sourceWorldToGltfRowMajor'])
def describe(obj):
    record = {'name': obj.name, 'type': obj.type}
    if obj.type == 'MESH':
        points = [transform @ obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        record.update(vertices=len(points), triangles=sum(len(p.vertices)-2 for p in obj.data.polygons))
        if points:
            record['registeredBoundsMm'] = [[min(p[i] for p in points)*1000 for i in range(3)], [max(p[i] for p in points)*1000 for i in range(3)]]
    return record
candidates = [describe(obj) for obj in bpy.data.objects
    if any(key in obj.name.lower() for key in ['gastrocnem', 'skin', 'integument', 'dermis'])]
collections = {name: [describe(obj) for obj in bpy.data.collections[name].all_objects]
    for name in ['Skin', 'Dermis', 'Integument'] if name in bpy.data.collections}
skin_meshes = [record for record in candidates if record['type'] == 'MESH'
    and any(key in record['name'].lower() for key in ['skin', 'integument', 'dermis'])]
result = {'source': bpy.data.filepath, 'candidates': candidates,
    'skinCollections': collections, 'skinMeshFound': bool(skin_meshes),
    'exportStatus': 'candidate inspection required' if skin_meshes else 'stopped: no source skin mesh'}
print(json.dumps(result, indent=2))

import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path('assets/source/Startup.blend').resolve()),use_scripts=False)
for o in bpy.data.objects:
 if any(k in o.name.lower() for k in ['gastrocnem','skin','integument']):print('SOURCE',o.name,o.type, len(o.data.vertices) if o.type=='MESH' else '')

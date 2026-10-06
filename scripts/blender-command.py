"""Send a script to Blender 5.2's MCP extension (NUL-delimited JSON)."""
import json, socket, sys, os
from pathlib import Path
if len(sys.argv) > 1:
    path = Path(sys.argv[1]).resolve()
    code = '__file__ = ' + repr(str(path)) + '\n' + path.read_text(encoding='utf-8-sig')
else:
    code = "import bpy; result = {'file': bpy.data.filepath, 'dirty': bpy.data.is_dirty, 'objects': len(bpy.data.objects)}"
command = {'type': 'execute', 'code': code, 'strict_json': True}
with socket.create_connection(('127.0.0.1', int(os.environ.get('BLENDER_MCP_PORT', '9876'))), timeout=15) as sock:
    sock.settimeout(180)
    sock.sendall(json.dumps(command).encode() + b'\0')
    data = b''
    while b'\0' not in data:
        chunk = sock.recv(65536)
        if not chunk:
            raise RuntimeError('Blender disconnected before returning a complete response')
        data += chunk
    response = json.loads(data.split(b'\0', 1)[0])
    print(json.dumps(response, indent=2))
    if response.get('status') == 'error':
        sys.exit(1)

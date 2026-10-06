"""Send a local command through the running Blender MCP add-on."""
import json, socket, sys, os
from pathlib import Path
command = {'type': 'execute_code', 'params': {'code': "__file__ = " + repr(str(Path(sys.argv[1]).resolve())) + "\n" + Path(sys.argv[1]).read_text(encoding="utf-8-sig")}} if len(sys.argv)>1 else {'type':'get_scene_info','params':{}}
with socket.create_connection(('127.0.0.1',int(os.environ.get('BLENDER_MCP_PORT','9876'))),timeout=15) as sock:
    sock.settimeout(180)
    sock.sendall(json.dumps(command).encode())
    data=b''
    while True:
        chunk=sock.recv(65536)
        if not chunk: raise RuntimeError('Blender disconnected')
        data+=chunk
        try: result=json.loads(data); break
        except json.JSONDecodeError: pass
    print(json.dumps(result,indent=2))
    if result.get('status')=='error': sys.exit(1)


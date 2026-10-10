"""Freeze audited preservation indices or verify a fresh bilateral rebuild.

Usage: python scripts/reproduce-structure-skin.py --freeze-preservation
       python scripts/reproduce-structure-skin.py
The rebuild reuses only the fingerprint-matched surface raster; fields and
meshes are rebuilt, and every compared artifact must reproduce exactly.
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
PARAMETERS=ROOT/'scripts/skin-parameters.json'
ARTIFACTS=['mesh.vertices.bin','mesh.faces.bin','mesh.simplified.bin','lower-exterior.glb','upper-exterior.glb']
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value): path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf8')
parser=argparse.ArgumentParser();parser.add_argument('--freeze-preservation',action='store_true');args=parser.parse_args()
p=read(PARAMETERS)
if args.freeze_preservation:
    preserved={}
    for side in ['right','left']:
        scratch=ROOT/'output/skin'/side; audit=read(ROOT/f'validation/skin-mesh-{side}.json')
        assert audit['passed'], side+' mesh audit must pass before freezing'
        for key,file in [('vertices','mesh.vertices.bin'),('denseFaces','mesh.faces.bin'),('simplifiedFaces','mesh.simplified.bin')]:
            assert audit['inputs'][key]['sha256']==digest(scratch/file), side+' audit is stale'
        locks=np.fromfile(scratch/'mesh.locks.bin',dtype=np.uint8)
        assert len(locks)*12==(scratch/'mesh.vertices.bin').stat().st_size
        file=ROOT/f'scripts/skin-preservation-{side}.json';write(file,np.flatnonzero(locks).tolist())
        preserved[side]=dict(vertexSha256=digest(scratch/'mesh.vertices.bin'),indicesFile=str(file.relative_to(ROOT)).replace('\\','/'),indicesSha256=digest(file))
    p['preservation']=preserved;write(PARAMETERS,p);print('Frozen preservation against current dense-vertex SHA on both sides')
else:
    assert set(p.get('preservation',{}))=={'right','left'}, 'Freeze passing preservation constraints first'
    baseline={side:{name:digest(ROOT/'output/skin'/side/name) for name in ARTIFACTS} for side in ['right','left']}
    report=dict(parameters='scripts/skin-parameters.json',parametersSha256=digest(PARAMETERS),freshFieldsRebuilt=True,matchingSurfaceRasterCacheReused=True,sides={})
    report['pipelineCodeSha256']={name:digest(ROOT/'scripts'/name) for name in ['prepare-structure-skin.py','skin_soft_toes.py','skin_toes.py','skin_hybrid.py','skin_extract.py','skin_winding.py','skin_glb.py']}
    for side in ['right','left']:
        subprocess.run([sys.executable,str(ROOT/'scripts/prepare-structure-skin.py'),'--side',side],cwd=ROOT,check=True)
        records={name:dict(sha256=digest(ROOT/'output/skin'/side/name),freshRebuildMatched=digest(ROOT/'output/skin'/side/name)==baseline[side][name]) for name in ARTIFACTS}
        report['sides'][side]=records
        write(ROOT/'validation/skin-reproducibility.json',report)
        assert all(r['freshRebuildMatched'] for r in records.values()),side+' fresh rebuild differs'
    print('Both fresh fields reproduced all five artifact hashes exactly')

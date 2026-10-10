"""Add modest, reproducible soft-tissue fullness to the audited skin envelope.

Run after prepare-structure-skin.py. Always reads its original output/skin GLBs,
so rerunning never accumulates padding. Deforms only visible skin and its caps.
The underlying source anatomy and hidden reference patches remain byte-identical.
"""
import argparse, copy, hashlib, json
from pathlib import Path
import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator
from scipy.ndimage import gaussian_filter1d
from scipy.spatial import cKDTree
from skin_glb import Glb, Writer
from importlib.machinery import SourceFileLoader

ROOT = Path(__file__).resolve().parents[1]
OFFSET = np.array([16.275487840175627, 589.4165262579918, 15.534035861492157])
PROFILE = np.array([[50,0,0],[90,.025,.10],[200,.075,.25],[300,.09,.30],
                    [400,.06,.25],[450.125,.075,.35],[560,.10,.55],
                    [680,.11,.55],[790,.09,.45],[850,.09,.45]])

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def visible(item):
    return item['id']=='skin' and not item['node'].get('extras',{}).get('sourceReference')

def deformation(vertices):
    # A smooth centerline and elliptical target from both pieces in their common frame.
    bins = np.arange(40, 811, 10, dtype=float)
    centers=[]; radii=[]
    for y in bins:
        section=vertices[np.abs(vertices[:,1]-y)<8][:,[0,2]]
        if not len(section): section=vertices[np.argsort(np.abs(vertices[:,1]-y))[:100]][:,[0,2]]
        low=section.min(0); high=section.max(0)
        centers.append((low+high)/2); radii.append(np.maximum((high-low)/2,10))
    center=CubicSpline(bins,gaussian_filter1d(centers,2,axis=0))
    radius=CubicSpline(bins,gaussian_filter1d(radii,2,axis=0)*1.07)
    scale=PchipInterpolator(PROFILE[:,0],PROFILE[:,1])
    roundness=PchipInterpolator(PROFILE[:,0],PROFILE[:,2])
    def transform(v):
        result=v.copy(); active=v[:,1]>50
        y=np.clip(v[active,1],50,810)
        c=center(y); a=np.maximum(radius(y),10)
        delta=v[active][:,[0,2]]-c
        radial=np.linalg.norm(delta/a,axis=1)
        # Smooth positive gap to the ellipse fills concave muscle grooves outward.
        # Its radial derivative stays positive: each section remains one-to-one.
        gap=1-radial
        fill=.5*(gap+np.sqrt(gap*gap+.04**2))
        factor=1+scale(y)+roundness(y)*fill
        result[np.ix_(active,[0,2])]=c+delta*factor[:,None]
        return result
    return transform

def normal_transform(v,n,transform):
    jacobian=np.empty((len(v),3,3)); epsilon=.01
    for axis in range(3):
        step=np.zeros(3);step[axis]=epsilon
        jacobian[:,:,axis]=(transform(v+step)-transform(v-step))/(2*epsilon)
    determinant=np.linalg.det(jacobian)
    assert determinant.min()>0, 'Fullness must preserve orientation'
    normals=np.linalg.solve(jacobian.transpose(0,2,1),n[...,None])[...,0]
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    return normals,float(determinant.min())

def replace_accessor(writer,index,data):
    a=writer.doc['accessors'][index];bv=writer.doc['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and a['type']=='VEC3' and bv.get('byteStride',12)==12
    start=bv.get('byteOffset',0)+a.get('byteOffset',0)
    writer.binary[start:start+len(data)*12]=np.asarray(data,dtype='<f4').tobytes()
    a.update(min=data.min(0).tolist(),max=data.max(0).tolist())

def run(side):
    offset=OFFSET.copy();offset[2]*=1 if side=='right' else -1
    scratch=ROOT/'output/skin'/side
    sources=[Glb(scratch/'lower-exterior.glb'),Glb(scratch/'upper-exterior.glb')]
    shifts=[np.zeros(3),offset]
    all_vertices=np.concatenate([m['vertices']+shift for source,shift in zip(sources,shifts)
                                 for m in source.meshes() if visible(m) and not m['node'].get('extras',{}).get('skinCap')])
    transform=deformation(all_vertices)
    topology=SourceFileLoader('skin_build',str(ROOT/'scripts/prepare-structure-skin.py')).load_module().topology
    pieces=[];seams=[];publications=[]
    for region,source,shift in zip(['lower','upper'],sources,shifts):
        writer=Writer();writer.doc=copy.deepcopy(source.doc);writer.binary=bytearray(source.binary)
        items=[];moved=[];jacobian_min=1e9
        for m in source.meshes():
            if not visible(m):continue
            p=m['primitive'];old=m['vertices']+shift;updated=transform(old)
            normals=source.accessor(p['attributes']['NORMAL']).astype(float)
            normals,minimum=normal_transform(old,normals,transform);jacobian_min=min(jacobian_min,minimum)
            replace_accessor(writer,p['attributes']['POSITION'],(updated-shift)/1000)
            replace_accessor(writer,p['attributes']['NORMAL'],normals)
            items.append((m,updated,m['faces'],normals))
            moved.append(np.linalg.norm(updated-old,axis=1))
            if m['node'].get('extras',{}).get('capEnd')=='seam':seams.append(updated)
        skin=[i for i in items if not i[0]['node'].get('extras',{}).get('skinCap')]
        assert len(skin)==1
        caps=[(v,f,n) for m,v,f,n in items if m['node'].get('extras',{}).get('skinCap')]
        _,v,f,_=skin[0];audit=topology(v,f,caps)
        assert audit['closed'] and audit['consistentWinding'] and audit['signedVolumeMm3']>0
        destination=ROOT/'public/models'/('left-lower-leg' if side=='left' and region=='lower' else '' if region=='lower' else side+'-upper-leg')
        output=scratch/(region+'-fuller-exterior.glb');output_hash=writer.save(output)
        manifest_path=destination/'exterior.manifest.json';manifest=read(manifest_path)
        record=dict(method='Smooth radial expansion and outward elliptical rounding in shared lower-leg frame',
                    sourceGlbSha256=digest(source.path),profileYmmScaleRoundness=PROFILE.tolist(),
                    source= str(source.path.relative_to(ROOT)).replace('\\','/'),
                    scriptSha256=digest(Path(__file__)),minimumSampledJacobian=jacobian_min,
                    maxOutwardMovementMm=float(np.max(np.concatenate(moved))),
                    topology=audit,illustrative=True)
        manifest.update(glbSha256=output_hash,bytes=output.stat().st_size,topology=audit,softTissueFullness=record)
        manifest['meshValidationScope']='Original pre-fullness envelope. The final fullness transform has independent topology, seam, and positive-Jacobian checks in validation/skin-natural/fullness-geometry.json.'
        publications.append((output,destination/'exterior.glb',manifest_path,manifest))
        pieces.append(dict(region=region,**record,glbSha256=output_hash))
    # The same smooth transform is applied to both duplicated seam loops and caps.
    seam_error=max(cKDTree(seams[0]).query(seams[1])[0].max(),cKDTree(seams[1]).query(seams[0])[0].max())
    assert seam_error < .0002, 'Upper/lower seam mismatch'
    for staged,destination,manifest_path,manifest in publications:
        destination.write_bytes(staged.read_bytes())
        manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    print(side, [(p['region'],round(p['maxOutwardMovementMm'],2)) for p in pieces],flush=True)
    return dict(side=side,seamMatched=True,seamMaxErrorMm=float(seam_error),pieces=pieces)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--side',choices=['left','right']);args=parser.parse_args()
    rows=[run(side) for side in ([args.side] if args.side else ['right','left'])]
    folder=ROOT/'validation/skin-natural';folder.mkdir(exist_ok=True)
    (folder/'fullness-geometry.json').write_text(json.dumps(dict(sides=rows),indent=2)+'\n',encoding='utf8')


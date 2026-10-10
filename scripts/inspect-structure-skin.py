"""Geometry audits for the study crop; outliers and intentional crop exclusions remain explicit."""
import importlib.util, json, sys, gzip
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0,str(Path(__file__).parent))
spec=importlib.util.spec_from_file_location('skin',Path(__file__).with_name('prepare-structure-skin.py'));skin=importlib.util.module_from_spec(spec);spec.loader.exec_module(skin)
ROOT=skin.ROOT

def in_polygon(point,loop):
 y,z=point;ay=loop[:,0];az=loop[:,1];by=np.roll(ay,-1);bz=np.roll(az,-1)
 crossing=((az>z)!=(bz>z))&(y<(by-ay)*(z-az)/(bz-az+1e-30)+ay)
 return bool(np.sum(crossing)%2)

def sections(v,f,x):
 tri=v[f];a=tri.min(1)[:,0];b=tri.max(1)[:,0];tri=tri[(a<x)&(b>x)]
 segments=[]
 for t in tri:
  points=[]
  for i,j in [(0,1),(1,2),(2,0)]:
   if (t[i,0]<x)!=(t[j,0]<x):
    u=(x-t[i,0])/(t[j,0]-t[i,0]);points.append(t[i,1:]+u*(t[j,1:]-t[i,1:]))
  if len(points)==2:segments.append(points)
 if not segments:return []
 segments=np.array(segments)
 points,iv=np.unique(np.round(segments.reshape(-1,2),6),axis=0,return_inverse=True);edges=iv.reshape(-1,2);adj={}
 for a,b in edges:
  adj.setdefault(int(a),[]).append(int(b));adj.setdefault(int(b),[]).append(int(a))
 remaining=set(adj);loops=[]
 while remaining:
  first=min(remaining);path=[first];prev=None;current=first
  for _ in range(len(adj)+1):
   choices=adj[current];following=next((i for i in choices if i!=prev),None)
   if following is None or following==first:break
   if following in path:break
   path.append(following);prev,current=current,following
  remaining.difference_update(path)
  if len(path)>2:loops.append(points[path])
 return loops

def loop_distance(a,b):
 def points_segments(points,line):
  start=line;edge=np.roll(line,-1,axis=0)-line
  delta=points[:,None,:]-start[None,:,:]
  t=np.clip(np.sum(delta*edge[None,:,:],axis=2)/np.maximum(np.sum(edge**2,axis=1)[None,:],1e-30),0,1)
  return float(np.linalg.norm(delta-t[:,:,None]*edge[None,:,:],axis=2).min())
 return min(points_segments(a,b),points_segments(b,a))

def toe_audit(side,meshes,v,f):
 bones={i:np.concatenate([m['vertices'] for m in meshes if m['region']=='lower' and m['id'].startswith(f'phalanx-{i}-')]) for i in range(1,6)}
 toe_faces=[m for m in meshes if m['region']=='lower' and m['id'].startswith('phalanx-')]
 # Only the toe/forefoot skin is relevant to plane sections.
 keep=(v[f,:,] if False else np.max(v[f,1],axis=1)<10)&(np.max(v[f,0],axis=1)>80)
 vf=f[keep];report=[]
 for i in range(1,5):
  start=max(bones[i][:,0].min(),bones[i+1][:,0].min());end=min(bones[i][:,0].max(),bones[i+1][:,0].max())
  values=[]
  for x in np.linspace(start+.1,end-.1,60):
   loops=sections(v,vf,x);centers={}
   for toe in [i,i+1]:
    samples=bones[toe][np.abs(bones[toe][:,0]-x)<1]
    if len(samples):centers[toe]=samples[:,1:].mean(0)
   if len(centers)!=2:continue
   owners={toe:next((li for li,loop in enumerate(loops) if in_polygon(center,loop)),None) for toe,center in centers.items()}
   if any(a is None for a in owners.values()):gap=None
   elif owners[i]==owners[i+1]:gap=0.0
   else:gap=loop_distance(loops[owners[i]],loops[owners[i+1]])
   values.append(dict(xMm=float(x),gapMm=gap))
  measurable=[q for q in values if q['gapMm'] is not None]
  fraction=sum(q['gapMm']>=.5 for q in measurable)/max(len(values),1)
  report.append(dict(pair=[i,i+1],commonToeLengthMm=float(end-start),sampledSections=len(values),unmeasurableSections=len(values)-len(measurable),fractionWithGapAtLeastHalfMm=fraction,requiredFraction=.6,passed=fraction>=.6,sections=values))
 return report

def run(side):
 scratch=skin.OUT/side;build=skin.read_json(scratch/'build.json');origin=np.array(build['grid']['originMm']);h=build['grid']['spacingMm'];p=build['parameters']
 field=np.load(scratch/'field.npy',mmap_mode='r');thickness=np.load(scratch/'thickness.npy',mmap_mode='r')
 meshes,sources,*_=skin.load_inputs(side)
 fine=None;fo=None;fh=None
 if build.get('fineFoot'):
  fine=np.load(scratch/'fine-foot.npy',mmap_mode='r');fo=np.array(build['fineFoot']['originMm']);fh=build['fineFoot']['spacingMm']
 outliers=[];crop=[];total=inside_count=eligible_count=0
 vertices=[];faces=[];offset=0
 for mi,m in enumerate(meshes):
  v=m['vertices'];total+=len(v);eligible=v[:,1]<=p['proximalYLowerMm'];eligible_count+=int(eligible.sum())
  sdf=map_coordinates(field,((v-origin)/h).T,order=1,mode='nearest')
  if fine is not None:
   q=(v-fo)/fh;use=np.all((q>=0)&(q<=np.array(fine.shape)-1),axis=1)
   sdf[use]=map_coordinates(fine,q[use].T,order=1,mode='nearest')
  outside=np.flatnonzero(eligible&(sdf>0));inside_count+=int(np.sum(eligible&(sdf<=0)))
  if len(outside):outliers.append(dict(meshIndex=mi,region=m['region'],id=m['id'],vertexIndices=outside.tolist(),positionsMm=v[outside].tolist(),fieldMm=sdf[outside].tolist()))
  excluded=np.flatnonzero(~eligible)
  if len(excluded):crop.append(dict(meshIndex=mi,region=m['region'],id=m['id'],vertexIndices=excluded.tolist(),positionsMm=v[excluded].tolist()))
  vertices.append(v);faces.append(m['faces']+offset);offset+=len(v)
 allv=np.concatenate(vertices).astype('<f4');allf=np.concatenate(faces).astype('<u4')
 allv.tofile(scratch/'source.vertices.bin');allf.tofile(scratch/'source.faces.bin')
 dense=np.load(scratch/'simplified.npz');v=dense['vertices'];f=dense['faces']
 used=np.unique(f);sample_ids=used[np.linspace(0,len(used)-1,10000).astype(int)];sample=v[sample_ids]
 intended=map_coordinates(thickness,((sample-origin)/h).T,order=1,mode='nearest')
 # Free toe field intentionally uses its independent thickness.
 heads=sorted([(pad['centerMm'][2],pad['centerMm'][0]) for pad in build['landmarkPads'] if pad['bone'].startswith('metatarsal')])
 threshold=np.interp(sample[:,2],[a for a,b in heads],[b for a,b in heads])+p['webDistalMm']+p['webBlendMm']
 intended[(sample[:,1]<30)&(sample[:,0]>threshold)]=p.get('toeDorsalPaddingMm',p['toeThicknessMm']) if p.get('smoothToeEnvelopes') else p['toeThicknessMm']
 sample.astype('<f4').tofile(scratch/'clearance.samples.bin');intended.astype('<f4').tofile(scratch/'clearance.intended.bin')
 # Single component is checked independently of manifold edge counts.
 part_metrics=[]
 for region in ['lower','upper']:
  data=np.load(scratch/f'{region}-piece.npz');faces=data['faces'];used=np.unique(faces);local=np.searchsorted(used,faces)
  a=np.concatenate([local[:,0],local[:,1],local[:,2]]);b=np.concatenate([local[:,1],local[:,2],local[:,0]])
  graph=coo_matrix((np.ones(len(a)),(a,b)),shape=(len(used),len(used))).tocsr()
  count,_=connected_components(graph,directed=False);part_metrics.append(dict(region=region,skinComponents=int(count),passed=count==1))
 toes=toe_audit(side,meshes,v,f)
 with gzip.open(ROOT/f'validation/skin-outliers-{side}.json.gz','wt',encoding='utf8') as out:json.dump(dict(outliers=outliers,cropExclusions=crop),out)
 report=dict(side=side,containment=dict(method='Trilinear sign of the construction field including the independent fine foot grid; decimated surface error is audited separately',allSourceVertices=total,studyCropVertices=eligible_count,insideStudyCropVertices=inside_count,studyCropFraction=inside_count/max(eligible_count,1),allSourceFraction=inside_count/max(total,1),outlierCount=sum(len(r['vertexIndices']) for r in outliers),intentionalProximalCropExclusions=total-eligible_count,requiredFraction=.999,passedWithinStudyCrop=inside_count/max(eligible_count,1)>=.999,passedForAllUncroppedSources=inside_count/max(total,1)>=.999,outlierFile=f'validation/skin-outliers-{side}.json.gz'),components=part_metrics,toes=toes,pads=build['landmarkPads'])
 skin.dump(ROOT/f'validation/skin-geometry-{side}.json',report)
 log=dict(side=side,containment=report['containment'],components=part_metrics,toes=[{k:q[k] for k in ['pair','fractionWithGapAtLeastHalfMm','passed']} for q in toes]);print(json.dumps(log,indent=2))

if __name__=='__main__':
 for side in sys.argv[1:] or ['right','left']:run(side)


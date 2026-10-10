"""Build illustrative skin from both of a side's own structure packs.

Usage: python scripts/prepare-structure-skin.py --side right --prototype
       python scripts/prepare-structure-skin.py --side right [--publish]
Inputs are surface sampled, never classified by inside tests. Fields, not meshes,
are smoothed. Scratch products stay in output/skin; only --publish replaces GLBs.
"""
import argparse, hashlib, importlib.metadata, json, math, subprocess, time
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from skimage.measure import marching_cubes
from skin_glb import Glb, Writer

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/skin'
OFFSETS={'right':np.array([16.275487840175627,589.4165262579918,15.534035861492157]),
         'left':np.array([16.275487840175627,589.4165262579918,-15.534035861492157])}

def read_json(path):
 return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def dump(path,value):
 Path(path).write_text(json.dumps(value,indent=2),encoding='utf8')
def log(*args):print(*args,flush=True)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

VALIDATOR_SPACING_MM=0.15

def audit_number(value):
 try:return float(value)
 except (TypeError,ValueError):return float('nan')

def read_existing_audit(path):
 try:
  value=read_json(path)
  return value if isinstance(value,dict) else {}
 except (OSError,TypeError,ValueError,UnicodeError):return {}

def mesh_audit_status(audit,side,prefix,p):
 reasons=[]
 if not isinstance(audit,dict): reasons.append('missing or invalid report')
 if isinstance(audit,dict) and audit.get('side')!=side: reasons.append('report side does not match requested side')
 limit=float(p.get('hausdorffLimitMm',0.3));spacing=float(p.get('surfaceValidationSpacingMm',VALIDATOR_SPACING_MM))
 if not math.isclose(spacing,VALIDATOR_SPACING_MM,rel_tol=0,abs_tol=1e-9):
  raise ValueError(f'Configured surfaceValidationSpacingMm={spacing:g} cannot be passed to validate-structure-skin.mjs; its fixed spacing is {VALIDATOR_SPACING_MM:g} mm')
 hausdorff=audit.get('hausdorff',{}) if isinstance(audit,dict) else {}
 if not isinstance(hausdorff,dict): hausdorff={}
 if not math.isclose(audit_number(hausdorff.get('limitMm')),limit,rel_tol=0,abs_tol=1e-9): reasons.append('audit Hausdorff limit differs from configured limit')
 if not math.isclose(audit_number(hausdorff.get('spacingMm')),spacing,rel_tol=0,abs_tol=1e-9): reasons.append('audit validation spacing differs from configured spacing')
 expected={'vertices':sha(str(prefix)+'.vertices.bin'),'denseFaces':sha(str(prefix)+'.faces.bin'),'simplifiedFaces':sha(str(prefix)+'.simplified.bin')}
 inputs=audit.get('inputs',{}) if isinstance(audit,dict) else {}
 if not isinstance(inputs,dict): inputs={}
 for key,value in expected.items():
  item=inputs.get(key,{})
  if not isinstance(item,dict) or item.get('sha256')!=value: reasons.append(f'{key} input hash is stale')
 if audit.get('targetTriangles')!=p['targetTriangles']: reasons.append('audit desired triangle target differs from configuration')
 if audit.get('budgetTriangles',audit.get('targetTriangles'))!=p.get('maximumTriangles',p['targetTriangles']): reasons.append('audit maximum triangle budget differs from configuration')
 if not isinstance(audit,dict) or audit.get('passed') is not True: reasons.append('audit did not pass')
 return len(reasons)==0,reasons

def ensure_mesh_audit(side,prefix,p,validation_path):
 audit=read_existing_audit(validation_path)
 current,reasons=mesh_audit_status(audit,side,prefix,p)
 if current:
  log('mesh audit current and passing',side)
  return audit
 limit=float(p.get('hausdorffLimitMm',0.3))
 log('refreshing mesh audit',side,'; '.join(reasons) if reasons else 'report absent')
 command=['node',str(ROOT/'scripts/validate-structure-skin.mjs'),side,f'--limit-mm={limit:g}']
 completed=subprocess.run(command,check=False,cwd=ROOT)
 log('mesh audit exit',completed.returncode)
 audit=read_existing_audit(validation_path)
 return audit
def load_inputs(side):
 lower=ROOT/'public/models'/('left-lower-leg' if side=='left' else '')
 upper=ROOT/f'public/models/{side}-upper-leg'
 result=[];sources=[]
 for region,base,offset in [('lower',lower,np.zeros(3)),('upper',upper,OFFSETS[side])]:
  for group in ['bones','muscles','exterior','neurovascular']:
   path=base/f'{group}.glb';source=Glb(path)
   if group!='exterior':sources.append(dict(path=str(path.relative_to(ROOT)),sha256=sha(path)))
   retained=hashlib.sha256()
   for m in source.meshes():
    if m['id']=='skin' or m['node'].get('extras',{}).get('sourceReference'):continue
    retained.update(m['vertices'].astype('<f8').tobytes());retained.update(m['faces'].astype('<u4').tobytes())
    m['vertices']+=offset;m['region']=region;m['group']=group
    result.append(m)
   if group=='exterior' and region=='lower':sources.append(dict(path=str(path.relative_to(ROOT)),retainedStructureSha256=retained.hexdigest(),included='gastrocnemius only; old skin excluded'))
 soft=ROOT/f'output/skin-input/{side}-soft.json'
 if soft.exists():
  meta=read_json(soft);data=(soft.with_suffix('.bin')).read_bytes()
  # Build utility metadata is one record per geometry.
  for item in meta['records']:
   v=np.frombuffer(data,dtype='<f4',count=item['vertexCount']*3,offset=item['vertexOffsetBytes']).reshape(-1,3).astype(float)
   f=np.frombuffer(data,dtype='<u4',count=item['indexCount'],offset=item['indexOffsetBytes']).reshape(-1,3).copy()
   result.append(dict(id=item['id'],name=item['id'],vertices=v,faces=f,region='lower',group='procedural'))
  sources.append(dict(path=str(soft.relative_to(ROOT)),layoutSha256=hashlib.sha256(json.dumps(meta['records'],sort_keys=True).encode()).hexdigest(),binarySha256=sha(soft.with_suffix('.bin'))))
 else:raise FileNotFoundError('Generate own-side procedural soft inputs with the skin-export Vitest config first')
 return result,sources,lower,upper

def triangle_samples(v,f,spacing):
 """Regular barycentric lattice, maximum grid edge <= spacing, deterministic."""
 for batch in range(0,len(f),12000):
  tri=v[f[batch:batch+12000]]
  edges=np.stack([np.linalg.norm(tri[:,1]-tri[:,0],axis=1),np.linalg.norm(tri[:,2]-tri[:,0],axis=1),np.linalg.norm(tri[:,2]-tri[:,1],axis=1)],axis=1)
  ns=np.maximum(1,np.ceil(edges.max(1)/spacing).astype(int))
  for n in np.unique(ns):
   selected=tri[ns==n];a,b=np.triu_indices(n+1)
   # a <= b; barycentric u=a/n, v=(b-a)/n.
   uv=np.column_stack([a/n,(b-a)/n])
   size=max(1,200000//len(uv))
   for i in range(0,len(selected),size):
    t=selected[i:i+size]
    yield (t[:,0,None,:]+uv[None,:,0,None]*(t[:,1,None,:]-t[:,0,None,:])+uv[None,:,1,None]*(t[:,2,None,:]-t[:,0,None,:])).reshape(-1,3)

def raster(meshes,origin,shape,h,spacing,top):
 shell=np.zeros(shape,bool);toes=np.zeros(shape,np.uint8);count=0
 for mi,m in enumerate(meshes):
  f=m['faces'];v=m['vertices'];f=f[np.min(v[f,1],axis=1)<=top]
  # Ignore triangles entirely above the prototype/crop.
  toe=int(m['id'].split('-')[1]) if m['id'].startswith('phalanx-') else 0
  for points in triangle_samples(v,f,spacing):
   points=points[points[:,1]<=top]
   q=np.rint((points-origin)/h).astype(np.int32)
   good=np.all((q>=0)&(q<np.array(shape)),axis=1);q=q[good]
   shell[tuple(q.T)]=True
   if toe:toes[tuple(q.T)]=toe
   count+=len(q)
  if mi%35==0:log('raster',mi+1,'/',len(meshes),'samples',count)
 return shell,toes,count

def ball(radius,h):
 r=int(math.ceil(radius/h));x=np.arange(-r,r+1)
 return x[:,None,None]**2+x[None,:,None]**2+x[None,None,:]**2<=(radius/h)**2

def largest(mask):
 labels,n=ndi.label(mask)
 counts=np.bincount(labels.ravel());counts[0]=0
 result=labels==counts.argmax()
 return result,dict(components=int(n),removedVoxels=int(mask.sum()-result.sum()))

def pads_from_bones(meshes,params):
 result=[]
 for p in params['pads']:
  v=np.concatenate([m['vertices'] for m in meshes if m['region']==p.get('region','lower') and m['id']==p['bone']])
  if p['selection']=='anterior-patella':
   point=v[v[:,0]>np.quantile(v[:,0],.8)].mean(0)
  elif p['selection']=='anterior-crest':
   select=v[(v[:,1]>60)&(v[:,1]<280)];point=select[select[:,0]>np.quantile(select[:,0],.95)].mean(0)
  elif p['selection']=='posterior-tuberosity':
   select=v[v[:,1]<=-25]
   point=select[np.argmin(select[:,0])]
  elif p['selection']=='posterior-plantar':
   select=v[v[:,0]<np.quantile(v[:,0],.12)]
   point=select[select[:,1]<np.quantile(select[:,1],.35)].mean(0)
  else:
   select=v[v[:,0]>np.quantile(v[:,0],.90)]
   point=select[select[:,1]<np.quantile(select[:,1],.40)].mean(0)
  result.append(dict(**p,centerMm=point.tolist()))
 return result

def make_field(shell,toes,origin,h,meshes,p):
 shape=shell.shape
 # All distance processing for separate toes is bounded to the foot crop.
 foot_y=min(shape[1],int(math.ceil((30-origin[1])/h)))
 foot_x=max(0,int((65-origin[0])/h))
 sl=(slice(foot_x,None),slice(None,foot_y),slice(None))
 foot_origin=origin+np.array([foot_x*h,0,0])
 foot_shell=shell[sl].copy();toe_labels=toes[sl];del toes
 xyz=[foot_origin[i]+np.arange(foot_shell.shape[i])*h for i in range(3)]
 head_points=[]
 for i in range(1,6):
  v=np.concatenate([m['vertices'] for m in meshes if m['region']=='lower' and m['id']==f'metatarsal-{i}'])
  head_points.append(v[v[:,0]>np.quantile(v[:,0],.95)].mean(0))
 head_points=np.array(head_points);order=np.argsort(head_points[:,2])
 head_x=np.interp(xyz[2],head_points[order,2],head_points[order,0])
 free=xyz[0][:,None,None] > head_x[None,None,:]+p['webDistalMm']
 free=np.broadcast_to(free,foot_shell.shape)
 toe_dist=[];bone_dist=[]
 for i in range(1,6):
  bone=toe_labels==i
  bone_dist.append(ndi.distance_transform_edt(~bone,sampling=h).astype(np.float32))
 nearest=np.argmin(np.stack(bone_dist),axis=0)+1
 toe_extents=[]
 for i in range(1,6):
  local=((nearest==i)&foot_shell&free)|(toe_labels==i)
  # Flood fill the densely sampled individual surface without morphological closing.
  local=ndi.binary_fill_holes(local)
  d=ndi.distance_transform_edt(~local,sampling=h).astype(np.float32)
  toe_dist.append(d-p['toeThicknessMm'])
  toe_extents.append(int(local.sum()))
 del bone_dist,nearest,toe_labels
 # Main-foot work has no free-toe closing. Web bridge is only proximal.
 main=shell.copy();main_foot=main[sl]
 main_foot[free]=False
 log('closing',shape,'voxels',int(np.prod(shape)))
 # Euclidean closing scales to broader soft tissue without cubic kernels.
 radius=p['closingRadiusMm']
 main=ndi.distance_transform_edt(~main,sampling=h)<=radius
 main=ndi.distance_transform_edt(main,sampling=h)>radius
 main=ndi.binary_fill_holes(main)
 # Source crop rims can leave tunnels connected to the outside. Flood-fill
 # each axial section before the 3D outside fill; no convex hull or fitted rings.
 if p.get('sectionFloodFill',False):
  for iy in range(main.shape[1]):main[:,iy,:]=ndi.binary_fill_holes(main[:,iy,:])
 main=ndi.binary_fill_holes(main)
 # Keep the body's main component before inflating.
 main,cc=largest(main);log('solid',int(main.sum()),cc)
 distance=ndi.distance_transform_edt(~main,sampling=h).astype(np.float32)
 if p.get('signedBodyField',False):
  distance-=ndi.distance_transform_edt(main,sampling=h).astype(np.float32)
 del main
 thickness=np.broadcast_to(np.interp(origin[1]+np.arange(shape[1])*h,*np.array(p['thicknessProfile']).T)[None,:,None],shape).astype(np.float32).copy()
 pads=pads_from_bones(meshes,p)
 xs=origin[0]+np.arange(shape[0])*h;ys=origin[1]+np.arange(shape[1])*h;zs=origin[2]+np.arange(shape[2])*h
 for pad in pads:
  c=np.array(pad['centerMm']);s=np.array(pad['sigmaMm'])
  weight=np.exp(-.5*((xs-c[0])/s[0])**2)[:,None,None]*np.exp(-.5*((ys-c[1])/s[1])**2)[None,:,None]*np.exp(-.5*((zs-c[2])/s[2])**2)[None,None,:]
  thickness+=pad['amplitudeMm']*weight.astype(np.float32)
 thickness=ndi.gaussian_filter(thickness,p['thicknessSmoothingMm']/h,mode='nearest')
 field=distance-thickness;del distance
 field=ndi.gaussian_filter(field,p['fieldSmoothingVoxels'])
 # Cap main-foot expansion in the free toe zone so only per-toe skins define it.
 local_field=field[sl]
 distal_offset=xyz[0][:,None,None]-head_x[None,None,:]-p['webDistalMm']
 toe_field=np.minimum.reduce(toe_dist)
 toe_field=ndi.gaussian_filter(toe_field,p['toeFieldSmoothingVoxels'])
 # Proximal web transition only; beyond blend region the main foot cannot bridge toes.
 gate=np.clip(distal_offset/p['webBlendMm'],0,1)
 main_gate=np.maximum(local_field,(gate-.5)*2*p['webBlendMm'])
 fillet_width=p.get('webFilletMm',2)
 fillet=np.maximum(fillet_width-np.abs(main_gate-toe_field),0)/fillet_width
 local_field[:]=np.minimum(main_gate,toe_field)-fillet_width*.25*fillet*fillet
 # No mesh smoothing. Remove isolated field islands after union.
 inside,final_cc=largest(field<=0)
 field=np.where((field<=0)&~inside,1.0,field).astype(np.float32)
 return field,thickness,pads,dict(mainComponent=cc,skinComponent=final_cc,toeSolidVoxels=toe_extents)

def largest_surface(v,f,n):
 a=np.concatenate([f[:,0],f[:,1],f[:,2]]);b=np.concatenate([f[:,1],f[:,2],f[:,0]])
 graph=coo_matrix((np.ones(len(a)),(a,b)),shape=(len(v),len(v))).tocsr()
 count,labels=connected_components(graph,directed=False)
 face_labels=labels[f[:,0]];sizes=np.bincount(face_labels);selected=face_labels==sizes.argmax()
 removed=int(np.sum(~selected));f=f[selected];used=np.unique(f)
 return v[used],np.searchsorted(used,f).astype(np.uint32),n[used],dict(surfaceComponentsBefore=int(np.sum(sizes>0)),removedInnerSurfaceTriangles=removed)

def normals_from_field(field,verts,origin,h):
 coords=((verts-origin)/h).T
 normals=np.zeros_like(verts)
 for axis in range(3):
  grad=np.gradient(field,h,axis=axis).astype(np.float32)
  normals[:,axis]=ndi.map_coordinates(grad,coords,order=1,mode='nearest')
  del grad
 normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
 return normals

def clip(v,f,n,y,above):
 """Plane split with shared edge intersections; the skin remains open."""
 vertices=v.tolist();normals=n.tolist();edge_cache={}
 inside=(v[:,1]>=y) if above else (v[:,1]<=y)
 full=np.all(inside[f],axis=1);crossing=np.any(inside[f],axis=1)&~full
 faces=f[full].tolist()
 for face in f[crossing]:
  polygon=[]
  for a,b in zip(face,np.roll(face,-1)):
   ina=(v[a,1]>=y) if above else (v[a,1]<=y)
   inb=(v[b,1]>=y) if above else (v[b,1]<=y)
   if ina:polygon.append(int(a))
   if ina != inb:
    key=tuple(sorted((int(a),int(b))))
    index=edge_cache.get(key)
    if index is None:
     t=(y-v[a,1])/(v[b,1]-v[a,1]);point=v[a]+t*(v[b]-v[a]);point[1]=y
     normal=n[a]+t*(n[b]-n[a]);normal/=max(np.linalg.norm(normal),1e-12)
     index=len(vertices);vertices.append(point.tolist());normals.append(normal.tolist());edge_cache[key]=index
    polygon.append(index)
  for i in range(1,len(polygon)-1):
   if len(set([polygon[0],polygon[i],polygon[i+1]]))==3:faces.append([polygon[0],polygon[i],polygon[i+1]])
 vertices=np.asarray(vertices);normals=np.asarray(normals);faces=np.asarray(faces,np.uint32)
 # Merge original plane vertices and coincident edge intersections exactly.
 used=np.unique(faces);vertices=vertices[used];normals=normals[used];faces=np.searchsorted(used,faces)
 keys=np.round(vertices,7);unique,idx,inv=np.unique(keys,axis=0,return_index=True,return_inverse=True)
 faces=inv[faces];vertices=vertices[idx];normals=normals[idx]
 good=np.logical_and.reduce([faces[:,0]!=faces[:,1],faces[:,1]!=faces[:,2],faces[:,0]!=faces[:,2]])
 good &= ~np.all(np.abs(vertices[faces,1]-y)<1e-7,axis=1)
 return vertices,faces[good].astype(np.uint32),normals

def loops_at(v,f,y):
 edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
 keys=np.sort(edges,axis=1);unique,counts=np.unique(keys,axis=0,return_counts=True)
 boundary=unique[(counts==1)&np.all(np.abs(v[unique,1]-y)<1e-4,axis=1)]
 adjacency={}
 for a,b in boundary:
  adjacency.setdefault(int(a),[]).append(int(b));adjacency.setdefault(int(b),[]).append(int(a))
 assert all(len(neighbors)==2 for neighbors in adjacency.values()),'Non-loop cut boundary'
 remaining=set(adjacency);loops=[]
 while remaining:
  first=min(remaining);loop=[first];previous=None;current=first
  while True:
   choices=adjacency[current];following=choices[0] if choices[0]!=previous else choices[1]
   if following==first:break
   loop.append(following);previous,current=current,following
   assert len(loop)<=len(adjacency)
  remaining.difference_update(loop);loops.append(loop)
 return sorted(loops,key=lambda loop:abs(np.cross(v[loop][:,[0,2]],np.roll(v[loop][:,[0,2]],-1,axis=0)).sum()),reverse=True)

def cap(v,f,y,end,normal_sign,scratch):
 loops=loops_at(v,f,y);assert len(loops)==1,f'Cut has {len(loops)} loops, requires one outer loop'
 points=v[loops[0]].copy();prefix=scratch/f'cap-{end}-{normal_sign}'
 dump(str(prefix)+'.json',dict(points=points[:,[0,2]].tolist()))
 subprocess.run(['node',str(ROOT/'scripts/skin-mesh-tools.mjs'),'cap',str(prefix)],check=True,cwd=ROOT)
 faces=np.fromfile(str(prefix)+'.faces.bin',dtype='<u4').reshape(-1,3)
 cross=np.cross(points[faces[:,1]]-points[faces[:,0]],points[faces[:,2]]-points[faces[:,0]])[:,1]
 if np.mean(cross)*normal_sign<0:faces=faces[:,[0,2,1]]
 normals=np.tile([0,normal_sign,0],(len(points),1))
 return points,faces,normals

def topology(v,f,caps):
 vv=[v];ff=[f];offset=len(v)
 for cv,cf,_ in caps:
  vv.append(cv);ff.append(cf+offset);offset+=len(cv)
 vv=np.concatenate(vv);ff=np.concatenate(ff)
 _,indices=np.unique(np.round(vv,5),axis=0,return_inverse=True);ff=indices[ff]
 directed=np.concatenate([ff[:,[0,1]],ff[:,[1,2]],ff[:,[2,0]]]);directions=np.where(directed[:,0]<directed[:,1],1,-1)
 edges=np.sort(directed,axis=1)
 _,inverse,counts=np.unique(edges,axis=0,return_inverse=True,return_counts=True)
 direction_sums=np.bincount(inverse,weights=directions,minlength=len(counts));winding_disagreements=int(np.sum((counts==2)&(direction_sums!=0)))
 actual_faces=np.concatenate([f]+[cf+sum(len(a) for a in [v]+[c[0] for c in caps[:i]]) for i,(_,cf,_) in enumerate(caps)])
 volume=float(np.einsum('ij,ij->i',vv[actual_faces[:,0]],np.cross(vv[actual_faces[:,1]],vv[actual_faces[:,2]])).sum()/6)
 return dict(closed=bool(np.all(counts==2)),consistentWinding=winding_disagreements==0,windingDisagreements=winding_disagreements,edgeIncidences={str(int(i)):int(np.sum(counts==i)) for i in np.unique(counts)},signedVolumeMm3=volume)

def field_code_hashes():
 return {name:sha(ROOT/'scripts'/name) for name in ['prepare-structure-skin.py','skin_soft_toes.py','skin_toes.py','skin_hybrid.py','skin_extract.py','skin_winding.py']}

def run(side,p,prototype,publish,reuse_field=False):
 p=dict(p);p['quadricErrorMm']=p.get('sideQuadricErrorMm',{}).get(side,p['quadricErrorMm'])
 started=time.time();scratch=OUT/(side+('-foot' if prototype else ''));scratch.mkdir(parents=True,exist_ok=True)
 meshes,sources,lower,upper=load_inputs(side)
 top=90 if prototype else p['proximalYLowerMm']+p['inputCropPaddingMm']
 points=np.concatenate([m['vertices'][m['vertices'][:,1]<=top] for m in meshes])
 h=p['gridMm'];origin=np.floor((points.min(0)-p['boundsPaddingMm'])/h)*h
 maximum=points.max(0)+p['boundsPaddingMm'];maximum[1]=top+p['boundsPaddingMm']
 shape=tuple((np.ceil((maximum-origin)/h)+1).astype(int))
 shell_cache=scratch/'raster.npz'
 fingerprint=hashlib.sha256(json.dumps(dict(sources=sources,top=top,h=h,spacing=p['sampleSpacingMm'],origin=origin.tolist(),shape=list(map(int,shape))),sort_keys=True).encode()).hexdigest()
 if shell_cache.exists() and read_json(scratch/'raster.json').get('fingerprint')==fingerprint:
  data=np.load(shell_cache);shell=data['shell'];toes=data['toes'];sample_count=read_json(scratch/'raster.json')['samples'];log('cached raster',shape)
 else:
  shell,toes,sample_count=raster(meshes,origin,shape,h,p['sampleSpacingMm'],top)
  np.savez_compressed(shell_cache,shell=shell,toes=toes);dump(scratch/'raster.json',dict(fingerprint=fingerprint,samples=sample_count))
 if reuse_field and (scratch/'dense.npz').exists():
  dense=np.load(scratch/'dense.npz');vv=dense['vertices'];ff=dense['faces'];nn=dense['normals'];report=read_json(scratch/'build.json');report['sources']=sources
  field_keys=['gridMm','sampleSpacingMm','closingRadiusMm','thicknessSmoothingMm','fieldSmoothingVoxels','toeThicknessMm','toeFieldSmoothingVoxels','webDistalMm','webBlendMm','thicknessProfile','pads','proximalYLowerMm','inputCropPaddingMm','boundsPaddingMm','flatSole','sectionFloodFill','webFilletMm','toeSectionEnvelopes','extractionGridMm','extractionSlabIntervals','skinToeGaussianSigmaVoxels','skinSectionThicknessMm','skinToeCarveIterations','skinToeMoatField','skinToeSourceRepairClearanceMm','skinCropXMinMm','skinCropTopYMm','hybridExtraction','hybridExtractionType','hybridFinePlaneYmm','hybridCoarsePlaneYmm','hybridFootYMaxMm','hybridFinePlaneXmm','hybridCoarsePlaneXmm']
  field_keys+=['signedBodyField','smoothToeEnvelopes','toeGapMm','toeProfileSmoothingMm','toeDorsalPaddingMm','toeLateralPaddingMm','toeRootBlendMm']
  assert all(report['parameters'].get(k)==p.get(k) for k in field_keys),'Cached field parameters changed; rebuild without --reuse-field'
  if report.get('fieldCodeSha256'):
   assert report['fieldCodeSha256']==field_code_hashes(),'Cached field implementation changed; rebuild without --reuse-field'
  report['parameters']=p;report['notes']=p['limitations']
 else:
  field,thickness,pads,cc=make_field(shell,toes,origin,h,meshes,p)
  fine_foot=None
  if p.get('toeSectionEnvelopes',False):
   from skin_toes import build_fine_foot
   log('independent section toe fields')
   fine_foot=build_fine_foot(shell,toes,origin,h,meshes,p,field)
   fine=fine_foot['field'];fo=fine_foot['origin'];start=np.rint((fo-origin)/h).astype(int)
   coarse=fine[::2,::2,::2];stop=start+np.array(coarse.shape)
   field[tuple(slice(a,b) for a,b in zip(start,stop))]=coarse
   np.save(scratch/'fine-foot.npy',fine);dump(scratch/'fine-foot.json',fine_foot['metadata'])
  del shell,toes
  log('extracting',shape)
  extraction_h=p.get('extractionGridMm',h)
  hybrid_meta=None
  if p.get('hybridExtraction',False):
   if fine_foot is None:
    raise ValueError('hybridExtraction requires toeSectionEnvelopes and a fine-foot field')
   from skin_hybrid import extract_hybrid, extract_hybrid_x
   override=(fine_foot['field'],fine_foot['origin'],fine_foot['spacing'])
   hybrid_type=p.get('hybridExtractionType','y-collar')
   if hybrid_type in ('foot-x-collar','toe-x-collar','x-collar'):
    vv,ff,nn,hybrid_meta=extract_hybrid_x(field,origin,h,override,p)
   elif hybrid_type in ('y-collar','ankle-y-collar'):
    vv,ff,nn,hybrid_meta=extract_hybrid(field,origin,h,override,p)
   else:
    raise ValueError(f'Unsupported hybridExtractionType: {hybrid_type!r}')
  elif extraction_h!=h:
   from skin_extract import extract_field_slabs
   override=(fine_foot['field'],fine_foot['origin'],fine_foot['spacing']) if fine_foot else None
   vv,ff,nn=extract_field_slabs(field,origin,h,extraction_h,override,p.get('extractionSlabIntervals',32))
  else:
   vv,ff,_,_=marching_cubes(field,0,spacing=(h,h,h),allow_degenerate=False,gradient_direction='ascent')
   vv+=origin;nn=normals_from_field(field,vv,origin,h)
  # Enforce outward winding by the gradient, independent of library convention.
  cross=np.cross(vv[ff[:,1]]-vv[ff[:,0]],vv[ff[:,2]]-vv[ff[:,0]])
  flip=np.einsum('ij,ij->i',cross,nn[ff].mean(1))<0
  ff[flip]=ff[flip][:,[0,2,1]]
  np.savez_compressed(scratch/'dense.npz',vertices=vv,faces=ff,normals=nn,origin=origin)
  np.save(scratch/'field.npy',field);np.save(scratch/'thickness.npy',thickness)
  report=dict(side=side,prototype=prototype,skinSource='structure-envelope',parameters=p,sources=sources,fieldCodeSha256=field_code_hashes(),
   inputMeshes=len(meshes),sourceSurfaceSamples=sample_count,grid=dict(originMm=origin.tolist(),spacingMm=h,shape=list(map(int,shape)),voxels=int(np.prod(shape))),
   componentProcessing=cc,landmarkPads=pads,denseTriangles=len(ff),elapsedSeconds=time.time()-started,
   registration=dict(constructionFrame='side-specific lower talus datum',upperToLowerOffsetMm=OFFSETS[side].tolist(),export='metres, identity transforms; upper output offset restored'),
   notes=p['limitations'])
  if fine_foot:report['fineFoot']=fine_foot['metadata']
  if hybrid_meta is not None:report['hybridExtraction']=hybrid_meta
  dump(scratch/'build.json',report)
 from skin_winding import orient_surface_consistently
 ff,winding=orient_surface_consistently(vv,ff,nn);report['winding']=winding
 vv,ff,nn,surface_components=largest_surface(vv,ff,nn);report['surfaceComponents']=surface_components;report['denseTriangles']=len(ff)
 np.savez_compressed(scratch/'dense.npz',vertices=vv,faces=ff,normals=nn,origin=origin);dump(scratch/'build.json',report)
 if prototype:
  writer=Writer();writer.add('skin',vv,ff,nn,dict(atlasId='skin',source='structure-envelope'));writer.save(scratch/'prototype.glb')
  log('prototype ready',len(ff),'triangles');return
 log('cut proximal');vv,ff,nn=clip(vv,ff,nn,p['proximalYLowerMm'],False)
 from skin_extract import repair_numerical_holes
 try:
  ff,repair_meta=repair_numerical_holes(vv,ff,nn,p['proximalYLowerMm'])
 except ValueError as exc:
  repair_meta=getattr(exc,'metadata',dict(error=str(exc)))
  report['numericalHoleRepair']=repair_meta
  dump(scratch/'build.json',report)
  raise
 report['numericalHoleRepair']=repair_meta
 dump(scratch/'build.json',report)
 prefix=scratch/'mesh'
 vv.astype('<f4').tofile(str(prefix)+'.vertices.bin');ff.astype('<u4').tofile(str(prefix)+'.faces.bin')
 dump(str(prefix)+'.json',dict(targetTriangles=p['targetTriangles'],budgetTriangles=p.get('maximumTriangles',p['targetTriangles']),errorMm=p['quadricErrorMm']))
 locks=np.zeros(len(vv),np.uint8);lock_path=Path(str(prefix)+'.locks.bin')
 vertex_sha=sha(str(prefix)+'.vertices.bin');lock_meta=Path(str(prefix)+'.lock-source.json')
 configured=p.get('preservation',{}).get(side)
 if configured:
  assert configured['vertexSha256']==vertex_sha,'Preservation indices do not match deterministic dense vertices'
  if configured.get('indicesFile'):
   indices_path=ROOT/configured['indicesFile']
   assert sha(indices_path)==configured['indicesSha256'],'Preservation index file hash changed'
   indices=read_json(indices_path)
  else:indices=configured['indices']
  locks[np.asarray(indices,int)]=1
 if not configured and p.get('toeSectionEnvelopes',False):
  fine=np.load(scratch/'fine-foot.npy',mmap_mode='r');meta=read_json(scratch/'fine-foot.json');fo=np.array(meta['originMm']);fh=meta['spacingMm']
  ids=np.flatnonzero((vv[:,0]>=fo[0])&(vv[:,1]<=meta['crop']['yMaxMm']))
  foot_v=vv[ids];tree=cKDTree(foot_v)
  points=np.concatenate([m['vertices'] for m in meshes]);points=points[(points[:,0]>=fo[0])&(points[:,1]<=meta['crop']['yMaxMm'])]
  values=ndi.map_coordinates(fine,((points-fo)/fh).T,order=1,mode='constant',cval=1e6)
  points=points[(values<=0)&(values>=-p.get('preserveSourceMarginMm',.2))]
  pin=[]
  for neighbors in tree.query_ball_point(points,p.get('preserveSourceRadiusMm',.8)):pin.extend(ids[neighbors].tolist())
  phase=np.mod(foot_v[:,0],p.get('preserveToeWallGridMm',1))
  grid=p.get('preserveToeWallGridMm',1);tolerance=p.get('preserveToeWallPhaseToleranceMm',.05)
  wall=(foot_v[:,0]>110)&(foot_v[:,1]<0)&(np.abs(nn[ids,2])>.55)&((phase<tolerance)|(phase>grid-tolerance))
  pin.extend(ids[wall].tolist());pin=np.unique(pin).astype(int)
  locks[pin]=1;report['initialPreservation']=dict(sourceNearBoundaryPoints=len(points),lockedVertices=len(pin),method='deterministic near-source contact and 1 mm intertoe-wall anchors')
  log('toe/source contact preservation',report['initialPreservation'])
 if not configured and lock_path.exists() and lock_meta.exists() and read_json(lock_meta).get('vertexSha256')==vertex_sha:
  locks=np.fromfile(lock_path,dtype=np.uint8);assert len(locks)==len(vv)
 validation_path=ROOT/f'validation/skin-mesh-{side}.json'
 if not configured and validation_path.exists():
  previous=read_json(validation_path);inputs=previous.get('inputs',{})
  if inputs.get('vertices',{}).get('sha256')==vertex_sha:
   patch=[]
   if inputs.get('denseFaces',{}).get('sha256')==sha(str(prefix)+'.faces.bin'):
    metrics=previous['hausdorff']['denseToSimplified'];ids=metrics.get('badSourceFaces',[])+metrics.get('worstActualFaceIndices',[])
    if ids:patch.extend(ff[np.asarray(ids,int)].reshape(-1).tolist())
   old_simple=Path(str(prefix)+'.simplified.bin')
   if old_simple.exists() and inputs.get('simplifiedFaces',{}).get('sha256')==sha(old_simple):
    old_faces=np.fromfile(old_simple,dtype='<u4').reshape(-1,3);metrics=previous['hausdorff']['simplifiedToDense']
    ids=metrics.get('badSourceFaces',[])+metrics.get('worstActualFaceIndices',[])
    for hit in previous.get('selfIntersections',{}).get('intersections',[]):
     ids.extend([hit['sourceTriangle'],hit['otherTriangle']])
     # A long simplified triangle can fold between distant locked corners.
     # Preserve the dense interior of the whole crossing neighborhood too.
     crossing_points=vv[old_faces[[hit['sourceTriangle'],hit['otherTriangle']]]].reshape(-1,3)
     padding=p.get('auditIntersectionPaddingMm',3)
     low=crossing_points.min(0)-padding;high=crossing_points.max(0)+padding
     patch.extend(np.flatnonzero(np.all((vv>=low)&(vv<=high),axis=1)).tolist())
    if ids:patch.extend(old_faces[np.asarray(ids,int)].reshape(-1).tolist())
   if patch:
    patch=np.unique(patch)
    for ring in range(p.get('auditPreservationRings',8)):patch=np.unique(ff[np.any(np.isin(ff,patch),axis=1)])
    locks[patch]=1;log('preserving audited error/intersection neighborhoods',len(patch))
 if np.any(locks):locks.tofile(lock_path)
 else:lock_path.unlink(missing_ok=True)
 dump(lock_meta,dict(vertexSha256=vertex_sha))
 for attempt in range(5):
  subprocess.run(['node',str(ROOT/'scripts/skin-mesh-tools.mjs'),'simplify',str(prefix)],check=True,cwd=ROOT)
  sf=np.fromfile(str(prefix)+'.simplified.bin',dtype='<u4').reshape(-1,3)
  _,inverse,counts=np.unique(np.sort(sf,axis=1),axis=0,return_inverse=True,return_counts=True)
  duplicate_count=int(np.sum(counts[inverse]>1));sf=sf[counts[inverse]==1]
  edges=np.sort(np.concatenate([sf[:,[0,1]],sf[:,[1,2]],sf[:,[2,0]]]),axis=1)
  unique,counts=np.unique(edges,axis=0,return_counts=True)
  boundary=unique[(counts==1)&~np.all(np.abs(vv[unique,1]-p['proximalYLowerMm'])<1e-4,axis=1)]
  bad=np.concatenate([unique[counts>2],boundary])
  if not len(bad):break
  patch=np.unique(bad)
  for ring in range(3):patch=np.unique(ff[np.any(np.isin(ff,patch),axis=1)])
  locks[patch]=1;locks.tofile(lock_path);log('preserving pinched neighborhoods',len(patch))
 else:raise ValueError('Simplification cannot preserve manifold topology')
 sf.astype('<u4').tofile(str(prefix)+'.simplified.bin')
 report['simplification']=read_json(str(prefix)+'.simplification.json');report['simplification']['removedFoldedTriangles']=duplicate_count;report['simplification']['lockedVertices']=int(locks.sum());report['simplification']['triangles']=len(sf)
 np.savez_compressed(scratch/'pre-simplification.npz',vertices=vv,faces=ff,normals=nn)
 np.savez_compressed(scratch/'simplified.npz',vertices=vv,faces=sf,normals=nn)
 pieces=[]
 for region,above,base,offset in [('lower',False,lower,np.zeros(3)),('upper',True,upper,OFFSETS[side])]:
  pv,pf,pn=clip(vv,sf,nn,p['seamYLowerMm'],above)
  if above:pv,pf,pn=clip(pv,pf,pn,p['proximalYLowerMm'],False)
  caps=[cap(pv,pf,p['seamYLowerMm'],'seam',-1 if above else 1,scratch)]
  ends=['seam']
  if above:caps.append(cap(pv,pf,p['proximalYLowerMm'],'proximal',1,scratch));ends.append('proximal')
  topo=topology(pv,pf,caps);log(region,topo)
  assert topo['closed'] and topo['consistentWinding'] and topo['signedVolumeMm3']>0,'Invalid capped topology or outward winding'
  writer=Writer();writer.add('skin',pv-offset,pf,pn,dict(atlasId='skin',source='structure-envelope',illustrative=True))
  for end,(cv,cf,cn) in zip(ends,caps):
   writer.add(f'skin-cap-{end}',cv-offset,cf,cn,dict(atlasId='skin',skinCap=True,capEnd=end,source='structure-envelope'))
  preserved=writer.preserve(Glb(base/'exterior.glb'),'gastrocnemius') if region=='lower' else []
  references=writer.preserve(Glb(base/'exterior.glb'),'skin',reference=True) if region=='upper' else []
  destination=scratch/f'{region}-exterior.glb';digest=writer.save(destination)
  record=dict(region=region,skinTriangles=len(pf),capTriangles=sum(len(c[1]) for c in caps),bytes=destination.stat().st_size,glbSha256=digest,topology=topo,preservedGastrocnemius=preserved,preservedSourcePatches=references)
  pieces.append(record)
  np.savez_compressed(scratch/f'{region}-piece.npz',vertices=pv,faces=pf,normals=pn)
 report['pieces']=pieces;report['elapsedSeconds']=time.time()-started;dump(scratch/'build.json',report)
 if publish:
  audit=ensure_mesh_audit(side,prefix,p,validation_path)
  audit_current,audit_reasons=mesh_audit_status(audit,side,prefix,p)
  assert audit_current,'Mesh validation is unavailable or stale after automatic audit: '+ '; '.join(audit_reasons)
  for key,file in [('vertices','.vertices.bin'),('denseFaces','.faces.bin'),('simplifiedFaces','.simplified.bin')]:
   assert audit['inputs'][key]['sha256']==sha(str(prefix)+file),'Mesh validation is stale'
  for record,base in zip(pieces,[lower,upper]):
   destination=scratch/(record['region']+'-exterior.glb')
   manifest=dict(**report,**record,method='Dense source surface sampling; Euclidean closing, axial fill and signed body distance field; regional soft-tissue padding and patellar pad; smooth labelled elliptic toe sweeps with continuous gap separators and C1 root blend; multi-resolution marching cubes; consistent winding; conservative audited meshoptimizer decimation; earcut caps',allParameters=p,license='CC-BY-SA-4.0',attribution=['Z-Anatomy — Gauthier Kervyn — CC BY-SA 4.0','BodyParts3D — Database Center for Life Science; Kousaku Okubo — CC BY-SA 2.1 Japan'],meshValidation=audit,software={name:importlib.metadata.version(name) for name in ['numpy','scipy','scikit-image']})
   manifest['validationReports']=['validation/skin-mesh-'+side+'.json','validation/skin-geometry-'+side+'.json','validation/skin-clearance-'+side+'.json','validation/skin-enclosure-'+side+'.json']
   if record['region']=='upper':manifest['sourcePatches']='Original nine open Z-Anatomy patches retained byte-for-byte as hidden sourceReference meshes because pelvis/gluteal patches exceed the groin cut; new visible envelope covers the configured thigh/knee study region.'
   (base/'exterior.glb').write_bytes(destination.read_bytes())
   dump(base/'exterior.manifest.json',manifest)
 log('ready',side,report['elapsedSeconds'])

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--side',choices=['right','left'],required=True);parser.add_argument('--prototype',action='store_true');parser.add_argument('--publish',action='store_true');parser.add_argument('--reuse-field',action='store_true');parser.add_argument('--parameters',default=str(ROOT/'scripts/skin-parameters.json'))
 args=parser.parse_args();run(args.side,read_json(args.parameters),args.prototype,args.publish,args.reuse_field)






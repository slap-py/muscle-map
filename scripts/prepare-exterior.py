"""Export both source gastrocnemius heads and an illustrative fitted skin envelope.
Run Blender in background with --factory-startup --disable-autoexec.
"""
import bpy,bmesh,json,hashlib,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/models'
meta=json.loads((OUT/'bones.manifest.json').read_text()); src=ROOT/'assets/source/Startup.blend'
assert hashlib.sha256(src.read_bytes()).hexdigest()==meta['sourceBlendSha256']
bpy.ops.wm.open_mainfile(filepath=str(src),use_scripts=False); bpy.context.view_layer.update()
transform=Matrix(meta['registration']['sourceWorldToBlenderRowMajor'])
prepared=[]
for name in ['Medial head of gastrocnemius.r','Lateral head of gastrocnemius.r']:
 o=bpy.data.objects[name]; mesh=o.data.copy(); mesh.transform(transform@o.matrix_world)
 # Retain the source aponeurosis so both heads meet the common calcaneal tendon.
 prepared.append((name,mesh))
bpy.data.batch_remove(ids=list(bpy.data.objects)); bpy.data.batch_remove(ids=list(bpy.data.texts))
heads=[]; records=[]
for name,mesh in prepared:
 o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); mesh.materials.clear()
 bpy.context.view_layer.objects.active=o; o.select_set(True)
 mod=o.modifiers.new('Smooth source surface','SUBSURF'); mod.levels=1; bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('Calf triangle budget','DECIMATE');mod.ratio=min(1,16000/sum(len(p.vertices)-2 for p in o.data.polygons));bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 o['atlasId']='gastrocnemius'; o['sourceObject']=name; o['license']='CC-BY-SA-4.0'
 points=[Vector((v.co.x,v.co.z,-v.co.y))*1000 for v in o.data.vertices]
 records.append({'sourceObject':name,'boundsMm':[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]],'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)})
 heads.append(o);o.select_set(False)
# Imported registered surfaces supply cross-section extents, not measured skin.
for asset in ['bones','muscles','neurovascular']:bpy.ops.import_scene.gltf(filepath=str(OUT/(asset+'.glb')))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[Vector((p.x,p.z,-p.y))*1000 for o in objects for v in o.data.vertices for p in [o.matrix_world@v.co]]
verts=[];faces=[]
def envelope(rings,axis):
 base=len(verts);n=64
 for t,a,b,ra,rb in rings:
  for j in range(n):
   u=2*math.pi*j/n; aa=a+ra*math.cos(u);bb=b+rb*math.sin(u)
   p=(aa,t,bb) if axis=='y' else (t,aa,bb)
   verts.append((p[0]/1000,-p[2]/1000,p[1]/1000))
 for k in range(len(rings)-1):
  for j in range(n):
   a=base+k*n+j;b=base+k*n+(j+1)%n;faces.append((a,b,b+n,a+n))
 faces.append(tuple(base+j for j in reversed(range(n))));faces.append(tuple(base+(len(rings)-1)*n+j for j in range(n)))
# Skin follows the convex outline of every registered source cross-section plus a soft-tissue margin,
# so no bone, muscle or ankle structure can poke through. Radii are smoothed along the limb.
N=64
def hull(pts):
 pts=sorted(set(pts))
 if len(pts)<3:return pts
 cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 lo=[];up=[]
 for q in pts:
  while len(lo)>=2 and cross(lo[-2],lo[-1],q)<=0:lo.pop()
  lo.append(q)
 for q in reversed(pts):
  while len(up)>=2 and cross(up[-2],up[-1],q)<=0:up.pop()
  up.append(q)
 return lo[:-1]+up[:-1]
def ray(poly,c,d):
 best=0
 for k in range(len(poly)):
  p,q=poly[k],poly[(k+1)%len(poly)];ex,ey=q[0]-p[0],q[1]-p[1]
  den=d[0]*ey-d[1]*ex
  if abs(den)<1e-9:continue
  s=((p[0]-c[0])*ey-(p[1]-c[1])*ex)/den;u=((p[0]-c[0])*d[1]-(p[1]-c[1])*d[0])/den
  if s>0 and -1e-6<=u<=1+1e-6:best=max(best,s)
 return best
def smooth(seq,passes,keep=0):
 for _ in range(passes):
  seq=[seq[0]]+[[sum(seq[j][c] for j in (k-1,k,k+1))/3 for c in range(len(seq[k]))] for k in range(1,len(seq)-1)]+[seq[-1]]
 return seq
def fit(levels,select,coords,margin,passes):
 """levels along the limb axis; select(t) -> source points; coords -> 2D section coordinates."""
 ts=[];centers=[];polys=[]
 for t in levels:
  pts=[coords(p) for p in select(t)]
  if len(pts)<4:continue
  ts.append(t);polys.append(hull(pts))
  xs=[q[0] for q in polys[-1]];ys=[q[1] for q in polys[-1]];centers.append([(min(xs)+max(xs))/2,(min(ys)+max(ys))/2])
 centers=smooth(centers,passes)
 raw=[];radii=[]
 for poly,c in zip(polys,centers):
  r=[ray(poly,c,(math.cos(2*math.pi*j/N),math.sin(2*math.pi*j/N)))+margin for j in range(N)]
  raw.append(r);radii.append(r)
 radii=smooth(radii,passes)
 radii=[[max(a,b-1) for a,b in zip(sm,rw)] for sm,rw in zip(radii,raw)]  # never retreat inside the source outline
 for r in radii:  # light circular smoothing removes ray-sampling facets
  r[:]=[(r[j-1]+2*r[j]+r[(j+1)%N])/4 for j in range(N)]
 return ts,centers,radii
def ring_envelope(ts,centers,radii,axis,taper=None):
 base=len(verts)
 for k,t in enumerate(ts):
  f=taper(k,len(ts)) if taper else 1
  for j in range(N):
   u=2*math.pi*j/N;aa=centers[k][0]+radii[k][j]*f*math.cos(u);bb=centers[k][1]+radii[k][j]*f*math.sin(u)
   p=(aa,t,bb) if axis=='y' else (t,aa,bb)
   verts.append((p[0]/1000,-p[2]/1000,p[1]/1000))
 for k in range(len(ts)-1):
  for j in range(N):
   a=base+k*N+j;b=base+k*N+(j+1)%N;faces.append((a,b,b+N,a+N))
 faces.append(tuple(base+j for j in reversed(range(N))));faces.append(tuple(base+(len(ts)-1)*N+j for j in range(N)))
phal=[p for o in objects if o.get('atlasId',o.name).startswith('phalanx-') for v in o.data.vertices for p in [Vector((lambda w:(w.x,w.z,-w.y))(o.matrix_world@v.co))*1000]]
xlim=sorted(p.x for p in phal)[len(phal)//10] if phal else 90
# Leg and hindfoot: sections perpendicular to the tibial axis.
ts,cs,rs=fit(range(-40,446,5),lambda t:[p for p in points if abs(p.y-t)<7 and p.x<xlim-10],lambda p:(p.x,p.z),7,10)
# The source stops mid-thigh-shaped ragged ends; hold the clean section below the cut so the open top is level.
hold=ts.index(max(t for t in ts if t<=350))
for k in range(len(ts)):
 if ts[k]>350:cs[k]=cs[hold];rs[k]=rs[hold]
ts=ts+[450];cs=cs+[cs[-1]];rs=rs+[rs[-1]]
ring_envelope(ts,cs,rs,'y')
# Foot: sections perpendicular to the long axis, tapering into the toe envelopes.
ts,cs,rs=fit(range(-76,int(xlim)+1,4),lambda t:[p for p in points if abs(p.x-t)<6 and p.y<36],lambda p:(p.y,p.z),6,3)
ring_envelope(ts,cs,rs,'x',lambda k,n:min(1,.12+(k+1)/7)*min(1,.5+(n-1-k)/10))
# Individually outlined toes extend from their metatarsal heads to distal tips.
for toe in range(1,6):
 pts=[]
 for o in objects:
  if o.get('atlasId',o.name).startswith('phalanx-'+str(toe)+'-'):
   pts += [Vector((p.x,p.z,-p.y))*1000 for v in o.data.vertices for p in [o.matrix_world@v.co]]
 if not pts:continue
 lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
 cx=(lo[0]+hi[0])/2-4;length=(hi[0]-lo[0])/2+10;cy=(lo[1]+hi[1])/2;cz=(lo[2]+hi[2])/2
 ry=(hi[1]-lo[1])/2+3;rz=(hi[2]-lo[2])/2+1
 rings=[]
 for i in range(33):
  t=cx+length*math.cos(math.pi-i*math.pi/32)
  local=[p for p in pts if abs(p.x-t)<8] or sorted(pts,key=lambda p:abs(p.x-t))[:10]
  z=(min(p.z for p in local)+max(p.z for p in local))/2
  y=(min(p.y for p in local)+max(p.y for p in local))/2
  radius=max(p.z for p in local)-min(p.z for p in local)
  shape=math.sin(i*math.pi/32)**.4
  rings.append((t,y,z,max(.3,ry*shape),max(.3,(radius/2+2)*shape)))
 envelope(rings,'x')
mesh=bpy.data.meshes.new('Illustrative skin envelope');mesh.from_pydata(verts,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
skin=bpy.data.objects.new('skin',mesh);bpy.context.collection.objects.link(skin)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
mod=skin.modifiers.new('Blend exterior','REMESH');mod.mode='VOXEL';mod.voxel_size=.0012; bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new('Soften skin','SMOOTH');mod.factor=1.2;mod.iterations=12;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new('Surface budget','DECIMATE');mod.ratio=.3;bpy.ops.object.modifier_apply(modifier=mod.name)
for p in skin.data.polygons:p.use_smooth=True
skin['atlasId']='skin';skin['source']='illustrative-envelope';skin['license']='CC-BY-SA-4.0'
for o in heads:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'exterior.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_materials='NONE',export_animations=False,export_cameras=False,export_lights=False)
manifest={k:meta[k] for k in ['sourceRevision','sourceUrl','sourceBlendSha256','license','attribution','registration']}
manifest.update({'gastrocnemius':records,'skin':{'method':'Elliptical envelopes fitted around registered source cross-sections; separate toe envelopes; voxel union and smoothing','limitation':'Illustrative outer contour, not scanned skin. Nails and skin creases are not modeled.'},'glbSha256':hashlib.sha256((OUT/'exterior.glb').read_bytes()).hexdigest()})
(OUT/'exterior.manifest.json').write_text(json.dumps(manifest,indent=2))
print('EXTERIOR EXPORTED',records)

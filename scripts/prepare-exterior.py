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
for asset in ['bones','muscles']:bpy.ops.import_scene.gltf(filepath=str(OUT/(asset+'.glb')))
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
# Slightly generous ellipses enclose asymmetric anatomy; remeshing blends ankle and heel.
for axis,levels in [('y',range(-40,446,5))]:
 rings=[]
 for t in levels:
  pts=[p for p in points if abs(p[1 if axis=='y' else 0]-t)<7 and (p.x<48 if axis=='y' else p.y<25)]
  if not pts:continue
  i,j=(0,2) if axis=='y' else (1,2)
  lo=[min(p[k] for p in pts) for k in [i,j]];hi=[max(p[k] for p in pts) for k in [i,j]]
  a,b=[(lo[k]+hi[k])/2 for k in range(2)];ra,rb=[(hi[k]-lo[k])/2+6 for k in range(2)]
  factor=max(1,max(math.sqrt(((p[i]-a)/ra)**2+((p[j]-b)/rb)**2) for p in pts))
  if t<=30:
   blend=max(0,min(1,(t+40)/70))
   rings.append((t,-12,6,20+10*blend,20+8*blend))
  elif t>=355:
   rings.append((t,-5,12,51,55))
  else:rings.append((t,a,b,ra*factor+2,rb*factor+2))
 # Average neighboring cross-sections to remove source-mesh scalloping.
 for _ in range(12):
  rings=[rings[0]]+[tuple([rings[k][0]]+[sum(rings[j][c] for j in [k-1,k,k+1])/3 for c in range(1,5)]) for k in range(1,len(rings)-1)]+[rings[-1]]
 envelope(rings,axis)
envelope([
 (-73,-30,0,1,1),(-65,-30,0,18,18),(-48,-28,0,31,28),(-23,-24,3,38,35),
 (0,-26,10,33,39),(25,-29,17,27,43),(55,-35,24,22,46),(82,-40,29,17,47),
 (100,-44,31,13,41),(112,-46,27,8,30),(122,-47,20,1,19),
],'x')
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

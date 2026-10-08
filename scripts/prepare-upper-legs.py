"""Export left/right hip-thigh-knee packs from the pinned source via Blender MCP.
All exports are original side-specific source objects. Source coordinates in meters;
GLB axes +X anterior,+Y superior,+Z subject-right; origin is femur bbox midpoint.
"""
import bpy,bmesh,json,hashlib,re
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/Startup.blend'
bone_manifest=json.loads((ROOT/'public/models/bones.manifest.json').read_text())
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==bone_manifest['sourceBlendSha256']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),use_scripts=False);bpy.context.view_layer.update()
MUSCLES={
'rectus-femoris':'Rectus femoris muscle','vastus-lateralis':'Vastus lateralis muscle','vastus-medialis':'Vastus medialis muscle','vastus-intermedius':'Vastus intermedius muscle','sartorius':'Sartorius muscle','tensor-fasciae-latae':'Tensor fasciae latae','gluteus-maximus':'Gluteus maximus muscle','gluteus-medius':'Gluteus medius muscle','gluteus-minimus':'Gluteus minimus muscle','iliacus':'Iliacus muscle','psoas-major':'Psoas major','pectineus':'Pectineus muscle','adductor-longus':'Adductor longus','adductor-brevis':'Adductor brevis','adductor-magnus':'Adductor magnus','gracilis':'Gracilis muscle','biceps-femoris-long-head':'Long head of biceps femoris','biceps-femoris-short-head':'Short head of biceps femoris','semitendinosus':'Semitendinosus muscle','semimembranosus':'Semimembranosus muscle','obturator-externus':'Obturator externus','obturator-internus':'Obturator internus','superior-gemellus':'Superior gemellus muscle','inferior-gemellus':'Inferior gemellus muscle','quadratus-femoris':'Quadratus femoris muscle','piriformis':'Piriformis muscle','popliteus':'Popliteus muscle'}
BONES={'hip-bone':'Hip bone','femur':'Femur','patella':'Patella','tibia':'Tibia','fibula':'Fibula'}
LIGAMENTS=['Anterior cruciate ligament','Posterior cruciate ligament','Fibular collateral ligament','Superficial part of tibial collateral ligament','Deep part of tibial collateral ligament','Oblique popliteal ligament','Arcuate popliteal ligament','Popliteofibular ligament','Transverse ligament of knee','Meniscopatellar ligament','Articular capsule of knee joint','Articular capsule of hip joint','Descending part of iliofemoral ligament','Transverse part of iliofemoral ligament','Ischiofemoral ligament','Pubofemoral ligament','Ligament of head of femur','Transverse acetabular ligament','Zona orbicularis']
FASCIA=['Fascia lata','Iliotibial tract','Lateral femoral intermuscular septum','Medial femoral intermuscular septum']
CARTILAGE=['Medial meniscus','Lateral meniscus','Acetabular labrum']
VESSELS=['Femoral artery','Deep femoral artery','Lateral circumflex femoral artery','Medial circumflex femoral artery','Perforating femoral arteries','Popliteal artery','Superior lateral genicular artery','Superior medial genicular artery','Inferior lateral genicular artery','Inferior medial genicular artery','Middle genicular artery','Patellar anastomosis','Femoral vein','Deep femoral vein','Lateral circumflex femoral veins','Medial circumflex femoral veins','Perforating veins','Popliteal vein','Great saphenous vein','Small saphenous vein','Genicular veins','Femoral nerve','Sciatic nerve','Obturator nerve','Anterior branch of obturator nerve','Posterior branch of obturator nerve','Lateral femoral cutaneous nerve','Posterior femoral cutaneous nerve','Anterior cutaneous branches of femoral nerve','Saphenous nerve','Tibial nerve','Common fibular nerve','Superior gluteal nerve','Nerve to quadratus femoris muscle','Nerve to piriformis muscle']
SKIN=['Anterior region of thigh','Posterior region of thigh','Gluteal region','Hip region','Anterior region of knee','Posterior region of knee','Popliteal fossa','Femoral triangle','Gluteal fold']
slug=lambda s:re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
prepared=[];patches={};frames={};missing=[]
for side,suffix in [('right','r'),('left','l')]:
 femur=bpy.data.objects[f'Femur.{suffix}'];datum=sum((femur.matrix_world@Vector(v) for v in femur.bound_box),Vector())/8
 # Blender X anterior, Y subject-left, Z superior; exported Y-up permutes these.
 transform=Matrix(((0,-1,0,datum.y),(1,0,0,-datum.x),(0,0,1,-datum.z),(0,0,0,1)))
 frames[side]={'datumSourceMeters':list(datum),'sourceWorldToBlenderRowMajor':[list(row) for row in transform]}
 def copy(id,base,tissue,group,mode='all',crop=True):
  name=base if base in ['Sacrum','Coccyx'] else f'{base}.{suffix}'
  src=bpy.data.objects.get(name)
  if not src:missing.append(name);return
  data=src.data.copy(); world=src.matrix_world.copy()
  prepared.append({'side':side,'id':id,'name':base,'source':name,'tissue':tissue,'group':group,'mode':mode,'data':data,'world':world,'transform':transform,'type':src.type,'crop':crop,'materials':[m.name if m else '' for m in data.materials],'datum':datum})
 for id,name in BONES.items():
  copy(id,name,'bone','bones','bone');copy(id+'-cartilage',name,'cartilage','bones','cartilage')
 copy('sacrum','Sacrum','bone','bones')
 for id,name in MUSCLES.items():
  copy(id,name,'muscle','muscles','belly');copy(id+'-tendon',name,'tendon','muscles','tendon')
  endpoints={}
  for end,letter in [('from','o'),('to','e')]:
   patch=bpy.data.objects.get(f'{name}.{letter}{suffix}')
   if not patch and id.startswith('biceps-femoris') and end=='to':patch=bpy.data.objects.get(f'Biceps femoris muscle.e{suffix}')
   if patch and len(patch.data.vertices):
    center=sum((transform@patch.matrix_world@v.co for v in patch.data.vertices),Vector())/len(patch.data.vertices)
    endpoints[end]={'seedMm':[center.x*1000,center.z*1000,-center.y*1000],'sourceObject':patch.name}
  patches[f'{side}:{id}']=endpoints
 for tissue,names in [('ligament',LIGAMENTS),('fascia',FASCIA),('cartilage',CARTILAGE)]:
  for name in names:copy(slug(name),name,tissue,'bones')
 for name in VESSELS:
  tissue='nerve' if 'nerve' in name.lower() else 'vein' if 'vein' in name.lower() else 'artery'
  copy(slug(name),name,tissue,'neurovascular')
 for name in SKIN:copy('skin',name,'skin','exterior')
# Evaluate clean standalone copies; removing source objects avoids dependency cycles.
bpy.data.batch_remove(ids=list(bpy.data.objects));bpy.data.batch_remove(ids=list(bpy.data.texts))
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
records={'left':[],'right':[]};objects={'left':{},'right':{}}
for item in prepared:
 data=item['data'];tmp=bpy.data.objects.new('prepare',data);scene.collection.objects.link(tmp)
 if item['type']=='CURVE':
  data.resolution_u=6;data.render_resolution_u=6;data.bevel_resolution=1;data.use_fill_caps=False
  bpy.context.view_layer.update();mesh=bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
  bpy.data.objects.remove(tmp,do_unlink=True);tmp=bpy.data.objects.new('prepare-mesh',mesh);scene.collection.objects.link(tmp)
 else:mesh=data
 mesh.transform(item['transform']@item['world']);bm=bmesh.new();bm.from_mesh(mesh)
 mode=item['mode'];mats=item['materials']
 if mode!='all':
  def keep(f):
   material=mats[f.material_index] if f.material_index<len(mats) else ''
   if mode=='bone':return 'Cartilage' not in material
   if mode=='cartilage':return 'Cartilage' in material
   if mode=='belly':return material!='Tendon'
   if mode=='tendon':return material=='Tendon'
  gone=[f for f in bm.faces if not keep(f)]
  if gone:bmesh.ops.delete(bm,geom=gone,context='FACES')
 # Preserve complete thigh/knee and proximal shafts, crop at 0.32m and iliac crest context.
 low=.32-item['datum'].z;high=1.025-item['datum'].z
 for z,no,outer in [(low,(0,0,1),False),(high,(0,0,1),True)]:
  if bm.verts:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-8,plane_co=(0,0,z),plane_no=no,clear_outer=outer,clear_inner=not outer)
 loose=[v for v in bm.verts if not v.link_faces]
 if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
 if not bm.faces:bm.free();bpy.data.objects.remove(tmp,do_unlink=True);continue
 # Cap material seams and crop rims. Thin fascia/region surfaces retain source sheet form.
 if item['tissue'] not in ['fascia','skin','cartilage']:
  boundary=[e for e in bm.edges if e.is_boundary]
  if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if item['tissue'] not in ['skin','fascia','cartilage'] and bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.to_mesh(mesh);bm.free();tmp.data=mesh;mesh.materials.clear()
 bpy.context.view_layer.update();tmp.hide_set(False);tmp.hide_viewport=False;bpy.context.view_layer.objects.active=tmp;tmp.select_set(True)
 mesh.calc_loop_triangles()
 if item['type']=='MESH' and item['tissue'] in ['bone','muscle'] and len(mesh.loop_triangles)<6000:
  mod=tmp.modifiers.new('Source surface smoothing','SUBSURF');mod.levels=1;mod.render_levels=1;bpy.context.view_layer.update();evaluated=bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()));tmp.modifiers.clear();tmp.data=evaluated
 mesh=tmp.data;mesh.calc_loop_triangles()
 limit=18000 if item['tissue'] in ['bone','muscle','skin'] else 22000
 if len(mesh.loop_triangles)>limit:
  mod=tmp.modifiers.new('Surface budget','DECIMATE');mod.ratio=limit/len(mesh.loop_triangles);mod.use_collapse_triangulate=True;bpy.context.view_layer.update();evaluated=bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()));tmp.modifiers.clear();tmp.data=evaluated
 mesh=tmp.data;bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));boundary=sum(e.is_boundary for e in bm.edges);bm.to_mesh(mesh);bm.free()
 for f in mesh.polygons:f.use_smooth=True
 points=[Vector((v.co.x,v.co.z,-v.co.y))*1000 for v in mesh.vertices]
 bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
 tmp.name=item['id'];tmp['atlasId']=item['id'];tmp['sourceObject']=item['source'];tmp['tissue']=item['tissue'];tmp['license']='CC-BY-SA-4.0';tmp['source']='z-anatomy-regional-surface' if item['tissue']=='skin' else 'z-anatomy'
 rec={'id':item['id'],'name':item['name'],'tissue':item['tissue'],'assetGroup':item['group'],'sourceObject':item['source'],'triangles':len(mesh.polygons),'boundsMm':bounds,'boundaryEdges':boundary,'materialSeparation':mode,'sourceAttachments':patches.get(f"{item['side']}:{item['id']}",{})}
 records[item['side']].append(rec);objects[item['side']].setdefault(item['group'],[]).append(tmp);tmp.select_set(False)
 print(item['side'],item['id'],len(mesh.polygons),flush=True)
bpy.app.driver_namespace['muscle_map_upper_export']={'ROOT':ROOT,'bone_manifest':bone_manifest,'frames':frames,'records':records,'objects':objects,'missing':missing}
result={'prepared':{side:len(records[side]) for side in records},'missingSourceObjects':missing}

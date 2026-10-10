"""Rebuild illustrative foot-detail landmarks without altering published anatomy."""
import json,hashlib
from pathlib import Path
from skin_glb import Glb
root=Path(__file__).resolve().parent.parent
paths={'right':root/'public/models/bones.glb','left':root/'public/models/left-lower-leg/bones.glb'}
sides={}
for side,path in paths.items():
 meshes={m['id']:m for m in Glb(path).meshes()};toes=[]
 for i in range(1,6):
  ph=[meshes[f'phalanx-{i}-{n}']['vertices'] for n in ['proximal','middle','distal'] if f'phalanx-{i}-{n}' in meshes]
  proximal=ph[0];distal=ph[-1];meta=meshes[f'metatarsal-{i}']['vertices']
  toes.append(dict(toe=i,root=proximal.min(0)[0].item(),tip=distal.max(0)[0].item()+3,proximal=proximal.mean(0)[[0,2]].tolist(),distal=distal.mean(0)[[0,2]].tolist(),metatarsal=meta.mean(0)[[0,2]].tolist(),joints=[p.max(0)[0].item()-1 for p in ph[:-1]],nailWidth=(distal.max(0)[2]-distal.min(0)[2]).item()*.72,nailLength=(distal.max(0)[0]-distal.min(0)[0]).item()*.63))
 sides[side]=toes
record=dict(method='Illustrative detail placements derived from each published lower foot bone pack; millimetres in talus frame',sourceSha256={s:hashlib.sha256(p.read_bytes()).hexdigest() for s,p in paths.items()},sides=sides)
(root/'validation/skin-detail-landmarks.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')

# Bake compact maps offline; no per-pixel texture synthesis runs in the viewer.
import numpy as np
from PIL import Image
width,height=768,512
x=-80+(np.arange(width)+.5)/width*280
z=-100+(np.arange(height)+.5)/height*200
x,z=np.meshgrid(x,z)
def smooth(a,b,v):
 t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
def gaussian(v,w):return np.exp(-.5*(v/w)**2)
folder=root/'public/models/skin-detail';folder.mkdir(exist_ok=True)
for side,toes in sides.items():
 grain=np.sin(x*11.3+z*7.7)*np.sin(z*13.1-x*5.9)
 mottle=np.sin(x*.23+np.sin(z*.14))*np.sin(z*.31-x*.09)
 relief=.018*grain;crease=np.zeros_like(x);nail=np.zeros_like(x);edge=np.zeros_like(x)
 for toe in toes:
  px,pz=toe['proximal'];dx,dz=toe['distal'];slope=(dz-pz)/(dx-px)
  transverse=z-pz-(x-px)*slope;toe_mask=gaussian(transverse,8 if toe['toe']==1 else 4.7)
  for joint in [toe['root']+4,*toe['joints']]:
   curve=joint+.025*transverse**2+.3*np.sin(z*.65+toe['toe'])
   for offset in [-2,0,2]:
    c=gaussian(x-curve-offset,.48)*toe_mask;relief-=.24*c;crease+=c*.11
  mx,mz=toe['metatarsal'];tendon_z=mz+(pz-mz)*(x-mx)/(px-mx)
  relief+=.65*gaussian(z-tendon_z,1.9)*smooth(mx-18,mx+4,x)*(1-smooth(toe['root']-8,toe['root']+8,x))
  cx=toe['tip']-toe['nailLength']*.58-3;nz=pz+(cx-px)*slope
  u=(x-cx)/(toe['nailLength']*.5);v=(z-nz-(x-cx)*slope)/(toe['nailWidth']*.5)
  q=(abs(u)**4+abs(v)**4)**.25;n=1-smooth(.91,1.06,q);rim=gaussian(q-1,.055)
  nail=np.maximum(nail,n);edge=np.maximum(edge,rim);relief+=.18*n-.09*rim
 tone=.90+.012*mottle-crease-.12*edge
 color=np.stack([tone-.04*nail,tone+.08*nail,tone+.10*nail],axis=-1)
 bump=np.clip(.5+relief/2,0,1)
 # DataTexture rows originally start at v=0. PNG/TextureLoader uses flipY=true.
 Image.fromarray(np.round(np.clip(color[::-1],0,1)*255).astype(np.uint8)).save(folder/f'{side}-color.png')
 Image.fromarray(np.round(bump[::-1]*255).astype(np.uint8)).save(folder/f'{side}-bump.png')
print('Baked bilateral skin detail maps; published GLBs unchanged')

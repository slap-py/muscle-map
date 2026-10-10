"""Lossless GLB primitives for the structure-envelope pipeline; mm processing, metre export."""
import copy, hashlib, json, struct
from pathlib import Path
import numpy as np
DTYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

class Glb:
 def __init__(self,path):
  self.path=Path(path); data=self.path.read_bytes()
  magic,version,length=struct.unpack_from('<III',data)
  assert magic==0x46546C67 and version==2 and length==len(data)
  offset=12;self.binary=b''
  while offset<length:
   size,kind=struct.unpack_from('<II',data,offset);chunk=data[offset+8:offset+8+size]
   if kind==0x4E4F534A:self.doc=json.loads(chunk)
   elif kind==0x004E4942:self.binary=chunk
   offset+=size+8
 def accessor(self,index):
  a=self.doc['accessors'][index];assert not a.get('sparse')
  v=self.doc['bufferViews'][a['bufferView']];dtype=np.dtype(DTYPES[a['componentType']]);w=WIDTH[a['type']]
  start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',w*dtype.itemsize)
  return np.ndarray((a['count'],w),dtype=dtype,buffer=self.binary,offset=start,strides=(stride,dtype.itemsize)).copy()
 def meshes(self):
  nodes=self.doc['nodes']
  def visit(index,parent,atlas=None):
   node=nodes[index];m=np.array(node.get('matrix',np.eye(4).T.reshape(-1)),float).reshape(4,4).T
   if any(k in node for k in ['translation','rotation','scale']):
    assert 'rotation' not in node or node['rotation']==[0,0,0,1],'Unexpected rotation'
    m=np.eye(4);m[:3,:3]=np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
   world=parent@m;atlas=node.get('extras',{}).get('atlasId',atlas)
   if 'mesh' in node:
    mesh=self.doc['meshes'][node['mesh']];identity=atlas or node.get('name',mesh.get('name'))
    for p in mesh['primitives']:
     assert p.get('mode',4)==4
     v=self.accessor(p['attributes']['POSITION']).astype(float);v=(v@world[:3,:3].T+world[:3,3])*1000
     f=self.accessor(p['indices']).reshape(-1,3) if 'indices' in p else np.arange(len(v)).reshape(-1,3)
     if np.linalg.det(world[:3,:3])<0:f=f[:,[0,2,1]]
     yield dict(id=identity,name=node.get('name',identity),vertices=v,faces=f,node=node,primitive=p,world=world)
   for child in node.get('children',[]):yield from visit(child,world,atlas)
  for i in self.doc['scenes'][self.doc.get('scene',0)]['nodes']:yield from visit(i,np.eye(4))

class Writer:
 def __init__(self):
  self.binary=bytearray();self.doc=dict(asset={'version':'2.0','generator':'Muscle Map structure-envelope'},scene=0,scenes=[{'nodes':[]}],nodes=[],meshes=[],accessors=[],bufferViews=[],buffers=[])
 def view(self,data):
  self.binary.extend(b'\0'*(-len(self.binary)%4));i=len(self.doc['bufferViews'])
  self.doc['bufferViews'].append(dict(buffer=0,byteOffset=len(self.binary),byteLength=len(data)));self.binary.extend(data);return i
 def accessor(self,array,kind,component):
  a=np.ascontiguousarray(array,dtype=DTYPES[component]);i=len(self.doc['accessors'])
  record=dict(bufferView=self.view(a.tobytes()),componentType=component,count=len(a),type=kind)
  if kind=='VEC3':record.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
  self.doc['accessors'].append(record);return i
 def node(self,name,mesh,extras):
  i=len(self.doc['nodes']);self.doc['scenes'][0]['nodes'].append(i)
  self.doc['nodes'].append(dict(name=name,mesh=len(self.doc['meshes']),extras=extras));self.doc['meshes'].append(mesh)
 def add(self,name,v,f,n,extras):
  p=self.accessor(v/1000,'VEC3',5126);norm=self.accessor(n,'VEC3',5126);idx=self.accessor(f.reshape(-1,1),'SCALAR',5125)
  self.node(name,{'primitives':[{'attributes':{'POSITION':p,'NORMAL':norm},'indices':idx}]},extras)
 def preserve(self,source,atlas,reference=False):
  hashes=[]
  for item in source.meshes():
   if item['id']!=atlas:continue
   if reference and item['node'].get('extras',{}).get('source')=='structure-envelope':continue
   assert np.allclose(item['world'],np.eye(4)),'Preservation requires identity transforms'
   p=copy.deepcopy(item['primitive']);p.pop('material',None);indices=list(p['attributes'].values())+([p['indices']] if 'indices' in p else []);mapping={}
   for old in indices:
    a=copy.deepcopy(source.doc['accessors'][old]);view=source.doc['bufferViews'][a['bufferView']]
    data=source.binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    nv=self.view(data);self.doc['bufferViews'][nv].update({k:v for k,v in view.items() if k not in ['buffer','byteOffset','byteLength']})
    a['bufferView']=nv;mapping[old]=len(self.doc['accessors']);self.doc['accessors'].append(a)
    hashes.append(dict(mesh=item['name'],accessor=old,outputAccessor=mapping[old],sha256=hashlib.sha256(data).hexdigest()))
   p['attributes']={k:mapping[v] for k,v in p['attributes'].items()}
   if 'indices' in p:p['indices']=mapping[p['indices']]
   extras=copy.deepcopy(item['node'].get('extras',{'atlasId':atlas}))
   if reference:extras.update(atlasId=atlas,sourceReference=True)
   self.node(item['name'],{'primitives':[p]},extras)
  return hashes
 def save(self,path):
  self.doc['buffers']=[{'byteLength':len(self.binary)}];data=json.dumps(self.doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
  self.binary.extend(b'\0'*(-len(self.binary)%4));result=struct.pack('<III',0x46546C67,2,28+len(data)+len(self.binary))
  result+=struct.pack('<II',len(data),0x4E4F534A)+data+struct.pack('<II',len(self.binary),0x004E4942)+self.binary
  Path(path).write_bytes(result);return hashlib.sha256(result).hexdigest()


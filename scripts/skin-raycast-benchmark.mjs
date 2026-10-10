import fs from 'node:fs/promises';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
function parse(data){const size=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+size).toString()),bin=data.subarray(28+size);return {doc,bin};}
function attribute(glb,id){const a=glb.doc.accessors[id],v=glb.doc.bufferViews[a.bufferView],n=a.type==='VEC3'?3:1,start=(v.byteOffset??0)+(a.byteOffset??0),array=a.componentType===5126?new Float32Array(a.count*n):new Uint32Array(a.count*n);for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)array[i*n+j]=a.componentType===5126?glb.bin.readFloatLE(start+i*(v.byteStride??n*4)+j*4):glb.bin.readUInt32LE(start+i*(v.byteStride??4)+j*4);return new THREE.BufferAttribute(array,n);}
const rows=[];
for(const side of ['right','left']) {
 const glb=parse(await fs.readFile('public/models/'+(side==='left'?'left-lower-leg/':'')+'exterior.glb'));
 const node=glb.doc.nodes.find(n=>n.extras?.atlasId==='skin'&&!n.extras?.skinCap&&!n.extras?.sourceReference);
 const p=glb.doc.meshes[node.mesh].primitives[0],g=new THREE.BufferGeometry();g.setAttribute('position',attribute(glb,p.attributes.POSITION));g.setIndex(attribute(glb,p.indices));g.scale(1000,1000,1000);g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld(true);
 const box=g.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const rays=[];for(let i=0;i<40;i++)for(let j=0;j<24;j++){const target=new THREE.Vector3(center.x+(i/39-.5)*size.x,center.y+(j/23-.5)*size.y,center.z);const origin=target.clone().add(new THREE.Vector3(500,100,800));rays.push(new THREE.Raycaster(origin,target.clone().sub(origin).normalize()));}
 const run=()=>{const t=performance.now();const hits=rays.map(r=>r.intersectObject(mesh,false)[0]?.distance??null);return {ms:performance.now()-t,hits};};
 const brute=run(),buildStart=performance.now();g.boundsTree=new MeshBVH(g,{indirect:true});mesh.raycast=acceleratedRaycast;const bvhBuildMs=performance.now()-buildStart;rays.forEach(r=>r.firstHitOnly=true);const accelerated=run();
 const mismatches=brute.hits.filter((v,i)=>v===null?accelerated.hits[i]!==null:accelerated.hits[i]===null||Math.abs(v-accelerated.hits[i])>1e-5).length;
 const row={side,triangles:g.index.count/3,rays:rays.length,bruteMs:brute.ms,acceleratedMs:accelerated.ms,speedup:brute.ms/accelerated.ms,bvhBuildMs,mismatches};rows.push(row);console.log(JSON.stringify(row));if(mismatches)throw Error('Raycast mismatch');
}
await fs.writeFile('validation/skin-raycast-performance.json',JSON.stringify({method:'960 rays on the actual published lower skin; first-hit BVH, indirect indices, same nearest hit within 0.00001 mm',rows},null,2));

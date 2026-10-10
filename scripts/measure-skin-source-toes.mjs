import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
const result={scope:'Original phalanx surfaces plus a separate audit of explicitly toe-labelled generated cartilage/tendon branches in the free-toe zone',limitations:'Digital vessel and nerve source groups span several toes without separate toe IDs; the phalanx-only gap does not bound all digital soft tissue.',detailedToeStructures:{}};
function clipX(geometry,xMin) {
 const p=geometry.attributes.position,f=geometry.index,out=[];
 for(let i=0;i<f.count;i+=3){const tri=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,f.getX(i+k)));const polygon=[];
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],ia=a.x>=xMin,ib=b.x>=xMin;if(ia)polygon.push(a);if(ia!==ib)polygon.push(a.clone().lerp(b,(xMin-a.x)/(b.x-a.x)));}
  for(let k=1;k+1<polygon.length;k++)for(const point of [polygon[0],polygon[k],polygon[k+1]])out.push(...point.toArray());
 }
 if(!out.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.setIndex(Array.from({length:out.length/3},(_,i)=>i));return g;
}
for(const side of ['right','left']) {
 const bytes=await fs.readFile('public/models/'+(side==='left'?'left-lower-leg/':'')+'bones.glb');
 const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const groups=new Map(Array.from({length:5},(_,i)=>[i+1,[]]));
 scene.updateMatrixWorld(true);
 scene.traverse(o=>{
  if(!o.isMesh)return;
  const id=o.userData.atlasId??o.name;
  const match=/^phalanx-(\d)-/.exec(id);
  if(!match)return;
  const g=o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().makeScale(1000,1000,1000).multiply(o.matrixWorld));
  const clean=new THREE.BufferGeometry();clean.setAttribute('position',g.attributes.position.clone());clean.setIndex(g.index.clone());
  groups.get(Number(match[1])).push(clean);
 });
 const toes=[...groups].map(([i,list])=> {const g=mergeGeometries(list);g.boundsTree=new MeshBVH(g,{indirect:true});return g;});
 result[side]=[];
 for(let i=0;i<4;i++){
  const hit=toes[i].boundsTree.closestPointToGeometry(toes[i+1],new THREE.Matrix4(),{}, {},0,Infinity);
  result[side].push({pair:[i+1,i+2],minimumSurfaceGapMm:hit.distance,method:'Exact triangle-to-triangle closest distance via BVH',surfaceOverlap:hit.distance<1e-7});
 }
 const allGroups=new Map([...groups].map(([i,list])=>[i,list.map(g=>g.clone())]));
 const meta=JSON.parse(await fs.readFile('output/skin-input/'+side+'-soft.json','utf8'));
 const data=await fs.readFile('output/skin-input/'+side+'-soft.bin');const included=[];
 for(const record of meta.records){
  const match=/^cartilage-phalanx-(\d)-/.exec(record.id) || /toe-(\d)/.exec(record.component??'');
  const toe=match?Number(match[1]):record.id.includes('hallucis')?1:record.component==='fifth-toe'?5:null;
  if(!toe)continue;
  const positions=new Float32Array(data.buffer,data.byteOffset+record.vertexOffsetBytes,record.vertexCount*3).slice();
  const indices=new Uint32Array(data.buffer,data.byteOffset+record.indexOffsetBytes,record.indexCount).slice();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(new THREE.BufferAttribute(indices,1));allGroups.get(toe).push(g);included.push({toe,id:record.id,component:record.component});
 }
 const build=JSON.parse(await fs.readFile('output/skin/'+side+'/build.json','utf8'));
 const heads=Array.from({length:5},(_,i)=>build.landmarkPads.find(p=>p.bone==='metatarsal-'+(i+1)).centerMm[0]);
 const rows=[];
 for(let i=0;i<4;i++){
  const cut=Math.max(heads[i],heads[i+1])+4;const clipped=[i+1,i+2].map(n=>allGroups.get(n).map(g=>clipX(g,cut)).filter(Boolean));
  const pair=clipped.map(list=>mergeGeometries(list));for(const g of pair)g.boundsTree=new MeshBVH(g,{indirect:true});
  const clippedBones=[i+1,i+2].map(n=>mergeGeometries(groups.get(n).map(g=>clipX(g,cut)).filter(Boolean)));
  for(const g of clippedBones)g.boundsTree=new MeshBVH(g,{indirect:true});
  const boneUpper=clippedBones[0].boundsTree.closestPointToGeometry(clippedBones[1],new THREE.Matrix4(),{}, {},0,Infinity).distance;
  console.log(side,'soft pair',i+1,i+2,'triangles',pair.map(g=>g.index.count/3),'upper bound',boneUpper);
  for(const g of clippedBones)g.dispose();
  const hit=pair[0].boundsTree.closestPointToGeometry(pair[1],new THREE.Matrix4(),{}, {},1e-7,boneUpper+1e-4);
  console.log(side,'soft pair result',i+1,i+2,hit.distance);
  rows.push({pair:[i+1,i+2],freeZoneXMinMm:cut,minimumSurfaceGapMm:hit.distance,surfaceTouchOrOverlap:hit.distance<1e-6,method:'Exact triangle-to-triangle distance after clipping explicitly toe-labelled source bones/cartilage/tendons distal to both metatarsal-head landmarks plus4mm'});
  for(const g of [...pair,...clipped.flat()])g.dispose();
 }
 result.detailedToeStructures[side]={includedGeneratedBranches:included,adjacentPairs:rows};
 for(const list of allGroups.values())for(const g of list)g.dispose();
 for(const g of toes)g.dispose();
}
await fs.writeFile('validation/skin-toe-source-gaps.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));


import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
const result={};
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
 for(const g of toes)g.dispose();
}
await fs.writeFile('validation/skin-toe-source-gaps.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));


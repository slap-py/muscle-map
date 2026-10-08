import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const load=async path=>{const b=await fs.readFile(path);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;};
const summary=scene=>{
 scene.updateMatrixWorld(true);const result=new Map();
 scene.traverse(o=>{if(!o.isMesh)return;const id=o.userData.atlasId;assert(id);const entry=result.get(id)??{bounds:new THREE.Box3(),triangles:0,volume:0};const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),p=geometry.attributes.position,index=geometry.index;assert([...p.array].every(Number.isFinite));geometry.computeBoundingBox();entry.bounds.union(geometry.boundingBox);const count=index?.count??p.count;assert.equal(count%3,0);entry.triangles+=count/3;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);entry.volume+=a.dot(b.cross(c))/6;}result.set(id,entry);geometry.dispose();});
 return result;
};
const report={mirrored:[],upper:[]};
const manifest=JSON.parse(await fs.readFile('public/models/left-lower-leg/manifest.json','utf8'));
for(const record of manifest.assets){
 const path=`public/models/${record.asset}.glb`;assert.equal(crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex'),record.sourceSha256,'Original asset changed');
 const right=summary(await load(path)),left=summary(await load(`public/models/left-lower-leg/${record.asset}.glb`));assert.deepEqual([...right.keys()].sort(),[...left.keys()].sort());
 for(const[id,r]of right){const l=left.get(id);assert.equal(l.triangles,r.triangles);const expectedMin=[r.bounds.min.x,r.bounds.min.y,-r.bounds.max.z],expectedMax=[r.bounds.max.x,r.bounds.max.y,-r.bounds.min.z];for(let axis=0;axis<3;axis++){assert(Math.abs(l.bounds.min.getComponent(axis)-expectedMin[axis])<2e-6,`${id} mirrored min`);assert(Math.abs(l.bounds.max.getComponent(axis)-expectedMax[axis])<2e-6,`${id} mirrored max`);}assert(Math.abs(l.volume-r.volume)<Math.max(1e-10,Math.abs(r.volume)*1e-4),`${id} preserved outward signed volume`);}
 report.mirrored.push({asset:record.asset,structures:right.size,originalHashUnchanged:true,reflectionAndWinding:true});
}
for(const side of ['left','right']){
 const m=JSON.parse(await fs.readFile(`public/models/${side}-upper-leg/manifest.json`,'utf8'));const ids=new Set();
 for(const {group,sha256}of m.exports){const path=`public/models/${side}-upper-leg/${group}.glb`;assert.equal(crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex'),sha256);const data=summary(await load(path));for(const[id,s]of data){assert(!ids.has(id));ids.add(id);assert(s.triangles>0);assert(s.bounds.getSize(new THREE.Vector3()).length()<1.3,`${id} anatomical meter bounds`);const records=m.structures.filter(r=>r.id===id);assert(records.length>0);assert(records.every(r=>r.sourceObject.endsWith(side==='left'?'.l':'.r')||r.sourceObject==='Sacrum'));}}
 assert.equal(ids.size,120);report.upper.push({side,structures:ids.size,sourceSideVerified:true,finiteGeometry:true,hashesVerified:true});
}
await fs.writeFile('validation/leg-asset-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

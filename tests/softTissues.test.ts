/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import * as THREE from 'three';
import type {MeshBVH} from 'three-mesh-bvh';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createAnkle} from '../src/ankle';
import {structures,byId} from '../src/data';
import {attachmentRecords,attachmentSources} from '../src/attachments';
import {jointSurfaces,cartilageId} from '../src/joints';
import {installBoneAssets,installMuscleAssets,loadMuscleAssets,muscleIds} from '../src/assets';
import {rebuildSoftTissues} from '../src/softTissues';
import {connectionsFor, footprintDecal, connectionCameraPose, directlyAttachedIds} from '../src/connections';
const parse=async(file:string)=>{
 const b=readFileSync(new URL(`../public/models/${file}.glb`,import.meta.url));
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
};
let model:ReturnType<typeof createAnkle>,report:ReturnType<typeof rebuildSoftTissues>;
beforeAll(async()=>{
 model=createAnkle();
 installBoneAssets(await parse('bones'),model.parts);
 installMuscleAssets(await parse('muscles'),model.parts);
 report=rebuildSoftTissues(model.parts);
});
afterAll(()=>{for(const part of model.parts.values())for(const mesh of part.meshes){mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();}});
describe('registered soft tissues',()=>{
 it('loads every source muscle in the frozen bone frame with identity transforms and bounded topology',async()=>{
  const scene=await parse('muscles'),ids:string[]=[];
  scene.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   ids.push(o.userData.atlasId);expect(o.name).toBe(o.userData.atlasId);
   expect(o.position.length()).toBe(0);expect(o.scale.toArray()).toEqual([1,1,1]);expect(o.quaternion.toArray()).toEqual([0,0,0,1]);
   const triangles=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
   expect(triangles).toBeGreaterThanOrEqual(5000);expect(triangles).toBeLessThanOrEqual(20000);
   o.geometry.dispose();
  });
  expect(ids.sort()).toEqual(muscleIds.filter(id=>id!=="gastrocnemius").sort());expect(ids).toHaveLength(12);
  const muscle=JSON.parse(readFileSync(new URL('../public/models/muscles.manifest.json',import.meta.url),'utf8'));
  const bones=JSON.parse(readFileSync(new URL('../public/models/bones.manifest.json',import.meta.url),'utf8'));
  expect(muscle.registration).toEqual(bones.registration);expect(muscle.sourceRevision).toBe(bones.sourceRevision);
  expect(muscle.muscles.every((m:any)=>m.nonManifoldEdges===0 && m.components<=3 && m.retainedVolumeRatio>0.5)).toBe(true);
  expect(model.parts.get('soleus-distal')!.anchor.y).toBeGreaterThan(100);
  expect(model.parts.get('edb')!.meshes[0].geometry.boundingBox!.max.x).toBeLessThan(66);
 });
 it('keeps a source ledger, valid footprint references, explicit guide order and distinct ligament components',()=>{
  expect(new Set(attachmentRecords.map(a=>a.id)).size).toBe(attachmentRecords.length);
  for(const a of attachmentRecords){
   expect(byId[a.structureId].tissue).toBe(a.kind);expect(byId[a.from.structureId]).toBeDefined();expect(byId[a.to.structureId]).toBeDefined();
   expect(a.sourceIds.every(id=>id in attachmentSources)).toBe(true);
   if(a.kind==='tendon'){expect(a.from.kind).toBe('junction');expect(byId[a.from.structureId].tissue).toBe('muscle');}
  }
  expect(attachmentRecords.filter(a=>a.structureId==='deltoid')).toHaveLength(5);
  expect(attachmentRecords.filter(a=>a.structureId==='spring')).toHaveLength(3);
  for(const id of ['atfl','cfl','ptfl','long-plantar','short-plantar'])expect(attachmentRecords.some(a=>a.structureId===id)).toBe(true);
  const longus=attachmentRecords.find(a=>a.structureId==='fibularis-longus-tendon')!;
  expect(longus.guidePoints.map(g=>g.landmark).join(' ')).toMatch(/lateral malleolus.*superior fibular.*inferior fibular.*cuboid groove/s);
  expect(attachmentRecords.find(a=>a.structureId==='flexor-hallucis-tendon')!.guidePoints.some(g=>g.landmark==='Under sustentaculum tali')).toBe(true);
 });
 it('fits footprints to surfaces, keeps all pulley guides on the smooth centerline, and renders closed flattened bands',()=>{
  expect(report.warnings).toEqual([]);expect(report.attachments).toBe(attachmentRecords.length);
  for(const a of attachmentRecords){
   const mesh=model.parts.get(a.structureId)!.meshes.find(m=>m.userData.attachmentId===a.id)!;
   expect(mesh).toBeDefined();expect(mesh.geometry.boundsTree).toBeDefined();
   for(const key of ['fromFootprint','toFootprint']) {
    const f=mesh.userData[key];if(f.meshIndex<0)continue;
    const target=model.parts.get(f.structureId)!.meshes[f.meshIndex];
    const hit=(target.geometry.boundsTree as MeshBVH).closestPointToPoint(new THREE.Vector3(...f.centerMm));
    expect(hit?.distance,`${a.id} ${key}`).toBeLessThan(0.002);
   }
   if(a.kind==='tendon') {
    const samples=mesh.geometry.userData.centerlineMm as number[][];
    expect(samples[0]).toEqual(mesh.userData.fromFootprint.centerMm);expect(samples.at(-1)).toEqual(mesh.userData.toFootprint.centerMm);
    for(const guide of mesh.userData.guidePoints)expect(samples.some(p=>new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...guide.positionMm))<1e-6)).toBe(true);
   } else {
    expect(mesh.geometry.getAttribute('position').count).toBe(49*4);
    expect(a.widthMm).toBeGreaterThan(a.thicknessMm*3);
   }
  }
 });
 it('covers both sides of every modeled synovial interface using thin offsets of identifiable bone triangles',()=>{
  expect(report.cartilagePatches).toBe(jointSurfaces.length*2);
  for(const j of jointSurfaces)for(const bone of j.bones){
   const patch=model.parts.get(cartilageId(bone))!.meshes.find(m=>m.userData.jointId===j.id)!;
   expect(patch,`${j.id}/${bone}`).toBeDefined();expect(patch.userData.sourceFaceIndices.length).toBeGreaterThan(0);
   const source=model.parts.get(bone)!.meshes[0],bvh=source.geometry.boundsTree as MeshBVH;
   const p=patch.geometry.getAttribute('position');
   for(let i=0;i<p.count;i+=Math.max(2,Math.floor(p.count/20/2)*2)){
    const inner=new THREE.Vector3().fromBufferAttribute(p,i),outer=new THREE.Vector3().fromBufferAttribute(p,i+1);
    expect(bvh.closestPointToPoint(inner)!.distance).toBeLessThan(0.04);
    expect(inner.distanceTo(outer)).toBeGreaterThan(0.01);expect(inner.distanceTo(outer)).toBeLessThanOrEqual(0.66);
   }
  }
 });
 it('preserves usable muscle meshes on load failure and disposes replaced geometry during a refit',async()=>{
  const part=model.parts.get('anterior')!,old=part.meshes[0],group=part.group,anchor=part.anchor;
  const failed=await loadMuscleAssets(model.parts,'missing',async()=>{throw new Error('404');});
  expect(failed.fallback).toEqual(muscleIds.filter(id=>id!=="gastrocnemius"));expect(part.meshes[0]).toBe(old);
  const previous=model.parts.get('atfl')!.meshes[0];
  const second=rebuildSoftTissues(model.parts);expect(second.warnings).toEqual([]);
  expect(previous.parent).toBeNull();expect(previous.geometry.boundsTree).toBeUndefined();
  expect(part.group).toBe(group);expect(part.anchor).toBe(anchor);
  expect([...model.parts.values()].filter(p=>!['artery','vein','nerve'].includes(structures.find(s=>s.id===p.id)!.tissue)).every(p=>p.meshes.length>0)).toBe(true);
  expect(model.parts.size).toBe(structures.length);
 });
});


describe('connection teaching with registered assets', () => {
 it('maps muscles to tendon insertion footprints and excludes pulley contacts from direct attachments', () => {
  const calf = connectionsFor(model.parts, 'soleus-distal');
  expect(calf.some(c => c.footprint.structureId === 'calcaneus')).toBe(true);
  const longus = directlyAttachedIds('fibularis-longus-tendon');
  expect(longus.has('fibularis')).toBe(true);
  expect(longus.has('metatarsal-1')).toBe(true);
  expect(longus.has('cuboid')).toBe(false);
  expect(directlyAttachedIds('fibularis').has('fibularis-longus-tendon')).toBe(true);
  expect(directlyAttachedIds('fibularis').has('metatarsal-1')).toBe(false);
 });
 it('clips every bone decal onto the actual source surface, excluding soft endpoints', () => {
  for (const a of attachmentRecords) for (const c of connectionsFor(model.parts, a.structureId).filter(c => c.record === a)) {
   const decal = footprintDecal(model.parts, c);
   if (a[c.end].kind !== 'surface' || byId[c.footprint.structureId].tissue !== 'bone') {
    expect(decal).toBeUndefined(); continue;
   }
   expect(decal, c.key).toBeDefined();
   const pos = decal!.geometry.getAttribute('position');
   expect(pos.count, c.key).toBeGreaterThan(0);
   const bone = model.parts.get(c.footprint.structureId)!.meshes[c.footprint.meshIndex];
   for (let i=0; i<pos.count; i+=Math.max(1,Math.floor(pos.count/10))) {
    const point = new THREE.Vector3().fromBufferAttribute(pos,i);
    expect((bone.geometry.boundsTree as MeshBVH).closestPointToPoint(point)!.distance, c.key).toBeLessThan(0.005);
   }
   decal!.geometry.dispose(); decal!.material.dispose();
  }
 });
 it('frames real footprints from an outward view at desktop and narrow aspect ratios', () => {
  for (const id of ['achilles','atfl','lisfranc','deltoid','plantar-fascia']) for (const c of connectionsFor(model.parts,id)) {
   for (const aspect of [0.45,1,2.2]) {
    const pose = connectionCameraPose(c.footprint,34,aspect);
    expect(pose.distance).toBeGreaterThanOrEqual(55);
    expect(pose.target.toArray()).toEqual(c.footprint.centerMm);
    expect(pose.position.clone().sub(pose.target).dot(new THREE.Vector3(...c.footprint.normal))).toBeGreaterThan(0);
    const camera = new THREE.PerspectiveCamera(34,aspect,0.05,10000);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
    for (const p of c.footprint.boundaryMm) {
     const projected = new THREE.Vector3(...p).project(camera);
     expect(Math.abs(projected.x), c.key).toBeLessThan(0.9);
     expect(Math.abs(projected.y), c.key).toBeLessThan(0.9);
    }
   }
  }
 });
});

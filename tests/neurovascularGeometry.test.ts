import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import catalog from '../src/neurovascularCatalog.json';
import manifest from '../public/models/neurovascular.manifest.json';
import boneManifest from '../public/models/bones.manifest.json';

type MeshMap=Map<string,{mesh:THREE.Mesh,points:THREE.Vector3[]}>;
async function readMeshes(name:string):Promise<MeshMap>{
 const bytes=readFileSync(`public/models/${name}.glb`);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const result:MeshMap=new Map();scene.updateMatrixWorld(true);
 scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const attribute=object.geometry.getAttribute('position'),points=[];
  for(let i=0;i<attribute.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(attribute,i).applyMatrix4(object.matrixWorld).multiplyScalar(1000));
  const key = object.userData.atlasId??object.name;
  const existing = result.get(key);
  if (existing) existing.points.push(...points); else result.set(key,{mesh:object,points});
 });return result;
}
let vessels:MeshMap,bones:MeshMap,exterior:MeshMap;
beforeAll(async()=>{[vessels,bones,exterior]=await Promise.all(['neurovascular','bones','exterior'].map(readMeshes));});

describe('registered neurovascular source assets',()=>{
 it('maps exactly 49 atlas IDs to unique explicit source objects and the shipped output hash',()=>{
  expect(catalog).toHaveLength(49);expect(manifest.structures).toHaveLength(49);
  expect(new Set(catalog.map(r=>r.id)).size).toBe(49);
  expect(new Set(catalog.map(r=>r.sourceObject)).size).toBe(49);
  expect(catalog.filter(r=>r.tissue==='nerve')).toHaveLength(16);
  expect(catalog.filter(r=>r.tissue!=='nerve')).toHaveLength(33);
  expect([...vessels.keys()].sort()).toEqual(catalog.map(r=>r.id).sort());
  for(const row of catalog){
   const entries=manifest.structures.filter(r=>r.atlasId===row.id);
   expect(entries).toHaveLength(1);expect(entries[0].sourceObject).toBe(row.sourceObject);
   expect(vessels.get(row.id)!.mesh.userData.sourceObject).toBe(row.sourceObject);
  }
  expect(manifest.sourceRevision).toBe(boneManifest.sourceRevision);
  expect(manifest.registration).toEqual(boneManifest.registration);
  expect(createHash('sha256').update(readFileSync('public/models/neurovascular.glb')).digest('hex')).toBe(manifest.glbSha256);
  // The source omits .r on this one right-foot nerve; do not silently drop it.
  expect(catalog.filter(r=>!r.sourceObject.endsWith('.r')).map(r=>r.sourceObject)).toEqual(['Common plantar digital branches of medial plantar nerve']);
 });
 it('uses meter GLBs, unchanged tube radii, closed mesh topology and capped full-tibia cropping',()=>{
  const top=boneManifest.bones.find(r=>r.atlasId==='tibia')!.boundsMeters[1][1]*1000;
  expect(manifest.cropYMaxMm).toBeCloseTo(top,6);
  for(const row of manifest.structures){
   const {mesh,points}=vessels.get(row.atlasId)!;
   expect(mesh.position.toArray()).toEqual([0,0,0]);expect(mesh.scale.toArray()).toEqual([1,1,1]);
   expect(mesh.quaternion.toArray()).toEqual([0,0,0,1]);
   expect(row.nonManifoldEdges).toBe(0);expect(row.tubeSides).toBe(6);
   expect(row.sourceBevelDepthMeters).toBeCloseTo(.0005,8);
   expect(row.sourceRadiusRangeMm[0]).toBeGreaterThanOrEqual(.19);
   expect(row.sourceRadiusRangeMm[1]).toBeLessThanOrEqual(3.1);
   expect((mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3).toBe(row.triangles);
   const bounds=new THREE.Box3().setFromPoints(points);
   expect(bounds.max.y,row.atlasId).toBeLessThanOrEqual(top+.001);
   for(let i=0;i<3;i++){
    expect(bounds.min.getComponent(i)).toBeCloseTo(row.boundsMm[0][i],3);
    expect(bounds.max.getComponent(i)).toBeCloseTo(row.boundsMm[1][i],3);
   }
   if(row.cropped){expect(row.cutCapFaces).toBeGreaterThan(0);expect(bounds.max.y).toBeCloseTo(top,3);}
  }
  expect(manifest.structures.find(r=>r.atlasId==='vein-great-saphenous')!.cropped).toBe(true);
 });
 it('fits registered exterior bounds within its documented one-millimeter construction tolerance',()=>{
  // This tests the spatial envelope, not watertight source skin containment:
  // exterior.glb is illustrative and was voxelized at 1.2 mm. Plantar digital
  // veins extend 0.533 mm below its box. Never distort source anatomy to fit it.
  const envelope=new THREE.Box3().setFromPoints(exterior.get('skin')!.points).expandByScalar(1);
  for(const [id,{points}] of vessels)for(const p of points)expect(envelope.containsPoint(p),id).toBe(true);
 });
 it('keeps the tibial nerve and posterior tibial artery behind the medial malleolus',()=>{
  // The distal medial tibial patch is selected in the documented ISB frame;
  // posterior is -X, medial is -Z. These are regional sanity checks, not a
  // measured clinical landmark or an inference from the tube label centroid.
  const patch=bones.get('tibia')!.points.filter(p=>p.y<20&&p.z< -20);
  expect(patch.length).toBeGreaterThan(20);
  const malleolus=new THREE.Box3().setFromPoints(patch);
  for(const id of ['nerve-tibial','artery-posterior-tibial']){
   const points=vessels.get(id)!.points.filter(p=>p.y>=malleolus.min.y&&p.y<=malleolus.max.y);
   expect(points.length).toBeGreaterThan(5);
   const course=new THREE.Box3().setFromPoints(points);
   expect(course.max.x,id).toBeLessThan(malleolus.min.x);
   expect(course.max.z,id).toBeLessThan(0);
   expect(course.min.x,id).toBeGreaterThan(malleolus.min.x-20);
  }
 });
 it('keeps dorsalis pedis across the dorsal midfoot',()=>{
  const ids=['navicular','cuneiform-medial','cuneiform-intermediate','cuneiform-lateral'];
  const midfoot=new THREE.Box3().setFromPoints(ids.flatMap(id=>bones.get(id)!.points));
  const points=vessels.get('artery-dorsalis-pedis')!.points.filter(p=>p.x>midfoot.min.x&&p.x<midfoot.max.x);
  expect(points.length).toBeGreaterThan(50);
  const course=new THREE.Box3().setFromPoints(points);
  expect(course.max.x-course.min.x).toBeGreaterThan(40);
  expect(course.min.y).toBeGreaterThan(midfoot.getCenter(new THREE.Vector3()).y);
  expect(course.max.y).toBeGreaterThan(midfoot.max.y);
  expect(course.min.z).toBeGreaterThan(midfoot.min.z);
  expect(course.max.z).toBeLessThan(midfoot.max.z);
 });
});

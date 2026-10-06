import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {atlasIds} from '../src/atlas';
import {applyCoverage} from '../src/appearance';
import {createAnkle} from '../src/ankle';
import {installExteriorAssets} from '../src/assets';
describe('exterior and regional atlas',()=>{
 it('keeps every toe ray distinct while including its attached muscles and tendons',()=>{
  for(let n=1;n<=5;n++) {
   const ids=atlasIds(`toe-${n}`);
   expect(ids.has(`metatarsal-${n}`)).toBe(true);
   expect(ids.has(`phalanx-${n}-distal`)).toBe(true);
   expect(ids.has(`cartilage-phalanx-${n}-distal`)).toBe(true);
   expect(ids.has(`phalanx-${n===5?1:n+1}-distal`)).toBe(false);
   expect(ids.has(n===1?'fhl':'fdl')).toBe(true);
  }
  expect(atlasIds('toe-1').has('sesamoid-medial')).toBe(true);
  expect(atlasIds('leg').has('gastrocnemius')).toBe(true);
 });
 it('loads both calf heads separately from soleus and a registered skin mesh',async()=>{
  const bytes=readFileSync('public/models/exterior.glb');
  const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const model=createAnkle(),soleus=model.parts.get('soleus-distal')!.meshes[0];
  const report=installExteriorAssets(scene,model.parts);
  expect(report.fallback).toEqual([]);
  expect(model.parts.get('gastrocnemius')!.meshes).toHaveLength(2);
  expect(model.parts.get('soleus-distal')!.meshes[0]).toBe(soleus);
  const skin=model.parts.get('skin')!.meshes[0];
  expect(skin.geometry.boundingBox!.max.y).toBeGreaterThan(430);
  expect(skin.geometry.boundingBox!.max.x).toBeGreaterThan(165);
  expect(skin.userData.source).toBe('illustrative-envelope');
 });
 it('retains depth coverage across 80% and makes shadow coverage follow the slider',()=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  for(const alpha of [1,.81,.80,.79,.5,.1,1]) {
   applyCoverage(mesh,alpha);
   expect(mesh.material.transparent).toBe(false);
   expect(mesh.material.depthWrite).toBe(true);
   expect(mesh.material.alphaHash).toBe(alpha<1);
   expect(mesh.customDepthMaterial!.userData.coverage.value).toBe(alpha);
  }
 });
});

import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {connectionOccluders, connectionHighlightIds, type Connection} from '../src/connections';
import type {AnatomyParts} from '../src/softTissues';

describe('camera cut-away sampling', () => {
 it('fades only visible tissue in front of the target and restores it as the camera moves', () => {
  const parts = new Map() as AnatomyParts;
  for (const [id,z] of [['front',5],['behind',-5],['selected',3],['hidden',7]] as const) {
   const geometry = new THREE.BoxGeometry(3,3,1);geometry.translate(0,0,z);
   const mesh = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.id=id;
   const group = new THREE.Group();group.add(mesh);group.visible=id!=='hidden';group.updateMatrixWorld(true);
   parts.set(id,{id,group,meshes:[mesh],anchor:new THREE.Vector3(0,0,z)});
  }
  const connection = {record:{structureId:'selected'},footprint:{centerMm:[0,0,0],normal:[0,0,1],boundaryMm:[]}} as unknown as Connection;
  expect([...connectionOccluders(parts,new THREE.Vector3(0,0,10),connection,'selected')]).toEqual(['front']);
  expect([...connectionOccluders(parts,new THREE.Vector3(10,0,0),connection,'selected')]).toEqual([]);
  expect([...connectionOccluders(parts,new THREE.Vector3(0,0,-10),connection,'selected')]).toEqual(['behind']);
  for(const part of parts.values())for(const mesh of part.meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
 });
});

describe('connection highlighting', () => {
 it('includes EDL and all eight tendon insertion endpoints on toes 2–5', () => {
  const ids = connectionHighlightIds('edl');
  expect(ids.has('edl')).toBe(true);
  expect(ids.has('extensor-digitorum-tendons')).toBe(true);
  for (let toe=2; toe<=5; toe++) for (const segment of ['middle','distal']) {
   expect(ids.has(`phalanx-${toe}-${segment}`)).toBe(true);
  }
  expect(ids.size).toBe(10);
  for (const unrelated of ['edb','fdl','tibia','talus','navicular','superior-extensor','flexor-digitorum-tendons']) {
   expect(ids.has(unrelated)).toBe(false);
  }
 });
 it('highlights the muscle when following its tendon or insertion without spreading through shared bones', () => {
  expect(connectionHighlightIds('extensor-digitorum-tendons').has('edl')).toBe(true);
  const toe = connectionHighlightIds('phalanx-2-distal');
  expect(toe.has('edl')).toBe(true);
  expect(toe.has('fdl')).toBe(true);
  expect(toe.has('phalanx-3-distal')).toBe(false);
  const longus = connectionHighlightIds('fibularis');
  expect(longus.has('fibularis-longus-tendon')).toBe(true);
  expect(longus.has('metatarsal-1')).toBe(true);
  expect(longus.has('cuneiform-medial')).toBe(true);
  expect(longus.has('cuboid')).toBe(false);
  expect(longus.has('fibularis-brevis-tendon')).toBe(false);
 });
 it('leaves a structure with no authored attachment alone', () => {
  expect([...connectionHighlightIds('unmodeled')]).toEqual(['unmodeled']);
 });
});

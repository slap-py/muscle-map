import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { createAnkle } from '../src/ankle';
import { loadNeurovascularAssets, installNeurovascularAssets, neurovascularIds } from '../src/assets';
import { enableMeshPicking, intersectThinStructures } from '../src/picking';

describe('optional neurovascular assets', () => {
  it('installs all 49 shipped structures in millimetres with BVH picking, and updates anchors', async () => {
    const bytes=readFileSync(new URL('../public/models/neurovascular.glb',import.meta.url));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const model=createAnkle();
    const report=installNeurovascularAssets(gltf.scene,model.parts);
    expect(report.loaded).toHaveLength(49);expect(report.fallback).toEqual([]);expect(report.warnings).toEqual([]);
    for(const id of neurovascularIds){const part=model.parts.get(id)!;expect(part.meshes).toHaveLength(1);const m=part.meshes[0];expect(m.userData.thinStructure).toBe(true);expect(m.geometry.boundsTree).toBeDefined();expect(m.geometry.boundingBox!.getCenter(new THREE.Vector3()).distanceTo(part.anchor)).toBeLessThan(1e-5);expect(m.geometry.boundingBox!.max.y).toBeLessThan(367);
      const position=m.geometry.getAttribute('position'),indices=m.geometry.index;
      const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(position,indices?.getX(i)??i));
      const surface=vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
      const out=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
      const ray=new THREE.Raycaster(surface.clone().addScaledVector(out,2),out.clone().negate());ray.firstHitOnly=true;
      m.updateMatrixWorld();expect(ray.intersectObject(m).some(hit=>hit.object.userData.id===id),id).toBe(true);
}
    for(const part of model.parts.values())for(const mesh of part.meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
  });
  it('hides missing layers on a 404, leaves their geometry empty, and preserves the base model', async () => {
    const model=createAnkle(), tibia=model.parts.get('tibia')!.meshes[0];
    const report=await loadNeurovascularAssets(model.parts,'missing.glb',async()=>{throw new Error('404');});
    expect(report.loaded).toEqual([]);expect(report.fallback).toHaveLength(49);
    for(const id of neurovascularIds){expect(model.parts.get(id)!.group.visible).toBe(false);expect(model.parts.get(id)!.meshes).toHaveLength(0);}
    expect(model.parts.get('tibia')!.meshes[0]).toBe(tibia);
    for(const part of model.parts.values())for(const mesh of part.meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
  });
});

describe('thin structure screen-space picking',()=>{
  it('hits a subpixel tube four pixels from the pointer without modifying its surface; solid bone occludes it',()=>{
    const camera=new THREE.PerspectiveCamera(50,1,.1,1000);camera.position.z=100;camera.updateMatrixWorld();
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,20,6),new THREE.MeshBasicMaterial());
    mesh.userData.thinStructure=true;mesh.position.x=4*(2*100*Math.tan(THREE.MathUtils.degToRad(25)))/500;mesh.updateMatrixWorld();enableMeshPicking(mesh);
    const ray=new THREE.Raycaster();ray.firstHitOnly=true;const pointer=new THREE.Vector2();ray.setFromCamera(pointer,camera);
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    const before=Array.from(mesh.geometry.attributes.position.array);
    expect(intersectThinStructures(ray,camera,pointer,500,500,[mesh])?.object).toBe(mesh);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(before);
    const block=new THREE.Mesh(new THREE.BoxGeometry(20,30,2),new THREE.MeshBasicMaterial());block.position.z=20;block.updateMatrixWorld();enableMeshPicking(block);
    expect(intersectThinStructures(ray,camera,pointer,500,500,[mesh,block])).toBeUndefined();
    const faded=new THREE.Group();faded.userData.alpha=.2;faded.add(block);faded.updateMatrixWorld();
    expect(intersectThinStructures(ray,camera,pointer,500,500,[mesh,block])?.object).toBe(mesh);
    mesh.geometry.dispose();block.geometry.dispose();
  });
});

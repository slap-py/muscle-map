import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSkinMaterial } from '../src/skinMaterial';
import { enableMeshPicking, chooseDepthAwareHit } from '../src/picking';
import { disposeObject } from '../src/viewerResources';

describe('skin detail and accelerated visibility',()=>{
  it('adds shading detail without moving, reindexing or renormalizing the authored envelope',()=>{
    const g=new THREE.BoxGeometry(260,550,170);g.translate(50,175,15);g.computeBoundingBox();
    const positions=g.getAttribute('position').array.slice(),normals=g.getAttribute('normal').array.slice(),indices=g.index!.array.slice();
    const mat=createSkinMaterial(g,false,(_url,loaded)=>{ loaded();return new THREE.Texture(); }),mesh=new THREE.Mesh(g,mat);mesh.userData.skinSurface=true;
    expect(mat.bumpMap).toBeInstanceOf(THREE.Texture);expect(mat.map).toBeInstanceOf(THREE.Texture);
    expect(g.getAttribute('skinDorsal')).toBeDefined();
    enableMeshPicking(mesh);
    expect(g.getAttribute('position').array).toEqual(positions);expect(g.getAttribute('normal').array).toEqual(normals);expect(g.index!.array).toEqual(indices);
    let disposed=0;mat.map!.addEventListener('dispose',()=>disposed++);mat.bumpMap!.addEventListener('dispose',()=>disposed++);
    disposeObject(mesh);expect(disposed).toBe(2);expect(g.boundsTree).toBeUndefined();
  });
  it('matches the exact surface hit while accelerating skin and cap occlusion',()=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(10,48,24),new THREE.MeshStandardMaterial());mesh.userData.skinSurface=true;mesh.updateMatrixWorld();
    const ray=new THREE.Raycaster(new THREE.Vector3(0,0,30),new THREE.Vector3(0,0,-1));ray.firstHitOnly=true;
    const distance=ray.intersectObject(mesh)[0].distance;
    enableMeshPicking(mesh);expect(mesh.geometry.boundsTree).toBeDefined();expect(ray.intersectObject(mesh)[0].distance).toBeCloseTo(distance,8);
    mesh.userData.skinCap=true;expect(chooseDepthAwareHit(ray.intersectObject(mesh))).toBeUndefined();disposeObject(mesh);
  });
  it('keeps caps and the separate upper-leg frame free of projected foot detail',()=>{
    const g=new THREE.BoxGeometry(200,500,150);g.computeBoundingBox();
    for(const cap of [false,true]){const mat=createSkinMaterial(g,cap);expect(mat.map).toBeNull();expect(mat.bumpMap).toBeNull();mat.dispose();}g.dispose();
  });
});

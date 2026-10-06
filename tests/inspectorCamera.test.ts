import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {setInspectorInset} from '../src/camera';
describe('inspector camera inset',()=>{
  it('centers the target in the free canvas after resizing and TAA jitter cleanup',()=>{
    const camera=new THREE.PerspectiveCamera(45,1,1,10000);camera.position.set(0,0,1000);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    for(const covered of [0,312,652,692]){
      setInspectorInset(camera,1180,948,covered);
      // The temporal pass writes and then clears these offsets each frame.
      camera.setViewOffset(1180,948,.25,-.25,1180,948);camera.clearViewOffset();
      const projected=new THREE.Vector3().project(camera);
      expect((projected.x*.5+.5)*1180).toBeCloseTo((1180-covered)/2,6);
    }
  });
});

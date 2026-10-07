import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from '../src/viewerResources';
import { createPickingWorker, enableMeshPicking } from '../src/picking';
import { createAnkle } from '../src/ankle';
import { loadBoneAssets } from '../src/assets';

describe('viewer resource lifecycle', () => {
  it('releases shared geometry, picking trees, textures and parked materials once', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const full = new THREE.MeshPhysicalMaterial({ map: texture });
    const depth = new THREE.MeshDepthMaterial();
    const a = new THREE.Mesh(geometry, material), b = new THREE.Mesh(geometry, material);
    a.customDepthMaterial = depth; a.userData.fullMaterial = full;
    enableMeshPicking(a); root.add(a,b);
    const releases = new Map<object, number>();
    for (const resource of [geometry, texture, material, full, depth]) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1));
    disposeObject(root);
    expect(geometry.boundsTree).toBeUndefined();
    expect([...releases.values()]).toEqual([1,1,1,1,1]);
  });

  it('rejects queued picking work after disposal without creating a worker', async () => {
    let workers = 0;
    const picking = createPickingWorker(delta => { workers += delta; });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry());
    const pending = picking.build([mesh]);
    picking.dispose(); picking.dispose();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(workers).toBe(0); expect(mesh.geometry.boundsTree).toBeUndefined();
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });

  it('frees staged assets when picking is cancelled and preserves the installed model', async () => {
    const model = createAnkle();
    const old = model.parts.get('tibia')!.meshes[0];
    const source = new THREE.Group();
    const bone = new THREE.Mesh(new THREE.BoxGeometry(.02,.02,.02), new THREE.MeshStandardMaterial());
    bone.name = 'tibia'; source.add(bone);
    let releasedGeometry = false, releasedMaterial = false, releasedSource = false;
    bone.geometry.addEventListener('dispose', () => { releasedSource = true; });
    const report = await loadBoneAssets(model.parts, 'bones.glb', async () => source, undefined, async meshes => {
      meshes[0].geometry.addEventListener('dispose', () => { releasedGeometry = true; });
      (meshes[0].material as THREE.Material).addEventListener('dispose', () => { releasedMaterial = true; });
      throw new DOMException('Viewer disposed','AbortError');
    });
    expect(report.loaded).toEqual([]);
    expect(model.parts.get('tibia')!.meshes[0]).toBe(old);
    expect(releasedGeometry && releasedMaterial && releasedSource).toBe(true);
    disposeObject(model.root);
  });
});

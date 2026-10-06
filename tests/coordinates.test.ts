import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createAnkle } from "../src/ankle";
import { structures } from "../src/data";
import { anatomicalDirections, cameraPreset, coordinateConvention, legacyPointToMm, legacyToAnatomicalMatrix } from "../src/coordinates";

describe("millimeter anatomy contract", () => {
  it("uses a fixed atlas-linked datum and a proper right-handed rotation", () => {
    expect(legacyPointToMm(0, 0.84, 0.05).length()).toBeLessThan(1e-10);
    expect(coordinateConvention.origin.atlasId).toBe("talus");
    expect(coordinateConvention.source.url).toMatch(/^https:/);
    const x = new THREE.Vector3(...anatomicalDirections.anterior);
    const y = new THREE.Vector3(...anatomicalDirections.dorsal);
    expect(x.cross(y).toArray()).toEqual(anatomicalDirections.lateral);
    expect(legacyToAnatomicalMatrix.determinant()).toBeCloseTo(1e6);
    expect(legacyPointToMm(1, 0.84, 0.05).toArray()).toEqual([0, 0, -100]);
    expect(legacyPointToMm(0, 1.84, 0.05).y).toBeCloseTo(100);
    expect(legacyPointToMm(0, 0.84, 1.05).x).toBeCloseTo(100);
  });

  it("preserves overview projection while changing origin, scale and axes", () => {
    const old = new THREE.PerspectiveCamera(34, 1.2, 0.1, 100);
    const target = new THREE.Vector3(0, 1.43, 0.76);
    old.position.copy(target).addScaledVector(new THREE.Vector3(-0.8, 0.8, 1.5).normalize(), 8.5);
    old.lookAt(target);
    old.updateMatrixWorld();
    const next = new THREE.PerspectiveCamera(34, 1.2, 10, 10000);
    const preset = cameraPreset("foot", 1.2);
    next.position.copy(preset.position);
    next.lookAt(preset.target);
    next.updateMatrixWorld();
    for (const p of [[0, 0.84, 0.05], [0.53, 0.15, 1.75], [-0.45, 3.15, -0.05]]) {
      const a = new THREE.Vector3(...p).project(old);
      const b = legacyPointToMm(p[0], p[1], p[2]).project(next);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
  });

  it("bakes mm geometry, keeps medial anatomy on -Z, and anchors labels to matching bounds", () => {
    const model = createAnkle();
    expect(model.root.scale.toArray()).toEqual([1, 1, 1]);
    expect(model.root.position.length()).toBe(0);
    const bounds = new THREE.Box3().setFromObject(model.root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(200);
    expect(size.x).toBeLessThan(400);
    expect(size.y).toBeGreaterThan(250);
    expect(size.y).toBeLessThan(550); // Full calf and exterior extend above the distal-leg fallback.
    expect(model.parts.get("metatarsal-1")!.anchor.z).toBeLessThan(model.parts.get("metatarsal-5")!.anchor.z);
    for (const part of model.parts.values()) {
      expect(structures.some(s => s.id === part.id)).toBe(true);
      const center = new THREE.Box3().setFromObject(part.group).getCenter(new THREE.Vector3());
      expect(part.anchor.distanceTo(center)).toBeLessThan(1e-6);
      for (const mesh of part.meshes) {
        expect(mesh.userData.atlasId).toBe(part.id);
        expect(mesh.userData.id).toBe(part.id);
        if (!mesh.userData.fiber) expect(mesh.geometry.boundsTree).toBeDefined();
        mesh.geometry.dispose();
        expect(mesh.geometry.boundsTree).toBeUndefined();
      }
    }
  });

  it("BVH and ordinary raycasts agree on anatomy IDs and millimeter hit distances", () => {
    const model = createAnkle();
    model.root.updateMatrixWorld(true);
    const meshes = [...model.parts.values()].flatMap(p => p.meshes.filter(m => !m.userData.fiber));
    const ray = new THREE.Raycaster();
    ray.firstHitOnly = true;
    let hitCount = 0;
    for (const view of ["foot", "medial", "lateral", "dorsal", "plantar"]) {
      const { position } = cameraPreset(view, 1);
      for (const id of ["talus", "calcaneus", "metatarsal-1", "tibia"]) {
        ray.set(position, model.parts.get(id)!.anchor.clone().sub(position).normalize());
        const fast = ray.intersectObjects(meshes, false)[0];
        const normal: THREE.Intersection[] = [];
        for (const mesh of meshes) THREE.Mesh.prototype.raycast.call(mesh, ray, normal);
        normal.sort((a,b) => a.distance-b.distance);
        expect(fast?.object.userData.id).toBe(normal[0]?.object.userData.id);
        if (fast) {
          hitCount++;
          expect(fast.distance).toBeCloseTo(normal[0].distance, 4);
        }
      }
    }
    expect(hitCount).toBeGreaterThan(15);
    for (const mesh of meshes) mesh.geometry.dispose();
  });
});


/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createAnkle } from "../src/ankle";
import { boneIds, installBoneAssets, loadBoneAssets } from "../src/assets";

function dispose(model: ReturnType<typeof createAnkle>) {
  for (const part of model.parts.values()) for (const mesh of part.meshes) {
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  }
}
function bone(id: string, size = 0.02) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial());
  mesh.name = id;
  return mesh;
}

describe("bone asset integration", () => {
  it("bakes hierarchy and meters once, preserves record/group/anchor identity, and replaces all old submeshes", () => {
    const model = createAnkle(), part = model.parts.get("tibia")!;
    const group = part.group, anchor = part.anchor, old = [...part.meshes];
    group.visible = false;
    const scene = new THREE.Group(), source = new THREE.Group();
    source.userData.atlasId = "tibia";
    source.position.set(0.1, 0.2, -0.03);
    const a = bone("first"), b = bone("second");
    b.position.x = 0.02;
    source.add(a, b); scene.add(source);
    const report = installBoneAssets(scene, model.parts);
    expect(report.loaded).toEqual(["tibia"]);
    expect(report.fallback).toHaveLength(29);
    expect(part.group).toBe(group); expect(part.anchor).toBe(anchor);
    expect(group.visible).toBe(false); expect(part.meshes).toHaveLength(2);
    expect(anchor.x).toBeCloseTo(110, 3); expect(anchor.y).toBeCloseTo(200, 3); expect(anchor.z).toBeCloseTo(-30, 3);
    for (const mesh of part.meshes) {
      expect(mesh.matrix.equals(new THREE.Matrix4())).toBe(true);
      expect(mesh.userData.atlasId).toBe("tibia");
      expect(mesh.geometry.boundsTree).toBeDefined();
    }
    for (const mesh of old) { expect(mesh.parent).toBeNull(); expect(mesh.geometry.boundsTree).toBeUndefined(); }
    dispose(model);
  });

  it("keeps missing, unmatched and malformed bones procedural without affecting soft tissues", () => {
    const model = createAnkle();
    const oldTalus = model.parts.get("talus")!.meshes[0];
    const oldAchilles = model.parts.get("achilles")!.meshes[0];
    const scene = new THREE.Group();
    const bad = bone("talus");
    bad.geometry.getAttribute("position").setX(0, NaN);
    scene.add(bad, bone("talus"), bone("not-an-atlas-id"), bone("fibula"));
    const report = installBoneAssets(scene, model.parts);
    expect(report.loaded).toEqual(["fibula"]);
    expect(model.parts.get("talus")!.meshes[0]).toBe(oldTalus);
    expect(model.parts.get("achilles")!.meshes[0]).toBe(oldAchilles);
    expect(report.warnings.length).toBe(2);
    dispose(model);
  });

  it("retains every procedural bone if fetching or parsing fails", async () => {
    const model = createAnkle(), old = model.parts.get("talus")!.meshes[0];
    const report = await loadBoneAssets(model.parts, "missing.glb", async () => { throw new Error("404"); });
    expect(report.loaded).toHaveLength(0); expect(report.fallback).toEqual(boneIds);
    expect(model.parts.get("talus")!.meshes[0]).toBe(old);
    expect(old.geometry.boundsTree).toBeDefined();
    dispose(model);
  });

  it("loads all 30 shipped bones with exact IDs, identity transforms, triangle budgets and matching BVH hits", async () => {
    const buffer = readFileSync(new URL("../public/models/bones.glb", import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), "");
    const names: string[] = [];
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      names.push(o.name); expect(o.userData.atlasId).toBe(o.name);
      expect(o.position.length()).toBe(0); expect(o.scale.toArray()).toEqual([1, 1, 1]);
      expect(o.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      const triangles = (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) / 3;
      expect(triangles).toBeGreaterThanOrEqual(5000); expect(triangles).toBeLessThanOrEqual(20000);
    });
    expect(names.sort()).toEqual([...boneIds].sort());
    const model = createAnkle();
    const report = installBoneAssets(gltf.scene, model.parts);
    expect(report.fallback).toEqual([]); expect(report.warnings).toEqual([]);
    expect(report.loaded).toHaveLength(30);
    const bounds = new THREE.Box3();
    for (const id of boneIds) {
      const part = model.parts.get(id)!;
      expect(part.meshes).toHaveLength(1);
      const mesh = part.meshes[0];
      expect(mesh.userData.source).toBe("z-anatomy");
      expect(mesh.geometry.boundsTree).toBeDefined();
      bounds.union(mesh.geometry.boundingBox!);
      const ordinary = new THREE.Mesh(mesh.geometry, mesh.material);
      let hits = 0;
      for (const direction of [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(-1,1,-1).normalize(), new THREE.Vector3(1,-1,1).normalize()]) {
        const ray = new THREE.Raycaster(part.anchor.clone().addScaledVector(direction, 1000), direction.clone().negate());
        ray.firstHitOnly = true;
        const accelerated = ray.intersectObject(mesh), reference = ray.intersectObject(ordinary);
        expect(accelerated.length > 0).toBe(reference.length > 0);
        if (reference.length) {
          hits++; expect(accelerated[0].distance).toBeCloseTo(reference[0].distance, 5);
          expect(accelerated[0].object.userData.id).toBe(id);
        }
      }
      expect(hits, id).toBeGreaterThan(0);
    }
    // Meter export -> mm runtime; a double conversion or legacy rotation fails here.
    expect(bounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(150);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(350);
    expect(bounds.max.y).toBeGreaterThan(300); expect(bounds.max.y).toBeLessThan(500);
    expect(model.parts.get("talus")!.anchor.length()).toBeLessThan(8);
    expect(model.parts.get("metatarsal-1")!.anchor.z).toBeLessThan(model.parts.get("metatarsal-5")!.anchor.z);
    expect(model.parts.get("sesamoid-medial")!.anchor.z).toBeLessThan(model.parts.get("sesamoid-lateral")!.anchor.z);
    dispose(model);
  });
});

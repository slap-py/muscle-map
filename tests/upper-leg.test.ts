/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import leftUpperLegPack from "../src/regions/upper-leg/left";
import rightUpperLegPack from "../src/regions/upper-leg/right";
import { lowerLegPack } from "../src/regions/lower-leg";

const packs = [leftUpperLegPack, rightUpperLegPack];
const nativeGroups = ["bones", "muscles", "exterior", "neurovascular"] as const;

async function nativeScene(path: URL) {
  const bytes = readFileSync(path);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

function disposeScene(scene: { traverse: (visit: (object: any) => void) => void }) {
  scene.traverse(object => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) material.dispose();
  });
}

describe("upper-leg region packs", () => {
  it("exposes independent side-specific catalogs and source facts", () => {
    expect(leftUpperLegPack.id).toBe("left-upper-leg");
    expect(rightUpperLegPack.id).toBe("right-upper-leg");
    expect(leftUpperLegPack.title).toBe("Left Hip & Upper Leg");
    expect(rightUpperLegPack.title).toBe("Right Hip & Upper Leg");
    expect(new Set(leftUpperLegPack.structures.map(structure => structure.id)).size).toBe(leftUpperLegPack.structures.length);
    expect(new Set(rightUpperLegPack.structures.map(structure => structure.id)).size).toBe(rightUpperLegPack.structures.length);
    for (const pack of packs) {
      for (const id of ["hip-bone", "femur", "patella", "adductor-longus", "rectus-femoris"])
        expect(pack.byId[id], `${pack.id}/${id}`).toBeDefined();
      const adductor = pack.byId["adductor-longus"];
      expect(adductor.tissue).toBe("muscle");
      expect(adductor.origin).toBeTruthy();
      expect(adductor.insertion).toBeTruthy();
      expect(adductor.references?.length).toBeGreaterThan(0);
      expect(pack.assets.bones).toMatch(new RegExp(`models/${pack.id}/bones\\.glb$`));
      expect(pack.assets.muscles).toMatch(new RegExp(`models/${pack.id}/muscles\\.glb$`));
      expect(pack.assets.exterior).toMatch(new RegExp(`models/${pack.id}/exterior\\.glb$`));
      expect(pack.assets.neurovascular).toMatch(new RegExp(`models/${pack.id}/neurovascular\\.glb$`));
    }
  });

  it("uses mirrored medial and lateral camera directions while preserving the lower-leg pack", () => {
    expect(leftUpperLegPack.cameraViews.medial[2]).toBeGreaterThan(0);
    expect(leftUpperLegPack.cameraViews.lateral[2]).toBeLessThan(0);
    expect(rightUpperLegPack.cameraViews.medial[2]).toBeLessThan(0);
    expect(rightUpperLegPack.cameraViews.lateral[2]).toBeGreaterThan(0);
    expect(lowerLegPack.id).toBe("lower-leg");
    expect(lowerLegPack.structureCounts.total).toBe(156);
    expect(lowerLegPack.assets.bones).toMatch(/models\/bones\.glb$/);
    expect(lowerLegPack.assets.muscles).toMatch(/models\/muscles\.glb$/);
  });

  it("contains native meshes with registered atlas IDs and identity source transforms", async () => {
    for (const pack of packs) {
      for (const group of nativeGroups) {
        const gltf = await nativeScene(new URL(`../public/models/${pack.id}/${group}.glb`, import.meta.url));
        const meshes: any[] = [];
        gltf.scene.traverse(object => { if ((object as any).isMesh) meshes.push(object); });
        expect(meshes.length, `${pack.id}/${group}`).toBeGreaterThan(0);
        for (const mesh of meshes) {
          const atlasId = mesh.userData.atlasId as string;
          expect(atlasId, `${pack.id}/${group}/${mesh.name}`).toEqual(expect.any(String));
          expect(pack.byId[atlasId], `${pack.id}/${atlasId}`).toBeDefined();
          expect(mesh.position.length()).toBe(0);
          expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
          expect(mesh.quaternion.toArray()).toEqual([0, 0, 0, 1]);
          const positions = mesh.geometry.getAttribute("position");
          expect(positions.count).toBeGreaterThanOrEqual(3);
          expect(Number.isFinite(positions.getX(0))).toBe(true);
        }
        disposeScene(gltf.scene);
      }
    }
  });
});

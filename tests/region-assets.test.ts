import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createAnkle } from "../src/ankle";
import { colors, type Structure, type Tissue } from "../src/data";
import { createRegionAssetLoaders } from "../src/assets";

function structure(id: string, tissue: Tissue): Structure {
  return {
    id, name: id, tissue, region: "Thigh", group: "Test", description: "test",
    role: "test", connection: "test", hint: "test",
  };
}

function addPart(model: ReturnType<typeof createAnkle>, id: string) {
  const group = new THREE.Group();
  const part = { id, group, meshes: [] as THREE.Mesh[], anchor: new THREE.Vector3() };
  model.root.add(group);
  model.parts.set(id, part);
  return part;
}

function mesh(id: string) {
  const result = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial());
  result.name = id;
  return result;
}

function dispose(model: ReturnType<typeof createAnkle>) {
  for (const part of model.parts.values()) {
    for (const value of part.meshes) {
      value.geometry.dispose();
      for (const material of Array.isArray(value.material) ? value.material : [value.material]) material.dispose();
    }
  }
}

describe("region asset loaders", () => {
  it("uses local metadata for foreign IDs and mixed tissue groups", async () => {
    const model = createAnkle();
    const part = addPart(model, "regional-fascia");
    const local = [structure("regional-fascia", "fascia")];
    const loaders = createRegionAssetLoaders(local, { bones: ["regional-fascia"], muscles: [], exterior: [], neurovascular: [] });
    const scene = new THREE.Group();
    scene.add(mesh("regional-fascia"));
    const report = await loaders.loadBoneAssets(model.parts, "regional.glb", async () => scene);
    const loaded = part.meshes[0];
    expect(report.loaded).toEqual(["regional-fascia"]);
    expect(report.fallback).toEqual([]);
    expect((loaded.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(colors.fascia.slice(1));
    expect((loaded.material as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);
    expect(loaded.userData.source).toBe("z-anatomy");
    expect(loaded.userData.atlasId).toBe("regional-fascia");
    dispose(model);
  });

  it("returns only local IDs and empties unavailable regional groups", async () => {
    const model = createAnkle();
    const part = addPart(model, "foreign-bone");
    const old = mesh("foreign-bone");
    part.meshes.push(old);
    part.group.add(old);
    const loaders = createRegionAssetLoaders([structure("foreign-bone", "bone")], { bones: ["foreign-bone"], muscles: [], exterior: [], neurovascular: [] });
    const report = await loaders.loadBoneAssets(model.parts, "missing.glb", async () => { throw new Error("404"); });
    expect(report.loaded).toEqual([]);
    expect(report.fallback).toEqual(["foreign-bone"]);
    expect(report.fallback).not.toContain("tibia");
    expect(part.meshes).toEqual([]);
    expect(part.group.visible).toBe(false);
    expect(part.group.userData.unavailable).toBe(true);
    dispose(model);
  });
});

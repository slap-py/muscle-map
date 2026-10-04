import { describe, expect, it } from "vitest";
import { createAnkle } from "../src/ankle";
import { structures } from "../src/data";
import { footBones, footConnections, footLinks, relatedIds } from "../src/foot";

describe("regional anatomy geometry", () => {
  it("models 26 distinct standard foot bones with the correct toe segments", () => {
    expect(footBones).toHaveLength(26);
    expect(footBones.filter((b) => b.group === "Tarsals")).toHaveLength(7);
    expect(footBones.filter((b) => b.group === "Metatarsals")).toHaveLength(5);
    expect(footBones.filter((b) => b.group === "Phalanges")).toHaveLength(14);
    expect(footBones.some((b) => b.id === "phalanx-1-middle")).toBe(false);
    for (let n = 2; n <= 5; n++)
      expect(
        footBones.filter((b) => b.id.startsWith(`phalanx-${n}-`)),
      ).toHaveLength(3);
  });
  it("has valid, reciprocal attachment links and separate tendon / ligament geometry", () => {
    const ids = new Set(structures.map((s) => s.id));
    for (const [a, b] of footLinks) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
      expect(relatedIds(a).has(b)).toBe(true);
      expect(relatedIds(b).has(a)).toBe(true);
    }
    expect(relatedIds("atfl")).toEqual(new Set(["fibula", "talus"]));
    expect(relatedIds("metatarsal-1").has("tibialis-anterior-tendon")).toBe(
      true,
    );
    for (const c of footConnections) {
      expect(c.paths.length).toBeGreaterThan(0);
      for (const path of c.paths) expect(path.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("provides finite selectable geometry for every regional atlas entry", () => {
    const model = createAnkle();
    expect(
      structures.some((s) => s.id === "femur" || s.region === "Knee"),
    ).toBe(false);
    expect(new Set(structures.map((s) => s.id)).size).toBe(structures.length);
    for (const s of structures)
      expect(model.parts.get(s.id)!.meshes.length).toBeGreaterThan(0);

    for (const part of model.parts.values())
      for (const mesh of part.meshes) {
        const a = mesh.geometry.attributes.position.array;
        expect(Array.from(a).every(Number.isFinite)).toBe(true);
      }

    for (const part of model.parts.values())
      for (const mesh of part.meshes) {
        const a = mesh.geometry.attributes.position.array;
        expect(mesh.geometry.boundingSphere?.radius ?? 1).toBeGreaterThan(0);
        mesh.geometry.dispose();
      }
  });
});

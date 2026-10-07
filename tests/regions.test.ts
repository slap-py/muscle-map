import { describe, expect, it } from "vitest";
import { lowerLegPack } from "../src/regions/lower-leg";
import { validateRegionPack } from "../src/regions";
import { regionCatalog, validateRegionCatalog } from "../src/regions/catalog";

describe("region packs", () => {
  it("ships the lower leg pack with unique structure IDs", () => {
    const ids = lowerLegPack.structures.map(structure => structure.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lowerLegPack.structureCounts.total).toBe(ids.length);
  });
  it("declares every model asset URL", () => {
    expect(lowerLegPack.assets.bones).toMatch(/models\/bones\.glb$/);
    expect(lowerLegPack.assets.muscles).toMatch(/models\/muscles\.glb$/);
    expect(lowerLegPack.assets.exterior).toMatch(/models\/exterior\.glb$/);
    expect(lowerLegPack.assets.neurovascular).toMatch(/models\/neurovascular\.glb$/);
  });
  it("requires a compass direction on every view preset", () => {
    expect(lowerLegPack.viewPresets.length).toBeGreaterThan(0);
    expect(lowerLegPack.viewPresets.every(view => lowerLegPack.directions.some(direction => direction.id === view.direction))).toBe(true);
  });
  it("keeps lightweight catalog metadata consistent with the lazy pack", () => {
    const entry = regionCatalog.find(region => region.id === lowerLegPack.id)!;
    expect(entry.structureCounts).toEqual(lowerLegPack.structureCounts);
    expect(Object.values(entry.structureCounts.byTissue).reduce((sum, count) => sum + count, 0)).toBe(156);
    expect(entry.thumbnail).toBe(lowerLegPack.thumbnail);
    expect(() => validateRegionCatalog([entry, entry])).toThrow(/unique/);
  });
  it("rejects duplicate IDs, missing assets, and undirected views", () => {
    const duplicate = { ...lowerLegPack, structures: [...lowerLegPack.structures, lowerLegPack.structures[0]] };
    expect(() => validateRegionPack(duplicate)).toThrow(/duplicate structure ids/);
    const missingAsset = { ...lowerLegPack, assets: { ...lowerLegPack.assets, bones: "" } };
    expect(() => validateRegionPack(missingAsset)).toThrow(/bones asset URL/);
    const missingDirection = { ...lowerLegPack, viewPresets: [{ ...lowerLegPack.viewPresets[0], direction: "" }] };
    expect(() => validateRegionPack(missingDirection)).toThrow(/missing a direction/);
    const unknownDirection = { ...lowerLegPack, viewPresets: [{ ...lowerLegPack.viewPresets[0], direction: "unknown" }] };
    expect(() => validateRegionPack(unknownDirection)).toThrow(/unknown direction/);
  });
});

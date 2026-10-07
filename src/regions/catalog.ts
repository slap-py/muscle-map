import { lowerLegCredits } from "./lower-leg/credits";
import type { RegionPack, RegionStructureCounts } from "./index";

export interface RegionCatalogEntry {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  dimThumbnail: string;
  structureCounts: RegionStructureCounts;
  credits: { sourcesHtml: string; footer: string };
  load: () => Promise<RegionPack>;
}

const lowerLegCounts: RegionStructureCounts = {
  total: 156,
  byTissue: { skin: 1, bone: 30, muscle: 13, tendon: 12, ligament: 15, fascia: 6, cartilage: 30, artery: 19, vein: 14, nerve: 16 },
};

/** Static hub metadata. The viewer pack remains lazy and is only imported by load(). */
export const regionCatalog: readonly RegionCatalogEntry[] = [{
  id: "lower-leg",
  title: "Right Foot & Ankle",
  description: "Explore the right foot and ankle through bones, muscles, connective tissues, vessels and nerves.",
  thumbnail: `${import.meta.env.BASE_URL}regions/lower-leg.png`,
  dimThumbnail: `${import.meta.env.BASE_URL}regions/lower-leg-dim.png`,
  structureCounts: lowerLegCounts,
  credits: lowerLegCredits,
  load: async () => (await import("./lower-leg")).default,
}];

export function validateRegionCatalog(entries: readonly RegionCatalogEntry[]) {
  const ids = entries.map(entry => entry.id);
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) throw new Error("Region catalog requires unique, nonempty ids");
  return entries;
}
validateRegionCatalog(regionCatalog);

export const defaultRegionId = "lower-leg";
export function regionForId(id: string | null | undefined): RegionCatalogEntry | undefined {
  return regionCatalog.find(region => region.id === id);
}

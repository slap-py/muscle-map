import { leftLowerLegCredits } from "./left-lower-leg/credits";
import { upperLegCredits } from "./upper-leg/credits";
import leftUpperCounts from "./upper-leg/left-counts.json";
import rightUpperCounts from "./upper-leg/right-counts.json";
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
  title: "Right Lower Leg & Foot",
  description: "Explore the right foot and ankle through bones, muscles, connective tissues, vessels and nerves.",
  thumbnail: `${import.meta.env.BASE_URL}regions/lower-leg.png`,
  dimThumbnail: `${import.meta.env.BASE_URL}regions/lower-leg-dim.png`,
  structureCounts: lowerLegCounts,
  credits: lowerLegCredits,
  load: async () => (await import("./lower-leg")).default,
}, {
  id: "left-lower-leg", title: "Left Lower Leg & Foot",
  description: "Explore the left lower leg and foot through bones, muscles, connective tissues, vessels and nerves.",
  thumbnail: `${import.meta.env.BASE_URL}regions/left-lower-leg.png`,
  dimThumbnail: `${import.meta.env.BASE_URL}regions/left-lower-leg-dim.png`,
  structureCounts: lowerLegCounts, credits: leftLowerLegCredits,
  load: async () => (await import("./left-lower-leg")).default,
}, {
  id: "right-upper-leg", title: "Right Hip & Upper Leg",
  description: "Explore the right thigh with hip and knee context, muscle attachments, joint tissues, vessels and nerves.",
  thumbnail: `${import.meta.env.BASE_URL}regions/right-upper-leg.png`,
  dimThumbnail: `${import.meta.env.BASE_URL}regions/right-upper-leg-dim.png`,
  structureCounts: rightUpperCounts, credits: upperLegCredits,
  load: async () => (await import("./upper-leg/right")).default,
}, {
  id: "left-upper-leg", title: "Left Hip & Upper Leg",
  description: "Explore the left thigh with hip and knee context, muscle attachments, joint tissues, vessels and nerves.",
  thumbnail: `${import.meta.env.BASE_URL}regions/left-upper-leg.png`,
  dimThumbnail: `${import.meta.env.BASE_URL}regions/left-upper-leg-dim.png`,
  structureCounts: leftUpperCounts, credits: upperLegCredits,
  load: async () => (await import("./upper-leg/left")).default,
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

/** The illustrative skin layer is excluded from advertised anatomical structure counts. */
export function browsableCounts(counts: RegionStructureCounts): RegionStructureCounts {
  const { skin: _skin, ...byTissue } = counts.byTissue;
  return { total: Object.values(byTissue).reduce((sum, count) => sum + (count ?? 0), 0), byTissue };
}

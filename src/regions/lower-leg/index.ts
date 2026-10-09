import neurovascularCatalog from "../../neurovascularCatalog.json";
import { structures, byId, tissueNames, colors, type Tissue } from "../../data";
import { atlasTabs as sourceAtlasTabs, atlasIds } from "../../atlas";
import { directions, createCompass } from "../../compass";
import { cameraViews, cameraPreset, legacyPointToMm, anatomicalDirections, legacyToAnatomicalMatrix, coordinateConvention, LEGACY_UNIT_MM } from "../../coordinates";
import { labelTier, tierForZoom } from "../../labels";
import { createAnkle } from "../../ankle";
import { rebuildSoftTissues } from "../../softTissues";
import { loadBoneAssets, loadMuscleAssets, loadExteriorAssets, loadNeurovascularAssets, createAssetSceneLoader, neurovascularTissues, isNeurovascular } from "../../assets";
import { attachmentRecords, attachmentsFor, attachmentSources, type AttachmentRecord, type Footprint, type GuidePoint } from "../../attachments";
import { connectionsFor, directlyAttachedIds, connectionHighlightIds, footprintDecal, connectionCameraPose, connectionOccluders, connectionClinicalPoints, type Connection } from "../../connections";
import { relatedIds, footStructures, footLinks, buildFoot, rays } from "../../foot";
import { validateRegionPack, type RegionArea, type RegionPack } from "../index";

export type { AttachmentRecord, Footprint, GuidePoint, Connection, RegionPack };
export { structures, byId, tissueNames, colors, sourceAtlasTabs as atlasTabs, atlasIds };
export { directions, createCompass, cameraViews, cameraPreset, legacyPointToMm, anatomicalDirections, legacyToAnatomicalMatrix, coordinateConvention, LEGACY_UNIT_MM, labelTier, tierForZoom };
export { createAnkle, rebuildSoftTissues };
export { attachmentRecords, attachmentsFor, attachmentSources };
export { connectionsFor, directlyAttachedIds, connectionHighlightIds, footprintDecal, connectionCameraPose, connectionOccluders, connectionClinicalPoints };
export { relatedIds, footStructures, footLinks, buildFoot, rays };
export { loadBoneAssets, loadMuscleAssets, loadExteriorAssets, loadNeurovascularAssets, createAssetSceneLoader };

export const atlasAreas: readonly RegionArea[] = sourceAtlasTabs.map(([id, label], index) => ({ id, label: id === "all" ? "All areas" : label, group: index < 4 ? "" : "Toes" }));
const viewLabels: Record<string, string> = { foot: "Overview", dorsal: "Dorsal", plantar: "Plantar", medial: "Medial", lateral: "Lateral", anterior: "Anterior", posterior: "Posterior" };
const viewDirections: Record<string, string> = { foot: "anterior", dorsal: "dorsal", plantar: "plantar", medial: "medial", lateral: "lateral", anterior: "anterior", posterior: "posterior" };
export const viewPresets = ["foot", "dorsal", "plantar", "medial", "lateral"].map(id => ({ id, label: viewLabels[id], direction: viewDirections[id], preset: (aspect: number) => cameraPreset(id, aspect) }));
const base = import.meta.env.BASE_URL;
export const assetUrls = { bones: `${base}models/bones.glb`, muscles: `${base}models/muscles.glb`, exterior: `${base}models/exterior.glb`, neurovascular: `${base}models/neurovascular.glb` } as const;
export const assets = assetUrls;
const neurovascularSources = Object.fromEntries(neurovascularCatalog.map(record => [record.id, record.sourceObject]));
// Frozen superior crop from public/models/neurovascular.manifest.json, in this pack's local frame.
const neurovascularCropYMaxMm = 365.34449458122253;
export const tissueKeys: readonly Tissue[] = ["skin", "bone", "muscle", "tendon", "ligament", "fascia", "cartilage", "artery", "vein", "nerve"];
export const atlasOrder: readonly Tissue[] = ["bone", "muscle", "tendon", "ligament", "fascia", "artery", "vein", "nerve", "cartilage", "skin"];
export const atlasNames: Readonly<Record<Tissue, string>> = { ...tissueNames, skin: "Skin", fascia: "Fascia & retinacula" };
export const presets = [
  { id: "exterior", icon: `<svg class="brand-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 2c3-1 5 1 4 4l-2 5c-1 2 0 4-2 6-2 2-6 1-6-2 0-2 2-4 3-6s0-6 3-7Z"/><path d="m9 9 5 2"/></svg>`, skinOpacity: 1, label: "Exterior", tissues: ["skin", "bone"] as Tissue[] },
  { id: "anatomy", label: "Anatomy", icon: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13C3 4 13 2 13 3c0 9-9 11-10 10ZM4 12l8-8"/></svg>`, opacity: 1, tissues: tissueKeys.filter(t => t !== "skin" && t !== "artery" && t !== "vein" && t !== "nerve") },
  { id: "skeleton", label: "Skeleton", icon: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2a2 2 0 0 0-3 3l3 1 5 5 1 3a2 2 0 0 0 3-3l-3-1-5-5Z"/></svg>`, tissues: ["bone", "cartilage"] as Tissue[] },
  { id: "neurovascular", label: "Neurovascular", opacity: 0.2, tissues: ["bone", "muscle", "artery", "vein", "nerve"] as Tissue[] },
] as const;
export const about = {
  title: "Right Lower Leg & Foot",
  overview: "Explore the right lower leg and foot with selectable Z-Anatomy bones, muscle bellies, arteries, veins and nerves. Zoom to reveal more labels, filter the grouped structure list by tissue or area, and resize or expand the details panel for a closer look at muscle anatomy and attachments.",
  controls: [{ key: "Drag", description: "Orbit the model" }, { key: "Right-drag / Shift-drag", description: "Pan; P toggles pan mode" }, { key: "Scroll / pinch", description: "Zoom; closer views reveal more labels" }, { key: "1–5", description: "Overview, dorsal, plantar, medial, lateral" }, { key: "F", description: "Focus selection" }, { key: "L", description: "Toggle labels" }, { key: "R", description: "Reset model, layers and filters" }, { key: "Esc", description: "Restore surroundings and clear selection" }],
  overviewHtml: `<p>Explore the right lower leg and foot with selectable Z-Anatomy bones, muscle bellies, arteries, veins and nerves. Zoom to reveal more labels, filter the grouped structure list by tissue or area, and resize or expand the details panel for a closer look at muscle anatomy and attachments.</p><p class="stats">${structures.filter(s=>s.tissue==='bone').length} bones · ${structures.filter(s=>s.tissue==='muscle').length} muscles · ${structures.filter(s=>s.tissue==='tendon'||s.tissue==='ligament').length} tendons &amp; ligaments · ${structures.filter(s=>s.tissue!=="skin").length} structures</p><p>This is a simplified study model, not a clinical reference. Attachment footprint extents are illustrative surface fits. The model is static and makes no biomechanical predictions. Bursae and tendon sheaths are omitted; some ligament bundles are grouped.</p>`,
  controlsHtml: `<dl class="shortcuts"><dt>Drag</dt><dd>Orbit the model</dd><dt>Right-drag / Shift-drag</dt><dd>Pan; P toggles pan mode</dd><dt>Scroll / pinch</dt><dd>Zoom; closer views reveal more labels</dd><dt>1–5</dt><dd>Overview, dorsal, plantar, medial, lateral</dd><dt>F</dt><dd>Focus selection</dd><dt>L</dt><dd>Toggle labels</dd><dt>R</dt><dd>Reset model, layers and filters</dd><dt>Esc</dt><dd>Restore surroundings and clear selection</dd><dt>Canvas arrows</dt><dd>Pan when the canvas has focus</dd><dt>List ↑ / ↓ / Enter</dt><dd>Move between visible rows and select</dd><dt>Inspector edge</dt><dd>Drag to resize; focus it and use ← / → for 24px steps</dd><dt>Inspector ↔</dt><dd>Expand to 640px or restore your saved width</dd><dt>Attachment card</dt><dd>Zoom to its footprint; select again to return</dd></dl>`,
} as const;
const byTissue = Object.fromEntries(tissueKeys.map(tissue => [tissue, structures.filter(structure => structure.tissue === tissue).length]));
export const defaultView = "foot" as const;
export const defaultMode = "anatomy" as const;
export const structureCounts = { total: structures.length, byTissue } as const;
export const loaders = { loadBoneAssets, loadMuscleAssets, loadExteriorAssets, loadNeurovascularAssets, createAssetSceneLoader };
export const scene = {
  initialCamera: legacyPointToMm(0.25, 6.1, 23),
  keyPosition: legacyPointToMm(-4, 12, 7), keyTarget: legacyPointToMm(0, 0, 0),
  fillPosition: legacyPointToMm(5, 6, -4), fillTarget: legacyPointToMm(0, 0, 0),
  floorPosition: legacyPointToMm(0, 0.06, 0),
};
export const lowerLegPack: RegionPack = validateRegionPack({ id: "lower-leg", title: "Right Lower Leg & Foot", description: "An interactive study model of the right lower leg and foot.", thumbnail: `${base}regions/lower-leg.png`, structures, byId, neurovascularSources, neurovascularCropYMaxMm, tissueNames, colors, atlasTabs: atlasAreas, atlasAreas, atlasIds, directions, cameraViews, cameraPreset, viewPresets, labelTier, tierForZoom, presets, assets: assetUrls, assetUrls, about, structureCounts, scene, createCompass, createAnkle, rebuildSoftTissues, attachmentSources, connectionsFor, directlyAttachedIds, connectionHighlightIds, footprintDecal, connectionCameraPose, connectionOccluders, connectionClinicalPoints, relatedIds, legacyPointToMm, neurovascularTissues, isNeurovascular, defaultView, defaultMode, tissueKeys, atlasOrder, atlasNames, loaders });
export default lowerLegPack;

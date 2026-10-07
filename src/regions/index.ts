import type * as THREE from "three";
import type { Structure, Tissue } from "../data";
import type { createAnkle } from "../ankle";
import type { rebuildSoftTissues } from "../softTissues";
import type { loadBoneAssets, loadExteriorAssets, loadMuscleAssets, loadNeurovascularAssets, createAssetSceneLoader } from "../assets";
import type { createCompass } from "../compass";
import type { attachmentSources } from "../attachments";
import type { directlyAttachedIds, connectionHighlightIds, footprintDecal, connectionCameraPose, connectionOccluders, connectionClinicalPoints, connectionsFor } from "../connections";
import type { relatedIds } from "../foot";
import type { legacyPointToMm } from "../coordinates";
import type { neurovascularTissues, isNeurovascular } from "../assets";

export interface RegionPreset { id: string; label: string; tissues: readonly Tissue[]; icon?: string; opacity?: number; skinOpacity?: number; }
export interface RegionViewPreset { id: string; label: string; direction: string; preset: (aspect: number) => { target: THREE.Vector3; position: THREE.Vector3 }; }
export interface RegionAssetUrls { bones: string; muscles: string; exterior: string; neurovascular: string; }
export interface RegionAboutCopy { title: string; overview: string; overviewHtml: string; controlsHtml: string; controls: readonly { key: string; description: string }[]; }
export interface RegionArea { id: string; label: string; group: string; }
export interface RegionStructureCounts { total: number; byTissue: Readonly<Partial<Record<Tissue, number>>>; }
export interface RegionPack {
  id: string; title: string; description: string; thumbnail: string;
  structures: readonly Structure[]; byId: Readonly<Record<string, Structure>>;
  tissueNames: Readonly<Record<Tissue, string>>; colors: Readonly<Record<Tissue, string>>;
  atlasTabs: readonly RegionArea[]; atlasAreas: readonly RegionArea[]; atlasIds: (area: string) => Set<string>;
  directions: readonly { id: string; short: string; label: string; v: [number, number, number]; color: string }[];
  cameraViews: Readonly<Record<string, readonly [number, number, number]>>; cameraPreset: (view: string, aspect: number) => { target: THREE.Vector3; position: THREE.Vector3 };
  viewPresets: readonly RegionViewPreset[]; labelTier: Readonly<Record<string, 1 | 2 | 3>>; tierForZoom: (ratio: number) => 1 | 2 | 3;
  presets: readonly RegionPreset[]; defaultView: string; defaultMode: string; tissueKeys: readonly Tissue[]; atlasOrder: readonly Tissue[]; atlasNames: Readonly<Record<Tissue, string>>; assets: RegionAssetUrls; assetUrls: RegionAssetUrls; about: RegionAboutCopy; structureCounts: RegionStructureCounts;
  scene: {
    initialCamera: THREE.Vector3; keyPosition: THREE.Vector3; keyTarget: THREE.Vector3;
    fillPosition: THREE.Vector3; fillTarget: THREE.Vector3; floorPosition: THREE.Vector3;
  };
  createCompass: typeof createCompass;
  createAnkle: typeof createAnkle; rebuildSoftTissues: typeof rebuildSoftTissues; attachmentSources: typeof attachmentSources; connectionsFor: typeof connectionsFor; directlyAttachedIds: typeof directlyAttachedIds; connectionHighlightIds: typeof connectionHighlightIds; footprintDecal: typeof footprintDecal; connectionCameraPose: typeof connectionCameraPose; connectionOccluders: typeof connectionOccluders; connectionClinicalPoints: typeof connectionClinicalPoints; relatedIds: typeof relatedIds; legacyPointToMm: typeof legacyPointToMm; neurovascularTissues: typeof neurovascularTissues; isNeurovascular: typeof isNeurovascular;
  loaders: { loadBoneAssets: typeof loadBoneAssets; loadMuscleAssets: typeof loadMuscleAssets; loadExteriorAssets: typeof loadExteriorAssets; loadNeurovascularAssets: typeof loadNeurovascularAssets; createAssetSceneLoader: typeof createAssetSceneLoader };
}
export function validateRegionPack(pack: RegionPack): RegionPack {
  if (!pack || typeof pack !== "object") throw new Error("Region pack must be an object");
  if (!pack.id?.trim()) throw new Error("Region pack id is required");
  if (!pack.title?.trim()) throw new Error(`Region pack ${pack.id} title is required`);
  const ids = pack.structures.map(structure => structure.id);
  if (ids.some(id => !id?.trim())) throw new Error(`Region pack ${pack.id} contains a structure without an id`);
  if (new Set(ids).size !== ids.length) throw new Error(`Region pack ${pack.id} contains duplicate structure ids`);
  for (const key of ["bones", "muscles", "exterior", "neurovascular"] as const)
    if (typeof pack.assets?.[key] !== "string" || !pack.assets[key].trim()) throw new Error(`Region pack ${pack.id} is missing the ${key} asset URL`);
  const viewIds = pack.viewPresets.map(view => view.id);
  if (viewIds.some(id => !id?.trim())) throw new Error(`Region pack ${pack.id} contains a view without an id`);
  if (new Set(viewIds).size !== viewIds.length) throw new Error(`Region pack ${pack.id} contains duplicate view ids`);
  const directionIds = new Set(pack.directions.map(direction => direction.id));
  if (directionIds.size !== pack.directions.length) throw new Error(`Region pack ${pack.id} contains duplicate direction ids`);
  for (const view of pack.viewPresets) {
    if (!view.direction?.trim()) throw new Error(`Region pack ${pack.id} view ${view.id} is missing a direction`);
    if (!directionIds.has(view.direction)) throw new Error(`Region pack ${pack.id} view ${view.id} has an unknown direction`);
  }
  if (!viewIds.includes(pack.defaultView)) throw new Error(`Region pack ${pack.id} is missing its default view`);
  const presetIds = pack.presets.map(preset => preset.id);
  if (new Set(presetIds).size !== presetIds.length) throw new Error(`Region pack ${pack.id} contains duplicate preset ids`);
  if (!presetIds.includes(pack.defaultMode)) throw new Error(`Region pack ${pack.id} is missing its default mode`);
  return pack;
}

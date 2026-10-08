import * as THREE from "three";
import { createAnkle as createRightAnkle } from "../../ankle";
import { rebuildSoftTissues as rebuildRightSoftTissues } from "../../softTissues";
import { enableMeshPicking, type BvhBuilder } from "../../picking";
import {
  loadBoneAssets as loadRightBoneAssets,
  loadMuscleAssets as loadRightMuscleAssets,
  loadExteriorAssets as loadRightExteriorAssets,
  loadNeurovascularAssets as loadRightNeurovascularAssets,
  createAssetSceneLoader,
  neurovascularTissues,
  isNeurovascular,
  type AssetReport,
  createRegionAssetLoaders,
} from "../../assets";
import { createCompass as createRightCompass } from "../../compass";
import { type Structure, type Tissue } from "../../data";
import { lowerLegPack as sourcePack, attachmentRecords as sourceAttachmentRecords, attachmentsFor as sourceAttachmentsFor, footStructures as sourceFootStructures, footLinks as sourceFootLinks, relatedIds as sourceRelatedIds, buildFoot as sourceBuildFoot, rays as sourceRays } from "../lower-leg";
import { validateRegionPack, type RegionArea, type RegionPack } from "../index";

export type { RegionPack, Tissue };
export type { AssetReport };

const reflection = new THREE.Matrix4().makeScale(1, 1, -1);
const legacyReflection = new THREE.Matrix4().makeScale(-1, 1, 1);
const vectorKeys = new Set([
  "seedMm", "positionMm", "authoredPositionMm", "centerMm", "normal", "boundaryMm",
  "centerlineMm", "pointMm", "targetMm", "anchorMm", "directionMm",
]);

function mirrorPoint(point: readonly number[]): [number, number, number] {
  return [point[0], point[1], -point[2]];
}

/** Mirror spatial metadata without changing IDs, face indices, or source provenance. */
function mirrorMetadata(value: unknown, key = ""): unknown {
  if (value instanceof THREE.Vector3) return value.clone().applyMatrix4(reflection);
  if (Array.isArray(value)) {
    if (vectorKeys.has(key) && value.length === 3 && value.every(item => typeof item === "number"))
      return mirrorPoint(value as number[]);
    return value.map(item => mirrorMetadata(item, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, mirrorMetadata(childValue, childKey)]));
  }
  return value;
}

function reverseWinding(geometry: THREE.BufferGeometry) {
  const index = geometry.index;
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const b = index.getX(i + 1), c = index.getX(i + 2);
      index.setX(i + 1, c);
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
    return;
  }
  const attributes = Object.values(geometry.attributes);
  for (let i = 0; i + 2 < geometry.getAttribute("position").count; i += 3) {
    for (const attribute of attributes) {
      const a = i + 1, b = i + 2;
      for (let component = 0; component < attribute.itemSize; component++) {
        const first = attribute.getComponent(a, component);
        attribute.setComponent(a, component, attribute.getComponent(b, component));
        attribute.setComponent(b, component, first);
      }
      attribute.needsUpdate = true;
    }
  }
}

function mirrorGeometry(geometry: THREE.BufferGeometry, matrix = reflection) {
  geometry.boundsTree = undefined;
  geometry.applyMatrix4(matrix);
  reverseWinding(geometry);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = mirrorMetadata(geometry.userData) as Record<string, unknown>;
  return geometry;
}

function mirrorParts(parts: ReturnType<typeof createRightAnkle>["parts"]) {
  for (const part of parts.values()) {
    part.anchor.z = -part.anchor.z;
    for (const mesh of part.meshes) {
      mirrorGeometry(mesh.geometry);
      mesh.userData = mirrorMetadata(mesh.userData) as Record<string, unknown>;
      enableMeshPicking(mesh);
    }
  }
}

/** Rebuild right-authored footprints in right coordinates, then return all output to the left side. */
export function rebuildSoftTissues(parts: ReturnType<typeof createRightAnkle>["parts"]) {
  mirrorParts(parts);
  const report = rebuildRightSoftTissues(parts);
  mirrorParts(parts);
  return report;
}

/** Build the procedural fallback in right coordinates, then rebuild and mirror it as a left model. */
export function createAnkle() {
  const model = createRightAnkle(false);
  mirrorParts(model.parts);
  rebuildSoftTissues(model.parts);
  return model;
}

const replaceSide = <T>(value: T): T => {
  if (typeof value === "string")
    return value.replace(/\bRIGHT\b/g, "LEFT").replace(/\bRight\b/g, "Left").replace(/\bright\b/g, "left") as T;
  if (Array.isArray(value)) return value.map(item => replaceSide(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceSide(item)])) as T;
  return value;
};

export const structures: readonly Structure[] = sourcePack.structures.map(structure => replaceSide(structure));
export const byId: Readonly<Record<string, Structure>> = Object.fromEntries(structures.map(structure => [structure.id, structure]));
export const tissueNames = { ...sourcePack.tissueNames };
export const colors = { ...sourcePack.colors };
export const atlasTabs = sourcePack.atlasTabs.map(area => replaceSide(area));
export const atlasAreas: readonly RegionArea[] = sourcePack.atlasAreas.map(area => replaceSide(area));
export const atlasIds = sourcePack.atlasIds;
// Source citations and verified titles stay byte-for-byte intact; only anatomical study metadata is sided.
export const attachmentSources = { ...sourcePack.attachmentSources };
function mirrorAttachmentRecord(record: typeof sourceAttachmentRecords[number]) {
  return {
    ...record,
    from: { ...record.from, seedMm: mirrorPoint(record.from.seedMm) },
    to: { ...record.to, seedMm: mirrorPoint(record.to.seedMm) },
    guidePoints: record.guidePoints.map(guide => ({ ...guide, positionMm: mirrorPoint(guide.positionMm) })),
    normal: mirrorPoint(record.normal),
  };
}
const attachmentRecordById = new Map(sourceAttachmentRecords.map(record => [record.id, mirrorAttachmentRecord(record)]));
export const attachmentRecords = [...attachmentRecordById.values()];
export function attachmentsFor(id: string) {
  return sourceAttachmentsFor(id).map(record => attachmentRecordById.get(record.id) ?? mirrorAttachmentRecord(record));
}
export function connectionsFor(parts: Parameters<typeof sourcePack.connectionsFor>[0], id: string) {
  return sourcePack.connectionsFor(parts, id).map(connection => ({
    ...connection,
    record: attachmentRecordById.get(connection.record.id) ?? mirrorAttachmentRecord(connection.record),
  }));
}
export const directlyAttachedIds = sourcePack.directlyAttachedIds;
export const connectionHighlightIds = sourcePack.connectionHighlightIds;
export const footprintDecal = sourcePack.footprintDecal;
export const connectionCameraPose = sourcePack.connectionCameraPose;
export const connectionOccluders = sourcePack.connectionOccluders;
export const connectionClinicalPoints = sourcePack.connectionClinicalPoints;
export const relatedIds = sourceRelatedIds;
export const footStructures = sourceFootStructures.map(structure => replaceSide(structure));
export const footLinks = sourceFootLinks.map(link => [...link] as [string, string]);

export const directions = sourcePack.directions.map(direction => ({ ...direction, v: mirrorPoint(direction.v) }));
export function createCompass(host: HTMLElement, onView: (id: string) => void, regionDirections: readonly { id: string; short: string; label: string; v: readonly number[]; color: string }[] = directions) {
  return createRightCompass(host, onView, regionDirections as { id: string; short: string; label: string; v: [number, number, number]; color: string }[]);
}
export const cameraViews: Readonly<Record<string, readonly [number, number, number]>> = Object.fromEntries(
  Object.entries(sourcePack.cameraViews).map(([id, vector]) => [id, mirrorPoint(vector)]),
);
export function cameraPreset(view: string, aspect: number) {
  const pose = sourcePack.cameraPreset(view, aspect);
  pose.target.z = -pose.target.z;
  pose.position.z = -pose.position.z;
  return pose;
}
export const legacyPointToMm = (x: number, y: number, z: number) => {
  const point = sourcePack.legacyPointToMm(x, y, z);
  point.z = -point.z;
  return point;
};
export const viewPresets = sourcePack.viewPresets.map(view => ({ ...view, preset: (aspect: number) => cameraPreset(view.id, aspect) }));
export const labelTier = sourcePack.labelTier;
export const tierForZoom = sourcePack.tierForZoom;
export const presets = sourcePack.presets.map(preset => replaceSide(preset));
export const defaultView = sourcePack.defaultView;
export const defaultMode = sourcePack.defaultMode;
export const tissueKeys = sourcePack.tissueKeys;
export const atlasOrder = sourcePack.atlasOrder;
export const atlasNames = { ...sourcePack.atlasNames };

const base = import.meta.env.BASE_URL;
export const assetUrls = {
  bones: `${base}models/left-lower-leg/bones.glb`,
  muscles: `${base}models/left-lower-leg/muscles.glb`,
  exterior: `${base}models/left-lower-leg/exterior.glb`,
  neurovascular: `${base}models/left-lower-leg/neurovascular.glb`,
} as const;
export const assets = assetUrls;

const regionalLoaders = createRegionAssetLoaders(structures, {
  bones: structures.filter(structure => structure.tissue === "bone").map(structure => structure.id),
  muscles: structures.filter(structure => structure.tissue === "muscle" && structure.id !== "gastrocnemius").map(structure => structure.id),
  exterior: ["skin", "gastrocnemius"],
  neurovascular: structures.filter(structure => isNeurovascular(structure.tissue)).map(structure => structure.id),
});

export async function loadBoneAssets(
  parts: Parameters<typeof loadRightBoneAssets>[0],
  url: string = assetUrls.bones,
  loadScene?: Parameters<typeof loadRightBoneAssets>[2],
  onProgress?: Parameters<typeof loadRightBoneAssets>[3],
  bvh?: BvhBuilder,
): Promise<AssetReport> {
  return regionalLoaders.loadBoneAssets(parts, url, loadScene, onProgress, bvh);
}
export async function loadMuscleAssets(
  parts: Parameters<typeof loadRightMuscleAssets>[0],
  url: string = assetUrls.muscles,
  loadScene?: Parameters<typeof loadRightMuscleAssets>[2],
  onProgress?: Parameters<typeof loadRightMuscleAssets>[3],
  bvh?: BvhBuilder,
): Promise<AssetReport> {
  return regionalLoaders.loadMuscleAssets(parts, url, loadScene, onProgress, bvh);
}
export async function loadExteriorAssets(
  parts: Parameters<typeof loadRightExteriorAssets>[0],
  onProgress?: Parameters<typeof loadRightExteriorAssets>[1],
  bvh?: Parameters<typeof loadRightExteriorAssets>[2],
  url: string = assetUrls.exterior,
  loadScene?: Parameters<typeof loadRightExteriorAssets>[4],
): Promise<AssetReport> {
  const report = await regionalLoaders.loadExteriorAssets(parts, onProgress, bvh, url, loadScene);
  // The exterior GLB is a mirrored illustrative envelope, not a measured left skin surface.
  if (report.loaded.includes("skin"))
    for (const mesh of parts.get("skin")?.meshes ?? []) mesh.userData.source = "mirrored-illustrative-envelope";
  return report;
}
export async function loadNeurovascularAssets(
  parts: Parameters<typeof loadRightNeurovascularAssets>[0],
  url: string = assetUrls.neurovascular,
  loadScene?: Parameters<typeof loadRightNeurovascularAssets>[2],
  bvh?: BvhBuilder,
): Promise<AssetReport> {
  return regionalLoaders.loadNeurovascularAssets(parts, url, loadScene, bvh);
}
export { createAssetSceneLoader, neurovascularTissues, isNeurovascular };
export const loaders = { loadBoneAssets, loadMuscleAssets, loadExteriorAssets, loadNeurovascularAssets, createAssetSceneLoader };

const mirrorLegacyPoint = (point: readonly number[]): [number, number, number] => [-point[0], point[1], point[2]];
export const rays = sourceRays.map(ray => ({ ...ray, base: mirrorLegacyPoint(ray.base), head: mirrorLegacyPoint(ray.head) }));
export function buildFoot(add: (id: string, geometry: THREE.BufferGeometry) => unknown) {
  return sourceBuildFoot((id, geometry) => add(id, mirrorGeometry(geometry, legacyReflection)));
}
const sourceScene = sourcePack.scene;
export const scene = {
  initialCamera: sourceScene.initialCamera.clone().applyMatrix4(reflection),
  keyPosition: sourceScene.keyPosition.clone().applyMatrix4(reflection),
  keyTarget: sourceScene.keyTarget.clone().applyMatrix4(reflection),
  fillPosition: sourceScene.fillPosition.clone().applyMatrix4(reflection),
  fillTarget: sourceScene.fillTarget.clone().applyMatrix4(reflection),
  floorPosition: sourceScene.floorPosition.clone().applyMatrix4(reflection),
};
const mirroredOverview = sourcePack.about.overview.replace(/\bright foot and ankle\b/gi, "left lower leg and foot");
const mirroredOverviewHtml = sourcePack.about.overviewHtml.replace(/\bright foot and ankle\b/gi, "left lower leg and foot");
export const about = {
  ...sourcePack.about,
  title: "Left Lower Leg & Foot",
  overview: `${mirroredOverview} This is a mirrored derivative of the right-side study model; left-side anatomy is not independently measured.`,
  overviewHtml: `${mirroredOverviewHtml}<p>This is a mirrored derivative of the right-side study model; left-side anatomy is not independently measured.</p>`,
  controls: sourcePack.about.controls.map(control => ({ ...control })),
  controlsHtml: sourcePack.about.controlsHtml,
};
export const structureCounts = {
  total: structures.length,
  byTissue: Object.fromEntries(sourcePack.tissueKeys.map(tissue => [tissue, structures.filter(structure => structure.tissue === tissue).length])),
};
export const tissueNamesForPack = tissueNames;

export const leftLowerLegPack: RegionPack = validateRegionPack({
  id: "left-lower-leg",
  title: "Left Lower Leg & Foot",
  assetFailureMessage: "Some models could not load. Unavailable structures are hidden; return home and reopen the region to retry.",
  description: "An interactive study model of the left lower leg and foot.",
  thumbnail: `${base}regions/left-lower-leg.png`,
  structures,
  byId,
  neurovascularSources: sourcePack.neurovascularSources,
  neurovascularCropYMaxMm: sourcePack.neurovascularCropYMaxMm,
  tissueNames,
  colors,
  atlasTabs,
  atlasAreas,
  atlasIds,
  directions,
  cameraViews,
  cameraPreset,
  viewPresets,
  labelTier,
  tierForZoom,
  presets,
  assets: assetUrls,
  assetUrls,
  about,
  structureCounts,
  scene,
  createCompass,
  createAnkle,
  rebuildSoftTissues,
  attachmentSources,
  connectionsFor,
  directlyAttachedIds,
  connectionHighlightIds,
  footprintDecal,
  connectionCameraPose,
  connectionOccluders,
  connectionClinicalPoints,
  relatedIds,
  legacyPointToMm,
  neurovascularTissues,
  isNeurovascular,
  defaultView,
  defaultMode,
  tissueKeys,
  atlasOrder,
  atlasNames,
  loaders,
});
export default leftLowerLegPack;
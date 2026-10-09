import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Side = "right" | "left";
type RegionPackModule = typeof import("../src/regions/lower-leg");

type SoftRecord = {
  id: string;
  tissue: "tendon" | "ligament" | "fascia" | "cartilage";
  source: "procedural";
  meshName: string;
  meshIndex: number;
  component: string | null;
  attachmentId: string | null;
  vertexOffsetBytes: number;
  vertexCount: number;
  indexOffsetBytes: number;
  indexCount: number;
  boundsMm: { min: [number, number, number]; max: [number, number, number] };
};

type SoftMetadata = {
  format: "muscle-map-skin-soft-v1";
  side: Side;
  packId: string;
  coordinateUnits: "millimetres";
  vertexEncoding: "float32-le";
  indexEncoding: "uint32-le";
  vertexStrideBytes: 12;
  sourceGlbs: Record<string, { path: string; bytes: number; sha256: string }>;
  generatedInputSha256: string;
  generatedInputBytes: number;
  vertexBytes: number;
  indexBytes: number;
  records: SoftRecord[];
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(repoRoot, "output", "skin-input");
const targetTissues = new Set(["tendon", "ligament", "fascia", "cartilage"] as const);
const glbNames = ["bones", "muscles", "exterior", "neurovascular"] as const;

const pathsFor = (side: Side) => {
  const modelRoot = side === "right"
    ? join(repoRoot, "public", "models")
    : join(repoRoot, "public", "models", "left-lower-leg");
  return Object.fromEntries(glbNames.map(name => [name, join(modelRoot, name + ".glb")])) as Record<typeof glbNames[number], string>;
};

const sha256 = (bytes: Uint8Array | ArrayBuffer) =>
  createHash("sha256").update(Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes)).digest("hex");

async function parseGlb(filePath: string): Promise<THREE.Object3D> {
  const bytes = await readFile(filePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const basePath = pathToFileURL(dirname(filePath) + "\\").href;
  return (await new GLTFLoader().parseAsync(arrayBuffer, basePath)).scene;
}

function getBounds(position: Float32Array): SoftRecord["boundsMm"] {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = position[i + axis];
      if (!Number.isFinite(value)) throw new Error("Generated soft tissue contains a non-finite vertex");
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return { min, max };
}

function meshArrays(mesh: THREE.Mesh): { vertices: Float32Array; indices: Uint32Array } {
  const position = mesh.geometry.getAttribute("position");
  if (!position || position.itemSize !== 3 || position.count < 3)
    throw new Error("Generated soft tissue is missing triangle positions");
  const vertices = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++)
    vertices.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
  const sourceIndex = mesh.geometry.getIndex();
  const indices = new Uint32Array(sourceIndex?.count ?? position.count);
  for (let i = 0; i < indices.length; i++) {
    const value = sourceIndex ? sourceIndex.getX(i) : i;
    if (!Number.isInteger(value) || value < 0 || value >= position.count)
      throw new Error("Generated soft tissue contains an invalid triangle index");
    indices[i] = value;
  }
  if (indices.length < 3 || indices.length % 3 !== 0)
    throw new Error("Generated soft tissue index count is not a triangle multiple");
  return { vertices, indices };
}

async function exportSide(side: Side) {
  const pack: RegionPackModule = side === "right"
    ? await import("../src/regions/lower-leg")
    : await import("../src/regions/left-lower-leg");
  const sourcePaths = pathsFor(side);
  const sourceGlbs: SoftMetadata["sourceGlbs"] = {};
  for (const name of glbNames) {
    const bytes = await readFile(sourcePaths[name]);
    sourceGlbs[name] = { path: sourcePaths[name], bytes: bytes.byteLength, sha256: sha256(bytes) };
  }

  const model = pack.createAnkle(false);
  const load = async (name: typeof glbNames[number]) => parseGlb(sourcePaths[name]);
  await pack.loaders.loadBoneAssets(model.parts, sourcePaths.bones, () => load("bones"));
  await pack.loaders.loadMuscleAssets(model.parts, sourcePaths.muscles, () => load("muscles"));
  // The exterior loader’s URL and scene-loader arguments intentionally follow its
  // runtime signature: (parts, progress, bvh, url, loadScene).
  await pack.loaders.loadExteriorAssets(model.parts, undefined, undefined, sourcePaths.exterior, () => load("exterior"));
  await pack.loaders.loadNeurovascularAssets(model.parts, sourcePaths.neurovascular, () => load("neurovascular"));
  const report = pack.rebuildSoftTissues(model.parts);
  // Some source joints have no opposing imported triangles; runtime preserves those warnings.
  const meshes: Array<{ id: string; tissue: SoftRecord["tissue"]; mesh: THREE.Mesh; meshIndex: number }> = [];
  for (const [id, part] of model.parts) {
    const structure = pack.byId[id];
    if (!structure || !targetTissues.has(structure.tissue as SoftRecord["tissue"])) continue;
    part.meshes.forEach((mesh, meshIndex) => {
      // Runtime-generated targets have no GLB source. Keep this explicit so a future
      // loader cannot accidentally add imported geometry to the skin input stream.
      if (mesh.userData.source === "z-anatomy" || mesh.userData.source === "z-anatomy-regional-surface") return;
      meshes.push({ id, tissue: structure.tissue as SoftRecord["tissue"], mesh, meshIndex });
    });
  }
  meshes.sort((a, b) =>
    a.id.localeCompare(b.id) ||
    a.tissue.localeCompare(b.tissue) ||
    a.meshIndex - b.meshIndex ||
    a.mesh.name.localeCompare(b.mesh.name));

  const vertexChunks: Uint8Array[] = [];
  const indexChunks: Uint8Array[] = [];
  let vertexOffsetBytes = 0;
  let indexOffsetBytes = 0;
  const records: SoftRecord[] = [];
  for (const item of meshes) {
    const arrays = meshArrays(item.mesh);
    const vertexBytes = new Uint8Array(arrays.vertices.buffer, arrays.vertices.byteOffset, arrays.vertices.byteLength);
    const indexBytes = new Uint8Array(arrays.indices.buffer, arrays.indices.byteOffset, arrays.indices.byteLength);
    const userData = item.mesh.userData as Record<string, unknown>;
    records.push({
      id: item.id,
      tissue: item.tissue,
      source: "procedural",
      meshName: item.mesh.name,
      meshIndex: item.meshIndex,
      component: typeof userData.component === "string" ? userData.component : null,
      attachmentId: typeof userData.attachmentId === "string" ? userData.attachmentId : null,
      vertexOffsetBytes,
      vertexCount: arrays.vertices.length / 3,
      indexOffsetBytes,
      indexCount: arrays.indices.length,
      boundsMm: getBounds(arrays.vertices),
    });
    vertexChunks.push(vertexBytes);
    indexChunks.push(indexBytes);
    vertexOffsetBytes += vertexBytes.byteLength;
    indexOffsetBytes += indexBytes.byteLength;
  }
  if (!records.length) throw new Error("No generated tendon, ligament, fascia, or cartilage meshes were found");

  const vertexPayload = Buffer.concat(vertexChunks.map(chunk => Buffer.from(chunk)));
  const indexPayload = Buffer.concat(indexChunks.map(chunk => Buffer.from(chunk)));
  const binary = Buffer.concat([vertexPayload, indexPayload]);
  for (const record of records) record.indexOffsetBytes += vertexPayload.byteLength;

  const metadata: SoftMetadata = {
    format: "muscle-map-skin-soft-v1",
    side,
    packId: (side === "right" ? pack.lowerLegPack : pack.leftLowerLegPack).id,
    coordinateUnits: "millimetres",
    vertexEncoding: "float32-le",
    indexEncoding: "uint32-le",
    vertexStrideBytes: 12,
    sourceGlbs,
    generatedInputSha256: sha256(binary),
    generatedInputBytes: binary.byteLength,
    vertexBytes: vertexPayload.byteLength,
    indexBytes: indexPayload.byteLength,
    records,
  };
  await mkdir(outputRoot, { recursive: true });
  await writeFile(join(outputRoot, side + "-soft.bin"), binary);
  await writeFile(join(outputRoot, side + "-soft.json"), JSON.stringify(metadata, null, 2) + "\n");
  return { metadata, binary };
}

test("exports deterministic right and left generated lower-leg soft tissue input", async () => {
  const right = await exportSide("right");
  const left = await exportSide("left");

  for (const result of [right, left]) {
    expect(result.metadata.records.length).toBeGreaterThan(0);
    expect(result.metadata.generatedInputBytes).toBe(result.binary.byteLength);
    expect(result.metadata.generatedInputSha256).toBe(sha256(result.binary));
    expect(result.metadata.records.every(record => targetTissues.has(record.tissue))).toBe(true);
    expect(result.metadata.records.every(record => record.source === "procedural")).toBe(true);
    expect(result.metadata.records.every(record =>
      record.vertexCount > 0 &&
      record.indexCount > 0 &&
      record.indexCount % 3 === 0 &&
      record.vertexOffsetBytes % 4 === 0 &&
      record.indexOffsetBytes % 4 === 0
    )).toBe(true);
  }

  expect(right.metadata.packId).toBe("lower-leg");
  expect(left.metadata.packId).toBe("left-lower-leg");
  expect(right.metadata.sourceGlbs.bones.sha256).not.toBe(left.metadata.sourceGlbs.bones.sha256);
  expect(right.metadata.generatedInputSha256).not.toBe(left.metadata.generatedInputSha256);

  const rightAtfl = right.metadata.records.find(record => record.id === "atfl");
  const leftAtfl = left.metadata.records.find(record => record.id === "atfl");
  expect(rightAtfl).toBeDefined();
  expect(leftAtfl).toBeDefined();
  const rightCenterZ = (rightAtfl!.boundsMm.min[2] + rightAtfl!.boundsMm.max[2]) / 2;
  const leftCenterZ = (leftAtfl!.boundsMm.min[2] + leftAtfl!.boundsMm.max[2]) / 2;
  expect(Math.sign(rightCenterZ)).toBe(-Math.sign(leftCenterZ));
}, 120_000);






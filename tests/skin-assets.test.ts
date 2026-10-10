import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import manifest from "../public/models/exterior.manifest.json";

type AssetCase = {
  label: string;
  path: URL;
  piece: "lower" | "upper";
  capEnds: string[];
};

const assets: AssetCase[] = [
  { label: "right lower", path: new URL("../public/models/exterior.glb", import.meta.url), piece: "lower", capEnds: ["seam"] },
  { label: "right upper", path: new URL("../public/models/right-upper-leg/exterior.glb", import.meta.url), piece: "upper", capEnds: ["proximal", "seam"] },
  { label: "left lower", path: new URL("../public/models/left-lower-leg/exterior.glb", import.meta.url), piece: "lower", capEnds: ["seam"] },
  { label: "left upper", path: new URL("../public/models/left-upper-leg/exterior.glb", import.meta.url), piece: "upper", capEnds: ["proximal", "seam"] },
];

function readGlb(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  let offset = 12;
  let json: any;
  let binary: Uint8Array<ArrayBufferLike> = new Uint8Array();
  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const kind = view.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    if (kind === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  return { json, binary };
}

function accessorBufferView(binary: Uint8Array<ArrayBufferLike>, doc: any, index: number) {
  const accessor = doc.accessors[index];
  const bufferView = doc.bufferViews[accessor.bufferView];
  const start = bufferView.byteOffset ?? 0;
  return binary.subarray(start, start + bufferView.byteLength);
}

function identityMatrix(value: unknown) {
  const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return Array.isArray(value) && value.length === 16 && value.every((item, index) => Math.abs(Number(item) - expected[index]) < 1e-9);
}

async function readAsset(asset: AssetCase) {
  const bytes = readFileSync(asset.path);
  const { json } = readGlb(bytes);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const pieceManifest = JSON.parse(readFileSync(new URL("./exterior.manifest.json", asset.path), "utf8"));
  return { asset, bytes, json, meshes, pieceManifest };
}


function skinTopology(meshes: readonly THREE.Mesh[]) {
  const vertices: THREE.Vector3[] = [];
  const vertexIds = new Map<string, number>();
  const faces: [number, number, number][] = [];
  const vertex = new THREE.Vector3();
  const keyFor = (value: THREE.Vector3) => `${value.x.toFixed(5)},${value.y.toFixed(5)},${value.z.toFixed(5)}`;
  const getVertex = (mesh: THREE.Mesh, sourceIndex: number) => {
    vertex.fromBufferAttribute(mesh.geometry.getAttribute("position") as THREE.BufferAttribute, sourceIndex).applyMatrix4(mesh.matrixWorld).multiplyScalar(1000);
    const key = keyFor(vertex);
    let id = vertexIds.get(key);
    if (id === undefined) { id = vertices.length; vertexIds.set(key, id); vertices.push(vertex.clone()); }
    return id;
  };
  for (const mesh of meshes.filter(mesh => mesh.userData.atlasId === "skin" && !mesh.userData.sourceReference)) {
    mesh.updateWorldMatrix(true, false);
    const index = mesh.geometry.getIndex();
    const source = index ? Array.from(index.array) : Array.from({ length: mesh.geometry.getAttribute("position").count }, (_, i) => i);
    for (let i = 0; i < source.length; i += 3)
      faces.push([getVertex(mesh, source[i]), getVertex(mesh, source[i + 1]), getVertex(mesh, source[i + 2])]);
  }
  const edges = new Map<string, number[]>();
  for (const [a, b, c] of faces) for (const [from, to] of [[a, b], [b, c], [c, a]] as [number, number][]) {
    if (from === to) continue;
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    (edges.get(key) ?? edges.set(key, []).get(key)!).push(from < to ? 1 : -1);
  }
  const incidence = [...edges.values()];
  const volume = faces.reduce((sum, [a, b, c]) => sum + vertices[a].dot(new THREE.Vector3().subVectors(vertices[b], vertices[a]).cross(new THREE.Vector3().subVectors(vertices[c], vertices[a]))) / 6, 0);
  return { incidence, volume };
}

describe("published structure-envelope exterior assets", () => {
  it("matches manifest piece hashes and keeps every published node at an identity transform", async () => {
    expect((manifest as any).skinSource).toBe("structure-envelope");
    for (const asset of assets) {
      const { bytes, json, pieceManifest } = await readAsset(asset);
      expect(pieceManifest.skinSource).toBe("structure-envelope");
      expect(pieceManifest.glbSha256, asset.label).toBe(createHash("sha256").update(bytes).digest("hex"));
      for (const node of json.nodes ?? []) {
        if (node.matrix) expect(identityMatrix(node.matrix), asset.label).toBe(true);
        if (node.translation) expect(node.translation, asset.label).toEqual([0, 0, 0]);
        if (node.rotation) expect(node.rotation, asset.label).toEqual([0, 0, 0, 1]);
        if (node.scale) expect(node.scale, asset.label).toEqual([1, 1, 1]);
      }
    }
  });

  it("preserves gastrocnemius accessor bytes listed by the manifest", async () => {
    for (const asset of assets.filter(asset => asset.piece === "lower")) {
      const { bytes, json, pieceManifest } = await readAsset(asset);
      const records = pieceManifest.preservedGastrocnemius;
      expect(records, asset.label).toHaveLength(6);
      for (const record of records) {
        const accessor = record.outputAccessor ?? record.accessor;
        expect(Number.isInteger(accessor)).toBe(true);
        const data = accessorBufferView(readGlb(bytes).binary, json, accessor);
        expect(createHash("sha256").update(data).digest("hex"), asset.label).toBe(record.sha256);
      }
    }
  });

  it("publishes the expected skin counts, cap metadata, and upper source references", async () => {
    for (const asset of assets) {
      const { meshes, pieceManifest } = await readAsset(asset);
      const skin = meshes.filter(mesh => mesh.userData.atlasId === "skin" && !mesh.userData.skinCap && !mesh.userData.sourceReference);
      const caps = meshes.filter(mesh => mesh.userData.skinCap === true);
      expect(skin.length, asset.label).toBeGreaterThan(0);
      expect(caps.map(mesh => mesh.userData.capEnd).sort(), asset.label).toEqual(asset.capEnds);
      expect(caps.every(mesh => mesh.userData.atlasId === "skin"), asset.label).toBe(true);
      const skinTriangles = skin.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3, 0);
      const capTriangles = caps.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3, 0);
      expect(skinTriangles, asset.label).toBeGreaterThan(0);
      expect(capTriangles, asset.label).toBeGreaterThan(0);
      const piece = pieceManifest;
      expect(skinTriangles, asset.label).toBe(piece.skinTriangles);
      expect(capTriangles, asset.label).toBe(piece.capTriangles);
      if (asset.piece === "upper") {
        const references = meshes.filter(mesh => mesh.userData.sourceReference === true);
        expect(references.length, asset.label).toBeGreaterThanOrEqual(9);
        const expected = piece?.preservedSourcePatches ? new Set(piece.preservedSourcePatches.map((record: any) => record.mesh)).size : undefined;
        if (expected !== undefined) expect(references.length, asset.label).toBe(expected);
      }
    }
  });


  it("welds skin and caps into a closed consistently wound surface", async () => {
    for (const asset of assets) {
      const { meshes } = await readAsset(asset);
      const { incidence, volume } = skinTopology(meshes);
      expect(incidence.length, asset.label).toBeGreaterThan(0);
      expect(incidence.every(directions => directions.length === 2), asset.label).toBe(true);
      expect(incidence.every(directions => directions[0] + directions[1] === 0), asset.label).toBe(true);
      expect(volume, asset.label).toBeGreaterThan(0);
    }
  });
});



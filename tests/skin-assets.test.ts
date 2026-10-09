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
});

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as THREE from "three";
import { ExtendedTriangle, MeshBVH } from "three-mesh-bvh";
import {trianglesIntersect} from "./skin-intersections.mjs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputRoot = join(root, "output", "skin");
const reportRoot = join(root, "validation");
const sides = ["right", "left"];
const spacingMm = 0.15;
const defaultLimitMm = 0.3;
const epsilonMm = 1e-6;
const selfSampleLimit = 10000;

function args() {
  const positional = process.argv.slice(2).filter(value => !value.startsWith("--"));
  const limitArg = process.argv.find(value => value.startsWith("--limit-mm="));
  const limitMm = limitArg ? Number(limitArg.slice(11)) : defaultLimitMm;
  if (!Number.isFinite(limitMm) || limitMm <= 0) throw new Error("Invalid --limit-mm");
  return { sides: positional.length ? positional : sides, limitMm };
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function pathFor(side, file) { return join(inputRoot, side, file); }
function readMeta(bytes, path) {
  try { return JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Error(path + " is not valid JSON: " + String(error)); }
}
async function verticesFrom(path) {
  const bytes = await readFile(path);
  if (bytes.byteLength % 12) throw new Error(path + " must contain Float32 XYZ values");
  const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  for (const value of values) if (!Number.isFinite(value)) throw new Error(path + " contains a non-finite coordinate");
  return { bytes, values, count: values.length / 3 };
}
async function facesFrom(path, vertexCount) {
  const bytes = await readFile(path);
  if (bytes.byteLength % 12) throw new Error(path + " must contain Uint32 triangles");
  const values = new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  for (const value of values) if (value >= vertexCount) throw new Error(path + " has an out-of-range index " + value);
  return { bytes, values, count: values.length / 3 };
}
function mesh(vertices, faces) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
  return geometry;
}
function vertex(vertices, index, output) {
  return output.set(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
}
function triangle(vertices, faces, index, a, b, c) {
  vertex(vertices, faces[index * 3], a);
  vertex(vertices, faces[index * 3 + 1], b);
  vertex(vertices, faces[index * 3 + 2], c);
}
function nearest(bvh, point, hit) {
  const result = bvh.closestPointToPoint(point, hit, 0, Infinity);
  if (!result || !Number.isFinite(result.distance)) throw new Error("MeshBVH nearest query failed");
  return result.distance;
}
/**
 * A barycentric lattice with longest edge / n <= spacing has subtriangle
 * diameter <= spacing. Therefore measured maximum + spacing is conservative.
 */
function hausdorffDirection(sourceVertices, sourceFaces, targetVertices, targetFaces, targetBvh, limitMm) {
  const started = performance.now();
  const count = sourceFaces.length / 3;
  const cache = new Map();
  let nearestQueries = 0;
  const query = point => {
    const key = point.x + "," + point.y + "," + point.z;
    const cached = cache.get(key);
    if (cached) return cached;
    const hit = {};
    const result = targetBvh.closestPointToPoint(point, hit, 0, Infinity);
    if (!result || !Number.isFinite(result.distance)) throw new Error("MeshBVH nearest query failed");
    const value = { distance: result.distance, faceIndex: result.faceIndex };
    cache.set(key, value);
    nearestQueries++;
    return value;
  };
  const targetA = new THREE.Vector3(), targetB = new THREE.Vector3(), targetC = new THREE.Vector3();
  const targetPoint = new THREE.Vector3(), targetTriangle = new THREE.Triangle();
  const badSourceFaces = new Set(), worstActualFaces = new Set();
  let measured = 0, samples = 0, certified = 0, fallback = 0, maxDepth = 0, upper = 0;
  const sample = (point, sourceFace) => {
    const result = query(point);
    measured = Math.max(measured, result.distance);
    if (result.distance > 0.25) worstActualFaces.add(sourceFace);
    samples++;
    return result;
  };
  const targetDistance = (point, faceIndex) => {
    if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex * 3 + 2 >= targetFaces.length) return Infinity;
    targetA.fromArray(targetVertices, targetFaces[faceIndex * 3] * 3);
    targetB.fromArray(targetVertices, targetFaces[faceIndex * 3 + 1] * 3);
    targetC.fromArray(targetVertices, targetFaces[faceIndex * 3 + 2] * 3);
    targetTriangle.set(targetA, targetB, targetC);
    targetTriangle.closestPointToPoint(point, targetPoint);
    return targetPoint.distanceTo(point);
  };
  const visit = (a, b, c, depth, sourceFace) => {
    const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    const centerHit = sample(center, sourceFace);
    const candidate = centerHit.faceIndex;
    const candidateBound = Math.max(targetDistance(a, candidate), targetDistance(b, candidate), targetDistance(c, candidate));
    if (candidateBound <= limitMm + epsilonMm) {
      upper = Math.max(upper, candidateBound);
      certified++;
      maxDepth = Math.max(maxDepth, depth);
      return;
    }
    const edge = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    if (edge <= spacingMm) {
      const va = sample(a, sourceFace), vb = sample(b, sourceFace), vc = sample(c, sourceFace);
      const maximumSample = Math.max(va.distance, vb.distance, vc.distance, centerHit.distance);
      // Distance to a surface is 1-Lipschitz. Every point in the triangle lies
      // within this centroid radius; refine uncertain bounds instead of treating
      // the first 0.15 mm lattice as evidence of an actual error.
      const radius = Math.max(center.distanceTo(a), center.distanceTo(b), center.distanceTo(c));
      const localUpper = Math.min(maximumSample + edge, centerHit.distance + radius);
      if (localUpper <= limitMm + epsilonMm || maximumSample > limitMm + epsilonMm || edge <= 0.005) {
        upper = Math.max(upper, localUpper);
        if (localUpper > limitMm + epsilonMm) badSourceFaces.add(sourceFace);
        fallback++;
        maxDepth = Math.max(maxDepth, depth);
        return;
      }
    }
    const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
    const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);
    visit(a, ab, ca, depth + 1, sourceFace);
    visit(ab, b, bc, depth + 1, sourceFace);
    visit(ca, bc, c, depth + 1, sourceFace);
    visit(ab, bc, ca, depth + 1, sourceFace);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let face = 0; face < count; face++) {
    triangle(sourceVertices, sourceFaces, face, a, b, c);
    visit(a.clone(), b.clone(), c.clone(), 0, face);
  }
  const diagnosticLimit = 4096;
  const sorted = set => Array.from(set).sort((left, right) => left - right);
  const bad = sorted(badSourceFaces);
  const worstFaces = sorted(worstActualFaces);
  return {
    triangleCount: count,
    sampleCount: samples,
    nearestQueries,
    cacheSize: cache.size,
    elapsedMs: performance.now() - started,
    spacingMm,
    minimumUncertainSpacingMm: 0.005,
    certificationEpsilonMm: epsilonMm,
    certifiedTriangles: certified,
    fallbackTriangles: fallback,
    maxSubdivisionDepth: maxDepth,
    maxMeasuredMm: measured,
    upperBoundMm: upper,
    badSourceFaceCount: bad.length,
    badSourceFaces: bad.slice(0, diagnosticLimit),
    badSourceFacesTruncated: bad.length > diagnosticLimit,
    worstActualFaceCount: worstFaces.length,
    worstActualFaceIndices: worstFaces.slice(0, diagnosticLimit),
    worstActualFacesTruncated: worstFaces.length > diagnosticLimit,
  };
}
function sharesVertex(vertices, faces, one, two) {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const oneIndex = faces[one * 3 + i], twoIndex = faces[two * 3 + j];
    if (oneIndex === twoIndex) return true;
    const offsetA = oneIndex * 3, offsetB = twoIndex * 3;
    if (Math.abs(vertices[offsetA] - vertices[offsetB]) <= 1e-5 &&
        Math.abs(vertices[offsetA + 1] - vertices[offsetB + 1]) <= 1e-5 &&
        Math.abs(vertices[offsetA + 2] - vertices[offsetB + 2]) <= 1e-5) return true;
  }
  return false;
}
function selfIntersections(vertices, faces) {
  const triangleCount = faces.length / 3;
  const testedCount = Math.min(triangleCount, selfSampleLimit);
  const stride = triangleCount <= selfSampleLimit ? 1 : triangleCount / selfSampleLimit;
  const geometry = mesh(vertices, faces);
  const bvh = geometry.boundsTree;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const candidate = new ExtendedTriangle(), source = new ExtendedTriangle();
  const hits = []; let rejectedSeparatingAxisCandidates = 0;
  for (let sample = 0; sample < testedCount; sample++) {
    const sourceIndex = Math.min(triangleCount - 1, Math.floor(sample * stride));
    triangle(vertices, faces, sourceIndex, a, b, c);
    source.a.copy(a); source.b.copy(b); source.c.copy(c); source.needsUpdate = true;
    const bounds = new THREE.Box3().setFromPoints([a, b, c]).expandByScalar(epsilonMm);
    bvh.shapecast({
      intersectsBounds: box => box.intersectsBox(bounds),
      intersectsTriangle: (other, otherIndex) => {
        if (!Number.isInteger(otherIndex) || otherIndex === sourceIndex || sharesVertex(vertices, faces, sourceIndex, otherIndex)) return false;
        candidate.a.copy(other.a); candidate.b.copy(other.b); candidate.c.copy(other.c); candidate.needsUpdate = true;
        if (!source.intersectsTriangle(candidate, undefined, true)) return false;
        if (!trianglesIntersect(source,candidate)) { rejectedSeparatingAxisCandidates++; return false; }
        if (hits.length < 16) hits.push({ sourceTriangle: sourceIndex, otherTriangle: otherIndex });
        return true;
      },
    });
  }
  geometry.dispose();
  return { sampledTriangles: testedCount, candidatePairs: hits.length, rejectedSeparatingAxisCandidates, independentSeparationToleranceMm:1e-7, intersections: hits, passed: hits.length === 0 };
}
function bounds(vertices) {
  const box = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i < vertices.length; i += 3) box.expandByPoint(point.set(vertices[i], vertices[i + 1], vertices[i + 2]));
  return { min: box.min.toArray(), max: box.max.toArray() };
}
function metadataNumber(metadata, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((object, part) => object && object[part], metadata);
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}
function sourcePath(metadata, side) {
  const values = [
    metadata.sourceGlb, metadata.sourceGLB, metadata.source && metadata.source.glb, metadata.source && metadata.source.path,
    metadata.sourceGlbs && metadata.sourceGlbs.exterior && metadata.sourceGlbs.exterior.path,
  ];
  const value = values.find(item => typeof item === "string" && item.length);
  return value ? resolve(root, value) : join(root, "public", "models", side === "left" ? "left-lower-leg" : "", "exterior.glb");
}
async function inspectSource(metadata, side) {
  const path = sourcePath(metadata, side);
  try {
    const bytes = await readFile(path);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer, pathToFileURL(dirname(path) + "\\").href);
    const box = new THREE.Box3();
    let meshes = 0;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      object.geometry.computeBoundingBox();
      if (object.geometry.boundingBox) box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    });
    return { available: true, path, bytes: bytes.byteLength, sha256: hash(bytes), meshes, boundsMeters: { min: box.min.toArray(), max: box.max.toArray() } };
  } catch (error) {
    return { available: false, path, error: String(error) };
  }
}
async function validate(side, limitMm) {
  if (!sides.includes(side)) throw new Error("Unknown side " + side);
  const metaPath = pathFor(side, "mesh.json");
  const metadata = readMeta(await readFile(metaPath), metaPath);
  const vertexInput = await verticesFrom(pathFor(side, "mesh.vertices.bin"));
  const denseInput = await facesFrom(pathFor(side, "mesh.faces.bin"), vertexInput.count);
  const simpleInput = await facesFrom(pathFor(side, "mesh.simplified.bin"), vertexInput.count);
  if (!denseInput.count || !simpleInput.count) throw new Error(side + " has an empty mesh");
  const targetTriangles = metadataNumber(metadata, ["targetTriangles", "simplifiedTriangles", "target.triangles"]);
  const budgetTriangles = metadataNumber(metadata, ["budgetTriangles", "maximumTriangles"]) ?? targetTriangles;
  const triangleBudgetPassed = budgetTriangles === null || simpleInput.count <= budgetTriangles;
  const dense = mesh(vertexInput.values, denseInput.values);
  const simplified = mesh(vertexInput.values, simpleInput.values);
  const denseToSimple = hausdorffDirection(vertexInput.values, denseInput.values, vertexInput.values, simpleInput.values, simplified.boundsTree, limitMm);
  const simpleToDense = hausdorffDirection(vertexInput.values, simpleInput.values, vertexInput.values, denseInput.values, dense.boundsTree, limitMm);
  const measured = Math.max(denseToSimple.maxMeasuredMm, simpleToDense.maxMeasuredMm);
  const upper = Math.max(denseToSimple.upperBoundMm, simpleToDense.upperBoundMm);
  const intersections = selfIntersections(vertexInput.values, simpleInput.values);
  dense.dispose(); simplified.dispose();
  const source = await inspectSource(metadata, side);
  const report = {
    format: "muscle-map-skin-validation-v1", side,
    inputs: {
      metadata: { path: metaPath, sha256: hash(Buffer.from(JSON.stringify(metadata))) },
      vertices: { path: pathFor(side, "mesh.vertices.bin"), bytes: vertexInput.bytes.byteLength, sha256: hash(vertexInput.bytes), count: vertexInput.count, boundsMm: bounds(vertexInput.values) },
      denseFaces: { path: pathFor(side, "mesh.faces.bin"), bytes: denseInput.bytes.byteLength, sha256: hash(denseInput.bytes), triangles: denseInput.count },
      simplifiedFaces: { path: pathFor(side, "mesh.simplified.bin"), bytes: simpleInput.bytes.byteLength, sha256: hash(simpleInput.bytes), triangles: simpleInput.count },
    },
    sourceGlb: source,
    targetTriangles,
    budgetTriangles,
    triangleBudgetPassed,
    targetErrorMm: metadataNumber(metadata, ["errorMm", "maxErrorMm", "target.errorMm"]),
    hausdorff: {
      limitMm, spacingMm, measuredMaxMm: measured, upperBoundMm: upper,
      passed: upper <= limitMm + epsilonMm, denseToSimplified: denseToSimple, simplifiedToDense: simpleToDense,
    },
    selfIntersections: intersections,
    passed: triangleBudgetPassed && upper <= limitMm + epsilonMm && intersections.passed,
  };
  await mkdir(reportRoot, { recursive: true });
  await writeFile(join(reportRoot, "skin-mesh-" + side + ".json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
const { sides: requestedSides, limitMm } = args();
const reports = [];
for (const side of requestedSides) {
  const report = await validate(side, limitMm);
  reports.push(report);
  console.log(side + ": measured=" + report.hausdorff.measuredMaxMm.toFixed(5) + "mm upper=" + report.hausdorff.upperBoundMm.toFixed(5) + "mm selfIntersections=" + report.selfIntersections.candidatePairs + " passed=" + report.passed);
}
if (reports.some(report => !report.passed)) process.exitCode = 1;












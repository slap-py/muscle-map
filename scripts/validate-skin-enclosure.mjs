#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sides = ["right", "left"];
const skinRoot = join(root, "output", "skin");
const reportRoot = join(root, "validation");
const cropYMaxMm = 790;
const boundaryToleranceMm = 1e-4;
const seamToleranceMm = 0.1;
const mirrorSampleLimit = 10_000;
const landmarkRangeMm = [2, 4]; const eligibleContainmentMinimum = 0.999; const sourceAllExpectedFraction = 0.908; const sourceAllTolerance = 0.01;
const rayDirection = new THREE.Vector3(1, 0.327, 0.219).normalize();
const upperOffset = {
  right: new THREE.Vector3(16.275487840175627, 589.4165262579918, 15.534035861492157),
  left: new THREE.Vector3(16.275487840175627, 589.4165262579918, -15.534035861492157),
};

function parseArgs() { const positional = process.argv.slice(2).filter(value => !value.startsWith("--")); return positional.length ? positional : sides; }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function pathFor(side, file) { return join(skinRoot, side, file); }
async function parseGlb(filePath) {
  const bytes = await readFile(filePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, pathToFileURL(dirname(filePath) + "\\").href);
  gltf.scene.updateMatrixWorld(true);
  return { bytes, scene: gltf.scene };
}
function meshIdentity(object) { return object.userData?.atlasId || object.userData?.id || object.name || ""; }
function keepSurface(object) {
  const id = meshIdentity(object);
  if (object.userData?.sourceReference === true || id === "gastrocnemius") return false;
  if (object.userData?.skinCap === true) return object.userData.capEnd === "proximal";
  return id === "skin";
}
function keepSeamCap(object) { return object.userData?.skinCap === true && object.userData.capEnd === "seam"; }
function transformedMesh(object, offsetMm) {
  const position = object.geometry.getAttribute("position");
  if (!position || position.itemSize !== 3) throw new Error("Skin mesh has no XYZ position attribute");
  const vertices = new Float32Array(position.count * 3), point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).multiplyScalar(1000).add(offsetMm);
    vertices[i * 3] = point.x; vertices[i * 3 + 1] = point.y; vertices[i * 3 + 2] = point.z;
  }
  const sourceIndex = object.geometry.getIndex();
  const faces = new Uint32Array(sourceIndex?.count ?? position.count);
  for (let i = 0; i < faces.length; i++) faces[i] = sourceIndex ? sourceIndex.getX(i) : i;
  if (faces.length % 3) throw new Error("Skin mesh index count is not a triangle multiple");
  return { vertices, faces, name: object.name, atlasId: meshIdentity(object) };
}
function appendMesh(out, item) {
  const base = out.vertices.length / 3;
  const vertices = new Float32Array(out.vertices.length + item.vertices.length);
  vertices.set(out.vertices); vertices.set(item.vertices, out.vertices.length);
  const faces = new Uint32Array(out.faces.length + item.faces.length);
  faces.set(out.faces);
  for (let i = 0; i < item.faces.length; i++) faces[out.faces.length + i] = item.faces[i] + base;
  out.vertices = vertices; out.faces = faces; out.meshes.push(item);
}
async function assembleSkin(side) {
  const lowerPath = pathFor(side, "lower-exterior.glb"), upperPath = pathFor(side, "upper-exterior.glb");
  const lower = await parseGlb(lowerPath), upper = await parseGlb(upperPath);
  const surface = { vertices: new Float32Array(), faces: new Uint32Array(), meshes: [] };
  const seam = { lower: [], upper: [] };
  const visit = (scene, offset, destination, keep) => scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !keep(object)) return;
    appendMesh(destination, transformedMesh(object, offset));
  });
  visit(lower.scene, new THREE.Vector3(), surface, keepSurface);
  visit(upper.scene, upperOffset[side], surface, keepSurface);
  const visitCap = (scene, offset, list) => scene.traverse(object => {
    if (object instanceof THREE.Mesh && keepSeamCap(object)) list.push(transformedMesh(object, offset));
  });
  visitCap(lower.scene, new THREE.Vector3(), seam.lower);
  visitCap(upper.scene, upperOffset[side], seam.upper);
  if (!surface.faces.length) throw new Error(side + " full skin assembly is empty");
  return {
    side, surface, seam,
    sourceFiles: {
      lower: { path: lowerPath, bytes: lower.bytes.byteLength, sha256: hash(lower.bytes) },
      upper: { path: upperPath, bytes: upper.bytes.byteLength, sha256: hash(upper.bytes) },
    },
  };
}
function geometry(vertices, faces) {
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  result.setIndex(new THREE.BufferAttribute(faces, 1));
  result.boundsTree = new MeshBVH(result, { indirect: true });
  return result;
}
function nearestDistance(bvh, point, hit) {
  const result = bvh.closestPointToPoint(point, hit, 0, Infinity);
  if (!result || !Number.isFinite(result.distance)) throw new Error("Skin BVH nearest query failed");
  return result.distance;
}
function boundarySegments(items) {
  const segments = [];
  for (const item of items) {
    const counts = new Map();
    const add = (a, b) => {
      const key = a < b ? a + ":" + b : b + ":" + a;
      const current = counts.get(key);
      if (current) current.count++;
      else counts.set(key, { a, b, count: 1 });
    };
    for (let i = 0; i < item.faces.length; i += 3) {
      const a = item.faces[i], b = item.faces[i + 1], c = item.faces[i + 2];
      add(a, b); add(b, c); add(c, a);
    }
    for (const edge of counts.values()) if (edge.count === 1) {
      const point = index => new THREE.Vector3(item.vertices[index * 3], item.vertices[index * 3 + 1], item.vertices[index * 3 + 2]);
      segments.push([point(edge.a), point(edge.b)]);
    }
  }
  return segments;
}
function pointSegmentDistance(point, a, b) {
  const edge = new THREE.Vector3().subVectors(b, a);
  const lengthSq = edge.lengthSq();
  const t = lengthSq ? Math.max(0, Math.min(1, new THREE.Vector3().subVectors(point, a).dot(edge) / lengthSq)) : 0;
  return point.distanceTo(new THREE.Vector3().copy(a).addScaledVector(edge, t));
}
function pointToPolylineDistance(point, segments) {
  let nearest = Infinity;
  for (const [a, b] of segments) nearest = Math.min(nearest, pointSegmentDistance(point, a, b));
  return nearest;
}
function directedLoopDistance(segments, otherSegments, maxSpacingMm = 0.01) {
  // Directed Hausdorff distance between the piecewise-linear boundary curves.
  // The distance to a fixed segment union is 1-Lipschitz, so a uniform lattice
  // over every source segment gives a conservative upper bound of half its
  // lattice spacing. This is independent of vertex subdivision/triangulation.
  let measuredMaxMm = 0, upperBoundMm = 0, sampleCount = 0;
  const point = new THREE.Vector3();
  for (const [a, b] of segments) {
    const edgeLength = a.distanceTo(b);
    const steps = Math.max(1, Math.ceil(edgeLength / maxSpacingMm));
    const spacing = edgeLength / steps;
    for (let i = 0; i <= steps; i++) {
      point.lerpVectors(a, b, i / steps);
      const distance = pointToPolylineDistance(point, otherSegments);
      sampleCount++;
      measuredMaxMm = Math.max(measuredMaxMm, distance);
      upperBoundMm = Math.max(upperBoundMm, distance + spacing * 0.5);
    }
  }
  return { measuredMaxMm, upperBoundMm, sampleCount, maxSpacingMm };
}function runLoopSubdivisionRegression() {
  const p = (x, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const unsplit = [[p(0), p(10)]];
  const split = [[p(0), p(5)], [p(5), p(10)]];
  const forward = directedLoopDistance(unsplit, split);
  const reverse = directedLoopDistance(split, unsplit);
  if (forward.measuredMaxMm > 1e-7 || reverse.measuredMaxMm > 1e-7) throw new Error("collinear loop subdivision regression failed");
}
runLoopSubdivisionRegression();
function seamReport(assembly) {
  const lowerItems = assembly.seam.lower, upperItems = assembly.seam.upper;
  const lower = { vertices: new Float32Array(), faces: new Uint32Array(), meshes: [] };
  const upper = { vertices: new Float32Array(), faces: new Uint32Array(), meshes: [] };
  for (const item of lowerItems) appendMesh(lower, item);
  for (const item of upperItems) appendMesh(upper, item);
  if (!lower.faces.length || !upper.faces.length) return { available: false, reason: "seam cap missing" };
  const lowerBvh = geometry(lower.vertices, lower.faces), upperBvh = geometry(upper.vertices, upper.faces);
  const point = new THREE.Vector3(), hit = {};
  let lowerToUpper = 0, upperToLower = 0;
  for (let i = 0; i < lower.vertices.length; i += 3) {
    point.set(lower.vertices[i], lower.vertices[i + 1], lower.vertices[i + 2]);
    lowerToUpper = Math.max(lowerToUpper, nearestDistance(upperBvh.boundsTree, point, hit));
  }
  for (let i = 0; i < upper.vertices.length; i += 3) {
    point.set(upper.vertices[i], upper.vertices[i + 1], upper.vertices[i + 2]);
    upperToLower = Math.max(upperToLower, nearestDistance(lowerBvh.boundsTree, point, hit));
  }
  lowerBvh.dispose(); upperBvh.dispose();
  const lowerLoop = boundarySegments(lowerItems), upperLoop = boundarySegments(upperItems);
  const lowerLoopToUpper = directedLoopDistance(lowerLoop, upperLoop), upperLoopToLower = directedLoopDistance(upperLoop, lowerLoop);
  const maxNearestMm = Math.max(lowerLoopToUpper.upperBoundMm, upperLoopToLower.upperBoundMm);
  return {
    available: true,
    lowerVertexCount: lower.vertices.length / 3,
    upperVertexCount: upper.vertices.length / 3,
    lowerToUpperMaxMm: lowerToUpper,
    upperToLowerMaxMm: upperToLower,
    surfaceNearestMaxMm: Math.max(lowerToUpper, upperToLower),
    lowerLoopSegmentCount: lowerLoop.length,
    upperLoopSegmentCount: upperLoop.length,
    lowerLoopToUpperMeasuredMm: lowerLoopToUpper.measuredMaxMm,
    upperLoopToLowerMeasuredMm: upperLoopToLower.measuredMaxMm,
    lowerLoopToUpperUpperBoundMm: lowerLoopToUpper.upperBoundMm,
    upperLoopToLowerUpperBoundMm: upperLoopToLower.upperBoundMm,
    loopSampleCount: lowerLoopToUpper.sampleCount + upperLoopToLower.sampleCount,
    maxMeasuredMm: Math.max(lowerLoopToUpper.measuredMaxMm, upperLoopToLower.measuredMaxMm),
    maxNearestMm,
    toleranceMm: seamToleranceMm,
    passed: maxNearestMm <= seamToleranceMm,
  };
}function uniqueRayDistances(hits) {
  const distances = hits.map(hit => hit.distance).filter(Number.isFinite).sort((a, b) => a - b), unique = [];
  for (const distance of distances) if (!unique.length || Math.abs(distance - unique.at(-1)) > 1e-5) unique.push(distance);
  return unique;
}
async function classifySource(side, skinBvh) {
  const sourcePath = pathFor(side, "source.vertices.bin"), bytes = await readFile(sourcePath);
  if (bytes.byteLength % 12) throw new Error(sourcePath + " is not Float32 XYZ");
  const vertices = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const point = new THREE.Vector3(), ray = new THREE.Ray(), hit = {};
  const outsideVertices = [], croppedIndices = [];
  let eligible = 0, inside = 0, boundary = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const index = i / 3, x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (y > cropYMaxMm) { croppedIndices.push(index); continue; }
    eligible++;
    point.set(x, y, z);
    const distance = nearestDistance(skinBvh, point, hit);
    let isInside = distance < boundaryToleranceMm;
    if (isInside) boundary++;
    else {
      ray.origin.copy(point); ray.direction.copy(rayDirection);
      isInside = uniqueRayDistances(skinBvh.raycast(ray, THREE.DoubleSide, 0, Infinity)).length % 2 === 1;
    }
    if (isInside) inside++;
    else outsideVertices.push({ index, positionMm: [x, y, z] });
  }
  const total = vertices.length / 3;
  return {
    source: { path: sourcePath, bytes: bytes.byteLength, sha256: hash(bytes), totalVertices: total },
    crop: { yMaxMm: cropYMaxMm, excludedCount: croppedIndices.length, excludedFraction: croppedIndices.length / total, excludedVertexIndices: croppedIndices },
    eligibleCount: eligible, insideCount: inside, boundaryCount: boundary, outsideCount: outsideVertices.length,
    eligibleContainmentFraction: eligible ? inside / eligible : 0, sourceAllContainmentFraction: total ? inside / total : 0,
    eligibleContainmentCriterion: { minimumFraction: eligibleContainmentMinimum, passed: eligible ? inside / eligible >= eligibleContainmentMinimum : false },
    sourceAllContainmentCriterion: { requiredFraction: 0.999, passed: total ? inside / total >= 0.999 : false, status: "all-original-source-vertices" },
    sourceAllContainmentDiagnostic: { expectedFraction: sourceAllExpectedFraction, toleranceFraction: sourceAllTolerance, passed: total ? Math.abs(inside / total - sourceAllExpectedFraction) <= sourceAllTolerance : false, status: "intentional-groin-cut-diagnostic" },
    intentionalGroinCut: true, expectedSourceAllFraction: sourceAllExpectedFraction, outsideVertices,
  };
}
function sampleSurface(vertices, maxSamples) {
  const count = vertices.length / 3, samples = Math.min(count, maxSamples), stride = count <= maxSamples ? 1 : count / maxSamples;
  const result = new Float32Array(samples * 3);
  for (let i = 0; i < samples; i++) {
    const index = Math.min(count - 1, Math.floor(i * stride));
    result[i * 3] = vertices[index * 3]; result[i * 3 + 1] = vertices[index * 3 + 1]; result[i * 3 + 2] = vertices[index * 3 + 2];
  }
  return result;
}
function mirrorReport(right, left) {
  const rightBvh = geometry(right.surface.vertices, right.surface.faces), leftBvh = geometry(left.surface.vertices, left.surface.faces);
  const rightSamples = sampleSurface(right.surface.vertices, mirrorSampleLimit), leftSamples = sampleSurface(left.surface.vertices, mirrorSampleLimit);
  const point = new THREE.Vector3(), hit = {}, distances = [];
  for (const samples of [rightSamples, leftSamples]) for (let i = 0; i < samples.length; i += 3) {
    point.set(samples[i], samples[i + 1], -samples[i + 2]);
    distances.push(nearestDistance(samples === rightSamples ? leftBvh.boundsTree : rightBvh.boundsTree, point, hit));
  }
  rightBvh.dispose(); leftBvh.dispose();
  distances.sort((a, b) => a - b);
  const percentile = value => distances[Math.min(distances.length - 1, Math.floor(distances.length * value))] ?? 0;
  return { sampleCountPerDirection: mirrorSampleLimit, bidirectionalSamples: distances.length, measuredMaxMm: distances.at(-1) ?? 0, meanMm: distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length), p95Mm: percentile(0.95), expectedDiscretizationMm: 1, expectedComparison: "Native left source plus 1 mm grid discretization; diagnostic only, not an exact-mirror claim." };
}
async function readSourceMesh(side) {
  const verticesPath = pathFor(side, "source.vertices.bin"), facesPath = pathFor(side, "source.faces.bin");
  const [vertexBytes, faceBytes] = await Promise.all([readFile(verticesPath), readFile(facesPath)]);
  if (vertexBytes.byteLength % 12 || faceBytes.byteLength % 12) throw new Error(side + " source mesh has invalid XYZ/triangle alignment");
  const vertices = new Float32Array(vertexBytes.buffer.slice(vertexBytes.byteOffset, vertexBytes.byteOffset + vertexBytes.byteLength));
  const faces = new Uint32Array(faceBytes.buffer.slice(faceBytes.byteOffset, faceBytes.byteOffset + faceBytes.byteLength));
  return { vertices, faces, files: { vertices: { path: verticesPath, bytes: vertexBytes.byteLength, sha256: hash(vertexBytes) }, faces: { path: facesPath, bytes: faceBytes.byteLength, sha256: hash(faceBytes) } } };
}
function summarizeDistances(distances) {
  const sorted = [...distances].sort((a, b) => a - b);
  const percentile = value => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
  return {
    sampleCount: sorted.length,
    measuredMaxMm: sorted.at(-1) ?? 0,
    p95Mm: percentile(0.95),
    meanMm: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
  };
}
async function sourceMirrorReport() {
  const [right, left] = await Promise.all([readSourceMesh("right"), readSourceMesh("left")]);
  const rightBvh = geometry(right.vertices, right.faces), leftBvh = geometry(left.vertices, left.faces);
  const rightSamples = sampleSurface(right.vertices, mirrorSampleLimit), leftSamples = sampleSurface(left.vertices, mirrorSampleLimit);
  const point = new THREE.Vector3(), hit = {}, rightToLeft = [], leftToRight = [];
  for (let i = 0; i < rightSamples.length; i += 3) {
    point.set(rightSamples[i], rightSamples[i + 1], -rightSamples[i + 2]);
    rightToLeft.push(nearestDistance(leftBvh.boundsTree, point, hit));
  }
  for (let i = 0; i < leftSamples.length; i += 3) {
    point.set(leftSamples[i], leftSamples[i + 1], -leftSamples[i + 2]);
    leftToRight.push(nearestDistance(rightBvh.boundsTree, point, hit));
  }
  rightBvh.dispose(); leftBvh.dispose();
  const combined = rightToLeft.concat(leftToRight);
  return {
    sampleCountPerDirection: mirrorSampleLimit,
    rightSourceVertexCount: right.vertices.length / 3,
    leftSourceVertexCount: left.vertices.length / 3,
    rightToMirroredLeft: summarizeDistances(rightToLeft),
    leftToMirroredRight: summarizeDistances(leftToRight),
    combined: summarizeDistances(combined),
    registration: {
      coordinateFrame: "side-specific source vertices registered to the lower-leg construction frame",
      zReflection: "comparison point z is negated before opposite-side nearest-surface query",
      upperToLowerOffsetMm: { right: upperOffset.right.toArray(), left: upperOffset.left.toArray() },
    },
    sourceFiles: { right: right.files, left: left.files },
    expectedDiscretizationMm: 1, expectedComparison: "Native source geometry difference after registration and z reflection; diagnostic baseline, not an exact-mirror assertion.",
  };
}async function boneLandmarks(side, skinBvh) {
  const path = join(root, "public", "models", side === "left" ? "left-lower-leg" : "", "bones.glb");
  const { scene } = await parseGlb(path), byId = new Map();
  scene.traverse(object => {
    const id = object instanceof THREE.Mesh ? meshIdentity(object) : "";
    if (!["tibia", "fibula", "calcaneus"].includes(id)) return;
    const position = object.geometry.getAttribute("position"), list = byId.get(id) ?? [], point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) list.push(point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).multiplyScalar(1000).clone());
    byId.set(id, list);
  });
  const all = id => byId.get(id) ?? [];
  const tibia = all("tibia"), fibula = all("fibula"), calcaneus = all("calcaneus");
  if (!tibia.length || !fibula.length || !calcaneus.length) throw new Error(side + " bone landmark source is incomplete");
  const zSign = side === "right" ? -1 : 1, range = points => { const y = points.map(point => point.y), min = Math.min(...y), max = Math.max(...y); return { min, span: max - min }; };
  const tibiaY = range(tibia), fibulaY = range(fibula);
  const distalTibia = tibia.filter(point => point.y <= tibiaY.min + tibiaY.span * 0.08);
  const distalFibula = fibula.filter(point => point.y <= fibulaY.min + fibulaY.span * 0.08);
  const pick = (points, score) => points.reduce((best, point) => !best || score(point) > score(best) ? point : best, null);
  const candidates = [
    ["tibia-medial-malleolus", pick(distalTibia.length ? distalTibia : tibia, point => zSign * point.z)],
    ["fibula-lateral-malleolus", pick(distalFibula.length ? distalFibula : fibula, point => -zSign * point.z)],
    ["tibial-crest", pick(tibia.filter(point => point.y >= 60 && point.y <= 280), point => point.x)],
    ["calcaneus-posterior-tuberosity", pick(calcaneus.filter(point => point.y <= -25), point => -point.x)],
  ];
  const hit = {}, landmarks = candidates.map(([name, candidate]) => {
    if (!candidate) return { name, available: false };
    const distanceMm = nearestDistance(skinBvh, candidate, hit);
    return { name, available: true, bonePointMm: candidate.toArray(), skinDistanceMm: distanceMm, criterionMm: landmarkRangeMm, passed: distanceMm >= landmarkRangeMm[0] && distanceMm <= landmarkRangeMm[1] };
  });
  return { source: path, landmarks, passed: landmarks.every(item => item.available && item.passed) };
}
async function validateSide(side) {
  const assembly = await assembleSkin(side), skinBvh = geometry(assembly.surface.vertices, assembly.surface.faces);
  const containment = await classifySource(side, skinBvh.boundsTree), seams = seamReport(assembly), landmarks = await boneLandmarks(side, skinBvh.boundsTree);
  skinBvh.dispose();
  return { side, upperOffsetMm: upperOffset[side].toArray(), sourceGlbs: assembly.sourceFiles, fullSkin: { vertexCount: assembly.surface.vertices.length / 3, triangleCount: assembly.surface.faces.length / 3, includedMeshes: assembly.surface.meshes.map(item => ({ name: item.name, atlasId: item.atlasId, vertexCount: item.vertices.length / 3, triangleCount: item.faces.length / 3 })), excludedMeshPolicy: "gastrocnemius and both seam caps excluded; upper proximal cap included" }, containment, seams, landmarks };
}
const requested = parseArgs(), reports = [];
for (const side of requested) { const report = await validateSide(side); reports.push(report); console.log(side + ": eligible containment=" + report.containment.eligibleContainmentFraction.toFixed(5) + " eligiblePass=" + report.containment.eligibleContainmentCriterion.passed + " source-all=" + report.containment.sourceAllContainmentFraction.toFixed(5) + " seamMax=" + (report.seams.maxNearestMm ?? NaN).toFixed(5) + " landmarksPassed=" + report.landmarks.passed); }
if (reports.length === 2) {
  const right = await assembleSkin("right"), left = await assembleSkin("left");
  const mirror = mirrorReport(right, left), sourceMirror = await sourceMirrorReport();
  for (const report of reports) {
    report.mirrorComparison = mirror;
    report.sourceMirrorComparison = sourceMirror;
  }
}
await mkdir(reportRoot, { recursive: true });
for (const report of reports) await writeFile(join(reportRoot, "skin-enclosure-" + report.side + ".json"), JSON.stringify(report, null, 2) + "\n");
if (reports.some(report => !report.seams.passed || !report.landmarks.passed || !report.containment.eligibleContainmentCriterion.passed || !report.containment.sourceAllContainmentCriterion.passed)) process.exitCode = 1;









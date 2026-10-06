import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { structures, colors, byId } from "./data";
import { enableMeshPicking } from "./picking";
import type { createAnkle } from "./ankle";

type Parts = ReturnType<typeof createAnkle>["parts"];
export const boneIds = structures.filter(s => s.tissue === "bone").map(s => s.id);
export const muscleIds = structures.filter(s => s.tissue === "muscle").map(s => s.id);
export interface AssetReport {
  loaded: string[];
  fallback: string[];
  warnings: string[];
}

function disposeMeshes(meshes: THREE.Mesh[]) {
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    mesh.customDepthMaterial?.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      material.dispose();
  }
}

/** Consume a meter-scale GLTF scene. Keep each existing part/group/anchor identity. */
function installAssets(scene: THREE.Object3D, parts: Parts, ids: string[], tissue: "bone" | "muscle" | "skin"): AssetReport {
  const report: AssetReport = { loaded: [], fallback: [], warnings: [] };
  const staged = new Map<string, THREE.Mesh[]>();
  const invalid = new Set<string>();
  const sourceMeshes: THREE.Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    sourceMeshes.push(object);
    let id: unknown = object.userData.atlasId;
    for (let parent = object.parent; !id && parent; parent = parent.parent)
      id = parent.userData.atlasId;
    id ??= object.name;
    if (typeof id !== "string" || !ids.includes(id) || !parts.has(id)) {
      report.warnings.push(`Ignored unmatched mesh: ${object.name}`);
      return;
    }
    let geometry!: THREE.BufferGeometry;
    let mesh: THREE.Mesh | undefined;
    try {
      if (object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh)
        throw new Error("Expected a static anatomical mesh");
      geometry = object.geometry.clone();
      // glTF is meters. Bake hierarchy and unit conversion once, before bounds/BVH.
      const matrix = new THREE.Matrix4().makeScale(1000, 1000, 1000).multiply(object.matrixWorld);
      geometry.applyMatrix4(matrix);
      const positions = geometry.getAttribute("position");
      if (!positions || positions.count < 3 || !Array.from(positions.array).every(Number.isFinite))
        throw new Error("Missing or non-finite vertices");
      const index = geometry.getIndex();
      const count = index?.count ?? positions.count;
      if (count < 3 || count % 3 || (index && Array.from(index.array).some(i => i >= positions.count)))
        throw new Error("Invalid triangle indices");
      if (matrix.determinant() < 0) {
        const indices = index ? Array.from(index.array) : Array.from({length: positions.count}, (_, i) => i);
        for (let i = 0; i < indices.length; i += 3)
          [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
        geometry.setIndex(indices);
      }
      geometry.clearGroups();
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (!geometry.boundingSphere || geometry.boundingSphere.radius <= 0)
        throw new Error("Empty anatomical surface");
      mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: colors[byId[id].tissue], roughness: tissue === "bone" ? 0.76 : 0.68, side: THREE.FrontSide,
      }));
      mesh.name = id;
      mesh.userData = { id, atlasId: id, fiber: false, source: byId[id].tissue === "skin" ? "illustrative-envelope" : "z-anatomy" };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      enableMeshPicking(mesh);
      const list = staged.get(id) ?? [];
      list.push(mesh);
      staged.set(id, list);
    } catch (error) {
      invalid.add(id);
      if (mesh) disposeMeshes([mesh]);
      else geometry?.dispose();
      report.warnings.push(`${id}: ${String(error)}`);
    }
  });
  for (const id of ids) {
    const meshes = staged.get(id);
    const part = parts.get(id);
    if (!part || !meshes?.length || invalid.has(id)) {
      if (meshes) disposeMeshes(meshes);
      report.fallback.push(id);
      continue;
    }
    const previous = part.meshes.splice(0);
    for (const mesh of previous) part.group.remove(mesh);
    disposeMeshes(previous);
    part.meshes.push(...meshes);
    part.group.add(...meshes);
    // All vertices are already in the scene frame; visibility does not affect the anchor.
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.union(mesh.geometry.boundingBox!);
    bounds.getCenter(part.anchor);
    report.loaded.push(id);
  }
  const textures = new Set<THREE.Texture>();
  for (const mesh of sourceMeshes)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
  textures.forEach(texture => texture.dispose());
  disposeMeshes(sourceMeshes);
  return report;
}

/** Missing/corrupt assets leave the immediately available procedural model intact. */
export async function loadBoneAssets(
  parts: Parts,
  url = `${import.meta.env.BASE_URL}models/bones.glb`,
  loadScene: (url: string) => Promise<THREE.Object3D> = async path => (await new GLTFLoader().loadAsync(path)).scene,
): Promise<AssetReport> {
  try {
    return installBoneAssets(await loadScene(url), parts);
  } catch (error) {
    return { loaded: [], fallback: [...boneIds], warnings: [`Bone asset unavailable: ${String(error)}`] };
  }
}


export const installBoneAssets = (scene: THREE.Object3D, parts: Parts) => installAssets(scene, parts, boneIds, 'bone');
export const installMuscleAssets = (scene: THREE.Object3D, parts: Parts) => installAssets(scene, parts, muscleIds.filter(id => id !== "gastrocnemius"), 'muscle');
export async function loadMuscleAssets(parts: Parts, url = `${import.meta.env.BASE_URL}models/muscles.glb`, loadScene: (url:string)=>Promise<THREE.Object3D> = async path => (await new GLTFLoader().loadAsync(path)).scene):Promise<AssetReport> {
  try { return installMuscleAssets(await loadScene(url), parts); }
  catch(error) { return {loaded:[], fallback:muscleIds.filter(id => id !== "gastrocnemius"), warnings:[`Muscle asset unavailable: ${String(error)}`]}; }
}

export async function loadExteriorAssets(parts: Parts): Promise<AssetReport> {
  try { return installExteriorAssets((await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/exterior.glb`)).scene, parts); }
  catch(error) { return {loaded:[],fallback:['skin','gastrocnemius'],warnings:[`Exterior asset unavailable: ${String(error)}`]}; }
}
export const installExteriorAssets = (scene: THREE.Object3D, parts: Parts) => installAssets(scene, parts, ['skin','gastrocnemius'], 'skin');

import * as THREE from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";

/** Build after geometry edits; preserve triangle indices for future annotations. */
export function enableMeshPicking(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundsTree) {
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
    geometry.addEventListener("dispose", () => { geometry.boundsTree = undefined; });
  }
  mesh.raycast = acceleratedRaycast;
}


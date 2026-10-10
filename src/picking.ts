import * as THREE from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";
import { GenerateMeshBVHWorker } from "three-mesh-bvh/worker";

/** Build after geometry edits; preserve triangle indices for future annotations. */
export function isSkinSurface(mesh: THREE.Object3D): boolean {
  return mesh.userData.skinSurface === true || mesh.userData.id === "skin" || mesh.userData.atlasId === "skin";
}

export function isSkinCap(mesh: THREE.Object3D): boolean {
  return mesh.userData.skinCap === true || mesh.name.startsWith("skin-cap-");
}

/** Pick through a translucent skin field while keeping opaque skin selectable at the surface. */
export function chooseDepthAwareHit(hits: readonly THREE.Intersection[]): THREE.Intersection | undefined {
  const eligible = hits.filter(hit => !isSkinCap(hit.object));
  const first = eligible[0];
  if (!first) return;
  if (!isSkinSurface(first.object)) return first;
  const deeper = eligible.find(hit => !isSkinSurface(hit.object));
  if (deeper) return deeper;
  const alpha = first.object.userData.alpha ?? first.object.parent?.userData.alpha ?? 1;
  return alpha < 0.6 ? undefined : first;
}

export function enableMeshPicking(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundsTree) {
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
    geometry.addEventListener("dispose", () => { geometry.boundsTree = undefined; });
  }
  mesh.raycast = acceleratedRaycast;
}

/** Builds picking BVHs for meshes that are not yet in the scene. */
export type BvhBuilder = (meshes: THREE.Mesh[]) => Promise<void>;

const WORKER_TIMEOUT_MS = 30000;

async function buildInWorker(worker: GenerateMeshBVHWorker, geometry: THREE.BufferGeometry, signal: AbortSignal) {
  // The worker takes ownership of the buffers it is sent, so send copies: a failed or
  // hung worker must never leave the real mesh without vertices.
  const proxy = new THREE.BufferGeometry();
  proxy.setAttribute("position", new THREE.BufferAttribute(geometry.getAttribute("position").array.slice(), 3));
  if (geometry.index) proxy.setIndex(new THREE.BufferAttribute(geometry.index.array.slice(), 1));
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = self.setTimeout(() => reject(new Error("BVH worker timed out")), WORKER_TIMEOUT_MS);
  });
  let cancel!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(new DOMException("Viewer disposed", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    signal.throwIfAborted();
    const built = await Promise.race([worker.generate(proxy, { indirect: true }), timeout, aborted]);
    signal.throwIfAborted();
    // An indirect BVH leaves the index untouched, so it applies to the original geometry as-is.
    return MeshBVH.deserialize(MeshBVH.serialize(built, { cloneBuffers: false }), geometry, { setIndex: false });
  } finally {
    self.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    proxy.dispose();
  }
}

/** Off-main-thread BVH builds, one job at a time. If the worker cannot start (CSP,
 * old browsers, a broken bundle) every remaining build falls back to the main thread. */
export function createPickingWorker(onWorkerChange: (delta: number) => void = () => {}) {
  let bvhWorker: GenerateMeshBVHWorker | null | undefined;
  let bvhQueue: Promise<unknown> = Promise.resolve();
  const abort = new AbortController();
  function releaseWorker() {
    if (bvhWorker) { bvhWorker.dispose(); onWorkerChange(-1); }
    bvhWorker = undefined;
  }
  const build: BvhBuilder = meshes => {
    const job = bvhQueue.then(async () => {
      abort.signal.throwIfAborted();
      for (const mesh of meshes) {
        const geometry = mesh.geometry;
        if (!geometry.boundsTree && bvhWorker !== null) {
          try {
            if (!bvhWorker) { bvhWorker = new GenerateMeshBVHWorker(); onWorkerChange(1); }
            geometry.boundsTree = await buildInWorker(bvhWorker, geometry, abort.signal);
            geometry.addEventListener("dispose", () => { geometry.boundsTree = undefined; });
          } catch (error) {
            abort.signal.throwIfAborted();
            console.warn(`BVH worker unavailable; building on the main thread. ${String(error)}`);
            releaseWorker();
            bvhWorker = null;
          }
        }
        abort.signal.throwIfAborted();
        enableMeshPicking(mesh);
      }
    });
    bvhQueue = job.catch(() => {});
    return job;
  };
  return {
    build,
    dispose() { if (!abort.signal.aborted) { abort.abort(); releaseWorker(); } },
  };
}

// Compatibility for existing callers; mounted viewers own separate worker sessions.
export const enableMeshPickingInWorker: BvhBuilder = createPickingWorker().build;


/** Screen-space assistance for subpixel tubes. Sample a 6 CSS-pixel disk using
 * BVH rays, preserving occlusion by solid anatomy at each sampled location.
 * The caller resolves the central ray first. This never enlarges or modifies the anatomical surface itself. */
export function intersectThinStructures(
  raycaster: THREE.Raycaster, camera: THREE.Camera, pointer: THREE.Vector2,
  width: number, height: number, targets: THREE.Mesh[],
): THREE.Intersection | undefined {
  if (!targets.some(mesh => mesh.userData.thinStructure)) return;
  const sample = new THREE.Vector2();
  let best: THREE.Intersection | undefined;
  try {
    for (const radius of [2, 4, 6]) {
      const count = 16;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        sample.set(pointer.x + Math.cos(angle) * radius * 2 / width,
          pointer.y + Math.sin(angle) * radius * 2 / height);
        raycaster.setFromCamera(sample, camera);
        const hits = raycaster.intersectObjects(targets, false);
        const opaque = hits.find(hit => (hit.object.parent?.userData.alpha ?? 1) >= .99);
        const hit = hits.find(hit => hit.object.userData.thinStructure &&
          (!opaque || hit.distance <= opaque.distance + .05));
        if (hit && (!best || hit.distance < best.distance)) best = hit;
      }
      if (best) return best;
    }
  } finally { raycaster.setFromCamera(pointer, camera); }
}

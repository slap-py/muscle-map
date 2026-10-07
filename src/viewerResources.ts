import * as THREE from 'three';

import { viewerDiagnostics } from "./viewerDiagnostics";
export { viewerDiagnostics } from "./viewerDiagnostics";

/** Dispose shared resources exactly once, including materials parked by Low graphics. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    for (const material of [mesh.material, mesh.customDepthMaterial, mesh.customDistanceMaterial, mesh.userData.fullMaterial].flat()) {
      if (material instanceof THREE.Material) materials.add(material);
    }
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  for (const geometry of geometries) { geometry.boundsTree = undefined; geometry.dispose(); }
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
}

export function createViewerScope() {
  const cleanups: (() => void)[] = [];
  const timers = new Set<number>();
  const abort = new AbortController();
  function listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, listener: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function listen<K extends keyof DocumentEventMap>(target: Document, type: K, listener: (event: DocumentEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function listen<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function listen(target: MediaQueryList, type: 'change', listener: (event: MediaQueryListEvent) => void, options?: AddEventListenerOptions): void;
  function listen(target: EventTarget, type: string, listener: (event: any) => void, options?: AddEventListenerOptions) {
    target.addEventListener(type, listener, options);
    viewerDiagnostics.activeListeners++;
    cleanups.push(() => { target.removeEventListener(type, listener, options); viewerDiagnostics.activeListeners--; });
  }
  return {
    signal: abort.signal, listen,
    cleanup(callback: () => void) { cleanups.push(callback); },
    timeout(callback: () => void, delay: number) {
      const id = window.setTimeout(() => { timers.delete(id); if (!abort.signal.aborted) callback(); }, delay);
      timers.add(id); return id;
    },
    track<T>(promise: Promise<T>): Promise<T> {
      viewerDiagnostics.pendingLoads++;
      return promise.finally(() => { viewerDiagnostics.pendingLoads--; });
    },
    dispose() {
      if (abort.signal.aborted) return;
      abort.abort();
      timers.forEach(id => clearTimeout(id)); timers.clear();
      cleanups.splice(0).reverse().forEach(cleanup => cleanup());
    },
  };
}

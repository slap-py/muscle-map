import { defineConfig } from 'vite';
export default defineConfig({
  // Pre-bundling would move three-mesh-bvh away from its worker script, breaking
  // `new URL('./generateMeshBVH.worker.js', import.meta.url)` in dev.
  optimizeDeps: { exclude: ['three-mesh-bvh', 'three-mesh-bvh/worker'] },
  worker: { format: 'es' },
});

/** Read-only counters for browser lifecycle regression checks. */
export const viewerDiagnostics = {
  activeViewers: 0, activeListeners: 0, activeWorkers: 0, pendingLoads: 0,
  geometries: 0, lastDisposedGeometries: 0,
};
if (typeof window !== 'undefined') Object.assign(window, { __viewerDiagnostics: viewerDiagnostics });

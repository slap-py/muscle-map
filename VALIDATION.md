# Foot & Ankle Explorer — validation

Checked October 5, 2026 (America/Los_Angeles). Version remains 1.0.0.

## UI revamp

**Final production build: passed. Unit/integration tests: 64 passed across 12 files. All eight browser scripts passed against the final production build on port 5176.**

| Browser script | Result |
| --- | --- |
| `browser-check.mjs` | General controls and About: passed |
| `bone-browser-check.mjs` | All 30 bones and fallback picking: passed |
| `soft-browser-check.mjs` | All 77 non-bone structures and partial fallback: passed |
| `exterior-browser-check.mjs` | Exterior, opacity, toe filters, fallback: passed |
| `connection-browser-check.mjs` | Attachments, cutaway, restoration, late refit: passed |
| `misc-browser-check.mjs` | Connection highlighting, keyboard, narrow layout: passed |
| `hover-connections-browser-check.mjs` | Hover-label rules: passed |
| `revamp-browser-check.mjs` | New UI, persistence, labels, loading, responsive layouts: passed |

No application or shader errors were reported. The general browser check records an incidental favicon 404.

Build and test checkpoints were run during the feature-removal, grouped-list, inspector, label, exterior-viewer, topbar/loading, and About phases. The dev server at port 5174 was checked throughout. Final production regression checks use preview port 5176.

New automated coverage includes:

- Allowed anatomical groups and atlas memberships, with explicit skin exemption and the fixed-taxonomy MTP-band limitation.
- Real IDs and zoom boundaries for label tiers; cartilage is excluded from automatic tiers.
- Muscle-fact coverage and source links for exactly 13 muscles, with other tissues' new fact fields left unauthored.
- Physical skin material and the skin shadow exception across opacity changes.
- Nine non-overlapping overview labels with leader lines; hidden and <50%-opacity structures excluded; forefoot zoom reveals additional label tiers.
- Type/area/visible-layer filters, highlighted search, temporarily revealed selected rows, ↑/↓/Enter, saved collapse state, and selection synchronization.
- Derived bone articulations, muscle facts/references, 24px keyboard resizing, expand/restore, saved width, and operation with localStorage blocked.
- Pointer dragging was additionally checked at both 280px and 680px clamp limits.
- Camera centering remains in the free canvas after inspector resizing and temporal antialiasing jitter cleanup.
- Shared title/mark, real byte-based loading progress, About tabs and keyboard navigation, responsive 820px and 390px layouts, and the narrow overflow menu.
- A 2.5-second asset-failure notice followed by functioning procedural shapes.

The existing regression suites retain source-bone selection and BVH behavior, all soft-tissue selections, camera/compass/zoom/pan, attachment decals and clinical notes, camera-sensitive cutaways, Highlight connections and hover behavior, reduced motion, missing assets, and delayed asset refitting. Obsolete feature steps have been removed or replaced.

Missing-skin evidence: `validation/exterior-source-inspection.json`. UI evidence: `validation/revamp-browser-check.json`, existing `validation/*-browser-check.json`, `revamp-overview.png`, `revamp-inspector-wide.png`, `revamp-forefoot.png`, `revamp-narrow-820.png`, `revamp-narrow-390.png`, and `exterior-*.png`.

## Blocked geometry acceptance

The installed Blender 5.2 **MCP** extension is reachable with the corrected project bridge. Inspection of the pinned Startup.blend found no skin mesh; Skin and Dermis are empty and Integument contains appendages. The user authorized continuing other work when Blender work was blocked.

Real-skin geometry was therefore not exported. The existing exterior GLB/manifest and illustrative provenance were preserved. The requested ≤40k triangles and ≥95% bone-vertex bounding-box enclosure checks for the replacement cannot be claimed, and real-skin/no-ring visual acceptance is pending. The viewer's skin material, shadow behavior, and skin-plus-bone preset are verified independently.

These checks validate software behavior and geometric consistency, not clinical or biomechanical accuracy. Existing source anatomy, fitted attachment extents, cartilage thickness, and skin shape remain subject to the documented limitations. The production build emits Vite's bundle-size advisory.

## Reproduce

```sh
npm run build
npm test
npm run preview -- --port 5176 --strictPort
```

Then execute every `scripts/*-browser-check.mjs` with Node. Set `VIEWER_URL` to override port 5176. No new dependencies are required.

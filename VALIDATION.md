# Validation — Phases 0 and 1

Checked October 4, 2026.

- Phase 0: build passed; browser rendered all 66 entries with no page errors.
  Tests were waived by the phase instructions.
- Phase 1: production build passes; all 12 tests pass.
- Coordinate tests verify right-handed axes, fixed datum, mm bounds, atlas IDs,
  medial placement, label anchors, original projected framing, and BVH raycast
  agreement with ordinary raycasts from five view directions.
- Production browser inspection covers presets, compass, hover/click selection,
  labels, search, focus, isolation, connections, all layers and tissue presets,
  opacity, orbit/pan/zoom, keyboard pan, the complete tour and reduced motion.
- Overview, isolated talus and plantar-tour screenshots were visually inspected.
  The overview retains its original composition and controls.

Reproduce with npm run build, npm test, and scripts/browser-check.mjs against a
local production preview. See continuation.md for commands and environment notes.
Browser evidence is in validation/browser-check.json and validation/*.png.

Known non-blocking diagnostics: Vite bundle-size advisory; existing favicon 404.
Opposite compass buttons overlap in aligned views, as before this work.

This validates rendering and interaction, not anatomical accuracy. The geometry
remains procedural, the mm calibration is illustrative, and legacy anatomical
claims still require a claim-level citation audit before replacement content ships.



## Phase 2 bone assets — 2026-10-04

Build and 16 unit/integration tests pass. The real shipped GLB contains all 30
right-side bones with exact IDs and identity transforms. Source cleanup enforces
zero loose vertices and zero non-manifold edges; final triangle counts range from
6,524 to 12,000. Five ray directions per bone compare accelerated and ordinary hits.

`node scripts/browser-check.mjs` validates all existing controls against the loaded
asset. `node scripts/bone-browser-check.mjs` individually selects, isolates, focuses,
hovers and labels all 30 imported bones, then verifies a simulated missing GLB
leaves the procedural fallback functional. JSON reports and phase2 screenshots are
in validation/. Source-to-frame matrices and artifact hashes are in the shipped
manifest. Soft-tissue anatomical alignment is outside these software checks.


## Phases 3–4 — 2026-10-04

Production build and 21 tests across six files pass. New tests parse the shipped
muscle GLB, verify identity transforms, triangle budgets and exact registration,
validate attachment references and named guide order, check footprint projection,
confirm guide interpolation and separate flattened component geometry, and check
both surface-derived cartilage shells at all 39 joint interfaces. They also check
resource disposal on refit and muscle-load fallback. The test timeout accommodates
real source-mesh fitting instead of mocking surface queries.

The Blender exporter independently checks post-validation manifold edges,
connected components and retained belly volume. This caught and corrected source
material seam fragmentation in abductor hallucis/FHL before final delivery.

The general browser suite and all 30 individual bone interactions pass, including
bone-asset 404 fallback. All 75 soft-tissue groups also pass selection, hover, focus, isolate and label
checks, with no application errors; muscle-asset 404 retains all 105 entries.
See `validation/soft-browser-check.json` for the recorded results. Screenshots use the phase4
prefix; earlier phase2 evidence is retained.

These checks validate geometry and interaction, not anatomical accuracy. Source
scale is preserved, while footprints, paths, shell masks and thickness are authored
illustrative fits. Existing diagnostics: Vite large-bundle advisory and favicon 404.


## Phase 5 — 2026-10-04

Build and 25 tests in 7 files pass. New real-asset checks verify every surface
footprint produces a decal on its actual bone, exclude junction/soft-tissue
endpoints, verify direct attachments exclude pulley-only contacts, and project
footprint rims inside desktop and narrow camera frames. A synthetic occlusion
fixture verifies camera movement restores clear structures and excludes hidden,
selected and behind-target geometry.

`node scripts/connection-browser-check.mjs` verifies muscle/tendon/ligament
footprints, notes and source links, clinical points, focus, ghost mode, deep
Lisfranc cutaways while orbiting, Escape from focused controls, manual layer
changes, all six tour stops/back/finish, restoration of prior layers/opacity,
rapid animated focus, narrow layout, both GLB 404 fallbacks and late asset refits.
The existing general interaction suite also passes. No application/shader errors;
the existing favicon 404 and Vite bundle advisory remain. See
`validation/connection-browser-check.json` and `validation/phase5-*.png`.

Visual review caught overlapping shared origins covering the active amber decal;
active footprints now render after all inactive decals. These checks validate
software geometry and interaction, not the anatomical accuracy of authored
footprint extents or a complete set of muscle origins.

## Exterior, regional atlas, and opacity update

- `npm run build`: passed (existing large-bundle advisory remains).
- `npm test`: 28 tests across 8 files passed.
- `node scripts/exterior-browser-check.mjs`: passed in headless Edge at
  1440x1000 and 1100x800; no page errors. Checked five distinct toe tabs,
  13 loaded muscles, exterior preset, skin opacity, muscle opacity through
  81/80/79 percent, reset, gastrocnemius attachment controls, and exterior
  asset failure fallback.
- Visually reviewed `validation/exterior-overview.png`,
  `validation/exterior-dorsal.png`, `validation/muscle-opacity-50.png`,
  `validation/gastrocnemius.png`, and `validation/exterior-narrow.png`.
- Skin is an illustrative fitted envelope. Coverage transparency avoids
  object-order popping; fine grain can remain during motion and settles
  through temporal antialiasing at rest.

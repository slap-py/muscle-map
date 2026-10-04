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


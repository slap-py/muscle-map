# Continuation — Muscle Map

Updated 2026-10-04. Requested work was Phase 0 and Phase 1 only.

## Completed

Phase 0:
- Initialized local Git on main. Baseline commit: 69e7acd.
- Phase 0 checkpoint: f264189.
- Reviewed upstream Z-Anatomy license and CC BY-SA terms. Foot/ankle reuse is
  suitable subject to attribution, share-alike and object-level provenance review.
  The full-body bundle has third-party exceptions. See credits.md.
- Installed and locked three-mesh-bvh 0.9.15. Non-fiber meshes build BVHs;
  existing hover/click raycaster uses firstHitOnly per mesh, retaining selected
  structure priority across all meshes. Geometry disposal releases the BVH.
- Added assets/source/ and public/models/ with import/manifest requirements.
- Phase 0 build passed; browser showed 66 entries and no page errors.
  Tests were not required for that phase.

Phase 1:
- All active geometry is now baked into millimeters in a right-handed
  ISB-aligned frame (+X anterior, +Y superior, +Z subject-right).
- Fixed datum: authored talus center [0, 0.84, 0.05] in legacy coordinates,
  mapped to [0, 0, 0] mm. This is a project reference, not a measured joint center.
- Display calibration: 100 mm per old unit. It is not anatomical measurement.
- Updated camera positions/presets, focus minimum, zoom limits, clipping, lights,
  light targets, shadow frustum/bias, floor and medial label offset.
- Compass retains the same controls with directions expressed in the new basis.
- Existing IDs, 66 entries, DOM/CSS, selection priority, hover/label behavior,
  tours, pan/orbit/zoom, tissue presets and layer controls are preserved.
- Every active anatomical mesh carries userData.id and userData.atlasId.
- Coordinate convention and its primary ISB citation are stored as data in
  src/coordinates.ts; COORDINATES.md defines the integration contract.
- Geometry is transformed only after fiber construction, before BVHs/anchors.
  Do not transform early in add(): muscle fibers read their parent vertices.
- No biomechanics or new anatomical attachment/path/function claims added.

## Verification

- npm run build passes. Vite reports an advisory bundle-size warning (~855 kB JS).
- npm test passes: 12 tests across four files.
- Added tests for origin, handedness, mm scale, unchanged projection, medial
  placement, label bounds, atlas-ID mapping, BVH disposal and accelerated versus
  ordinary raycast hit IDs/distances from five views.
- Production viewer checked in headless Microsoft Edge through Playwright.
  See validation/browser-check.json and screenshots for results.
- Browser checks cover all view presets, six compass directions, real mesh hover
  and click, temporary labels, pointer leave, focus/isolate/connections, all layers,
  tissue presets, opacity, labels, zoom, orbit, pan, keyboard pan, wheel zoom,
  all six tour stops and reduced-motion labels.
- Opposite compass markers overlap when looking along their axis (existing UI).
  The check returns to overview before each compass click.
- An existing missing favicon can produce a 404; it is recorded separately.
  No application page errors occurred in the completed run.

To reproduce:
1. npm install
2. npm run build
3. npm test
4. npm run preview -- --port 5176 --strictPort
5. In another terminal: node scripts/browser-check.mjs
   Override VIEWER_URL to check a different local URL. The script uses installed
   Microsoft Edge and writes screenshots and JSON under validation/.

## Where to continue

No Z-Anatomy originals or GLBs were downloaded/imported in these phases.
The viewer still displays procedural geometry. Anatomical fidelity is not yet
achieved and the UI continues to say it is simplified.

1. Pin an upstream source revision; download appropriate originals into
   assets/source/ and preserve original licenses plus hashes. Confirm licenses
   for the exact selected objects, excluding unrelated restricted assets.
2. Map source objects to the existing atlas IDs; never replace IDs with raw
   upstream names. Preserve multi-mesh groups and current layer/selection APIs.
3. Register source geometry to the documented datum. Determine source units
   and transform explicitly. Export meter-scale GLBs, then convert once into
   mm at runtime. Never feed GLBs through the legacy procedural transform.
4. Build a claim-level source ledger before authoring/replacing anatomical
   content: each attachment location, path, function and relationship needs
   supporting URL/title/section or figure in data keyed by atlas ID.
   Existing legacy anatomical prose and paths have general reading references
   only; they have NOT received a claim-by-claim citation or accuracy audit.
   Do not treat those readings or these unit tests as validation of coordinates.
   No anatomical attachment-point dataset exists yet: current anchors are
   label centroids, and relatedIds is the existing adjacency/attachment graph.
5. Imported meshes must use the same part/group/anchor contract and enableMeshPicking
   after all transforms. For dense sources consider offline simplification and
   worker BVH construction if synchronous startup becomes slow.
6. Keep all existing controls intact. Run build, tests and browser checks after
   every subsequent phase. Biomechanics remain out of scope.

The historical full-leg builder in src/model.ts is unused and remains in its
original frame for reference. foot.ts and ankleDetails.ts retain legacy procedural
authoring coordinates behind the active createAnkle conversion boundary.

## Environment notes

Git ownership differs between sandbox and desktop accounts on this machine.
Use git -c safe.directory='H:/Projects/Muscle Map' ... when required.
No global safe-directory setting or remote repository was added.
After git init the normal sandbox and in-app browser failed to refresh; approved
project shell commands and Playwright were used instead. Preexisting root preview
images are retained and ignored as generated evidence, not deleted.


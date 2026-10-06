# Phase 5 handoff — 2026-10-04

Connection-focused teaching features are implemented on top of Phases 3–4.

## Current behavior

- Selection highlights modeled bone footprints with round surface-clipped teal
  decals. The focused footprint is amber and renders above overlapping footprints
  at shared origins. Decals never enter the picking targets; selecting/clearing or
  refitting assets disposes and rebuilds their geometry/materials.
- The inspector's **Zoom to connection** entries retain component and endpoint
  identity. Each flies to the fitted center from the outward surface normal, with
  distance padded for the footprint and the narrower viewport axis. Junction and
  soft-to-soft endpoints are labeled separately and do not create bone decals.
- **Ghost mode** temporarily reveals all layers, keeping the selection and directly
  attached structures opaque. The neighborhood uses endpoint records; pulley
  contact and legacy adjacency are not mistaken for anatomical attachment. A
  focused record additionally preserves its owning band and endpoint.
- Camera-aware cutaways raycast toward the footprint center and four rim samples,
  fading intervening structures (including an occluding host bone) while preserving
  the selected structure and owning band. Updates are throttled to 100 ms and
  restore structures once the camera moves away. This fades entire structures;
  it does not cut mesh topology.
- Escape works from inspector buttons and search inputs, clears selection and
  temporary effects, and restores layer/opacity settings. Changing a layer exits
  ghost/cutaway mode. Isolate, connection-only visibility, presets and reset retain
  their existing behavior. An open About dialog keeps its normal Escape handling.
- Attachment records now carry `note`; each endpoint shows the note and existing
  source title/section links. ATFL, Achilles and Lisfranc have one sourced clinical
  point. Clinical links are in `src/connections.ts`.
- The six-stop tour focuses ATFL, Achilles, Lisfranc, superior extensor retinaculum,
  fibularis brevis and plantar fascia attachments, using ghost mode at every stop.
  Back, Finish and Close work without overwriting previous layer/opacity choices.
- Late bone/muscle loads refit active decals and the focused camera target.

## Files and verification

- `src/connections.ts`: attachment neighborhoods, resolved endpoint lookup,
  surface decals, footprint camera poses, occluder detection and clinical points.
- `src/main.ts`, `src/style.css`, `src/attachments.ts`: viewer integration and notes.
- `npm run build` and `npm test`: pass, 25 tests across 7 files. New tests cover
  real-asset decal/surface agreement, every bone footprint producing geometry,
  non-bone endpoint exclusion, muscle insertion lookup, direct-attachment versus
  pulley distinction, narrow/desktop camera framing and directional occlusion.
- `node scripts/connection-browser-check.mjs`: production Edge checks of selected
  footprints, focus, source/clinical notes, orbit-sensitive deep cutaways,
  restoration, tour navigation, animated focus changes, narrow layout, GLB 404s
  and late asset refits. Evidence: `validation/connection-browser-check.json` and
  `validation/phase5-*.png`.
- The general `scripts/browser-check.mjs` interaction regression suite passes.
  No application or shader errors. Existing Vite size advisory and favicon 404
  remain. Browser suites default to preview port 5176; override with VIEWER_URL.
- README and VALIDATION are updated. No commit or deployment was made.

## Limits

Only existing attachment records are displayed. Muscle selections expose modeled
muscle–tendon and distal insertion connections; unmodeled proximal muscle origins
are not inferred. Footprint extents and coordinates remain illustrative surface
fits. Cutaways are sampled visibility aids, not anatomical dissection or clinical
segmentation. The source geometry, existing registration and atlas IDs are unchanged.

Normal sandbox process startup still fails; approved project PowerShell commands
were used. The existing production preview serves the rebuilt output on refresh.

---

# Phases 3–4 handoff — 2026-10-04

Phase 3 attachment data and Phase 4 soft tissues are implemented. The historical
Phase 0–2 notes below describe earlier states and do not override this section.

## Current deliverables

- `src/attachments.ts`: 74 typed records with stable structure/component IDs,
  start/end footprints, explicit named pulley guides, millimeter dimensions,
  coordinate status and anatomical source/section locators. Footprints are
  independent of label anchors. Resolved mesh metadata includes bone face IDs,
  surface normals, footprint boundaries and fitted guide positions.
- `public/models/muscles.glb`: 12 right-side source bellies, about 2.37 MB,
  7,012–12,000 triangles each; `assets/muscles.blend` is the cleaned scene.
  The same pinned source hash and frozen bone registration are used. GLB is
  meters; runtime conversion to mm occurs once. Atlas IDs/groups remain stable.
- `scripts/prepare-muscles.py`: reproducible extraction, cleanup, capping,
  subdivision/decimation, export and manifest generation with disabled source
  auto-execution. It also writes `src/muscleLandmarks.json` for approximate
  junctions. Source Tendon material faces are separated; non-manifold seams in
  abductor hallucis and FHL require documented seam-level cuts (X=65 mm and
  Y=31 mm), retaining belly aponeuroses. EDB distal slips are cropped at X=65 mm.
  Soleus gets a 0.6 mm voxel repair. Tiny repair artifacts are removed.
  Final checks enforce manifold topology, 1 component per belly except the
  3 EDB bellies, and retention of at least half the input belly volume.
- `src/softTissues.ts`: smooth tendon curves through fitted junctions, explicit
  pulley guides and insertion footprints; static bone-clearance correction;
  closed flattened ligament bands; refitted broad retinacula and plantar fascia
  using `src/geometry.ts` ribbon geometry. Deltoid has 5 components, spring has
  3, lateral ligaments remain ATFL/CFL/PTFL, long plantar has 5 slips, short
  plantar is separate. Added deep flexor bellies/tendons and flexor retinaculum.
- `src/joints.ts`: 39 explicit synovial interfaces, generating 78 cartilage
  patches on opposing bone surfaces. Masks select bone triangles by distance
  and opposing normals; shells offset those vertices 0.02–0.65 mm with closed
  boundary walls. All 30 modeled bones have cartilage groups. Proximal
  tibiofibular cartilage is restricted to the proximal joint; the distal
  syndesmosis is not treated as a cartilage-bearing joint.
- 105 atlas entries: 30 bones, 12 muscles, 12 tendon groups, 15 ligament groups,
  6 fascia/retinacula, 30 cartilage groups. Existing selection IDs are preserved.
  Named component records and source links are available in the inspector.
- Bone and muscle loaders retain per-structure procedural fallback, dispose old
  resources and rebuild BVHs after final transforms. Refit preserves group and
  anchor identity. About, README and deployed CREDITS explain the adaptations.

## Limits and next work

Coordinates, widths, thicknesses, footprint extents and material-seam junctions
are illustrative. The cited anatomy sources support attachment topology and
course, not numerical coordinates. Surface fitting is not validated biomechanics
or clinical segmentation. Cartilage covers the modeled synovial interfaces;
knee femoral articular surfaces are outside this foot/ankle atlas. Tendon sheaths,
vessels, nerves, bursae and many small ligaments are omitted. Branching extensor
apparatus and variable ligament components remain simplified. Legacy anatomical
prose has not received an exhaustive claim-level audit.

## Reproduction and verification

- Run `npm run build` and `npm test` (21 tests in 6 files).
- Rebuild muscles with Blender 5.2 background/factory startup/disabled autoexec,
  passing `scripts/prepare-muscles.py`; see `public/models/README.md`.
- `node scripts/soft-geometry-check.mjs` verifies the assembled real assets and
  writes `validation/soft-geometry-check.json`.
- Browser suites: `scripts/browser-check.mjs`, `scripts/bone-browser-check.mjs`,
  `scripts/soft-browser-check.mjs`, using Edge and VIEWER_URL or port 5176.
  Evidence and screenshots are stored under `validation/`.
- Final results: production build and all 21 tests pass; general browser controls,
  all 30 bone groups and all 75 soft-tissue groups pass selection/hover/focus/
  isolate/label checks. Bone and muscle GLB 404 fallbacks retain all 105 records.
  No application page errors. Existing Vite size advisory and favicon 404 remain.
- Normal sandbox shell startup still fails. Approved project PowerShell commands
  work. No source Blender UI session was changed. No commit or deployment made.

---

# Continuation — Muscle Map

Updated 2026-10-04. Phase 2 bone integration is complete.

## Phase 2 deliverables

- `public/models/bones.glb`: all 30 right-side bones, exact atlas IDs in names and
  extras.atlasId; 6,524–12,000 triangles per bone, 311,846 total; about 5.7 MB.
- `assets/bones.blend`: cleaned 30-object scene with identity object transforms.
- `src/assets.ts`: GLTF loading, exact atlas mapping, multi-mesh support, world
  transform baking, meter-to-mm conversion once, per-bone procedural fallback,
  resource disposal and BVH construction after transforms.
- Existing part/group/anchor objects remain stable. Existing selection, hover,
  isolate, focus, labels and relationship APIs use the new meshes unchanged.
- Full source tibia/fibula retained. Overview fits their bounds; regional views
  preserve Phase 1 directions. Atlas labels are Tibia and Fibula, with the
  original whole-bone descriptions restored after removing distal-only overrides.
- Attribution and CC BY-SA 4.0 notices ship in the About dialog and models folder.

## Source and coordinates

Pinned Z-Anatomy revision: b722f392d2b09d21f0527229fe1338f27a3bc04e.
Original ZIP and Startup.blend are retained in assets/source but Git-ignored due
to size; `scripts/download-bones.py` reproduces them. Original licenses and hashes
are tracked in assets/source/source-manifest.json. Embedded upstream Python was
not executed. Only the right-side skeletal subset is exported.

Source units are Metric, 1 meter per unit. Source -Y / +Z / -X map to anatomical
+X anterior / +Y superior / +Z subject-right. The frozen pre-processing Talus.r
world bounding-box center maps to Phase 1 [0,0,0]. Native scale and inter-bone
relationships are retained. Both source-to-Blender and source-to-GLB matrices,
source names, processing counts and GLB hash are in bones.manifest.json.

The source is coarse: Catmull-Clark subdivision plus selective decimation meets
the requested budget. Smoothing does not add measured anatomical detail. Cleanup
removes loose vertices and a tiny dangling cuneiform face, with outward normals
and zero non-manifold edges in all 30 outputs. Sesamoids are separated from the
source's two-component object and identified by their transverse coordinate.

## Verification and reproduction

- `npm run build`: passes; existing large-bundle advisory remains (~904 kB JS).
- `npm test`: 16 tests across five files pass. New tests load the actual GLB,
  verify all IDs, budgets, identity transforms, units, laterality, partial/failure
  fallbacks, resource disposal and BVH vs ordinary raycasts for every bone.
- `node scripts/browser-check.mjs`: full production interaction suite, all 30
  source bones, existing 66 entries; validation/browser-check.json.
- `node scripts/bone-browser-check.mjs`: individually verifies selection, hover,
  isolate, focus and labels for all 30 imported bones; simulates GLB 404 and
  confirms procedural fallback remains pickable. validation/bone-browser-check.json.
- Both browser suites use Edge and default to http://127.0.0.1:5176. Override
  VIEWER_URL if needed. Phase 2 screenshots are in validation/.
- Rebuild source with Blender 5.2: `blender --background --factory-startup
  --disable-autoexec --python scripts/prepare-bones.py` from the repository root.
- When MCP is responsive, the same script can run with `python
  scripts/blender-command.py scripts/prepare-bones.py` in a dedicated Blender
  session. It replaces that scene. BLENDER_MCP_PORT optionally overrides 9876.

## Post-Phase-2 fixes — 2026-10-04

- Consistent selection shadows (`src/main.ts`): shadow casting depends on tissue
  opacity and excludes fiber meshes, rather than depending on the selection fade.
  Clicking a bone no longer disables surrounding structures' shadows. Isolate,
  layer visibility and the muscle-opacity control retain their existing behavior.
- Correct whole-bone labels (`src/data.ts`): removed the legacy "Distal tibia" and
  "Distal fibula" name/description overrides. Atlas rows, model labels and inspector
  headings now use Tibia and Fibula, matching the full imported bones. Restored
  the original whole-bone descriptions; retained the tibia's ankle-view hint.
- Verification: production build passed after both changes. Targeted Edge checks
  confirmed unchanged shadow casters before/after selection, visibility during
  isolate, non-shadowing fibers, muscle-opacity behavior, and correct atlas and
  inspector names. No application page errors occurred in the shadow check.
  Shadow screenshots: validation/shadows-before-selection.png and
  validation/shadows-after-selection.png. These were targeted browser checks;
  the full 16-test and interaction suites above were run at Phase 2 completion.
- The production preview on port 5176 serves the rebuilt files. Refresh an already
  open viewer tab to load them. The temporary verification server on 5177 was stopped.

## Remaining scope

Soft-tissue meshes, attachment paths, relation graph and anatomical prose remain
legacy procedural data. They have NOT been registered to the new bones or given a
claim-level anatomical audit. Do not treat label anchors as attachment points.
No biomechanics or muscle fitting is included in Phase 2.

## Environment

Normal sandbox commands fail during helper startup; approved project shell
commands work. Blender MCP listeners accepted connections but did not respond to
commands, including after the user's restart. Source processing/export therefore
used Blender's command-line Python execution. No changes were made to the original
Blender scene or its unsaved work. Use git -c safe.directory='H:/Projects/Muscle Map'
when required. No commit or remote/publish action was performed.

## Phase 0–1 historical handoff

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


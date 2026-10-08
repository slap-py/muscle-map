# Muscle Map — validation

Latest checks: October 6, 2026 (America/Los_Angeles). Version remains 1.0.0.



## Independent left/right leg regions — October 7, 2026

- Production build passes. Full unit suite: **101 tests across 22 files**.
- Added `#/left-lower-leg` (156 structures), `#/right-upper-leg` and
  `#/left-upper-leg` (120 each). Four independent hub cards include generated
  Light/Dim previews, matching structure counts and source credits.
- Blender work used the running **MCP** extension via the project's NUL-delimited
  bridge. The source blend was opened without executing embedded scripts;
  no blend file was saved or overwritten.
- Both upper legs use original side-specific source anatomy. The left lower leg
  reflects the registered right assets. Numerical audit checks reflected bounds,
  triangle counts and signed volume/winding for every imported structure.
  SHA-256 checks confirm all four original right-side GLBs are unchanged.
- Native upper-leg checks validate all atlas IDs, finite geometry, anatomical
  meter-scale bounds, export hashes and original `.l`/`.r` source names.
- Browser checks verify each region's isolated model URLs, lazy vessels/nerves,
  atlas, source facts, selection, isolation, focus, attachment close-ups and
  medial/lateral views. Switching regions returns geometry, listener, worker
  and pending-load counters to zero. Responsive hub coverage includes 390, 820
  and 1440 pixels in Light and Dim modes.
- The strengthened browser pass requires attachment controls and nonempty focused
  connections, exact muscle counts, successful exterior loading, and nonoverlapping
  viewer titles at 390/820 pixels. Low graphics creates and disposes workers for
  all three new regions. A forced upper-leg bone 404 reports zero loaded bones and
  clearly marks unavailable structures. All eight hub thumbnail images load.
- Visual QA covered all three new Anatomy views and the upper-leg Exterior and
  Neurovascular views. Open source exterior sheets require double-sided display;
  their coverage and provenance remain source-based. The upper Anatomy preset
  leaves the full fascia shell off initially so muscle surfaces are visible.

Evidence: `validation/leg-asset-audit.json`,
`validation/leg-regions-browser-check.json`, `validation/hub-browser-check.json`,
and the region overview/exterior/neurovascular screenshots. New reproducible
checks are `scripts/check-leg-assets.mjs` and
`scripts/leg-regions-browser-check.mjs`; the existing combined browser runner
includes the latter automatically. Checked using the preview on port 5181.
The earlier full 12-script regression report below is historical; this extension
reran the unit suite and the focused four-region/hub browser checks.


## Region packs, hub and viewer lifecycle

**Final production build: passed. `npm test`: 92 tests passed across 19 files. All 12 browser scripts passed against the production preview on port 5177.**

- The lower-leg pack provides the existing 156 structures, atlas areas, camera views,
  compass directions, label tiers, tissue presets, About copy and model URLs.
  Existing anatomy files remain in place. Router and pack validation tests cover
  deep links, malformed routes, storage namespaces, unique IDs, declared assets
  and directed view presets.
- The hub requests no model files or viewer/Three chunks before a region is opened.
  Its entry JavaScript is 10.08 kB before gzip. The one region card includes a
  Playwright-generated thumbnail and all ten tissue counts, summing to 156.
- Hub screenshots and interaction checks pass at 390, 820 and 1440 pixels in both
  Light and Dim themes. Card opening, the region menu, Escape, browser Back,
  valid and invalid selection deep links and last-region persistence pass.
  Existing theme, graphics, inspector-width and collapse settings retain their keys.
- Ten complete hub/viewer cycles keep the mounted baseline at 200 renderer
  geometries and 19 scoped listeners. Every disposal returns both to zero;
  actual `renderer.info.memory.geometries` is checked before renderer disposal.
  Independently tracked global listeners return to the initial hub count each time.
- Leaving during delayed loading clears pending loads and workers. Low graphics
  creates a real picking worker while mounted and releases it on return to the hub.
  The final Low disposal reports zero viewers, listeners, workers, pending loads,
  geometries and disposed-renderer geometries.
- The 1440 × 1000 default viewer comparison has **zero changed pixels** across its
  1180 × 948 canvas (1,118,640 pixels), including labels, compass, canvas controls
  and the overlaid inspector. The new region menu is outside that canvas.
- Existing checks still cover all 30 bones, 77 other original structures and all
  49 neurovascular structures, source facts, picking, attachments, cutaways,
  opacity, fallback models, loading progress, responsive controls and persistence.
  No application or shader errors were reported; the general script still records
  the incidental favicon 404. Vite's existing large-chunk advisory remains.

Browser harness corrections were necessary for the saved pre-refactor viewer:
attachment sections already start collapsed; shared fact sources already appear
once in the separate References section; and the baseline full-shaft overview
already shows four automatic labels. Checks now open attachment sections before
clicking their controls, verify deduplicated references, and preserve that measured
label count. Loading observers discover the per-mount overlay. The delayed-load
test explicitly reloads the same hash URL, and the Low graphics assertion targets
its button rather than the viewport's matching diagnostic attribute. Corrected
checks were rerun serially; the aggregate report retains their earlier attempts.

Evidence: [all browser results](validation/region-regression-check.json),
[hub checks](validation/hub-browser-check.json),
[lifecycle cycles and counters](validation/lifecycle-browser-check.json), and
[canvas comparison](validation/viewer-visual-regression.json). Responsive hub
captures are `validation/hub-{light,dark}-{390,820,1440}.png`. The generated card
asset is `public/regions/lower-leg.png`.

The final serial run used `VIEWER_URL=http://127.0.0.1:5177/`. The combined
`node scripts/run-browser-checks.mjs` runner defaults all checks to port 5176
and accepts that environment override. README contains the build, preview and
thumbnail-generation commands.

## UI revamp (October 5)

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

## Neurovascular geometry validation

The background Blender 5.2.1 exporter ran with factory startup and auto-execution
disabled against the pinned source revision and its verified SHA-256. Output:
49 explicit source objects, 58,600 triangles, 1,518,544-byte GLB. Four long objects
were cropped at the full processed tibia top (Y = 365.344494581 mm); original tube
ends and cut ends are capped, with zero non-manifold edges per exported object.

`npx vitest run tests/neurovascularGeometry.test.ts`: **5 tests passed**.
These checks load the actual shipped GLBs and verify:

- Every atlas ID maps to exactly one unique source object; 33 vessels and 16
  nerves; the GLB hash and frozen registration match the recorded manifest.
- Identity node transforms, meter-to-millimeter conversion, exact triangle and
  geometry bounds, preserved source radius ranges, recorded closure, and crop
  caps at the full-tibia boundary.
- Every vertex fits the illustrative skin's axis-aligned bounds expanded by
  1 mm. Plantar digital veins extend 0.533 mm below the unexpanded minimum Y;
  this tolerance is below the exterior's 1.2 mm voxel construction scale. The
  test does not claim containment inside measured or watertight source skin.
- Tibial nerve and posterior tibial artery pass posterior to the distal medial
  tibial surface patch (Y < 20 mm, Z < -20 mm), in the documented ISB frame.
- Dorsalis pedis spans the midfoot and lies on the dorsal side of the registered
  navicular/cuneiform region. These checks detect registration and sidedness
  regressions; they do not establish clinical landmark accuracy.

Reproducible selection evidence is in
`validation/neurovascular-source-inventory.json`. The unsuffixed right-foot
common plantar digital branches of the medial plantar nerve are explicitly
included and documented; no other missing structures were invented. Source
per-point tube radii are 0.2–3.0 mm (most nerves 0.5 mm), and remain unchanged.


## Dim theme and neurovascular viewer checks

- `npm test -- --maxWorkers=1`: **76 tests passed across 15 files**. One worker
  avoids local Windows memory pressure; the same full suite is exercised.
- `node scripts/theme-browser-check.mjs`: System dark, forced Light and Dim,
  persistence across reload, live OS changes, blocked storage, and non-overlapping
  topbar controls at 390, 820, 1100, 1280 and 1440 pixels. Accent/teal/amber contrast
  on both dim surfaces is 4.99:1 or better. No application or shader errors.
- `node scripts/neurovascular-browser-check.mjs`: both themes; no startup fetch
  or visible neurovascular layers; one lazy GLB fetch; all 49 entries searched and
  inspected with individually linked facts; layer controls, Neurovascular preset,
  opacity, isolate/Escape, actual thin-vessel canvas picking, narrow layout and
  graceful 404 hiding. No application or shader errors.
- `tests/neurovascular-assets.test.ts` also casts an actual BVH ray against every
  imported mesh and verifies screen-space tolerance, unchanged geometry and
  occlusion by opaque anatomy.
- Default light anatomy was compared against a screenshot captured before these
  changes. Excluding DOM controls and label overlays, no pixels differed by more
  than 5/255 per channel. The new tissue controls are intentional UI additions;
  the anatomy, camera framing and default layers remain unchanged. Evidence:
  `validation/neurovascular-default-comparison.json` and the baseline/current PNGs.
- Visual review of `theme-dim-attachments.png` confirms the amber attachment
  footprint remains clear against the dim model. The dim shadow was reduced after
  review to avoid a bright cast-shadow silhouette. Anatomy material colors are
  unchanged across themes; only lighting, shadows and background vary.

JSON results and screenshots are saved under `validation/theme-*` and
`validation/neurovascular-*`. Use `VIEWER_URL` when targeting a production
preview; the two new browser scripts default to the development server on 5174.


Final regression pass: all eight existing browser scripts also pass (main,
bone, soft, connection, exterior, misc, hover-connections and revamp). The
30-bone and 77-existing-soft-tissue sweeps preserve the old coverage; the new
49 structures are covered separately. Tablet topbar bounds at 901 and 1024 px
are recorded in `validation/revamp-topbar-widths.json`, with no overlap or
horizontal overflow. The transient failure-banner check uses a pre-navigation
observer to verify its text and lifetime without missing it on a busy machine.

The final `npm run build` passes. A transient Windows allocation failure during
an overlapping browser run was resolved by serial execution and lower esbuild
concurrency (`GOMAXPROCS=2`, `GOGC=20` for that shell only). No project runtime or
build settings were changed for the machine's memory pressure.


## Home and explorer refinements · October 7, 2026

The focused hub check now covers the Right Foot & Ankle title, a collapsed
structure breakdown without skin, centered Light / Dim thumbnails (including
live system theme changes), the shared credits route and preserved source
attribution without loading viewer models. It deliberately blocks the viewer
import to confirm the proper loading screen remains the same DOM element
through model loading. It also checks the visible home link, effective graphics
gauge direction for Low / High / Auto, and the rightmost inspector expand
button without overlap with Clear. Credits and home screenshots cover narrow
and desktop layouts; the collapsed home fits a 390 × 844 viewport.

Reproduce the preview assets with `node scripts/hub-browser-check.mjs --generate`.
Capture uses a 720px viewport where the inspector is below the canvas, eliminating
the off-axis framing that shifted the old screenshot to the left.

Final unit verification: 19 files / 93 tests passed. `npm run build` passes.
The production home and credits smoke check also passes at 390 × 844: both
preview assets ship, the credits route reloads directly, and neither page
requests viewer modules or model assets. Results are recorded in
`validation/production-hub-check.json`.

All 12 browser scripts pass. The explorer revamp check was rerun after
updating two stale title assertions to Right Foot & Ankle; its passing rerun
is recorded in `validation/region-regression-check.json`. Visual review confirms
centered theme previews, readable narrow credits, a consistent opening screen,
and the expand control at the right edge of the details panel.

## Multi-region viewer · October 7, 2026

The production build passes and the full unit suite passes (23 files, 106 tests). Five new composition tests cover canonical combined URLs, frozen source registration, shared shafts and sacrum, independent regional asset loading, namespaced picking and attachments, and opposite-side separation.

`node scripts/combined-regions-browser-check.mjs` passes without browser errors or warnings. It verifies home multi-selection at 390/820/1440px, the combined left leg in Low graphics, both muscle sets, attachment focus, lazy neurovascular and exterior layers, adding/removing regions, reloads, opposite-side deep links, and disposal. The existing home/navigation browser checks also pass.

Reports and screenshots: `validation/combined-regions-browser-check.json`, `combined-hub-*.png`, `combined-left-overview.png`, `combined-left-attachment.png`, and `combined-left-exterior.png`.
All four regions also pass together in High graphics (67 bones, 80 muscles), with an accessible mobile picker, disabled empty-selection submission, and zero retained viewer/listener resources after returning home. Reproduce with `node scripts/combined-all-regions-browser-check.mjs`; the report is `validation/combined-all-regions-check.json`.


## Shared neurovascular anatomy · October 8, 2026

The production build passes. The full unit suite passes (26 files, 126 tests); the 16 focused shared-anatomy and viewer-session tests also pass after the final inspector-copy refinement.

Combined views join exact source-matched vessels and nerves on the same side, even when regional IDs differ. The shipped upper/lower packs share the great and small saphenous veins, saphenous nerve and tibial nerve: one joined leg has 80 unique neurovascular structures; four regions have 160. Arterial continuations with different source identities remain separate anatomy.

Real left and right GLBs are checked at the registered superior lower-leg crop. Shared upper sections are clipped at that plane to avoid double overlap; both sections use one picking ID, union bounds and a single atlas entry. A failed section leaves successful geometry usable without clipping away its fallback coverage. No connector geometry is invented.

Reproduce browser checks with `node scripts/combined-neurovascular-browser-check.mjs` against the preview. Low/right and High/left checks cover both Area memberships, Focus/Isolate, adding and removing regions, retained layers/opacity/search/filters/labels/anatomical view, shared-selection transfer, legacy upper-region deep links, four-region side separation, mobile layout and disposal. There are no browser errors or warnings. The existing combined-region browser check also passes, including bone deduplication and attachment focus.

Evidence is saved in `validation/combined-neurovascular-browser-check.json`, `combined-neurovascular-low*.png`, `combined-neurovascular-high*.png`, `combined-neurovascular-four-regions.png`, and `combined-neurovascular-final*.png`.

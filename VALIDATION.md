# Muscle Map — validation

Latest checks: October 9, 2026 (America/Los_Angeles). Version remains 1.0.0.



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

## Branding style fixes · October 8, 2026

The viewer wordmark and region title share a vertical center. The home and viewer taglines are removed. All switch knobs have even insets, and inspector descriptions and section headings use the compact 13px facts scale. Scrolling details stay below Clear/Expand; layers remain scrollable inside short desktop windows. Opacity labels fit their rows, and the mobile home selection card stays below the body map.

`npm run build` passes; all 26 unit-test files / 126 tests pass. `node scripts/branding-browser-check.mjs` passes 58 checks against the production preview with no runtime errors. Set `VIEWER_URL` to the preview origin (default port 5176). The check covers 320–1440px widths, 400–1000px heights, Light/Dim settings, checked and unchecked switches, inspector scrolling/resizing, neurovascular controls, combined regions, and narrow credits. Reports and reviewed screenshots are saved as `validation/branding-check.json` and `validation/branding-*.png`.

## Introduction and how-it-works pages — October 8, 2026

- Root `#/` opens the new introduction; `#/browser` retains the existing body map. Viewer return and loading-cancel links target the browser. A browser footer link returns to the introduction.
- `#/how-it-works` explains Layers, selection/details, modeled connections, combining touching same-side regions, camera controls, and model scope. Shared `#/credits` keeps attribution and license links.
- Model previews are actual combined-left-leg Anatomy/Skeleton stills, captured in Light and Dim by `scripts/capture-introduction-models.mjs`. Their attribution is also stored in `public/introduction/CREDITS.md`.
- `npm run build`: passed. `npm test`: 26 files / 127 tests passed.
- `VIEWER_URL=http://127.0.0.1:5174/ node scripts/introduction-browser-check.mjs`: passed, no browser errors. Covered keyboard preview switching; Light, Dim, and System themes; widths 320/390/600/820/1024/1440; guide reload; source attribution; Start exploring; combined regions; viewer disposal; Back/Forward; and existing structure deep links.
- Existing `scripts/branding-browser-check.mjs`: all 58 checks passed after targeting the browser route. Existing browser/viewer layouts and controls remain intact.
- Reports: `validation/introduction-browser-check.json`, `validation/branding-check.json`. Visual QA: introduction in Light/Dim at 390/1440px and how-it-works at 390/1440px, rendered and inspected.


## Historical structure-derived skin — October 9, 2026 (superseded)

This final record covers the deterministic whole-limb skin envelope built from each side's own lower- and upper-leg packs. All distances are millimetres. The lower and upper source datums are registered before assembly, the proximal study crop is Y=790, and the seam is Y=450.125 above the retained gastrocnemius heads. The hybrid extractor keeps a 1 mm heel/body field and uses 0.5 mm extraction for the free toes, joined at the X collar with coarse X=80.125, fine X=80.375, and Y=50.

A shared manifold edge-parity winding pass runs after extraction and before component/cap assembly. The final lower and upper pieces on both sides are closed, have zero directed-edge winding disagreements, and have positive signed volume. Each side also retains nine upper source patch references, and the gastrocnemius accessor bytes are preserved byte-for-byte. The upper references are hidden sourceReference meshes and are excluded from the generated skin and mirror measurements.

| Metric | Right | Left | Result |
| --- | ---: | ---: | --- |
| Published simplified skin triangles before the final cut | 192,552 | 159,982 | Original 150,000 goal **not met**; both remain below the configured 260,000 hard ceiling |
| Lower skin / cap triangles | 128,332 / 290 | 109,490 / 278 | Closed, consistently wound |
| Upper skin / cap triangles | 64,791 / 1,129 | 51,031 / 1,109 | Closed, consistently wound |
| Lower / upper exterior GLB bytes | 3,669,852 / 1,680,936 | 3,217,216 / 1,349,916 | Includes caps; upper retains hidden source references |
| Certified Hausdorff upper bound against dense skin | 0.300001 mm | 0.300001 mm | 0.3 mm limit met within numerical tolerance |
| Sampled self-intersection candidates | 0 | 0 | 10,000 sampled triangles per side; not exhaustive |
| Exact containment within the Y=790 study crop | 99.9168% | 99.9007% | 99.9% criterion met |
| Eligible crop outliers | 541 | 646 | Every coordinate and source index is listed in the enclosure report |
| Containment across all uncropped source vertices | 90.7376% | 90.7232% | **Fails 99.9%** when intentional proximal context is included |
| Intentionally proximal-cropped source vertices | 65,792 | 65,795 | Reported separately from eligible crop containment |
| Seam-loop discrepancy | 0.0051 mm | 0.0051 mm | 0.1 mm criterion met |
| Toe sections with gap at least 0.5 mm, pairs 1–2 / 2–3 / 3–4 / 4–5 | 70% / 60% / 90% / 96.7% | 73.3% / 61.7% / 91.7% / 96.7% | All pairs meet the 60% criterion |
| Clearance samples within 0.5 mm of intended field | 59.86% | 57.14% | **Clearance criterion fails** |
| Maximum sampled clearance deviation | 6.338 mm | 6.342 mm | Explicit limitation |
| Landmark distances: medial malleolus / lateral malleolus / tibial crest / posterior calcaneus | 3.299 / 3.398 / 3.138 / 3.739 mm | 3.291 / 3.409 / 3.134 / 3.752 mm | All four landmarks meet the 2–4 mm criterion |

The exact enclosure study therefore passes for the eligible cropped source set and reports the expected failure when the intentionally excluded proximal source vertices are counted. The all-source percentages are not relabeled as passes. Clearance remains a separate failed acceptance criterion even though the landmark distances pass.

The source toe-gap audit has two scopes. The older phalanx-only gaps are 5.5621, 4.2039, 3.0754, and 6.9993 mm for pairs 1–2 through 4–5. The explicit free-zone audit additionally includes toe-labelled cartilage and tendon branches distal to the metatarsal heads plus 4 mm, and reports 5.5621, 6.3120, 8.2325 mm on the right or 8.2354 mm on the left, and 6.9993 mm. These source-structure diagnostics describe different scopes; the phalanx-only result does not bound every digital vessel, nerve, or soft-tissue branch.

Mirror comparison is diagnostic rather than an exact-reflection claim. After native-side registration and Z reflection, the generated skin maximum discrepancy is 1.8188 mm, while the corresponding native source comparison is 1.2051 mm; the remaining difference includes the 1 mm raster grid and side-specific geometry.

Fresh fields were rebuilt with the matching surface raster cache reused. All five frozen artifact hashes matched for both sides: mesh vertices, dense faces, simplified indices, lower exterior GLB, and upper exterior GLB. The acceptance summary, geometry, enclosure, clearance, build, reproducibility, source-gap, and mesh reports are the source of the figures above.

The final production preview passes all 142 tests in 29 files and `npm run build`. The Exterior, combined-regions, revamp and hub browser checks pass. The final visual matrix contains 528 captures (264 per side) at 1440 and 390 px, in Light and Dim themes, at 100%, 50% and 20% skin opacity, with caps on and off; 16 additional captures cover the actual proximal and seam cut ends. Whole-limb views and ankle, heel and toe close-ups were inspected. Both screenshot runs report zero runtime errors and warnings. The 390 px harness bypasses the existing phone gate for QA only; production phone viewer support is unchanged.

Visual acceptance **fails**: ragged thin edges remain along the toe webs, including at 100% opacity, despite passing section-gap measurements. Three direct 0.5 mm source-raster toe alternatives with 0.8, 0.65 and 0.5 mm section padding were rejected because their actual mesh gap checks failed for the first two pairs. The last alternative also left almost no global containment margin. Ankle and heel bumps read in the reviewed views, and cap visibility/tint works. The rounded illustrative sole was retained without a ground-plane clip. See `validation/skin-visual-review.json` and `validation/skin-toe-prototype.json`; visual review is not relabeled as a pass.

Fresh browser contexts against the local production preview measured combined Skeleton plus Exterior readiness at 9.361 s / 14.994 s for right High / Low and 10.893 s / 17.380 s for left High / Low. Exterior switching after Skeleton readiness took 0.363 s / 0.447 s and 0.379 s / 8.319 s respectively. These are local load observations, not production-network or isolated GLB parse benchmarks. The report is `validation/skin-load-budget.json`.

The plan's complete acceptance set is **not met**: toe-web appearance, uniform clearance, uncropped all-source containment and the original 150k triangle goal remain unmet. The generated assets and controls are reviewable, with failures recorded in each exterior manifest and `validation/skin-acceptance-summary.json`.


## Photo-guided skin fullness and toe revision — October 9, 2026

This record supersedes the earlier structure-derived skin geometry and its visual review. The four published GLBs now use a signed body distance field, broader variable soft-tissue padding, an anterior patellar pad and smoother Achilles/ankle/heel transitions. Rounded source-labelled toe sweeps, continuous gap separators and a broad C1 root blend replace the ragged voxel-carved webs. The supplied photographs are qualitative contour references; these assets remain illustrative and are not registered scans. Some structure-derived surface relief remains.

Both sides use their own lower/upper packs and the existing source registration, seam and groin cut. Gastrocnemius accessor bytes and all nine hidden upper source patches remain unchanged. Caps remain enabled at 100% opacity by default. Homepage source files and the nested checkout were not edited by this revision.

| Current measurement | Right | Left | Result |
|---|---:|---:|---|
| Simplified triangles before cuts/caps | 152,996 | 149,994 | 150k goal fails right; passes left |
| Study-crop source containment | 99.9102% | 99.9105% | >99.9% passes |
| Study-crop outliers | 584 | 582 | Coordinates retained in side outlier reports |
| All uncropped source containment | 90.7316% | 90.7321% | Fails; proximal context remains outside groin cut |
| Clearance within nominal thickness +/-0.5 mm | 27.98% | 29.49% | Original uniform-clearance criterion fails |
| Maximum nominal clearance deviation | 9.533 mm | 9.543 mm | Variable soft-tissue contour, not a uniform offset |
| Toe gap fractions, pairs 1-2 / 2-3 / 3-4 / 4-5 | 90.0% / 96.7% / 93.3% / 63.3% | 90.0% / 96.7% / 93.3% / 61.7% | All actual section criteria pass |
| Landmark distances, medial / lateral / crest / heel | 4.813 / 5.618 / 11.630 / 9.128 mm | 4.817 / 5.612 / 11.565 / 9.138 mm | Original 2-4 mm bands fail |
| Conservative simplification upper bound | 0.300001 mm | 0.300001 mm | 0.3 mm bound passes within 0.000001 mm tolerance |
| Maximum seam discrepancy | 0.00501 mm | 0.00501 mm | Passes |

All four capped pieces are closed, single-component, consistently wound and have positive signed volume. Each side has zero intersections among 10,000 sampled triangles; this is not an exhaustive intersection certificate. Mirror comparisons remain diagnostics of native-side differences, not a reflection certificate.

New preservation indices were frozen against the new dense-vertex SHA, with separate checked index files for each side. Fresh bilateral field rebuilds reused only matching source-raster caches and reproduced all five artifacts per side exactly: dense vertices, dense faces, simplified faces, lower GLB and upper GLB. Parameter and pipeline hashes are in `validation/skin-reproducibility.json`. Geometry, enclosure, clearance, outlier coordinates and all exterior/parent manifests were refreshed.

Fresh visual evidence contains 10 focused desktop captures (five per side) and 16 cut-cap captures. The assistant inspected whole-limb anterior/lateral views and toe, ankle and heel closeups at 100% skin opacity, plus representative proximal/seam cap on/off views. The ragged toe-web strips are absent in these views; distal clefts are rounded, with normal proximal webs retained. This is a scoped qualitative visual pass, not user approval or a claim of clinical accuracy. Both focused side runs report zero errors and warnings; the cap run reports zero page errors. The historical 544-capture transparency/mobile matrix was not rerun on this revision. Production phone support is unchanged.

`npm test` passes all **142 tests in 29 files**; the connective-tissue export check passes its one test; `npm run build` passes with the existing Vite bundle-size advisory. Fresh production-preview contexts loaded combined Skeleton + Exterior successfully on both sides in High and Low graphics, with zero page errors. Current readiness observations: right high 9.037 s, right low 14.467 s, left high 10.183 s, left low 16.850 s. These are local measurements, not production-network benchmarks.

Current evidence: `validation/skin-visual-review.json`, `validation/skin-fullness-final-right/skin-visual-browser-check.json`, `validation/skin-fullness-final-left/skin-visual-browser-check.json`, `validation/skin-fullness-caps/report.json`, `validation/skin-load-budget.json`, `validation/skin-acceptance-summary.json`, and the per-side mesh/geometry/enclosure/clearance reports. Previous review and acceptance records are preserved under ignored `output/skin/reference-before-fullness/`; historical capture reports retain their original paths.

The complete original acceptance set remains **unmet**. Uniform clearance, all-source containment, original landmark bands and the right-side 150k goal remain explicit failures. Every exterior manifest and the acceptance summary retain `allCriteriaPassed: false`.


## Skin rendering performance and foot detail — October 9, 2026

The user's subsequent feedback rejected the previous skin's severe interaction lag and overly smooth foot appearance. This revision changes the viewer and its shading; all four exterior GLBs retain the handoff hashes. No field, extraction, simplification, preservation constraint, cap, seam or assembly coordinate changed. Existing geometry/enclosure/clearance/reproducibility records therefore remain applicable. The homepage and nested checkout were preserved.

The visibility sampler previously cast a 40-by-24 ray grid through unaccelerated skin, including when labels were disabled and no label candidates existed. Skin and cap meshes now receive indirect BVHs before installation, using the existing worker path in Low graphics. Empty label lists skip visibility sampling. A benchmark on each actual lower exterior casts 960 rays: right 3,458.54 ms before / 4.79 ms accelerated; left 3,541.49 ms / 1.97 ms. Every nearest hit matches within 0.00001 mm; index buffers remain unchanged.

Fresh Edge headless contexts on the local production preview at 1440x1000 perform the same 45-step pointer drag on both sides, High and Low graphics, at 100% and 50% opacity. With labels at their default off setting, baseline median frame intervals are 250.3–333.7 ms (about 3–4 FPS); all revised medians are 16.7 ms (about 60 FPS). A second revised matrix explicitly enables labels and also measures 16.7 ms medians across all eight conditions. The first baseline harness incorrectly labeled its rows as labels-on; the saved record was corrected after checking the default setting. It still exercised the old, unconditional label visibility scan. These are local RAF/interaction observations, not a hardware-independent FPS guarantee or production-network benchmark. All 16 revised runs have zero page errors.

Both tiers now use a standard matte skin material. Four compact, offline-baked PNGs add restrained transverse toe creases, nail beds/cuticle rims, dorsal tendon relief and small surface variation. Placement derives from each side's published toe/metatarsal geometry, with the photograph guiding appearance only. The effect fades on the side walls, sole and ankle and is excluded from caps and the upper piece's separate frame. This is shading detail: no triangle count or anatomical envelope is changed. Texture loads participate in exterior readiness; viewer disposal releases the textures. `python scripts/prepare-skin-detail.py` regenerates the maps and landmark provenance.

The final unit suite passes **145 tests in 30 files**. The production build passes with the existing Vite chunk-size advisory. New checks verify accelerated skin/cap picking, nearest-hit equivalence, preservation of positions/normals/indices, map disposal and exclusion of foot detail from caps/upper frames. Existing tests were updated where they required the previous physical material or deliberately absent skin BVH.

Fresh production visual evidence and assistant review are recorded in `validation/skin-runtime-review.json`, with bilateral focused captures and cut-cap captures under `validation/skin-runtime-right/`, `skin-runtime-left/` and `skin-runtime-caps/`. The historical comprehensive phone/transparency matrix is not rerun. User visual approval has not been obtained. Uniform clearance, uncropped containment, original 2–4 mm landmark bands and the right-side 150k triangle target remain failed; `allCriteriaPassed` remains false. The previous assistant shape review is historical evidence for the unchanged geometry, not approval of this new appearance.

## Skin fullness and natural surface — October 9, 2026

The visible bilateral skin now has modest radial fullness and outward rounding of the thigh/calf grooves. `scripts/prepare-skin-fullness.py` always reads the original `output/skin/<side>/` GLBs; it validates both regional pieces before publishing them. Bones, muscles, gastrocnemius, source reference patches, indices and registration are preserved. Skin/cap positions and skin normals change. The final manifests identify this extra processing; previous clearance/Hausdorff/source-containment reports apply to the base envelope, not the final fuller surface. Existing unmet acceptance criteria remain unmet.

`validation/skin-natural/fullness-geometry.json` records closed surfaces, consistent winding, positive volume and positive sampled deformation Jacobians on all four pieces. The paired seams match within 0.00002 mm on both sides. Padding tapers to zero below Y=50 mm, preserving the authored foot. All four final GLB hashes match their manifests and the new report.

Skin shading now uses reduced specular intensity, varied roughness, restrained warm color variation and fine pore relief over the whole limb. Object-space noise avoids UV seams; pixel-footprint fading prevents distant shimmer. Caps retain their flat cut-face shading and the existing dorsal foot maps remain available.

The full unit suite passes **145 tests in 30 files** with two workers. An earlier unrestricted parallel run hit the existing 20-second timeout in a procedural left-pack test; the complete bounded run passes. `npm run build` passes with the existing Vite bundle-size advisory.

Fresh production Edge captures in `validation/skin-natural/after-*.png` cover both sides in anterior/lateral views, a thigh close-up, skin at 40% opacity and caps off. `after-browser.json` records zero browser errors. The assistant reviewed the contour and fine texture in these captures. `performance.json` covers both sides in High/Low graphics at 100% and 50% opacity: all eight local pointer-drag measurements have 16.7 ms median frame intervals (approximately 60 FPS), with zero page errors. No claim is made about other hardware or user visual approval.

## Simplified skin controls — October 9, 2026

Removed the cap and cap-opacity controls from Layers and Settings, together with their saved preferences/session fields. Cut surfaces follow the skin opacity; paired internal seam caps remain automatically hidden. Skin is excluded from the left atlas filters, rows and advertised search/list counts, while the right layer and skin-opacity control remain available. All four opacity sliders use fixed label/output columns and the same flexible track width; the longer vessels/nerves label wraps.

The production build and 14 relevant viewer/session/graphics tests pass. `validation/skin-controls-check.json` records browser verification at 1440 px with normal/expanded inspector widths and at 1024 px: all four slider tracks have matching widths and horizontal alignment; cap controls are absent from both panels; skin is absent from the left menu and from counts; reset and skin opacity still work. Legacy saved cap preferences were included in the browser check. No browser errors occurred. Screenshots are `validation/skin-controls-*.png`.

# Muscle Map

Version 1.0.0 · Updated October 2026

An interactive, static atlas with four independently loaded regions: right foot/ankle, left lower leg/foot, and left and right upper legs. Each region has its own card, models, atlas, views and inspector state. Select multiple cards and choose **Open selected regions** to explore them in one aligned scene. Use the region picker beside the viewer title to add or remove regions, and the Area filter to browse each region.

Shared vessels and nerves on the same side appear once in a combined view. Selecting either section selects the full structure; Focus and Isolate cover all its loaded sections. The shared entry appears under both regions in the Area filter. Adding or removing a region preserves tissue layers, opacity, labels, search, filters and anatomical view, and carries a shared selection into the remaining region.

The left lower leg/foot is a reflected derivative of the original right-side study. Both upper legs use original side-specific source anatomy, with hip and knee context. Each upper leg includes 120 structures (27 muscles); each lower-leg pack includes 156.

The original right foot/ankle study remains available at `#/lower-leg`. The atlas contains 156 selectable structures: 30 bones, 13 muscles, 12 tendon groups, 15 ligament groups, 6 fascia/retinacular groups, 30 cartilage groups, 19 arterial objects, 14 venous objects, 16 nerve objects, and skin. Named neurovascular branch groups remain one selectable source object each.

## Run and validate

```sh
npm install
npm run dev
npm run build
npm test
npm run preview -- --port 5176 --strictPort
```

The dev server uses http://127.0.0.1:5174. Every `scripts/*-browser-check.mjs` accepts `VIEWER_URL` and defaults to http://127.0.0.1:5176. Run each with Node against the preview. Reports and screenshots are in `validation/`; see [VALIDATION.md](VALIDATION.md).

## Explore

- Exterior shows skin and bones at 100% skin opacity. Lower the skin slider to see the skeleton. Anatomy and Skeleton provide the other presets. Neurovascular shows bones, arteries, veins and nerves with muscles at reduced opacity. The three neurovascular layers start off in the default overview.
- System / Light / Dim sets the appearance. System follows the OS; a manual override is saved per browser. Anatomy colors remain fixed across themes.
- Search names, anatomical groups, and descriptions. Tissue chips are independent multi-select filters; cartilage is excluded from the list by default. The Area dropdown filters leg, ankle/heel, midfoot, and individual toes. “Only visible layers” follows your layer switches. Clear filters restores the defaults.
- Tissue sections can be collapsed; their state is saved locally. A selected structure remains temporarily listed even when filtered out. Selection from the model expands its section and scrolls the row into view. Use ↑/↓ and Enter within the list.
- Labels start on. The overview displays major landmarks; zooming closer reveals regional and smaller structures. Overlapping automatic labels are omitted, leader lines connect labels to their anchors, and hidden or faded structures below 50% opacity are excluded. Selection and hover take priority.
- Select a structure for Focus, Isolate, Neighbors, description, function, attachments, related structures, and applicable references. All 13 muscles include sourced origin, insertion, action, innervation, and blood supply. The 49 neurovascular entries each have two short, individually sourced facts. Bone articulations are computed from the existing relationship graph.
- Drag the inspector's left edge to resize it from 280–680px. Its focused handle responds to ←/→ in 24px steps. Expand switches to 640px and restores your saved width. Wider panels arrange facts and descriptive text in two columns. The empty inspector shows only a prompt and Layers.
- Highlight connections colors modeled attachments in teal and temporarily reveals hidden connected layers. Focus frames the selected connection set. Isolate takes precedence. Reset turns highlighting off.
- In Attachments, select a card to focus its footprint. Surrounding anatomy fades; camera-aware cutaways follow the close-up. Select again to return, or press Escape to restore surroundings and clear selection. Footprint extents are illustrative.
- Drag to orbit, right-drag or Shift-drag to pan, and scroll/pinch to zoom. The anatomical compass and five view buttons provide fixed views. **1–5** select Overview, Dorsal, Plantar, Medial, Lateral; **P** toggles pan, **F** focuses, **L** toggles labels, **R** resets. Canvas arrow keys pan.
- About has Overview, Controls, and Sources & credits tabs with arrow-key navigation. Below 700px, topbar actions appear in the ⋯ menu. Below 900px, panels move beneath the canvas.

Models load with byte-based progress when all content lengths are known, or an indeterminate bar otherwise. Failed existing assets retain procedural shapes and show an explanatory message for 2.5 seconds. Neurovascular assets load lazily; if unavailable, their layers are hidden rather than replaced by invented geometry.

## Anatomy, provenance, and illustrative skin

Bones and muscle bellies use registered Z-Anatomy / BodyParts3D meshes. Gastrocnemius includes both source heads and is separately selectable from soleus. Tendons, ligaments, retinacula, and 78 cartilage patches across 39 modeled interfaces are fitted to the source surfaces. Arteries, veins and nerves are adapted from the same pinned source, converted from curves with their tube radii preserved, cropped at the full-tibia upper boundary and registered with the bone transform. Geometry is static and simplified, not clinical; bursae, tendon sheaths and some small structures are omitted.

**Lymph is unavailable for this region in the pinned dataset:** there are no lymphatic vessels below the hip, and only three mid-shin nodes in range. Those nodes are excluded; no lymphatic geometry is modeled by hand. This describes dataset coverage, not the presence of lymphatics in real anatomy.

The Skin layer is an illustrative envelope derived from each side's own registered structures. It is not scanned skin. The fuller contour revision uses a signed body distance field, broader regional soft-tissue padding and a patellar pad. Independent rounded toe profiles use labelled bones/cartilage and associated tendons; grouped digital vessels and nerves constrain coverage by nearest own-side phalanges. Continuous field separators and a broad smooth root blend replace voxel carving and local source repairs. Marching cubes uses a 1 mm body/heel grid and bounded 0.5 mm toe extraction, joined across the existing 0.25 mm collar. Gastrocnemius accessor bytes and hidden upper source references remain unchanged. Caps default on at 100% opacity; combined views hide matching seam caps.

The prescribed group taxonomy places MTP collateral bands under “Midfoot ligaments”; source comments record this taxonomy limitation. Source fact links are in `src/muscleFacts.ts` and `src/neurovascularFacts.ts`, and attachment references in `src/attachments.ts`.

## Implementation and reproducibility

The app uses template-string HTML in `src/app.ts` and `src/main.ts`, CSS tokens in `src/style.css`, TypeScript, Three.js, camera-controls, and Vite. No UI framework or dependency was added. Fonts and models are local.

- `src/labels.ts`: label tiers and zoom thresholds.
- `src/data.ts`, `foot.ts`, `ankleDetails.ts`, `softTissueData.ts`: atlas metadata and groups.
- `src/muscleFacts.ts`, `src/neurovascularFacts.ts`: source-linked anatomy facts.
- `src/neurovascularCatalog.json`: explicit 49-object atlas/source mapping; `scripts/prepare-vessels.py` reproduces the adapted asset.
- `src/assets.ts`, `appearance.ts`: model loading, fallback, materials, and depth coverage.
- `src/connections.ts`, `attachments.ts`, `joints.ts`, `softTissues.ts`: relationships and fitted geometry.

Keep all `scripts/prepare-*.py` files. GLBs, manifests, source metadata, and license files are tracked. `.blend` and `.zip` originals are ignored but retained locally; exporters need `assets/source/Startup.blend`.

Use the running **MCP** extension on localhost:9876:

```sh
python scripts/blender-command.py
python scripts/blender-command.py scripts/inspect-exterior.py
```

The bridge uses NUL-delimited JSON with `type: execute`, `code`, and `strict_json`. Inspection/export scripts may replace Blender's open scene; save work first. `prepare-exterior.py` is the legacy ring-envelope exporter. `prepare-structure-skin.py` replaces that workflow; the old GLB remains in Git history. See [COORDINATES.md](COORDINATES.md), [credits.md](credits.md), [public/models/CREDITS.md](public/models/CREDITS.md), and [continuation.md](continuation.md).


### Display theme

The topbar offers System / Light / Dim. System follows the operating system,
including changes while the viewer is open. A manual choice is remembered in
this browser when local storage is available and applied before the first paint.
Dim uses a slate background and adjusted scene lighting; anatomy material colors
are identical in both themes. Arteries, veins and nerves load only when requested
and remain off in the default overview. The Neurovascular preset enables bones,
vessels and nerves with muscles at 20% opacity.

## Regions and viewer lifecycle

The app opens at `#/`, the Fabrica introduction. **Start exploring** opens the existing
person-based browser at `#/browser`; **How it works** opens `#/how-it-works`.
The introduction uses actual Anatomy/Skeleton stills of the combined left leg,
supports the existing themes, and links to `#/credits`. Its CSS is scoped to the
introduction pages, and it does not load the 3D engine or models. Regenerate the
stills against the dev server with `node scripts/capture-introduction-models.mjs`
(or supply `VIEWER_URL`). Open a region from the browser or use
`#/lower-leg` directly. A link such as `#/lower-leg?select=talus` selects a structure.
The brand link beside the viewer title returns to the browser. Browser Back restores
the previous route; Escape closes the region menu or clears a selection first, then
returns an idle viewer to the hub.

`src/app.ts` owns routing and the hub. `src/regions/catalog.ts` contains lightweight
card metadata and dynamic pack imports. `src/regions/index.ts` defines and validates
`RegionPack`; `src/regions/lower-leg/index.ts` provides the current data, atlas areas,
views, compass directions, label tiers, presets, About copy, scene frame and model
URLs. Existing anatomy files stay in their original locations and are re-exported
through the pack.

`mountViewer(pack, container)` in `src/main.ts` returns a handle with `dispose()`,
`ready` and `select(id)`. Disposal cancels rendering and pending loads, removes
listeners and the resize observer, clears the slow-frame samples and label overlay,
terminates its picking worker, and releases model and postprocessing resources.
The hub loads neither the viewer/3D engine nor model files until a region is opened.

The last opened region is remembered under `muscle-map-last-region`. Existing theme,
graphics, inspector-width and collapsed-section settings keep their per-browser keys.
New region-specific settings should use `regionStorageKey(regionId, key)`.

Run the introduction flow check with `node scripts/introduction-browser-check.mjs`.
It covers responsive layouts, themes, keyboard preview switching, guide and
attribution navigation, combined regions, disposal, and existing deep links.
Browser check URL helpers target `#/browser` by default. Run browser checks
against the preview with:

```sh
npm run build
npm test
npm run preview -- --port 5176 --strictPort
node scripts/run-browser-checks.mjs
```

The new hub and lifecycle checks are also runnable separately. Generate the card
thumbnail from the Playwright viewer capture with
`node scripts/hub-browser-check.mjs --generate`.

The home card shows a collapsed structure breakdown (skin is omitted from that
breakdown) and centered Light / Dim previews. Sources, model attribution, licenses
and reading links live on the shared `#/credits` page linked from the home footer.
Viewer About keeps Overview and Controls. The same loading screen stays visible
from lazy route startup through model downloads; Back to home can cancel opening.
The graphics gauge reflects the effective High / Low tier, including Auto.


## Additional leg regions

- `#/left-lower-leg`: left lower leg and foot, 156 structures, mirrored from the
  registered right-side study. Reflects anatomical Z, triangle winding, normals,
  camera directions, connection seeds and resolved footprints. It is not an
  independently measured left specimen.
- `#/right-upper-leg` and `#/left-upper-leg`: 120 source structures each:
  6 bones, 27 muscles, 21 tendon-material groups, 18 ligaments, 4 fascia groups,
  8 cartilage groups, 12 arteries, 9 veins, 14 nerves, and one exterior group.
  Hip bone and sacrum plus proximal tibia/fibula provide attachment context.
  The source crop runs from 0.32 to 1.025 meters in source superior coordinates.
  Full psoas origins and proximal nerve paths extend beyond this crop.

The upper-leg Exterior displays the structure-derived envelope with outward
front faces and independent cut caps. Original body-region patches are retained
as hidden source references. Anatomy leaves the full fascia lata shell hidden initially;
its layer switch exposes it. Tendons are separated using source material faces.
The source includes portions of the extensor mechanism in those tendon meshes;
there is no separately named patellar-ligament source object in this pack.
Muscle attachment cards use available source origin/insertion patches. Named
hip/knee ligament focus cards fit sampled source contact points to the bones.
All footprint extents remain illustrative. Source-specific origin, insertion,
action, innervation, blood-supply facts and references appear for all 27 muscles.

New region assets and manifests live in `public/models/<region-id>/`. The shared
asset loader resolves each pack's own IDs and tissue metadata. It keeps missing
source meshes unavailable instead of inventing anatomy. Supplemental vessels and
nerves remain lazy; disposal releases their geometry and workers.

To regenerate using the running Blender **MCP** extension on port 9876:

```sh
python scripts/blender-command.py scripts/prepare-left-lower-leg.py
python scripts/blender-command.py scripts/prepare-upper-legs.py
python scripts/blender-command.py scripts/export-upper-legs.py
npm run build
npm run preview -- --port 5181 --strictPort
node scripts/generate-leg-thumbnails.mjs
```

The two upper-leg calls intentionally separate preparation from export because
opening the source replaces Blender's operator context. Run them consecutively
in the same Blender session. They replace the open scene without saving a blend
file; the pinned source remains unchanged. Asset counts regenerate with exports.
Thumbnail generation accepts `VIEWER_URL`, defaulting to port 5181.

`VIEWER_URL=http://127.0.0.1:5181/ node scripts/leg-regions-browser-check.mjs`
checks each region, isolated model URLs, attachments, cameras and disposal.
The updated hub check covers all four cards at mobile, tablet and desktop widths.

### Combined regions

Combined views use shareable routes such as `#/regions?region=left-lower-leg&region=left-upper-leg`. Model loaders remain independent and neurovascular assets remain lazy. Original export datums restore a shared coordinate frame; complete lower-leg tibia/fibula meshes replace upper-leg shaft context, and paired upper legs share one sacrum. Structure IDs are namespaced by region to keep opposite sides selectable. The existing mirrored-left lower-leg provenance still applies.

Run `node scripts/combined-regions-browser-check.mjs` against the preview to verify multi-selection, attachments, layers, region changes, deep links and disposal.


## Rebuilding the illustrative skin

Run `npm exec vitest -- run --config scripts/skin-export.config.ts` to export the actual generated lower-leg connective tissues. Then run `python scripts/prepare-structure-skin.py --side right` and `--side left`, each from its own lower/upper packs. Parameters are in `scripts/skin-parameters.json`. After mesh audits pass, run `python scripts/reproduce-structure-skin.py --freeze-preservation` to freeze new indices against their dense-vertex SHA, then `python scripts/reproduce-structure-skin.py` to verify fresh bilateral field and artifact hashes. Regenerate constraints after every field change; cached-field reuse also checks the recorded implementation hashes. Run `python scripts/inspect-structure-skin.py`, `node scripts/measure-skin-clearance.mjs` and `node scripts/validate-skin-enclosure.mjs` for the remaining audits, then `python scripts/report-structure-skin.py` to attach current acceptance measurements to the published manifests. `--publish` automatically runs `node scripts/validate-structure-skin.mjs <side> --limit-mm=<hausdorffLimitMm>` when the side-specific mesh audit is missing, stale or failing, then rereads the report and refuses publication unless its hashes, configured Hausdorff limit and fixed 0.15 mm validation spacing match and it passes. The configured `surfaceValidationSpacingMm` remains 0.15 mm; uncertain Lipschitz bounds refine to 0.005 mm without changing the 0.3 mm error limit. `targetTriangles` records the desired count and `maximumTriangles` the publication ceiling; locked details can prevent reaching the desired count. Frozen per-side preservation index files referenced by the parameters JSON make simplification independent of previous scratch audits; `--reuse-field` permits triangulation refinement without changing the field. `scripts/measure-skin-source-toes.mjs` records exact phalanx spacing and explicitly toe-labelled cartilage/tendon spacing in the free-toe zone. Grouped digital vessels and nerves do not have independent toe IDs. `sideQuadricErrorMm` permits the two native-source sides to use independently audited decimation tolerances. No pip packages are required: the Python stack is NumPy/SciPy/scikit-image, and installed Node meshoptimizer/earcut perform simplification and cap triangulation.

The region packs do not share a local origin. The full side is constructed in its lower-leg talus frame using frozen source-datum offsets, and the upper piece is exported back to its femur-midpoint frame. The skin seam is Y=450.125 mm in the lower frame, above the preserved calf heads; bones and vessels were originally cropped at Y=365.3445 mm and the upper shafts start around Y=252.3309 mm, an overlap of about 113.014 mm. The groin-level study cut is Y=790 mm. Skin ownership follows those planes even where source anatomy overlaps them. More proximal pelvis/gluteal anatomy remains visible as source context but lies outside the skin crop.

The nine original upper-leg body-region patches are compared in `validation/skin-source-audit.json`. All nine original patch geometries remain byte-identical in the upper GLBs as hidden `sourceReference` meshes because their hip/pelvis coverage exceeds the groin cut. The visible envelope covers the configured thigh/knee study region. The envelope has no geometric creases, nails or person-specific fat. The viewer adds illustrative, source-positioned foot creases, nail beds and dorsal tendon relief through lightweight color/bump textures; these do not change its geometry or measured clearance. Thickness, smoothing, webbing and cut levels are project choices. Clearance and landmark reports distinguish measured departures from the intended profile; do not infer uniform skin-to-bone clearance from the illustrative parameters.

The complete original acceptance set remains unmet. The fuller contour revision is measured in `validation/skin-acceptance-summary.json`, with fresh toe, ankle, heel and cap reviews in `validation/skin-visual-review.json`. Uniform source clearance, the original 2-4 mm landmark bands, and uncropped source containment remain explicit failures; the groin cut still excludes proximal context. The right mesh remains slightly over the original 150k triangle target. This illustrative shape uses variable soft-tissue coverage rather than a uniform offset. Historical screenshots document the previous derivative. Phone viewer support is unchanged.


### Skin rendering and foot detail

Skin and caps now use indirect picking BVHs, including the label-occlusion grid. The viewer skips that grid when there are no active labels. Both graphics tiers use a matte physical skin material with restrained specular intensity, object-space color/roughness variation and fine pore relief over the entire limb. The existing baked dorsal foot detail fades away on the sole, sides and ankle. Texture decoding completes before exterior readiness is reported; disposal releases the maps. The shading preserves its input geometry. The subsequent fullness pass described below changes only the visible exterior positions/normals and cap contours; source anatomy, triangle indices and registration stay intact.

Run `python scripts/prepare-skin-detail.py` to reproduce the bilateral maps and `validation/skin-detail-landmarks.json` from the published foot bone packs (NumPy and Pillow, already available). Run `node scripts/skin-raycast-benchmark.mjs` for nearest-hit equivalence and timing. Run `node scripts/skin-performance-browser-check.mjs` against `VIEWER_URL` (default 5178), optionally with `SKIN_PERF_LABELS=true`; `SKIN_PERF_OUT` chooses the report. Existing measurements are in `validation/skin-performance-before.json`, `skin-performance-after.json` and `skin-performance-labels.json`. See `VALIDATION.md` and `validation/skin-runtime-review.json` for the scoped visual review and the geometry acceptance failures that remain.


### Skin fullness and natural surface

After publishing the base skin and writing its acceptance reports, run `python scripts/prepare-skin-fullness.py`, then `npm run build`. The script reads the unmodified bilateral GLBs in `output/skin/<side>/` on every run. It expands calf and thigh contours and fills muscle grooves outward toward a smooth elliptical section. The foot below Y=50 mm retains its original geometry and detail mapping. Upper and lower pieces use the same own-side coordinate frame and deformation, including their cut caps. Source muscles, bones, gastrocnemius and hidden source patches keep their original accessor bytes. Normals follow the inverse deformation Jacobian.

`validation/skin-natural/fullness-geometry.json` records the final closed topology, consistent winding, positive sampled Jacobian and matched cut seams. The exterior manifests record the original GLB hashes and this additional processing. Previous field/clearance/Hausdorff audits describe the base envelope; they are not new measurements of the fuller contour. The fullness is illustrative and does not change the existing unmet anatomical acceptance criteria. Rerunning the script is idempotent.

The surface uses seam-free object-space variation with restrained warm mottling, varied roughness and fine bump relief. Fine detail fades with the pixel footprint to prevent distant shimmer. Caps keep their flat cut-face shading and receive no pores. No additional textures or runtime dependencies are required. `node scripts/skin-natural-browser-check.mjs after` captures both sides, the thigh close-up, transparency and caps; `VIEWER_URL` can select a production preview.

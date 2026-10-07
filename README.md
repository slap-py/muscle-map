# Muscle Map

Version 1.0.0 · Updated October 2026

An interactive, static study of the right foot and ankle. The atlas contains 156 selectable structures: 30 bones, 13 muscles, 12 tendon groups, 15 ligament groups, 6 fascia/retinacular groups, 30 cartilage groups, 19 arterial objects, 14 venous objects, 16 nerve objects, and skin. Named neurovascular branch groups remain one selectable source object each.

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

## Anatomy, provenance, and the pending skin replacement

Bones and muscle bellies use registered Z-Anatomy / BodyParts3D meshes. Gastrocnemius includes both source heads and is separately selectable from soleus. Tendons, ligaments, retinacula, and 78 cartilage patches across 39 modeled interfaces are fitted to the source surfaces. Arteries, veins and nerves are adapted from the same pinned source, converted from curves with their tube radii preserved, cropped at the full-tibia upper boundary and registered with the bone transform. Geometry is static and simplified, not clinical; bursae, tendon sheaths and some small structures are omitted.

**Lymph is unavailable for this region in the pinned dataset:** there are no lymphatic vessels below the hip, and only three mid-shin nodes in range. Those nodes are excluded; no lymphatic geometry is modeled by hand. This describes dataset coverage, not the presence of lymphatics in real anatomy.

**Real-skin replacement is blocked.** Inspection of the pinned `assets/source/Startup.blend` through the running Blender 5.2 **MCP** extension found no skin/integument mesh. Its Skin and Dermis collections are empty; Integument contains hair and nail appendages. Under the requested stop condition, the existing exterior GLB and manifest were preserved. The skin remains an illustrative fitted surface, and its provenance remains `illustrative-envelope`. No claim of right-leg skin extraction, capping, ≤40k triangles, or 95% bone enclosure is made. The new skin material and Exterior preset are implemented independently.

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

The bridge uses NUL-delimited JSON with `type: execute`, `code`, and `strict_json`. Inspection/export scripts may replace Blender's open scene; save work first. `prepare-exterior.py` remains the existing illustrative exporter until a real skin source is supplied. See [COORDINATES.md](COORDINATES.md), [credits.md](credits.md), [public/models/CREDITS.md](public/models/CREDITS.md), and [continuation.md](continuation.md).


### Display theme

The topbar offers System / Light / Dim. System follows the operating system,
including changes while the viewer is open. A manual choice is remembered in
this browser when local storage is available and applied before the first paint.
Dim uses a slate background and adjusted scene lighting; anatomy material colors
are identical in both themes. Arteries, veins and nerves load only when requested
and remain off in the default overview. The Neurovascular preset enables bones,
vessels and nerves with muscles at 20% opacity.

## Regions and viewer lifecycle

The app opens at `#/`, the Muscle Map region hub. Open the lower-leg card or use
`#/lower-leg` directly. A link such as `#/lower-leg?select=talus` selects a structure.
The home button beside the viewer title and the region menu return to All regions. Browser Back restores
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

Run all browser checks against the preview with:

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

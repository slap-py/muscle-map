# Foot & Ankle Explorer

Version 1.0.0 · Updated October 2026

An interactive, static study of the right foot and ankle. The atlas contains 107 selectable structures: 30 bones, 13 muscles, 12 tendon groups, 15 ligament groups, 6 fascia/retinacular groups, 30 cartilage groups, and skin.

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

- Exterior shows skin and bones at 100% skin opacity. Lower the skin slider to see the skeleton. Anatomy and Skeleton provide the other presets.
- Search names, anatomical groups, and descriptions. Tissue chips are independent multi-select filters; cartilage is excluded from the list by default. The Area dropdown filters leg, ankle/heel, midfoot, and individual toes. “Only visible layers” follows your layer switches. Clear filters restores the defaults.
- Tissue sections can be collapsed; their state is saved locally. A selected structure remains temporarily listed even when filtered out. Selection from the model expands its section and scrolls the row into view. Use ↑/↓ and Enter within the list.
- Labels start on. The overview displays major landmarks; zooming closer reveals regional and smaller structures. Overlapping automatic labels are omitted, leader lines connect labels to their anchors, and hidden or faded structures below 50% opacity are excluded. Selection and hover take priority.
- Select a structure for Focus, Isolate, Neighbors, description, function, attachments, related structures, and applicable references. All 13 muscles include sourced origin, insertion, action, innervation, and blood supply. Bone articulations are computed from the existing relationship graph; other tissues have no newly authored fact fields.
- Drag the inspector's left edge to resize it from 280–680px. Its focused handle responds to ←/→ in 24px steps. Expand switches to 640px and restores your saved width. Wider panels arrange facts and descriptive text in two columns. The empty inspector shows only a prompt and Layers.
- Highlight connections colors modeled attachments in teal and temporarily reveals hidden connected layers. Focus frames the selected connection set. Isolate takes precedence. Reset turns highlighting off.
- In Attachments, select a card to focus its footprint. Surrounding anatomy fades; camera-aware cutaways follow the close-up. Select again to return, or press Escape to restore surroundings and clear selection. Footprint extents are illustrative.
- Drag to orbit, right-drag or Shift-drag to pan, and scroll/pinch to zoom. The anatomical compass and five view buttons provide fixed views. **1–5** select Overview, Dorsal, Plantar, Medial, Lateral; **P** toggles pan, **F** focuses, **L** toggles labels, **R** resets. Canvas arrow keys pan.
- About has Overview, Controls, and Sources & credits tabs with arrow-key navigation. Below 700px, topbar actions appear in the ⋯ menu. Below 900px, panels move beneath the canvas.

Models load with byte-based progress when all content lengths are known, or an indeterminate bar otherwise. Failed assets retain procedural shapes and show an explanatory message for 2.5 seconds.

## Anatomy, provenance, and the pending skin replacement

Bones and muscle bellies use registered Z-Anatomy / BodyParts3D meshes. Gastrocnemius includes both source heads and is separately selectable from soleus. Tendons, ligaments, retinacula, and 78 cartilage patches across 39 modeled interfaces are fitted to the source surfaces. Geometry is static and simplified, not clinical; nerves, vessels, bursae, tendon sheaths, and some small structures are omitted.

**Real-skin replacement is blocked.** Inspection of the pinned `assets/source/Startup.blend` through the running Blender 5.2 **MCP** extension found no skin/integument mesh. Its Skin and Dermis collections are empty; Integument contains hair and nail appendages. Under the requested stop condition, the existing exterior GLB and manifest were preserved. The skin remains an illustrative fitted surface, and its provenance remains `illustrative-envelope`. No claim of right-leg skin extraction, capping, ≤40k triangles, or 95% bone enclosure is made. The new skin material and Exterior preset are implemented independently.

The prescribed group taxonomy places MTP collateral bands under “Midfoot ligaments”; source comments record this taxonomy limitation. All source fact links are in `src/muscleFacts.ts` and attachment references in `src/attachments.ts`.

## Implementation and reproducibility

The app uses template-string HTML in `src/main.ts`, CSS tokens in `src/style.css`, TypeScript, Three.js, camera-controls, and Vite. No UI framework or dependency was added. Fonts and models are local.

- `src/labels.ts`: label tiers and zoom thresholds.
- `src/data.ts`, `foot.ts`, `ankleDetails.ts`, `softTissueData.ts`: atlas metadata and groups.
- `src/muscleFacts.ts`: source-linked muscle facts.
- `src/assets.ts`, `appearance.ts`: model loading, fallback, materials, and depth coverage.
- `src/connections.ts`, `attachments.ts`, `joints.ts`, `softTissues.ts`: relationships and fitted geometry.

Keep all `scripts/prepare-*.py` files. GLBs, manifests, source metadata, and license files are tracked. `.blend` and `.zip` originals are ignored but retained locally; exporters need `assets/source/Startup.blend`.

Use the running **MCP** extension on localhost:9876:

```sh
python scripts/blender-command.py
python scripts/blender-command.py scripts/inspect-exterior.py
```

The bridge uses NUL-delimited JSON with `type: execute`, `code`, and `strict_json`. Inspection/export scripts may replace Blender's open scene; save work first. `prepare-exterior.py` remains the existing illustrative exporter until a real skin source is supplied. See [COORDINATES.md](COORDINATES.md), [credits.md](credits.md), [public/models/CREDITS.md](public/models/CREDITS.md), and [continuation.md](continuation.md).

# Foot & Ankle Explorer

A focused, static study of a **right foot and ankle**, using the Cell Simulator interface and smooth camera controller.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5174. Use `npm run build` for the production build and `npm test` for geometry/camera/compass checks.

## Explore

- Drag to orbit, right/Shift-drag to pan, and scroll to zoom toward the cursor. Pan mode supports ordinary left-drag; two-finger touch pans and pinches.
- The lower-left anatomical compass follows the camera. Click **M** (medial), **L** (lateral), **D** (dorsal/top), **Pl** (plantar/sole), **A** (anterior/toes), or **P** (posterior/heel) to orient the view. These directions refer to the right foot. View changes take the shortest horizontal rotation, including after repeated orbits or clicks during a transition.
- Overview, dorsal, plantar, medial, and lateral presets frame the regional study.
- Search or click individual structures, isolate them, focus the camera, or show adjacent and attached structures (**Neighbors**).
- Turn on **Highlight connections** under Layers to keep the selected structure and its modeled attachments highlighted. For example, selecting extensor digitorum longus highlights its tendons and toe insertion bones. Connected structures appear in teal in the model and atlas; Focus structure frames the full connection. The toggle stays on as you change selections, temporarily reveals hidden connected layers, and preserves your layer choices. Isolate shows only the selected structure; Reset turns the toggle off.
- Hover over any visible structure to highlight its name in the atlas and show a temporary model label, even with Labels turned off. With **Highlight connections** on, hover labels only appear for the selected structure and its highlighted connections; dimmed surroundings do not show hover labels.
- Labels fade in and out and glide with the camera. A brief hover settling time softens switches between neighboring structures; reduced-motion preferences disable these animations.
- Toggle bones, muscles, tendons, ligaments, fascia/retinacula, and joint-surface cartilage.
- Selecting a muscle, tendon or ligament highlights its modeled bone footprints in teal. Under **Attachments**, choose an endpoint to fly to its fitted surface; the active footprint turns amber. Soft-tissue endpoints and muscle–tendon junctions are labeled separately.
- **Ghost mode** preserves the selected structure and its direct attachments while fading surroundings. Focused connections automatically fade structures obstructing the footprint as you orbit. Escape restores your layer and opacity settings; changing a layer exits ghost mode.
- Read attachment notes and section-level sources beside each endpoint, with sourced clinical points for ATFL, Achilles and Lisfranc connections.
- Follow the six-stop connection tour through ATFL, Achilles, Lisfranc, superior extensor retinaculum, fibularis brevis and plantar fascia. Each stop uses footprint focus and ghost mode.
- Keys: **1** dorsal, **2** lateral, **3** medial, **4** overview, **P** pan, **F** focus selected, **L** labels, **R** reset, **Escape** restore surroundings and clear. Arrow keys pan when the canvas has focus.

## Regional anatomy

The active atlas contains 105 selectable entries: 30 bones, 12 muscles, 12 tendon groups, 15 ligament groups, six fascia/retinacular groups and 30 cartilage groups. Complexes preserve their existing atlas IDs; independently named component meshes and footprint records appear under Zoom to connection in the inspector.

The procedural fallback refinements guided by the supplied illustrations include distinct talar body/neck contours, a longer calcaneal tuberosity and medial shelf, navicular tuberosity, wedge-like cuneiforms, a recessed second metatarsal base, broad metatarsal heads, toe articular ends, fifth-metatarsal tuberosity, unequal malleolar heights, and raised medial midfoot. Tendon routes are joined by extensor and fibular retinacula, intrinsic muscle volumes, plantar aponeurosis, and the hallux sesamoids.

The full leg and knee animation have been removed from the active experience. `src/model.ts` preserves the earlier procedural leg implementation for reference and is not imported by the app.

## Accuracy and references

The bone and muscle layers use 30 bone meshes and 12 muscle bellies adapted from Z-Anatomy / BodyParts3D at the same source scale and registration. Procedural tendons, flattened ligament/retinacular bands and cartilage shells are fitted to their surfaces. This is not a clinically validated reconstruction. The supplied screenshots provide visible contours and relationships but not hidden surfaces, measured dimensions, or individual variation. They were used as visual references, not redistributed as textures or model assets.

Bursae, tendon sheaths, nerves, vessels and many small ligaments remain omitted. Retinacular bundles, toe collateral pairs, and extensor expansions are simplified. Cartilage uses 78 offset surface patches across 39 modeled synovial interfaces; thickness and masks are illustrative. The knee femoral surfaces lie outside the atlas. The study is static; it makes no force, strain, gait, or physiological-deformation predictions.

Reference reading:

- [OpenStax — Lower-limb bones and foot arches](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb)
- [NCBI — Foot and ankle anatomy](https://www.ncbi.nlm.nih.gov/books/NBK546698/)
- [NCBI — Ankle joint](https://www.ncbi.nlm.nih.gov/books/NBK545158/)
- [NCBI — Foot muscles and tendon paths](https://www.ncbi.nlm.nih.gov/books/NBK539705/)
- [Advanced Ankle and Foot Sonoanatomy — retinacula](https://pmc.ncbi.nlm.nih.gov/articles/PMC7151198/)

## Implementation

- `src/assets.ts`: bone/muscle GLB loading, atlas matching, per-structure fallback and BVH integration
- `src/attachments.ts`: typed footprints, named pulley guides, component records and source ledger
- `src/connections.ts`: surface decals, attachment-only neighborhoods, footprint camera poses, ray-sampled cutaways and sourced clinical points
- `src/softTissues.ts`: surface fitting, tendon curves, flattened bands and cartilage offsets
- `src/joints.ts`: explicit synovial surface-pair inventory
- `scripts/prepare-muscles.py`: source muscle extraction and reproducible export
- `src/ankle.ts`: procedural regional assembly, muscles, cartilage and tissue materials
- `src/foot.ts`: shaped foot bones, tendon/ligament paths and attachment graph
- `src/ankleDetails.ts`: additional regional structures and metadata
- `src/geometry.ts`: contour lofts and broad retaining bands
- `src/compass.ts`: camera-relative anatomical compass
- `src/camera.ts`: Cell Explorer-style smooth camera and adaptive depth clipping
- `src/main.ts`: atlas, layers, selection, camera views and tour

Built with TypeScript, Three.js, camera-controls and Vite. Fonts are local; the app has no runtime asset-service dependency.

## Anatomical asset migration

Phases 0–2 provide BVH picking, millimeter coordinates, and all 30 source bones in
`public/models/bones.glb` (about 5.7 MB). Each bone has 6,524–12,000 triangles and
its existing atlas ID. `assets/bones.blend` is the cleaned source scene.
`public/models/bones.manifest.json` records the immutable source revision, object
mapping, processing, unit conversion and registration. Adapted bone assets are
CC BY-SA 4.0. The GLB loader preserves existing interaction records and keeps each
procedural bone if its source mesh cannot load.
See [continuation.md](continuation.md) for completed work and next steps,
[COORDINATES.md](COORDINATES.md) for the fixed frame and scale contract,
and [credits.md](credits.md) for licensing and attribution.

### Phases 3–4

Run `scripts/prepare-muscles.py` with Blender 5.2 (background, factory startup,
disabled auto-execution) to reproduce `public/models/muscles.glb` and its manifest.
`node scripts/soft-geometry-check.mjs` checks the assembled registered model;
`node scripts/soft-browser-check.mjs` exercises all 75 soft-tissue atlas groups
and a missing-muscle-asset fallback in Edge. The browser suites default to the
production preview at http://127.0.0.1:5176.

### Phase 5

`node scripts/connection-browser-check.mjs` checks footprint highlighting, focus,
ghost restoration, deep cutaways, all six tour stops, narrow layouts, reduced motion,
asset failures and refitting after late loads. Use `VIEWER_URL` to override the
production preview at port 5176. Decals use the fitted attachment surfaces, not label
anchors. Muscle selections expose the modeled tendon insertion records; unmodeled
proximal muscle origins are not invented. Cutaways sample the footprint center and
rim against visible anatomy, fading whole obstructing structures rather than cutting
mesh topology. Footprint extents remain illustrative.

### Exterior and regional browsing

Use **Exterior** to show the skin surface, or enable **Skin exterior** under
Visible layers and adjust **Skin opacity** to reveal the anatomy underneath.
Anatomy starts with skin hidden. Skin is an illustrative fitted envelope, not a
scan; nails and surface creases are omitted. Gastrocnemius includes both source
heads and remains separately selectable from soleus.

Atlas tabs organize the model by lower leg, ankle/heel, midfoot, and each toe.
Toe tabs include the corresponding bones, cartilage and associated soft tissues.
Shared multi-toe tendons appear in each relevant tab. Search filters the current tab.

Faded anatomy uses depth-tested alpha coverage and temporal antialiasing, avoiding
object transparency sorting and the old 80% depth-write/shadow switch. Fine grain
can remain during motion and settles when the camera stops.

Run `node scripts/exterior-browser-check.mjs` against the development server on
port 5178 to check exterior controls, regional tabs, opacity, and asset fallback.

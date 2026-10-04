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
- The lower-left anatomical compass follows the camera. Click **M** (medial), **L** (lateral), **D** (dorsal/top), **Pl** (plantar/sole), **A** (anterior/toes), or **P** (posterior/heel) to orient the view. These directions refer to the right foot.
- Overview, dorsal, plantar, medial, and lateral presets frame the regional study.
- Search or click individual structures, isolate them, focus the camera, or show adjacent and attached structures.
- Hover over any visible structure to highlight its name in the atlas and show a temporary model label, even with Labels turned off.
- Labels fade in and out and glide with the camera. A brief hover settling time softens switches between neighboring structures; reduced-motion preferences disable these animations.
- Toggle bones, muscles, tendons, ligaments, fascia/retinacula, and the illustrative talar cartilage patch.
- Follow the six-stop tour through the ankle mortise, heel, midfoot, retaining bands, fibular tendons, and sole.
- Keys: **1** dorsal, **2** lateral, **3** medial, **4** overview, **P** pan, **F** focus selected, **L** labels, **R** reset, **Escape** clear. Arrow keys pan when the canvas has focus.

## Regional anatomy

The active atlas contains 66 selectable entries: 30 bones (26 standard foot bones, two hallux sesamoids, distal tibia and fibula), nine muscle entries, seven tendon entries, fourteen ligament entries, five fascia/retinacular entries, and one cartilage entry.

Refinements guided by the supplied illustrations include distinct talar body/neck contours, a longer calcaneal tuberosity and medial shelf, navicular tuberosity, wedge-like cuneiforms, a recessed second metatarsal base, broad metatarsal heads, toe articular ends, fifth-metatarsal tuberosity, unequal malleolar heights, and raised medial midfoot. Tendon routes are joined by extensor and fibular retinacula, intrinsic muscle volumes, plantar aponeurosis, and the hallux sesamoids.

The full leg and knee animation have been removed from the active experience. `src/model.ts` preserves the earlier procedural leg implementation for reference and is not imported by the app.

## Accuracy and references

This is original, reference-guided procedural geometry, not a scan-derived or clinically validated reconstruction. The supplied screenshots provide visible contours and relationships but not hidden surfaces, measured dimensions, or individual variation. They were used as visual references, not redistributed as textures or model assets.

Bursae, tendon sheaths, nerves, vessels, several deep muscles, and many small ligaments remain omitted. Retinacular bundles, toe collateral pairs, and extensor expansions are simplified. The cartilage patch represents only the talar dome. The study is static; it makes no force, strain, gait, or physiological-deformation predictions.

Reference reading:

- [OpenStax — Lower-limb bones and foot arches](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb)
- [NCBI — Foot and ankle anatomy](https://www.ncbi.nlm.nih.gov/books/NBK546698/)
- [NCBI — Ankle joint](https://www.ncbi.nlm.nih.gov/books/NBK545158/)
- [NCBI — Foot muscles and tendon paths](https://www.ncbi.nlm.nih.gov/books/NBK539705/)
- [Advanced Ankle and Foot Sonoanatomy — retinacula](https://pmc.ncbi.nlm.nih.gov/articles/PMC7151198/)

## Implementation

- `src/ankle.ts`: regional assembly, muscles, cartilage and tissue materials
- `src/foot.ts`: shaped foot bones, tendon/ligament paths and attachment graph
- `src/ankleDetails.ts`: additional regional structures and metadata
- `src/geometry.ts`: contour lofts and broad retaining bands
- `src/compass.ts`: camera-relative anatomical compass
- `src/camera.ts`: Cell Explorer-style smooth camera and adaptive depth clipping
- `src/main.ts`: atlas, layers, selection, camera views and tour

Built with TypeScript, Three.js, camera-controls and Vite. Fonts are local; the app has no runtime asset-service dependency.

## Anatomical asset migration

Phases 0 and 1 establish the asset/licensing pipeline, BVH picking and millimeter
coordinates. The geometry remains procedural until a later source-model import.
See [continuation.md](continuation.md) for completed work and next steps,
[COORDINATES.md](COORDINATES.md) for the fixed frame and scale contract,
and [credits.md](credits.md) for licensing and attribution.

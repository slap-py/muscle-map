# Processed anatomical models

`bones.glb` contains exactly 30 right-side bones, named after existing atlas IDs,
with `extras.atlasId`: tibia, fibula, 7 tarsals, 5 metatarsals, 14 phalanges and
2 separate hallux sesamoids. Each mesh has 6,524–12,000 triangles and identity
object transforms. No loose geometry or non-manifold edges remain.

The GLB is meters in the Phase 1 anatomical basis. `src/assets.ts` bakes hierarchy
transforms and converts to millimeters once, builds BVHs, and replaces meshes in
existing part records. Missing, malformed or unknown bones retain their procedural
fallback. The existing group, anchor and selection IDs remain stable.

`bones.manifest.json` contains source mapping, transforms, license, processing
and output hash. CREDITS.md and Z-Anatomy-License.txt ship with the asset.
The adapted meshes are CC BY-SA 4.0; this does not relicense original viewer code.

Rebuild after downloading originals:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python scripts/prepare-bones.py
```

When the Blender MCP add-on is responsive, run the same script with
`python scripts/blender-command.py scripts/prepare-bones.py`. This replaces the
current Blender scene; use a dedicated scene/session. `BLENDER_MCP_PORT` overrides
9876. The script saves the cleaned source to `assets/bones.blend`.

The source has coarse control surfaces, so subdivision is needed before reducing
larger surfaces to budget. Smoothing does not create new measured anatomical data.
Native source scale and inter-bone positions are retained. Phase 4 soft tissues are fitted to these registered source surfaces.

## Muscles and reconstructed soft tissues

`muscles.glb` contains 12 right-side muscle bellies (about 2.4 MB), with exact atlas
IDs and identity transforms. `muscles.manifest.json` records source materials,
seam removal, caps, repairs, crop, bounds, junctions, units, matrix and hash.
Rebuild using the same Blender command above with `scripts/prepare-muscles.py`.
That script also writes `assets/muscles.blend` and `src/muscleLandmarks.json`.

`src/attachments.ts` contains 74 independently rendered attachment records.
`src/softTissues.ts` resolves footprints to current surfaces, routes smooth tendon
curves through explicit pulley guides, fits flattened bands, and builds 78 thin
cartilage shells from paired surface masks at the 39 synovial interfaces listed
in `src/joints.ts`. Cartilage includes the talar facets, midfoot, MTP/IP and hallux
sesamoid interfaces. Knee femoral surfaces are outside this regional atlas.

These are static illustrative fits. No thickness, footprint boundary, material
seam or guide coordinate is a subject-specific measurement or validated wrapping
solution. All original bone/muscle scale and positions remain unchanged.

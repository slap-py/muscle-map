# Coordinate contract — Phase 1

All active runtime mesh vertices, bounds, label anchors, camera positions/targets,
lights, and future attachment points use millimeters. One Three.js unit = 1 mm.
The scene root has identity rotation, translation and scale.

## Axes and origin

Right-handed ISB-aligned anatomical frame in the neutral standing orientation:
+X anterior (toes), +Y superior (up), +Z subject-right.
For this right foot, medial = -Z and lateral = +Z.
Dorsal/plantar compass shortcuts represent +Y/-Y for this static pose.

Axis source: Wu & Cavanagh (1995), Parts 1–2 and Figure 1,
[ISB original paper](https://media.isbweb.org/images/documents/standards/Wu%20and%20Cavanagh%20J%20Biomech%2028%20(1995)%201258-1261.pdf).
The paper's reporting unit is meters; this app deliberately uses millimeters.
This is an ISB-aligned scene basis, not an implementation of a joint coordinate
system or an ISB segment center-of-mass frame. Biomechanics remain out of scope.

Fixed origin: the authored talus reference center, atlas ID `talus`,
at legacy [0, 0.84, 0.05]. It becomes [0, 0, 0] mm.
This is a reproducible project datum, not a measured joint center, attachment or
subject-specific landmark. Never recenter it after visibility/selection changes.

## Legacy conversion

The old frame was +X medial, +Y up, +Z anterior.
A legacy unit is assigned 100 mm as display calibration, not a measured dimension.

```text
x_mm = 100 * (z_old - 0.05)
y_mm = 100 * (y_old - 0.84)
z_mm = -100 * x_old
```

This is a proper rotation plus uniform positive scale and translation, with no
reflection. Mesh normals and winding preserve sidedness.
`src/coordinates.ts` owns the matrix, directions, camera presets and source record.
`src/ankle.ts` bakes this conversion once after procedural construction and before
BVH generation or anchor calculation. Source arrays in foot.ts/ankleDetails.ts
remain explicitly legacy authoring inputs. They are not runtime mm points.
The unused historical full-leg builder in model.ts remains legacy-only.

## Camera and scene distances

Preset distances: 850 mm overview/sides, 590 mm surfaces, adjusted for aspect ratio.
Focus minimum: 60 mm. Dolly bounds: 2–3000 mm. The controller rest threshold remains its default (shared by linear and angular checks).
Adaptive near clip: clamp(distance * 0.01, 0.05, 100) mm;
far clip: near * 100000. Shadow camera distances, normal bias, lights and floor
are converted with the model. Damping times, angular limits and pixel-based label
spacing remain unchanged. Label side uses -Z, corresponding to old +X medial.

## Future GLB ingestion

[glTF 2.0 §3.4](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units) specifies linear distances in meters. Export valid meter-scale GLBs
with the anatomical axis orientation, then convert loaded scene geometry to mm
exactly once (1000x), baking world transforms before building BVHs.
Do not label mm coordinates as ordinary meter-scale glTF. Record the source-to-scene
matrix and source units in each manifest; do not guess Blender export orientation.

Register imported anatomy to this fixed datum using documented landmarks and
record any calibration; never use a mesh's changing bounding-box center as the origin.
If a better measured datum is chosen later, version the convention and migrate all
meshes, attachment coordinates and camera presets together.

Every anatomical mesh keeps the existing atlas ID in userData.atlasId and
userData.id (the current UI reads id); source GLB nodes use extras.atlasId.
An attachment record must identify its owning atlas ID, connected atlas IDs,
position in mm, convention version, and citations for its location/path.
Label anchors are presentation centroids, not anatomical attachments.
Citations must give URL, title and section/figure plus what claim they support;
general model attribution does not validate an attachment coordinate.



## Phase 2 source registration

Pinned Z-Anatomy source uses Metric / 1 meter per Blender unit. Its standing axes
are -Y anterior, +Z superior and -X subject-right. The source world bounding-box
center of Talus.r, frozen before smoothing, maps to the fixed Phase 1 datum
[0, 0, 0]. This is a reproducible display registration, not a measured joint center.
The exact datum and 4x4 source-world-to-GLB matrix are in bones.manifest.json.
No scaling, reflection, independent bone repositioning or per-bone fitting is used.

Blender geometry is stored with anterior +X, superior +Z and right -Y so the
standard Y-up exporter produces the required anatomical GLB basis. Both matrices
are recorded. All 30 Blender and GLB object transforms are identity. Runtime bakes
GLB world matrices and multiplies by 1000 once; the legacy matrix is never applied.
Full source tibia/fibula are retained; Overview fits their larger extent. Regional
view shortcuts retain Phase 1 directions. Soft tissues stay procedural and do not
represent registered attachments to the new surfaces.

## Neurovascular source registration

`neurovascular.glb` uses the unchanged bone registration and fixed talus datum.
The 49 explicit source objects in `src/neurovascularCatalog.json` are converted
from curves while preserving their bevel depth and per-point radii. Six-sided
tubes use longitudinal resolution 6. The source control-point radii range from
0.2 to 3.0 mm; most peripheral nerves have a 0.5 mm radius. No anatomy is scaled
or moved independently to fit the viewer.

Long curves are cropped and capped at the processed full-tibia upper boundary,
Y = 365.344494581 mm. Exported GLB positions remain meters, with identity node
transforms; ingestion multiplies by 1000 exactly once before bounds and BVHs.
The exact matrices, source names, output hash, bounds, counts and processing are
recorded in `public/models/neurovascular.manifest.json`.

The source object `Common plantar digital branches of medial plantar nerve`
lacks the usual `.r` suffix. Its collection and negative source-X bounds locate
it in the right foot; this explicit exception completes the 16-nerve inventory.
The other 33 objects are vessels (19 arteries and 14 veins).

Exterior validation is an axis-aligned envelope check, not a claim of containment
inside measured skin. The existing exterior is illustrative and voxelized at
1.2 mm. Plantar digital veins extend 0.533 mm below its minimum Y; all new vertices
fit the exterior bounds with a documented 1 mm tolerance. The anatomy is retained
unchanged rather than distorted to fit that illustrative contour.

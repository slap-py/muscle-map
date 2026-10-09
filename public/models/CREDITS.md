# Credits and asset licensing

Updated 2026-10-05. Registered bone, muscle-belly and neurovascular meshes are adapted from Z-Anatomy / BodyParts3D. Tendons, ligaments, fascia and cartilage are procedural surface fits. No upstream definitions or application code are imported.

## Z-Anatomy decision

The planned foot/ankle subset can be copied, processed, displayed and redistributed
under CC BY-SA 4.0, including commercial use, with attribution, license links,
change notices and share-alike terms for adapted model assets. Do not impose
additional restrictions on those assets. This is sufficient for the intended
viewer, subject to checking the exact objects imported; it is not blanket
clearance of the full-body collection.

Primary sources:
- [Upstream license](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)

Retain these requested upstream credits when importing:
- BodyParts3D — The Database Center for Life Science — CC BY-SA 2.1 Japan.
  Original model: Kousaku Okubo. [Source](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html),
  [license](https://creativecommons.org/licenses/by-sa/2.1/jp/).
- Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0.
  Design, 3D and anatomy: Gauthier Kervyn.
  [Source](https://github.com/Z-Anatomy/Models-of-human-anatomy),
  [license](https://creativecommons.org/licenses/by-sa/4.0/).

Upstream lists exceptions: Dundee cranial nerves/foramina (CC BY 4.0),
Dundee inner ear (CC BY-NC-SA 4.0), Lissie Cowley kidney (CC BY-NC 4.0),
and University of Washington Brainder/white matter without a stated license there.
Exclude these unrelated objects; verify provenance against the exact source
revision before distributing any subset. Wikipedia definitions carry separate
CC BY-SA 3.0 terms and are not imported. This notice does not relicense original app code.

When models ship, include attribution in the deployment and record actual
changes (cropping, decimation, registration, unit conversion and GLB export).
Phase 2 changes: right-side extraction; two sesamoids separated; loose geometry
and one dangling face removed; outward normals; Catmull-Clark surface subdivision
and decimation to 6,524–12,000 triangles per bone; source-to-Phase-1 registration;
identity object transforms; meter-scale GLB export. Full tibia and fibula retained.
Subdivision smooths coarse source surfaces; it does not add measured detail.

Pinned revision: `b722f392d2b09d21f0527229fe1338f27a3bc04e`.
See `assets/source/source-manifest.json` for original SHA-256 hashes and URLs,
and `public/models/bones.manifest.json` for the exact object mapping, processing,
units, registration matrix and output hash. The skeletal subset falls under the
upstream blanket Z-Anatomy/BodyParts3D model license; none of the listed exception
objects are included. Original object-specific authorship metadata is not supplied
by upstream, so attribution is at the source-project level. Adapted mesh assets
are CC BY-SA 4.0. The viewer About dialog and deployed models/CREDITS.md retain
credits and original license links.

## Dependencies

three-mesh-bvh by Garrett Johnson is MIT licensed:
[license](https://github.com/gkjohnson/three-mesh-bvh/blob/master/LICENSE).
Three.js and camera-controls retain their MIT notices. Inter retains its
SIL Open Font License. Installed packages include their upstream licenses.


## Phase 4 muscle and surface adaptations

`muscles.glb` and `assets/muscles.blend` use the same pinned source revision,
physical scale and frozen registration as the bone layer. Exact source names,
triangle counts, per-object repairs and output SHA-256 are recorded in
`public/models/muscles.manifest.json`. These right lower-leg and foot objects
fall under the same upstream blanket model license; no exception objects or
upstream definitions are included. Original object-level authorship is not
provided, so attribution remains at source-project level.

Changes: removed faces assigned upstream's Tendon material; capped belly seams;
cleaned and triangulated surfaces; subdivided and decimated to the Phase 2 budget;
repaired soleus topology using a 0.6 mm voxel grid; cropped incorrectly
muscle-colored EDB distal slips at anatomical X = 65 mm; used documented seam-level cuts for abductor hallucis (X = 65 mm) and FHL (Y = 31 mm), preserving belly aponeuroses where material-only separation fragmented the source; baked identity transforms;
exported meter-scale GLB. Source material seams supply approximate distal junctions.
Subdivision and capping do not supply measured anatomical detail.

Muscle assets and derived surface adaptations are distributed under CC BY-SA 4.0.
Cartilage masks are extracted from the adapted bone surfaces and offset 0.02–0.65 mm;
their thickness is illustrative. Attachment/guide coordinates are authored and fitted
to these surfaces. Anatomical references and claim locators live in
`src/attachments.ts`; they support topology/course, not numerical coordinates.
Original viewer implementation code retains its existing license status.

## Exterior and calf update

`exterior.glb` adds both right gastrocnemius heads from the same pinned Z-Anatomy
source and registration as the other muscles. The original soleus mapping was
correct; gastrocnemius had been excluded from the regional model. Source
aponeuroses are retained, with illustrative connections to the common Achilles
junction. See `exterior.manifest.json` for provenance and geometry processing.

The skin is a procedural outer envelope fitted around the registered anatomy,
with separate toe contours, voxel union and smoothing. It is not scanned skin;
nails and creases are omitted. It is an adaptation under the same CC BY-SA 4.0
terms and attribution as the source anatomy. Rebuild with Blender:
`blender --background --factory-startup --disable-autoexec --python scripts/prepare-exterior.py`.

## Historical source skin inspection

The Blender 5.2 MCP source inspection found no skin/integument mesh in the pinned Startup.blend. Skin and Dermis collections are empty; Integument contains hair and nail appendages. The preceding ring-derived surface is retained in Git history. The current structure-envelope derivative is documented below; neither surface is extracted Z-Anatomy skin.

The viewer now uses a skin physical material and a skin-plus-bone Exterior preset. These visual changes do not change the geometry's provenance. The running MCP extension can be inspected through `python scripts/blender-command.py scripts/inspect-exterior.py` after saving open Blender work.

## Neurovascular adaptations

`neurovascular.glb` adds 49 selectable right lower-leg and foot source objects
(19 arterial, 14 venous and 16 peripheral nerve objects) from
`assets/source/Startup.blend`, revision
`b722f392d2b09d21f0527229fe1338f27a3bc04e`. A source object may contain a
whole named branch group; the count is of source objects, not individual branches.

Attribution: **BodyParts3D — The Database Center for Life Science — CC BY-SA 2.1 Japan**
(original model: Kousaku Okubo) and **Z-Anatomy — The libre 3D atlas of anatomy —
CC BY-SA 4.0** (design, 3D and anatomy: Gauthier Kervyn). Source and license links
above apply. The adapted neurovascular assets are distributed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Changes: explicit source-object selection; curve-to-mesh conversion with source
bevel and point radii retained; reduced tube tessellation; cropping and capping
at the viewer's full-tibia upper boundary; the frozen bone source-to-viewer
registration and millimetre/ISB coordinate contract; triangulation and GLB export.
The reproducible processing, exact object mapping, triangle counts and output hash
are recorded in `neurovascular.manifest.json` beside the deployed model
(`public/models/neurovascular.manifest.json` in the repository).

The exact list below was checked against the exception list in the pinned
`assets/source/Z-Anatomy-License.txt`. These are lower-limb cardiovascular and
peripheral nerve objects. No Dundee cranial nerves/foramina or inner ear,
Lissie Cowley kidney, University of Washington Brainder or white matter objects
are included. The foot nerves use the upstream blanket model license; upstream
does not provide separate object-level authorship. No upstream definition text
is imported. Independently summarized study facts and their individual source
links are in `src/neurovascularFacts.ts`.

One verified right-foot nerve object, `Common plantar digital branches of medial
plantar nerve`, has no `.r` suffix in the source. It is included explicitly by name,
with its right-side location documented in the manifest.

**Lymph is unavailable for this region in this dataset.** The pinned source has no
lymphatic vessels below the hip. The only lymph objects in range are three
mid-shin nodes; these are excluded. No lymphatic anatomy is modeled by hand.
This is a source-data limitation, not an anatomical claim that the foot lacks
lymphatic vessels.

### Included neurovascular source objects

Arteries:

- `Anterior tibial artery.r`
- `Arcuate artery.r`
- `Calcaneal branches of fibular artery.r`
- `Calcaneal branches of posterior tibial artery.r`
- `Common plantar digital arteries.r`
- `Deep plantar artery.r`
- `Dorsal digital arteries of foot.r`
- `Dorsal metatarsal arteries.r`
- `Dorsalis pedis artery.r`
- `Fibular artery.r`
- `Lateral plantar artery.r`
- `Lateral tarsal artery.r`
- `Medial plantar artery.r`
- `Perforating branches of plantar metatarsal arteries.r`
- `Plantar arch.r`
- `Plantar metatarsal arteries.r`
- `Posterior tibial artery.r`
- `Proper plantar digital arteries.r`
- `Superficial branch of medial plantar artery.r`

Veins:

- `Anterior tibial veins.r`
- `Dorsal digital veins of foot.r`
- `Dorsal metatarsal veins.r`
- `Dorsal venous arch of foot.r`
- `Fibular veins.r`
- `Great saphenous vein.r`
- `Intercapitular veins of foot.r`
- `Lateral plantar veins.r`
- `Medial plantar veins.r`
- `Plantar digital veins.r`
- `Plantar metatarsal veins.r`
- `Plantar venous arch.r`
- `Posterior tibial veins.r`
- `Small saphenous vein.r`

Nerves:

- `Common plantar digital branches of lateral plantar nerve.r`
- `Common plantar digital branches of medial plantar nerve`
- `Deep fibular nerve.r`
- `Dorsal digital branches of deep fibular nerve.r`
- `Dorsal digital branches of superficial fibular nerve.r`
- `Intermediate dorsal cutaneous nerve of foot.r`
- `Lateral plantar nerve.r`
- `Medial dorsal cutaneous nerve of foot.r`
- `Medial plantar nerve.r`
- `Muscular branches of deep fibular nerve.r`
- `Proper plantar digital branches of lateral plantar nerve.r`
- `Proper plantar digital branches of medial plantar nerve.r`
- `Saphenous nerve.r`
- `Superficial fibular nerve.r`
- `Sural nerve.r`
- `Tibial nerve.r`


## Left lower leg and bilateral upper legs — October 7, 2026

The assets in `left-lower-leg/`, `left-upper-leg/`, and `right-upper-leg/`
are adaptations of the same pinned Z-Anatomy / BodyParts3D source credited above,
distributed under CC BY-SA 4.0 with underlying BodyParts3D attribution retained.
Each folder's manifest records hashes, provenance and processing.

The left lower-leg pack reflects the previously registered right-side assets
through anatomical Z and corrects winding and normals. It is a study mirror,
not independent left-side source anatomy. Its skin remains an illustrative
exterior derived from the existing right-side envelope.

The two upper-leg packs extract original `.l` and `.r` source objects. Changes:
hip-to-proximal-lower-leg crop; separated tendon and cartilage materials; cap
crop/seam boundaries; subdivide and reduce source surfaces; convert source curves
with their original radii; register around each femur; export static Y-up GLBs.
Exterior consists of original body-region patches displayed double-sided.
No excluded third-party exception objects are used. Per-object names and triangle
counts are recorded in each manifest. Footprint focus extents are illustrative.


## Illustrative structure envelope (October 2026)

The displayed skin is derived from the side-specific Z-Anatomy structure exports and the viewer’s generated connective tissues, rather than extracted from a skin scan. Each side is constructed from its own packs; the left lower-leg anatomy remains a mirrored right-side derivative, while its upper-leg source is native. Triangle surfaces are voxel-sampled, filled, inflated by a smooth project-defined thickness field and extracted with gradient normals. Independent per-toe fields use source-derived cross-section hulls and preserve air gaps; bounded half-millimetre extraction slabs resolve their contours. The lower-leg gastrocnemius geometry is preserved byte for byte. Cut caps are separately triangulated meshes. The nine original upper-leg open surface patches are compared in `validation/skin-source-audit.json`; the new envelope stops at a groin-level study cut and omits more proximal pelvis/gluteal context. No creases, nails or person-specific fat are modeled. Derived envelopes: CC BY-SA 4.0. Source attribution and upstream license notices above continue to apply.

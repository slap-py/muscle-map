# Credits and asset licensing

Updated 2026-10-04. Phases 2–4 ship 30 bone and 12 muscle-belly meshes adapted from Z-Anatomy / BodyParts3D. Tendons, ligaments, fascia and cartilage are procedural surface fits. No upstream definitions or application code are imported.

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

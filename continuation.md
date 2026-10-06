# Foot & Ankle Explorer — continuation

Updated October 2026 · version 1.0.0

## Current state

The UI revamp is implemented: anatomical groups and multi-select tissue filters; Area dropdown; saved collapse state; keyboard list selection; selected-row override; compact empty inspector; saved 280–680px resize and 640px expand; sourced muscle facts and derived bone articulations; zoom-tier labels with overlap rejection and leaders; branded responsive topbar; real loading progress and fallback notice; three-tab About dialog.

Attachment focus, camera-aware cutaways, Highlight connections, Isolate, Neighbors, procedural asset fallback, and existing anatomical geometry are retained. Exterior now shows skin and bones and resets skin opacity to 100%. The skin uses a physical material and casts no shadow. All original preparation scripts remain.

## Outstanding: actual skin geometry

The Blender connection problem was a protocol mismatch. `scripts/blender-command.py` now speaks the installed Blender 5.2 **MCP** extension's NUL-delimited JSON protocol at localhost:9876; it is distinct from “MCP for Blender”.

After the user confirmed saving the scene, source inspection succeeded but found no skin mesh. Skin and Dermis collections are empty; Integument contains appendages only. The requested missing-skin stop condition therefore applies to Phase 5 geometry. The user authorized completing other work in this case.

`prepare-exterior.py`, `public/models/exterior.glb`, and `exterior.manifest.json` were deliberately preserved. They still describe an illustrative envelope; do not relabel it as Z-Anatomy skin. True-skin bisect/cap/decimation and the ≤40k-triangle / 95%-bone-enclosure tests await a suitable source. Credits and About do not claim an adaptation that was not performed.

To resume: supply a source containing the skin surface, inspect it with `python scripts/blender-command.py scripts/inspect-exterior.py`, and apply the requested registration, right-side cut, proximal cut, capping, outward normals, and ~35k triangle budget. Preserve the gastrocnemius export. Update provenance and add geometry acceptance tests only once the replacement is real.

## Checks and repository policy

See `VALIDATION.md` and `validation/*-browser-check.json` for the final verification. Dev server: port 5174. Production preview: `npm run preview -- --port 5176 --strictPort`. All browser checks accept `VIEWER_URL`.

Work is on main. Baseline commit: `6704f2b` (`chore: snapshot phase 5 state with GLB assets`, with the requested co-author trailer). The revamp is one subsequent commit; nothing is pushed. `.blend` and `.zip` originals remain on disk and ignored. GLBs and manifests are tracked. No new runtime dependency or framework, and version remains 1.0.0.

Normal Windows sandbox process startup failed during this session; approved project-scoped PowerShell commands were used. Do not confuse that execution-host issue with Blender availability.

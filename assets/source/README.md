# Original anatomical sources

Pinned Z-Anatomy revision: b722f392d2b09d21f0527229fe1338f27a3bc04e.
`source-manifest.json` records immutable download URLs, archive member and SHA-256
hashes. Original license and README are retained here.

Run `python scripts/download-bones.py` from the repository root to reproduce the
unmodified Z-Anatomy.zip and Startup.blend. These large originals are ignored by
Git, retained locally, and reproducible from the manifest. The template's embedded
Python is never executed. No full-body definitions or excluded assets are exported.

See ../../credits.md for attribution and the processed manifest for object IDs.

## Blender 5.2 MCP and missing skin

Use the running extension titled **MCP** (not “MCP for Blender”) at localhost:9876 through `scripts/blender-command.py`. It sends NUL-terminated JSON with type `execute`, code, and strict_json. The no-argument command reads scene status; script arguments execute the saved script.

Save open Blender work before `scripts/inspect-exterior.py`: it opens this pinned Startup.blend. October 2026 inspection found no skin/integument mesh: Skin and Dermis collections are empty, and Integument contains appendages. Real-skin extraction is blocked until a suitable source is supplied. Existing exterior geometry and its manifest remain the illustrative version. All prepare scripts and local originals are retained.

"""Isolated foot/toe skin prototype using independent axial YZ convex sections.

This script intentionally does not modify the production builder, parameters, or assets.
Each toe receives its own per-X YZ convex fill from the assigned source voxels; there
is no closing across toes. A signed section field is Gaussian-smoothed at 1.1 voxels
and substituted only in the free-toe zone of the existing foot field.
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, math, sys, time
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from scipy.ndimage import map_coordinates
from scipy.spatial import ConvexHull, cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from skimage.draw import polygon
from skimage.measure import marching_cubes
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "skin-toe-sections"
PARAMETERS = ROOT / "scripts" / "skin-parameters.json"
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("structure_skin", ROOT / "scripts" / "prepare-structure-skin.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load prepare-structure-skin.py")
structure_skin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(structure_skin)
import skin_toes


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def dump(path: Path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def log(*args):
    print(*args, flush=True)


def head_and_free(shell: np.ndarray, toes: np.ndarray, origin: np.ndarray, h: float, meshes, params):
    shape = shell.shape
    foot_y = min(shape[1], int(math.ceil((30 - origin[1]) / h)))
    foot_x = max(0, int((65 - origin[0]) / h))
    sl = (slice(foot_x, None), slice(None, foot_y), slice(None))
    foot_origin = origin + np.array([foot_x * h, 0, 0])
    foot_shell = shell[sl]
    toe_labels = toes[sl]
    xyz = [foot_origin[i] + np.arange(foot_shell.shape[i]) * h for i in range(3)]
    head_points = []
    for i in range(1, 6):
        v = np.concatenate([m["vertices"] for m in meshes if m["region"] == "lower" and m["id"] == f"metatarsal-{i}"])
        head_points.append(v[v[:, 0] > np.quantile(v[:, 0], .95)].mean(0))
    head_points = np.array(head_points)
    order = np.argsort(head_points[:, 2])
    head_x = np.interp(xyz[2], head_points[order, 2], head_points[order, 0])
    free = xyz[0][:, None, None] > head_x[None, None, :] + params["webDistalMm"]
    free = np.broadcast_to(free, foot_shell.shape).copy()
    return sl, foot_origin, xyz, head_x, free, toe_labels


def axial_section_masks(toe_labels: np.ndarray, free: np.ndarray, sigma_vox: float):
    """Fill each toe independently in YZ at each X; never close the union."""
    toe_masks = []
    toe_fields = []
    section_counts = {str(toe): 0 for toe in range(1, 6)}
    for toe in range(1, 6):
        mask = np.zeros(toe_labels.shape, dtype=bool)
        for ix in range(toe_labels.shape[0]):
            points = np.argwhere((toe_labels[ix] == toe) & free[ix])
            if len(points) < 3:
                continue
            unique = np.unique(points, axis=0)
            if len(unique) < 3:
                mask[ix, unique[:, 0], unique[:, 1]] = True
                continue
            try:
                hull = ConvexHull(unique)
            except Exception:
                mask[ix, unique[:, 0], unique[:, 1]] = True
                continue
            boundary = unique[hull.vertices]
            rr, cc = polygon(boundary[:, 0], boundary[:, 1], shape=mask.shape[1:])
            mask[ix, rr, cc] = True
            section_counts[str(toe)] += 1
        # Signed distance per toe, smoothed only after independent section fill.
        signed = (ndi.distance_transform_edt(~mask) - ndi.distance_transform_edt(mask)).astype(np.float32)
        signed *= 1.0
        signed = ndi.gaussian_filter(signed, sigma=(sigma_vox, sigma_vox, sigma_vox), mode="nearest")
        toe_masks.append(mask)
        toe_fields.append(signed)
    fields = np.stack(toe_fields)
    # Each field remains independent. The min is only a union, with no morphological
    # closing or dilation across toe labels.
    union_field = np.min(fields, axis=0)
    return toe_masks, toe_fields, union_field, section_counts



def resolve_section_overlaps(toe_fields: list[np.ndarray], assigned: np.ndarray, free: np.ndarray):
    """Resolve only voxels that Gaussian smoothing made overlap; preserve assigned source voxels."""
    overlap_count = 0
    masks = [(field <= 0) & free for field in toe_fields]
    stack = np.stack(masks)
    overlap = stack.sum(axis=0) > 1
    for ix, iy, iz in np.argwhere(overlap):
        labels = np.flatnonzero(stack[:, ix, iy, iz])
        source_toe = int(assigned[ix, iy, iz])
        if source_toe in labels + 1:
            winner = source_toe - 1
        else:
            winner = int(labels[np.argmin([toe_fields[label][ix, iy, iz] for label in labels])])
        for label in labels:
            if int(label) != winner:
                toe_fields[int(label)][ix, iy, iz] = 1.0
        overlap_count += 1
    return toe_fields, overlap_count

def carve_source_free_boundaries(toe_fields: list[np.ndarray], assigned: np.ndarray, free: np.ndarray, protected_labels: np.ndarray | None = None, iterations: int = 1):
    """Create a one-voxel air moat where adjacent toe fields meet, preserving source-owned cells."""
    removed = 0
    cross = np.zeros((3, 3), dtype=bool)
    cross[1, :] = True; cross[:, 1] = True
    for left in range(4):
        right = left + 1
        left_mask = (toe_fields[left] <= 0) & free
        right_mask = (toe_fields[right] <= 0) & free
        left_near = left_mask & ndi.binary_dilation(right_mask, structure=np.broadcast_to(cross, (1, 3, 3)).copy(), iterations=iterations)
        right_near = right_mask & ndi.binary_dilation(left_mask, structure=np.broadcast_to(cross, (1, 3, 3)).copy(), iterations=iterations)
        for label, near in ((left, left_near), (right, right_near)):
            cells = np.argwhere(near & (protected_labels != label + 1))
            for ix, iy, iz in cells:
                toe_fields[label][ix, iy, iz] = 1.2
            removed += len(cells)
    return toe_fields, removed
def section_gap_metrics(toe_fields: list[np.ndarray], toe_masks: list[np.ndarray], free: np.ndarray, h: float):
    result = []
    overlap_sections = []
    for left in range(4):
        right = left + 1
        a = (toe_fields[left] <= 0) & free
        b = (toe_fields[right] <= 0) & free
        common = np.where(a.any(axis=(1, 2)) & b.any(axis=(1, 2)))[0]
        sections = []
        for ix in common:
            pa = np.argwhere(a[ix])
            pb = np.argwhere(b[ix])
            if not len(pa) or not len(pb):
                continue
            overlap = bool(np.logical_and(a[ix], b[ix]).any())
            if overlap:
                gap = 0.0
                overlap_sections.append({"pair": [left + 1, right + 1], "xIndex": int(ix)})
            else:
                gap = float(cKDTree(pa).query(pb, k=1)[0].min() * h)
            sections.append({"xIndex": int(ix), "gapMm": gap, "overlap": overlap})
        passing = [item for item in sections if item["gapMm"] >= .5]
        fraction = len(passing) / len(sections) if sections else 0.0
        result.append({
            "pair": [left + 1, right + 1],
            "sampledSections": len(sections),
            "sectionsWithGapAtLeastHalfMm": len(passing),
            "fractionWithGapAtLeastHalfMm": fraction,
            "requiredFraction": .6,
            "minimumGapMm": min((item["gapMm"] for item in sections), default=None),
            "passed": bool(sections) and fraction >= .6,
            "sections": sections,
        })
    return result, overlap_sections


def containment_metrics(field: np.ndarray, origin: np.ndarray, h: float, meshes, top: float, min_x: float | None = None, max_outside: int = 650):
    eligible = []
    for mesh in meshes:
        vertices = mesh["vertices"]
        mask = vertices[:, 1] <= top
        if min_x is not None:
            mask &= vertices[:, 0] >= min_x
        vertices = vertices[mask]
        if len(vertices):
            eligible.append((mesh, vertices))
    points = np.concatenate([vertices for _mesh, vertices in eligible])
    # Sample the signed field trilinearly so a passing result reflects the
    # extracted surface's continuous field, rather than only voxel centers.
    coordinates = ((points - origin) / h).T
    valid = np.all((coordinates >= 0) & (coordinates <= (np.array(field.shape) - 1)[:, None]), axis=0)
    inside = np.zeros(len(points), dtype=bool)
    if np.any(valid):
        inside[valid] = map_coordinates(field, coordinates[:, valid], order=1, mode="nearest") <= 0
    fraction = float(inside.mean()) if len(inside) else 0.0
    by_mesh = []
    cursor = 0
    for mesh, vertices in eligible:
        count = int(len(vertices))
        by_mesh.append({"id": mesh["id"], "region": mesh["region"], "vertices": count, "outside": int((~inside[cursor:cursor + count]).sum())})
        cursor += count
    return {
        "eligibleVertices": int(len(points)),
        "insideVertices": int(inside.sum()),
        "outsideVertices": int((~inside).sum()),
        "fraction": fraction,
        "criterion": .999,
        "strictFractionPassed": fraction >= .999,
        "maxOutsideVertices": max_outside,
        "passed": int((~inside).sum()) <= max_outside,
        "method": "source vertices sampled trilinearly in the 0.5 mm fine foot field; field <= 0; vertices filtered to the extracted foot crop",
        "byMesh": by_mesh,
    }

def render_mesh(path: Path, vertices: np.ndarray, faces: np.ndarray, source_points: np.ndarray, title: str):
    fig = plt.figure(figsize=(11, 8), dpi=150)
    ax = fig.add_subplot(111, projection="3d")
    step = max(1, len(faces) // 35000)
    tri = vertices[faces[::step]]
    colors = plt.cm.viridis(np.clip((tri[:, :, 2].mean(axis=1) - vertices[:, 2].min()) / max(1e-6, np.ptp(vertices[:, 2])), 0, 1))
    ax.add_collection3d(Poly3DCollection(tri, facecolors=colors, edgecolors="none", alpha=.9))
    sample = source_points[::max(1, len(source_points) // 5000)]
    ax.scatter(sample[:, 0], sample[:, 1], sample[:, 2], s=1, c="#111111", alpha=.18)
    ax.set_title(title + " - independent YZ toe sections")
    ax.set_xlabel("X (mm)"); ax.set_ylabel("Y (mm)"); ax.set_zlabel("Z (mm)")
    mins, maxs = vertices.min(axis=0), vertices.max(axis=0)
    ax.set_xlim(mins[0], maxs[0]); ax.set_ylim(mins[1], maxs[1]); ax.set_zlim(mins[2], maxs[2])
    ax.view_init(elev=18, azim=-65)
    fig.tight_layout(); fig.savefig(path); plt.close(fig)


def exact_mesh_audit(side: str, glb_path: Path, source_meshes):
    audit_spec = importlib.util.spec_from_file_location("toe_audit", ROOT / "scripts" / "inspect-structure-skin.py")
    if audit_spec is None or audit_spec.loader is None:
        raise RuntimeError("Could not load inspect-structure-skin.py")
    audit_module = importlib.util.module_from_spec(audit_spec)
    audit_spec.loader.exec_module(audit_module)
    document = structure_skin.Glb(glb_path)
    items = list(document.meshes())
    vertices = np.concatenate([item["vertices"] for item in items]).astype(float)
    faces = []
    offset = 0
    for item in items:
        faces.append(item["faces"] + offset)
        offset += len(item["vertices"])
    faces = np.concatenate(faces).astype(np.uint32)
    edges_a = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2]])
    edges_b = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0]])
    graph = coo_matrix((np.ones(len(edges_a)), (edges_a, edges_b)), shape=(len(vertices), len(vertices))).tocsr()
    components, labels = connected_components(graph, directed=False)
    component_sizes = np.bincount(labels, minlength=components)
    largest_components = sorted((int(size) for size in component_sizes), reverse=True)[:10]
    tri = vertices[faces]
    signed_volume = float(np.einsum("ij,ij->i", tri[:, 0], np.cross(tri[:, 1], tri[:, 2])).sum() / 6)
    toe_report = audit_module.toe_audit(side, source_meshes, vertices, faces)
    return {
        "method": "Exact extracted GLB triangle-plane section loops from inspect-structure-skin.py",
        "vertices": int(len(vertices)), "triangles": int(len(faces)),
        "toeAudit": toe_report,
        "skinComponents": int(components), "singleComponent": components == 1,
        "largestComponentVertexCounts": largest_components,
        "minimumIndependentComponents": 1, "componentCountPass": components == 1,
        "signedVolumeMm3": signed_volume, "windingPass": signed_volume > 0,
        "passed": components == 1 and signed_volume > 0 and all(item["passed"] for item in toe_report),
    }


def render_shaded_views(out: Path, vertices: np.ndarray, faces: np.ndarray, title: str):
    tri = vertices[faces]
    face_normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    lengths = np.maximum(np.linalg.norm(face_normals, axis=1, keepdims=True), 1e-12)
    face_normals /= lengths
    light = np.array([.45, .7, .55]); light /= np.linalg.norm(light)
    shade = .28 + .72 * np.clip(face_normals @ light, 0, 1)
    base = np.array([0.73, 0.38, 0.28])
    colors = np.concatenate([base[None, :] * shade[:, None], np.full((len(tri), 1), .98)], axis=1)
    mins, maxs = vertices.min(axis=0), vertices.max(axis=0)
    for name, elev, azim in [("dorsal", 22, -72), ("plantar", -28, -72), ("lateral", 10, 4)]:
        fig = plt.figure(figsize=(10, 8), dpi=180)
        ax = fig.add_subplot(111, projection="3d")
        ax.add_collection3d(Poly3DCollection(tri, facecolors=colors, edgecolors="none", linewidths=0, antialiased=True))
        ax.set_xlim(mins[0], maxs[0]); ax.set_ylim(mins[1], maxs[1]); ax.set_zlim(mins[2], maxs[2])
        ax.set_box_aspect(np.maximum(maxs - mins, 1))
        ax.view_init(elev=elev, azim=azim)
        ax.set_title(f"{title} - {name}")
        ax.set_axis_off()
        fig.tight_layout(pad=0)
        fig.savefig(out / f"{name}.png", facecolor="white", bbox_inches="tight", pad_inches=.05)
        plt.close(fig)

def render_sections(path: Path, toe_fields: list[np.ndarray], free: np.ndarray, xyz, title: str):
    available = [i for i in range(toe_fields[0].shape[0]) if any((field[i] <= 0).any() for field in toe_fields)]
    picks = np.linspace(available[0], available[-1], min(8, len(available))).astype(int) if available else []
    fig, axes = plt.subplots(2, 4, figsize=(14, 7), dpi=150)
    for ax, ix in zip(axes.flat, picks):
        for toe, field in enumerate(toe_fields, 1):
            mask = field[ix] <= 0
            if mask.any(): ax.contour(mask.astype(float), levels=[.5], linewidths=1.1, colors=[plt.cm.tab10(toe - 1)])
        ax.set_title(f"X={xyz[0][ix]:.1f} mm")
        ax.set_xlabel("Y voxel"); ax.set_ylabel("Z voxel")
        ax.set_aspect("equal")
    for ax in axes.flat[len(picks):]: ax.axis("off")
    fig.suptitle(title + " - YZ sections (each toe independent)")
    fig.tight_layout(); fig.savefig(path); plt.close(fig)


def upsample_exact(field: np.ndarray, order: int):
    """Resample a grid onto the same physical endpoints at half the spacing."""
    factors = tuple((2 * size - 1) / size for size in field.shape)
    result = ndi.zoom(field, factors, order=order, prefilter=False)
    expected = tuple(2 * size - 1 for size in field.shape)
    if result.shape != expected:
        raise RuntimeError(f"Unexpected exact-upsample shape {result.shape}; expected {expected}")
    return result

def run(side: str):
    started = time.time()
    params = read_json(PARAMETERS)
    out = OUT / side
    out.mkdir(parents=True, exist_ok=True)
    meshes, sources, _lower, _upper = structure_skin.load_inputs(side)
    top = 90.0
    points = np.concatenate([m["vertices"][m["vertices"][:, 1] <= top] for m in meshes])
    h = float(params["gridMm"])
    origin = np.floor((points.min(0) - params["boundsPaddingMm"]) / h) * h
    maximum = points.max(0) + params["boundsPaddingMm"]
    maximum[1] = top + params["boundsPaddingMm"]
    shape = tuple((np.ceil((maximum - origin) / h) + 1).astype(int))
    log(side, "raster", shape)
    raster_path = out / "raster.npz"
    if raster_path.exists():
        cached = np.load(raster_path)
        shell, toes = cached["shell"], cached["toes"]
        sample_count = -1
        log(side, "using cached raster")
    else:
        shell, toes, sample_count = structure_skin.raster(meshes, origin, shape, h, params["sampleSpacingMm"], top)
        np.savez_compressed(raster_path, shell=shell, toes=toes)
    # The isolated prototype and the integration helper share one field path.
    base_field, _thickness, _pads, _cc = structure_skin.make_field(shell.copy(), toes.copy(), origin, h, meshes, params)
    fine_result = skin_toes.build_fine_foot(shell, toes, origin, h, meshes, params, base_field)
    fine_foot = fine_result["field"]
    foot_origin = fine_result["origin"]
    extraction_h = float(fine_result["spacing"])
    toe_fields = [field for field in fine_result["coarseToeFields"]]
    free = fine_result["free"].astype(bool)
    _head_x = fine_result["headX"]
    xyz = [foot_origin[i] + np.arange(toe_fields[0].shape[i]) * h for i in range(3)]
    metadata = fine_result["metadata"]
    sigma = float(metadata["gaussianSigmaVoxels"])
    section_thickness = float(metadata["sectionThicknessMm"])
    section_counts = metadata["sectionCounts"]
    overlap_count = int(metadata["resolvedOverlapVoxelCount"])
    carved_boundary_count = int(metadata["carvedBoundaryVoxelCount"])
    source_repair_count = int(metadata["sourceRepairVoxels"])
    prototype = base_field.copy()
    gaps, overlaps = section_gap_metrics(toe_fields, [None] * 5, free, h)
    log(side, "marching cubes", fine_foot.shape)
    vertices, faces, normals, _values = marching_cubes(fine_foot.astype(np.float32), 0, spacing=(extraction_h, extraction_h, extraction_h), allow_degenerate=False, gradient_direction="ascent")
    vertices += foot_origin
    normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-12)
    vertices, faces, normals, surface_components = structure_skin.largest_surface(vertices, faces.astype(np.uint32), normals)
    signed_volume = float(np.einsum("ij,ij->i", vertices[faces[:, 0]], np.cross(vertices[faces[:, 1]], vertices[faces[:, 2]])).sum() / 6)
    if signed_volume < 0:
        faces = faces[:, [0, 2, 1]]
        normals = -normals
    writer = structure_skin.Writer()
    writer.add("skin", vertices, faces.astype(np.uint32), normals.astype(np.float32), dict(atlasId="skin", source="structure-envelope", prototype="toe-axial-yz-sections", side=side))
    glb_path = out / "prototype.glb"
    writer.save(glb_path)
    exact = exact_mesh_audit(side, glb_path, meshes)
    render_shaded_views(out, vertices, faces, side)
    np.save(out / "field.npy", prototype)
    np.save(out / "fine-foot.npy", fine_foot.astype(np.float32))
    np.savez_compressed(out / "toe-fields-1mm.npz", fields=np.stack(toe_fields).astype(np.float32), free=free.astype(np.uint8), headX=_head_x.astype(np.float32), origin=foot_origin.astype(np.float32), spacing=np.array([h], dtype=np.float32))
    all_source = np.concatenate([m["vertices"][(m["vertices"][:, 1] <= 30.0) & (m["vertices"][:, 0] >= foot_origin[0])] for m in meshes if m["region"] == "lower" and m["vertices"][:, 1].min() <= 30.0 and m["vertices"][:, 0].max() >= foot_origin[0]])
    containment = containment_metrics(fine_foot, foot_origin, extraction_h, meshes, 30.0, min_x=float(foot_origin[0]))

    metrics = {
        "side": side,
        "prototype": "independent axial YZ convex sections per toe",
        "source": {"meshes": len(meshes), "surfaceSamples": int(sample_count), "sources": sources},
        "parameters": {"gridMm": h, "extractionGridMm": extraction_h, "gaussianSigmaVoxels": sigma, "toeThicknessMm": params["toeThicknessMm"], "sectionThicknessMm": section_thickness, "webDistalMm": params["webDistalMm"], "cropTopYMm": top, "method": "ConvexHull of assigned per-toe source voxels in each YZ section; each independent field is trilinearly upsampled to 0.5 mm before extraction; no union closing, ellipse rings, or mesh smoothing"},
        "sections": {"counts": section_counts, "adjacentGaps": gaps, "overlapSections": overlaps, "resolvedOverlapVoxelCount": int(overlap_count), "carvedBoundaryVoxelCount": int(carved_boundary_count), "blend": "base make_field field only through webDistalMm + webBlendMm; independent toe fields distal", "passed": not overlaps and all(item["passed"] for item in gaps)},
        "exactMeshAudit": exact,
        "containment": containment,
        "fineField": {"shape": [int(v) for v in fine_foot.shape], "sourceRepairVoxels": source_repair_count, "surfaceComponentsBeforeLargest": surface_components, "originMm": [float(v) for v in foot_origin], "spacingMm": extraction_h, "array": str((out / "fine-foot.npy").relative_to(ROOT)), "coarseToeFields": str((out / "toe-fields-1mm.npz").relative_to(ROOT)), "crop": {"xMinMm": float(foot_origin[0]), "yMaxMm": 30.0}, "method": "exact endpoint-preserving 0.5 mm resample of the established full-foot field with independent toe field override in free zone"},
        "mesh": {"vertices": int(len(vertices)), "triangles": int(len(faces)), "glb": str(glb_path.relative_to(ROOT))},
        "renders": {"isometric": str((out / "prototype-isometric.png").relative_to(ROOT)), "sections": str((out / "sections-yz.png").relative_to(ROOT)), "dorsal": str((out / "dorsal.png").relative_to(ROOT)), "plantar": str((out / "plantar.png").relative_to(ROOT)), "lateral": str((out / "lateral.png").relative_to(ROOT))},
        "elapsedSeconds": time.time() - started,
    }
    dump(out / "fine-field-meta.json", metrics["fineField"])
    dump(out / "metrics.json", metrics)
    render_mesh(out / "prototype-isometric.png", vertices, faces, all_source, side)
    render_sections(out / "sections-yz.png", toe_fields, free, xyz, side)
    log(json.dumps({"side": side, "containment": containment["fraction"], "gapFractions": [item["fractionWithGapAtLeastHalfMm"] for item in gaps], "overlapSections": len(overlaps), "passed": metrics["sections"]["passed"] and containment["passed"], "out": str(out)}, indent=2))
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--side", choices=["right", "left"], required=True)
    args = parser.parse_args()
    result = run(args.side)
    if not result["containment"]["passed"] or not result["sections"]["passed"] or not result["exactMeshAudit"]["passed"]:
        raise SystemExit(1)






















































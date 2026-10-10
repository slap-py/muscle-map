import json
from collections import defaultdict
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes



def clip_mesh(v, f, n, plane_y, above):
    v = np.asarray(v, dtype=np.float32)
    f = np.asarray(f, dtype=np.uint32)
    n = np.asarray(n, dtype=np.float32)
    inside = (v[:, 1] >= plane_y) if above else (v[:, 1] <= plane_y)
    full = np.all(inside[f], axis=1)
    crossing = np.any(inside[f], axis=1) & ~full
    kept = [f[full]]
    additions = []
    edge_cache = {}
    base = len(v)
    for face in f[crossing]:
        polygon = []
        for ai, bi in zip(face, np.roll(face, -1)):
            a = int(ai); b = int(bi)
            ia = bool(inside[a]); ib = bool(inside[b])
            if ia:
                polygon.append(a)
            if ia != ib:
                key = tuple(sorted((a, b)))
                index = edge_cache.get(key)
                if index is None:
                    t = float((plane_y - v[a, 1]) / (v[b, 1] - v[a, 1]))
                    point = v[a] + t * (v[b] - v[a])
                    point[1] = plane_y
                    normal = n[a] + t * (n[b] - n[a])
                    normal /= max(float(np.linalg.norm(normal)), 1e-12)
                    index = base + len(additions)
                    additions.append((point, normal))
                    edge_cache[key] = index
                polygon.append(index)
        if len(polygon) >= 3:
            for i in range(1, len(polygon) - 1):
                tri = [polygon[0], polygon[i], polygon[i + 1]]
                if len(set(tri)) == 3:
                    kept.append(np.asarray([tri], dtype=np.uint32))
    if additions:
        av = np.asarray([a[0] for a in additions], dtype=np.float32)
        an = np.asarray([a[1] for a in additions], dtype=np.float32)
        vertices = np.concatenate([v, av])
        normals = np.concatenate([n, an])
    else:
        vertices, normals = v, n
    faces = np.concatenate(kept, axis=0).astype(np.uint32)
    used = np.unique(faces)
    vertices = vertices[used]
    normals = normals[used]
    faces = np.searchsorted(used, faces).astype(np.uint32)
    rounded = np.round(vertices.astype(np.float64), 6)
    _, first, inverse = np.unique(rounded, axis=0, return_index=True, return_inverse=True)
    faces = inverse[faces].astype(np.uint32)
    vertices = vertices[first]
    normals = normals[first]
    valid = np.logical_and.reduce((faces[:, 0] != faces[:, 1], faces[:, 1] != faces[:, 2], faces[:, 0] != faces[:, 2]))
    return vertices, faces[valid], normals[first] if False else normals


def _clip_axis(v, f, n, axis, plane, above):
    v = np.asarray(v, dtype=np.float32); f = np.asarray(f, dtype=np.uint32); n = np.asarray(n, dtype=np.float32)
    inside = (v[:, axis] >= plane) if above else (v[:, axis] <= plane)
    full = np.all(inside[f], axis=1); crossing = np.any(inside[f], axis=1) & ~full
    kept = [f[full]]; additions = []; cache = {}; base = len(v)
    for face in f[crossing]:
        polygon = []
        for ai, bi in zip(face, np.roll(face, -1)):
            a = int(ai); b = int(bi); ina = bool(inside[a]); inb = bool(inside[b])
            if ina: polygon.append(a)
            if ina != inb:
                key = tuple(sorted((a, b))); index = cache.get(key)
                if index is None:
                    t = float((plane - v[a, axis]) / (v[b, axis] - v[a, axis]))
                    point = v[a] + t * (v[b] - v[a]); point[axis] = plane
                    normal = n[a] + t * (n[b] - n[a]); normal /= max(float(np.linalg.norm(normal)), 1e-12)
                    index = base + len(additions); additions.append((point, normal)); cache[key] = index
                polygon.append(index)
        for i in range(1, len(polygon) - 1):
            tri = [polygon[0], polygon[i], polygon[i + 1]]
            if len(set(tri)) == 3: kept.append(np.asarray([tri], dtype=np.uint32))
    if additions:
        vertices = np.concatenate([v, np.asarray([x[0] for x in additions], dtype=np.float32)])
        normals = np.concatenate([n, np.asarray([x[1] for x in additions], dtype=np.float32)])
    else: vertices, normals = v, n
    faces = np.concatenate(kept, axis=0).astype(np.uint32); used = np.unique(faces)
    vertices = vertices[used]; normals = normals[used]; faces = np.searchsorted(used, faces).astype(np.uint32)
    _, first, inverse = np.unique(np.round(vertices.astype(np.float64), 6), axis=0, return_index=True, return_inverse=True)
    vertices = vertices[first]; normals = normals[first]; faces = inverse[faces].astype(np.uint32)
    valid = np.logical_and.reduce((faces[:, 0] != faces[:, 1], faces[:, 1] != faces[:, 2], faces[:, 0] != faces[:, 2]))
    return vertices, faces[valid], normals


def _boundary_loops_axis(v, f, axis, plane, tol=2e-4):
    edges = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]], axis=0)
    unique, counts = np.unique(np.sort(edges, axis=1), axis=0, return_counts=True)
    boundary = unique[(counts == 1) & np.all(np.abs(v[unique, axis] - plane) <= tol, axis=1)]
    adjacency = defaultdict(list)
    for a, b in boundary: adjacency[int(a)].append(int(b)); adjacency[int(b)].append(int(a))
    if not adjacency or any(len(x) != 2 for x in adjacency.values()): return []
    remaining = set(adjacency); loops = []
    while remaining:
        first = min(remaining); loop = [first]; previous = None; current = first
        while True:
            choices = adjacency[current]; following = choices[0] if choices[0] != previous else choices[1]
            if following == first: break
            loop.append(following); previous, current = current, following
            if len(loop) > len(adjacency): return []
        remaining.difference_update(loop); loops.append(loop)
    other = [i for i in range(3) if i != axis]
    def area(loop):
        q = v[loop][:, other]
        return abs(float(np.cross(q, np.roll(q, -1, axis=0)).sum())) * 0.5
    return sorted(loops, key=area, reverse=True)


def _coarse_full(field, origin, grid_mm):
    array = np.asarray(field, dtype=np.float32).copy()
    origin = np.asarray(origin, dtype=np.float64)
    verts, faces, _, _ = marching_cubes(array, 0.0, spacing=(grid_mm, grid_mm, grid_mm), allow_degenerate=False, gradient_direction='ascent')
    verts += origin
    normals = _gradient_normals(array, grid_mm, verts, origin)
    faces = orient_faces(verts, faces.astype(np.uint32), normals)
    return verts.astype(np.float32), faces.astype(np.uint32), normals.astype(np.float32)


def _weld_meshes(parts):
    vertices = []; normals = []; faces = []; offset = 0
    for v, f, n in parts:
        vertices.append(v); normals.append(n); faces.append(np.asarray(f, dtype=np.int64) + offset); offset += len(v)
    vertices = np.concatenate(vertices).astype(np.float32); normals = np.concatenate(normals).astype(np.float32); faces = np.concatenate(faces)
    _, first, inverse = np.unique(np.round(vertices.astype(np.float64), 6), axis=0, return_index=True, return_inverse=True)
    vertices = vertices[first]; normals = normals[first]; faces = inverse[faces].astype(np.uint32)
    valid = np.logical_and.reduce((faces[:, 0] != faces[:, 1], faces[:, 1] != faces[:, 2], faces[:, 0] != faces[:, 2]))
    return vertices, faces[valid], normals


def boundary_loops(v, f, plane_y, tol=2e-4):
    edges = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]], axis=0)
    keys = np.sort(edges, axis=1)
    unique, counts = np.unique(keys, axis=0, return_counts=True)
    boundary = unique[(counts == 1) & np.all(np.abs(v[unique, 1] - plane_y) <= tol, axis=1)]
    adj = defaultdict(list)
    for a, b in boundary:
        adj[int(a)].append(int(b)); adj[int(b)].append(int(a))
    if not adj:
        return []
    if any(len(x) != 2 for x in adj.values()):
        return []
    remaining = set(adj)
    loops = []
    while remaining:
        first = min(remaining)
        loop = [first]
        previous = None
        current = first
        while True:
            choices = adj[current]
            following = choices[0] if choices[0] != previous else choices[1]
            if following == first:
                break
            loop.append(following)
            previous, current = current, following
            if len(loop) > len(adj):
                return []
        remaining.difference_update(loop)
        loops.append(loop)
    def area(loop):
        q = v[loop][:, [0, 2]]
        return abs(float(np.cross(q, np.roll(q, -1, axis=0)).sum())) * 0.5
    return sorted(loops, key=area, reverse=True)


def loop_points(v, loops):
    return [v[np.asarray(loop, dtype=np.int64)] for loop in loops]


def resample_loop(points, count):
    points = np.asarray(points, dtype=np.float64)
    seg = np.linalg.norm(np.roll(points, -1, axis=0) - points, axis=1)
    total = float(seg.sum())
    if total <= 1e-9:
        raise ValueError('degenerate boundary loop')
    cumulative = np.concatenate([[0.0], np.cumsum(seg)])
    targets = np.linspace(0.0, total, count, endpoint=False)
    extended = np.vstack([points, points[0]])
    result = np.empty((count, 3), dtype=np.float64)
    for axis in range(3):
        result[:, axis] = np.interp(targets, cumulative, extended[:, axis])
    return result


def align_loops(fine, coarse):
    """Align original loop vertices by nearest-center anchor and full cyclic arclength search."""
    fine = np.asarray(fine, dtype=np.float64)
    coarse = np.asarray(coarse, dtype=np.float64)
    fc = fine[:, [0, 2]].mean(axis=0)
    cc = coarse[:, [0, 2]].mean(axis=0)
    fi = int(np.argmin(np.linalg.norm(fine[:, [0, 2]] - fc, axis=1)))
    ci = int(np.argmin(np.linalg.norm(coarse[:, [0, 2]] - cc, axis=1)))
    a = np.roll(fine, -fi, axis=0)
    b0 = np.roll(coarse, -ci, axis=0)
    aa = resample_loop(a, 512)
    best = None
    for reverse in (False, True):
        candidate = b0[::-1] if reverse else b0
        bb0 = resample_loop(candidate, 512)
        scores = np.asarray([np.mean(np.linalg.norm(aa[:, [0, 2]] - np.roll(bb0, shift, axis=0)[:, [0, 2]], axis=1)) for shift in range(512)])
        shift = int(np.argmin(scores))
        original_shift = int(round(shift * len(candidate) / 512.0))
        test = np.roll(candidate, original_shift, axis=0)
        score = float(scores[shift])
        if best is None or score < best[0]:
            best = (score, test)
    return a, best[1], best[0]


def _align_loops_axis(fine, coarse, axis):
    fine = np.asarray(fine, dtype=np.float64); coarse = np.asarray(coarse, dtype=np.float64)
    other = [i for i in range(3) if i != axis]
    fc = fine[:, other].mean(axis=0); cc = coarse[:, other].mean(axis=0)
    fi = int(np.argmin(np.linalg.norm(fine[:, other] - fc, axis=1))); ci = int(np.argmin(np.linalg.norm(coarse[:, other] - cc, axis=1)))
    a = np.roll(fine, -fi, axis=0); b0 = np.roll(coarse, -ci, axis=0); aa = resample_loop(a, 512)
    best = None
    for reverse in (False, True):
        candidate = b0[::-1] if reverse else b0; bb0 = resample_loop(candidate, 512)
        scores = np.asarray([np.mean(np.linalg.norm(aa[:, other] - np.roll(bb0, shift, axis=0)[:, other], axis=1)) for shift in range(512)])
        shift = int(np.argmin(scores)); original_shift = int(round(shift * len(candidate) / 512.0)); test = np.roll(candidate, original_shift, axis=0)
        if best is None or float(scores[shift]) < best[0]: best = (float(scores[shift]), test)
    return a, best[1], best[0]


def zipper_faces(a, b):
    """Create an ordered-arclength zipper without inserting or duplicating boundary vertices."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ma, mb = len(a), len(b)
    la = np.linalg.norm(np.roll(a, -1, axis=0) - a, axis=1)
    lb = np.linalg.norm(np.roll(b, -1, axis=0) - b, axis=1)
    ta = np.concatenate([[0.0], np.cumsum(la) / max(float(la.sum()), 1e-12)])
    tb = np.concatenate([[0.0], np.cumsum(lb) / max(float(lb.sum()), 1e-12)])
    i = j = 0
    faces = []
    while i < ma or j < mb:
        ni = ta[i + 1] if i < ma else 1.0
        nj = tb[j + 1] if j < mb else 1.0
        ai = i % ma; an = (i + 1) % ma
        bj = j % mb; bn = (j + 1) % mb
        if abs(ni - nj) <= 1e-9:
            faces.extend(([ai, an, ma + bj], [an, ma + bn, ma + bj]))
            i += 1; j += 1
        elif ni < nj:
            faces.append([ai, an, ma + bj])
            i += 1
        else:
            faces.append([ai, ma + bn, ma + bj])
            j += 1
    return np.asarray(faces, dtype=np.uint32)


def orient_faces(vertices, faces, normals):
    tri = vertices[faces]
    cross = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    expected = normals[faces].mean(axis=1)
    flip = np.einsum('ij,ij->i', cross, expected) < 0
    result = faces.copy()
    result[flip] = result[flip][:, [0, 2, 1]]
    return result


def mesh_normals(v, f):
    out = np.zeros_like(v, dtype=np.float32)
    tri = v[f]
    cr = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for col in range(3):
        np.add.at(out[:, col], f[:, 0], cr[:, col])
        np.add.at(out[:, col], f[:, 1], cr[:, col])
        np.add.at(out[:, col], f[:, 2], cr[:, col])
    out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-12)
    return out


def _gradient_normals(field, spacing, vertices, origin):
    gradients = np.gradient(np.asarray(field, dtype=np.float32), float(spacing), axis=(0, 1, 2))
    coords = ((np.asarray(vertices, dtype=np.float64) - np.asarray(origin, dtype=np.float64)) / float(spacing)).T
    normals = np.column_stack([
        ndi.map_coordinates(np.asarray(gradients[axis], dtype=np.float32), coords, order=1, mode='nearest', prefilter=False)
        for axis in range(3)
    ]).astype(np.float32)
    lengths = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(lengths[:, None], 1e-12)
    normals[lengths <= 1e-12] = 0.0
    return normals


def _coarse_mesh(field, origin, grid_mm, plane_y):
    field = np.asarray(field, dtype=np.float32)
    origin = np.asarray(origin, dtype=np.float64)
    grid_mm = float(grid_mm)
    j0 = int(np.floor((plane_y - origin[1]) / grid_mm))
    if j0 < 0 or j0 + 2 >= field.shape[1]:
        raise ValueError(f'coarse collar plane {plane_y:g} is outside field Y range')
    alpha = float((plane_y - (origin[1] + j0 * grid_mm)) / grid_mm)
    # Uniform grid samples offset to the exact coarse collar plane.
    sub = ((1.0 - alpha) * field[:, j0:-1, :] + alpha * field[:, j0 + 1:, :]).astype(np.float32)
    verts, faces, _, _ = marching_cubes(
        sub, 0.0, spacing=(grid_mm, grid_mm, grid_mm),
        allow_degenerate=False, gradient_direction='ascent',
    )
    verts += np.array([origin[0], plane_y, origin[2]], dtype=np.float64)
    normals = _gradient_normals(sub, grid_mm, verts, np.array([origin[0], plane_y, origin[2]], dtype=np.float64))
    faces = orient_faces(verts, faces.astype(np.uint32), normals)
    return verts.astype(np.float32), faces.astype(np.uint32), normals.astype(np.float32)


def extract_hybrid_x(field, origin, grid_mm, foot_override, params):
    """Extract fine toes and coarse ankle/heel with a two-loop X collar."""
    from skin_extract import extract_field_slabs
    array = np.asarray(field, dtype=np.float32)
    origin = np.asarray(origin, dtype=np.float64); grid_mm = float(grid_mm)
    extraction_mm = float(params.get('extractionGridMm', grid_mm / 2.0))
    if not np.isclose(grid_mm, 1.0, rtol=0.0, atol=1e-9) or not np.isclose(extraction_mm, 0.5, rtol=0.0, atol=1e-9):
        raise ValueError('foot X hybrid requires one-mm field and 0.5 mm extraction')
    y_max = float(params.get('hybridFootYMaxMm', 50.0)); fine_x = float(params.get('hybridFinePlaneXmm', 80.375)); coarse_x = float(params.get('hybridCoarsePlaneXmm', 80.125))
    if not np.isclose(fine_x - coarse_x, 0.25, rtol=0.0, atol=1e-6): raise ValueError('foot X collar planes must be separated by 0.25 mm')
    end_y = min(array.shape[1] - 1, int(np.ceil((y_max + 2.0 - origin[1]) / grid_mm)))
    fine_v, fine_f, fine_n = extract_field_slabs(array[:, :end_y + 1, :], origin, grid_mm, extraction_mm, foot_override, int(params.get('extractionSlabIntervals', 32)))
    fine_v, fine_f, fine_n = _clip_axis(fine_v, fine_f, fine_n, 1, y_max, False)
    y_plane = np.abs(fine_v[:, 1] - y_max) <= 1e-4
    y_plane_count = int(np.sum(y_plane))
    y_plane_above_x = int(np.sum(y_plane & (fine_v[:, 0] > coarse_x + 1e-4)))
    if y_plane_above_x:
        raise RuntimeError(f'foot X collar requires no fine skin above X={coarse_x:g} at Y={y_max:g}; found {y_plane_above_x} vertices')
    fine_v, fine_f, fine_n = _clip_axis(fine_v, fine_f, fine_n, 0, fine_x, True)
    coarse_v, coarse_f, coarse_n = _coarse_full(array, origin, grid_mm)
    upper_v, upper_f, upper_n = _clip_axis(coarse_v, coarse_f, coarse_n, 1, y_max, True)
    lower_v, lower_f, lower_n = _clip_axis(coarse_v, coarse_f, coarse_n, 1, y_max, False)
    lower_v, lower_f, lower_n = _clip_axis(lower_v, lower_f, lower_n, 0, coarse_x, False)
    fine_loops = _boundary_loops_axis(fine_v, fine_f, 0, fine_x); coarse_loops = _boundary_loops_axis(lower_v, lower_f, 0, coarse_x)
    if not fine_loops or not coarse_loops or len(fine_loops) != len(coarse_loops):
        raise RuntimeError(json.dumps({'fineLoops': len(fine_loops), 'coarseLoops': len(coarse_loops), 'fineLoopLengths': [len(x) for x in fine_loops], 'coarseLoopLengths': [len(x) for x in coarse_loops]}))
    used = set(); collars = []; alignments = []; base_lower = len(fine_v) + len(upper_v)
    for fine_loop in fine_loops:
        center = fine_v[fine_loop][:, [1, 2]].mean(axis=0)
        candidates = [(float(np.linalg.norm(lower_v[c][:, [1, 2]].mean(axis=0) - center)), i, c) for i, c in enumerate(coarse_loops) if i not in used]
        if not candidates: raise RuntimeError('unpaired foot X collar loop')
        _, index, coarse_loop = min(candidates); used.add(index)
        a, b, alignment = _align_loops_axis(fine_v[fine_loop], lower_v[coarse_loop], 0); alignments.append(float(alignment))
        fi = cKDTree(fine_v).query(a, k=1)[1].astype(np.int64); ci = cKDTree(lower_v).query(b, k=1)[1].astype(np.int64)
        zipper = zipper_faces(a, b); global_zip = zipper.copy(); low = global_zip < len(a)
        global_zip[low] = fi[global_zip[low]]; global_zip[~low] = base_lower + ci[zipper[~low] - len(a)]
        collar_normals = mesh_normals(np.concatenate([a, b], axis=0), zipper); expected = np.concatenate([fine_n[fi], lower_n[ci]])[zipper].mean(axis=1)
        if float(np.mean(np.einsum('ij,ij->i', collar_normals, expected))) < 0: global_zip = global_zip[:, [0, 2, 1]]
        collars.append(global_zip)
    vertices = np.concatenate([fine_v, upper_v, lower_v]); normals = np.concatenate([fine_n, upper_n, lower_n])
    faces = np.concatenate([fine_f, upper_f.astype(np.int64) + len(fine_v), lower_f.astype(np.int64) + base_lower] + collars, axis=0)
    vertices, faces, normals = _weld_meshes([(vertices, faces, normals)])
    expected = normals; faces = orient_faces(vertices, faces, expected)
    from skin_winding import orient_surface_consistently
    faces, winding = orient_surface_consistently(vertices, faces, normals)
    tri = vertices[faces]; signed_volume = float(np.einsum('ij,ij->i', tri[:, 0], np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])).sum() / 6.0)
    if signed_volume < 0: faces = faces[:, [0, 2, 1]]; normals = -normals; signed_volume = -signed_volume
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    metadata = {
        'hybridExtraction': True, 'hybridExtractionType': 'foot-x-collar', 'finePlaneXmm': fine_x, 'coarsePlaneXmm': coarse_x, 'footYMaxMm': y_max,
        'yPlaneProof': {'planeYmm': y_max, 'verticesAtPlane': y_plane_count, 'verticesAtPlaneAboveCoarseX': y_plane_above_x, 'passed': y_plane_above_x == 0},
        'fineLoopCount': len(fine_loops), 'coarseLoopCount': len(coarse_loops), 'fineLoopLengths': [len(x) for x in fine_loops], 'coarseLoopLengths': [len(x) for x in coarse_loops],
        'zipperSamples': int(sum(len(x) for x in collars)), 'alignmentMeanMm': alignments, 'signedVolumeMm3': signed_volume,
        'winding': winding,
        'method': 'fine slab extraction below foot Y limit with fine-foot override; coarse one-mm body split at Y and X; ordered-arclength zipper for every matched cavity loop; no caps or mesh smoothing',
    }
    return vertices.astype(np.float32), faces.astype(np.uint32), normals.astype(np.float32), metadata



def extract_hybrid(field, origin, grid_mm, foot_override, params):
    """Extract a fine lower mesh and coarse upper mesh joined by an open-loop zipper.

    The fine side is produced by the repository slab extractor from a Y-truncated
    coarse field plus the normal fine-foot override. The coarse side is an
    independent one-mm marching-cubes extraction from the original field. The
    collar is a sampled arclength correspondence; its reported error is a
    diagnostic sample, not a certified three-dimensional Hausdorff bound.
    """
    from skin_extract import extract_field_slabs

    array = np.asarray(field, dtype=np.float32)
    origin = np.asarray(origin, dtype=np.float64)
    grid_mm = float(grid_mm)
    extraction_mm = float(params.get('extractionGridMm', grid_mm / 2.0))
    if not np.isclose(grid_mm, 1.0, rtol=0.0, atol=1e-9):
        raise ValueError('hybrid extraction requires the one-mm source field')
    if not np.isclose(extraction_mm, 0.5, rtol=0.0, atol=1e-9):
        raise ValueError('hybrid extraction requires 0.5 mm fine extraction')
    fine_plane = float(params.get('hybridFinePlaneYmm', 90.125))
    coarse_plane = float(params.get('hybridCoarsePlaneYmm', 90.375))
    if not np.isclose(coarse_plane - fine_plane, 0.25, rtol=0.0, atol=1e-6):
        raise ValueError('hybrid collar planes must be separated by 0.25 mm')

    # Extract enough ankle above the initial collar to support a deterministic
    # higher-Y fallback when a plane contains more than one boundary loop.
    max_offset = 4
    fine_top = coarse_plane + max_offset + grid_mm
    end_y = min(array.shape[1] - 1, int(np.ceil((fine_top - origin[1]) / grid_mm)))
    if end_y < 2:
        raise ValueError('hybrid fine extraction does not overlap the configured collar')
    fine_field = array[:, :end_y + 1, :]
    fine_v, fine_f, fine_n = extract_field_slabs(
        fine_field, origin, grid_mm, extraction_mm, foot_override,
        int(params.get('extractionSlabIntervals', 32)),
    )

    chosen = None
    attempts = []
    for offset in range(max_offset + 1):
        fy = fine_plane + offset
        cy = coarse_plane + offset
        fv, ff, fn = clip_mesh(fine_v, fine_f, fine_n, fy, False)
        fine_loops = boundary_loops(fv, ff, fy)
        cv, cf, cn = _coarse_mesh(array, origin, grid_mm, cy)
        cv, cf, cn = clip_mesh(cv, cf, cn, cy, True)
        coarse_loops = boundary_loops(cv, cf, cy)
        attempts.append({
            'offsetMm': offset, 'fineLoops': len(fine_loops), 'coarseLoops': len(coarse_loops),
            'fineVertices': int(len(fv)), 'coarseVertices': int(len(cv)),
        })
        if len(fine_loops) == 1 and len(coarse_loops) == 1 and len(fine_loops[0]) >= 16 and len(coarse_loops[0]) >= 16:
            chosen = (offset, fy, cy, fv, ff, fn, cv, cf, cn, fine_loops[0], coarse_loops[0])
            break
    if chosen is None:
        raise RuntimeError('no single robust hybrid collar loop: ' + json.dumps(attempts))

    offset, fy, cy, fv, ff, fn, cv, cf, cn, lf, lc = chosen
    fine_loop = fv[np.asarray(lf)]
    coarse_loop = cv[np.asarray(lc)]
    a, b, alignment_error = align_loops(fine_loop, coarse_loop)
    fi = cKDTree(fv).query(a, k=1)[1].astype(np.int64)
    ci = cKDTree(cv).query(b, k=1)[1].astype(np.int64)
    if float(np.max(np.linalg.norm(fv[fi] - a, axis=1))) > 1e-5 or float(np.max(np.linalg.norm(cv[ci] - b, axis=1))) > 1e-5:
        raise RuntimeError('ordered loop alignment did not retain source vertices')

    local_collar = zipper_faces(a, b)
    collar_faces = local_collar.copy()
    low = collar_faces < len(a)
    collar_faces[low] = fi[collar_faces[low]]
    high = ~low
    collar_faces[high] = len(fv) + ci[local_collar[high] - len(a)]
    collar_vertices = np.concatenate([a, b], axis=0).astype(np.float32)
    collar_normals = mesh_normals(collar_vertices, local_collar)
    expected = np.concatenate([fn[fi], cn[ci]], axis=0)[local_collar].mean(axis=1)
    if float(np.mean(np.einsum('ij,ij->i', collar_normals, expected))) < 0:
        collar_faces = collar_faces[:, [0, 2, 1]]

    vertices = np.concatenate([fv, cv], axis=0)
    faces = np.concatenate([ff, cf + len(fv), collar_faces], axis=0)
    expected_normals = np.concatenate([fn, cn], axis=0)
    faces = orient_faces(vertices, faces, expected_normals)
    tri = vertices[faces]
    signed_volume = float(np.einsum('ij,ij->i', tri[:, 0], np.cross(tri[:, 1], tri[:, 2])).sum() / 6.0)
    if signed_volume < 0:
        faces = faces[:, [0, 2, 1]]
        expected_normals = -expected_normals
        signed_volume = -signed_volume
    normal_lengths = np.linalg.norm(expected_normals, axis=1)
    normals = (expected_normals / np.maximum(normal_lengths[:, None], 1e-12)).astype(np.float32)

    # This nearest-point sample compares the coarse loop with the original fine
    # surface at the coarse plane. It is deliberately labeled diagnostic.
    ref_v, ref_f, _ = clip_mesh(fine_v, fine_f, fine_n, cy, False)
    ref_loops = boundary_loops(ref_v, ref_f, cy)
    if ref_loops:
        ref = ref_v[np.asarray(ref_loops[0])]
        sampled_error, _ = cKDTree(ref).query(b)
        collar_stats = {
            'kind': 'sampled-boundary-vertex-nearest',
            'samples': int(len(b)),
            'meanMm': float(np.mean(sampled_error)),
            'p95Mm': float(np.percentile(sampled_error, 95)),
            'maxMm': float(np.max(sampled_error)),
            'certified3DError': False,
        }
    else:
        collar_stats = {'kind': 'sampled-boundary-vertex-nearest', 'samples': 0, 'certified3DError': False}
    metadata = {
        'hybridExtraction': True,
        'finePlaneYmm': fy, 'coarsePlaneYmm': cy, 'selectedOffsetMm': offset,
        'attempts': attempts, 'fineBoundaryVertices': int(len(lf)), 'coarseBoundaryVertices': int(len(lc)),
        'zipperSamples': int(len(a)), 'centerAlignmentMeanErrorMm': float(alignment_error),
        'collarStats': collar_stats,
        'fineTriangles': int(len(ff)), 'coarseTriangles': int(len(cf)), 'zipperTriangles': int(len(collar_faces)),
        'signedVolumeMm3': signed_volume,
        'method': 'fine slab extraction below collar with fine-foot override; independent one-mm marching cubes above collar; ordered-arclength zipper; no caps or mesh smoothing',
    }
    return vertices.astype(np.float32), faces.astype(np.uint32), normals.astype(np.float32), metadata




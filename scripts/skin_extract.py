"""Memory-bounded marching-cubes extraction for structure skin fields.

The public helper works in the field's XYZ axis order. Fields are sampled on a
regular grid whose world origin is the coordinate of field[0, 0, 0].
"""
from __future__ import annotations

from typing import Optional, Tuple

import numpy as np
from scipy import ndimage as ndi
from skimage.measure import marching_cubes


def _as_origin(origin: np.ndarray) -> np.ndarray:
    value = np.asarray(origin, dtype=np.float64)
    if value.shape != (3,):
        raise ValueError(f"origin must have shape (3,), got {value.shape}")
    if not np.all(np.isfinite(value)):
        raise ValueError("origin must be finite")
    return value


def _zoom_half_grid(chunk: np.ndarray) -> np.ndarray:
    """Linearly resample a coarse chunk onto its half-grid, including endpoints."""
    shape = tuple(int(size) for size in chunk.shape)
    if len(shape) != 3 or any(size < 2 for size in shape):
        raise ValueError(f"field slabs need at least two samples per axis, got {shape}")
    target = tuple(2 * size - 1 for size in shape)
    factors = tuple(target[i] / shape[i] for i in range(3))
    sampled = ndi.zoom(
        np.asarray(chunk, dtype=np.float32),
        factors,
        order=1,
        mode="nearest",
        prefilter=False,
        grid_mode=False,
    )
    if sampled.shape != target:
        fixed = sampled
        slices = tuple(slice(0, min(fixed.shape[i], target[i])) for i in range(3))
        fixed = fixed[slices]
        pad = [(0, target[i] - fixed.shape[i]) for i in range(3)]
        if any(after for _, after in pad):
            fixed = np.pad(fixed, pad, mode="edge")
        sampled = fixed
    if sampled.shape != target:
        raise RuntimeError(f"half-grid resample produced {sampled.shape}, expected {target}")
    return np.asarray(sampled, dtype=np.float32)


def _overlay_fine(
    sampled: np.ndarray,
    fine: np.ndarray,
    fine_origin: np.ndarray,
    coarse_origin: np.ndarray,
    extraction_mm: float,
    coarse_start_y: int,
    coarse_end_y: int,
) -> None:
    """Overlay the aligned fine field into one resampled slab in place."""
    fine = np.asarray(fine)
    if fine.ndim != 3 or any(size < 2 for size in fine.shape):
        raise ValueError(f"fine foot field must be a 3D grid with at least two samples per axis, got {fine.shape}")
    if not np.issubdtype(fine.dtype, np.number) or not np.isfinite(fine).all():
        raise ValueError("fine foot field must contain finite numeric values")
    fine_origin = _as_origin(fine_origin)
    delta_half = (fine_origin - coarse_origin) / 0.5
    if not np.allclose(delta_half, np.rint(delta_half), rtol=0.0, atol=1e-6):
        raise ValueError("fine foot origin must differ from the coarse origin by an integer number of 0.5 mm steps")
    delta_grid = (fine_origin - coarse_origin) / extraction_mm
    if not np.allclose(delta_grid, np.rint(delta_grid), rtol=0.0, atol=1e-6):
        raise ValueError("fine foot origin must align to the extraction grid")
    global_start = np.array([0, 2 * coarse_start_y, 0], dtype=np.int64)
    global_end = np.array(
        [sampled.shape[0] - 1, 2 * coarse_end_y, sampled.shape[2] - 1],
        dtype=np.int64,
    )
    fine_start = np.rint(delta_grid).astype(np.int64)
    fine_end = fine_start + np.asarray(fine.shape, dtype=np.int64) - 1
    overlap_start = np.maximum(global_start, fine_start)
    overlap_end = np.minimum(global_end, fine_end)
    if np.any(overlap_start > overlap_end):
        return
    local_start = overlap_start - global_start
    local_end = overlap_end - global_start + 1
    fine_local_start = overlap_start - fine_start
    fine_local_end = overlap_end - fine_start + 1
    sampled[
        local_start[0] : local_end[0],
        local_start[1] : local_end[1],
        local_start[2] : local_end[2],
    ] = np.asarray(
        fine[
            fine_local_start[0] : fine_local_end[0],
            fine_local_start[1] : fine_local_end[1],
            fine_local_start[2] : fine_local_end[2],
        ],
        dtype=np.float32,
    )


def _gradient_normals(sampled: np.ndarray, spacing: float, vertices: np.ndarray) -> np.ndarray:
    gradients = np.gradient(sampled, spacing, axis=(0, 1, 2))
    coords = (np.asarray(vertices, dtype=np.float64) / spacing).T
    normals = np.column_stack(
        [
            ndi.map_coordinates(
                np.asarray(gradients[axis], dtype=np.float32),
                coords,
                order=1,
                mode="nearest",
                prefilter=False,
            )
            for axis in range(3)
        ]
    ).astype(np.float64)
    lengths = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(lengths[:, None], 1e-12)
    normals[lengths <= 1e-12] = 0.0
    return normals.astype(np.float32)


def _weld(
    vertex_chunks: list[np.ndarray],
    face_chunks: list[np.ndarray],
    normal_chunks: list[np.ndarray],
    tolerance: float = 1e-5,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    if not vertex_chunks or not face_chunks:
        return (
            np.empty((0, 3), dtype=np.float32),
            np.empty((0, 3), dtype=np.uint32),
            np.empty((0, 3), dtype=np.float32),
        )
    vertices = np.concatenate(vertex_chunks, axis=0).astype(np.float32, copy=False)
    normals = np.concatenate(normal_chunks, axis=0).astype(np.float32, copy=False)
    offsets = np.cumsum([0] + [len(chunk) for chunk in vertex_chunks[:-1]], dtype=np.int64)
    faces = np.concatenate(
        [np.asarray(chunk, dtype=np.int64) + offset for chunk, offset in zip(face_chunks, offsets)],
        axis=0,
    )
    keys = np.rint(vertices.astype(np.float64) / tolerance).astype(np.int64)
    _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    positions = vertices[first].astype(np.float32, copy=True)
    normal_sums = np.column_stack(
        [
            np.bincount(inverse, weights=normals[:, axis].astype(np.float64), minlength=len(first))
            for axis in range(3)
        ]
    )
    remapped = inverse[faces]
    nondegenerate = (
        (remapped[:, 0] != remapped[:, 1])
        & (remapped[:, 1] != remapped[:, 2])
        & (remapped[:, 2] != remapped[:, 0])
    )
    remapped = remapped[nondegenerate]
    if len(remapped):
        p = positions.astype(np.float64)
        cross = np.cross(p[remapped[:, 1]] - p[remapped[:, 0]], p[remapped[:, 2]] - p[remapped[:, 0]])
        positive_area = np.einsum("ij,ij->i", cross, cross) > 1e-20
        remapped = remapped[positive_area]
    if len(remapped):
        _, unique_indices = np.unique(np.sort(remapped, axis=1), axis=0, return_index=True)
        remapped = remapped[np.sort(unique_indices)]
    lengths = np.linalg.norm(normal_sums, axis=1)
    normal_sums /= np.maximum(lengths[:, None], 1e-12)
    normal_sums[lengths <= 1e-12] = 0.0
    return positions, remapped.astype(np.uint32), normal_sums.astype(np.float32)



def repair_numerical_holes(
    vertices: np.ndarray,
    faces: np.ndarray,
    normals: np.ndarray,
    open_plane_y: float,
    edge_tolerance_mm: float = 1e-3,
    plane_tolerance_mm: float = 1e-4,
    collinear_tolerance_mm: float = 1e-5,
) -> Tuple[np.ndarray, dict]:
    """Repair only numerical open-edge artifacts without moving vertices.

    Tiny three-edge float32 weld slivers receive one gradient-wound triangle.
    An exactly collinear three-edge T-junction splits the single adjacent
    triangle at its existing interior vertex. Larger or non-triangular
    internal boundaries raise with diagnostics attached.
    """
    vertex_array = np.asarray(vertices)
    face_array = np.asarray(faces)
    normal_array = np.asarray(normals)
    if vertex_array.ndim != 2 or vertex_array.shape[1] != 3:
        raise ValueError("vertices must have shape (N, 3)")
    if face_array.ndim != 2 or face_array.shape[1] != 3:
        raise ValueError("faces must have shape (M, 3)")
    if normal_array.shape != vertex_array.shape:
        raise ValueError("normals must have shape (N, 3)")
    if not np.isfinite(vertex_array).all() or not np.isfinite(normal_array).all():
        raise ValueError("vertices and normals must be finite")
    if edge_tolerance_mm <= 0 or plane_tolerance_mm < 0 or collinear_tolerance_mm <= 0:
        raise ValueError("repair tolerances must be valid")
    edges = np.sort(
        np.concatenate([face_array[:, [0, 1]], face_array[:, [1, 2]], face_array[:, [2, 0]]]),
        axis=1,
    )
    unique_edges, counts = np.unique(edges, axis=0, return_counts=True)
    open_edges = unique_edges[counts == 1]
    endpoint_edge = np.all(
        np.isclose(vertex_array[open_edges, 1], float(open_plane_y), rtol=0.0, atol=plane_tolerance_mm),
        axis=1,
    )
    internal_edges = open_edges[~endpoint_edge]
    metadata = {
        "openEdgesBefore": int(len(open_edges)),
        "ignoredEndpointEdges": int(np.sum(endpoint_edge)),
        "internalOpenEdgesBefore": int(len(internal_edges)),
        "edgeToleranceMm": float(edge_tolerance_mm),
        "planeToleranceMm": float(plane_tolerance_mm),
        "collinearToleranceMm": float(collinear_tolerance_mm),
        "repairedCount": 0,
        "repaired": [],
        "splitCollinearCount": 0,
        "splitCollinear": [],
        "unresolved": [],
    }
    if not len(internal_edges):
        metadata["internalOpenEdgesAfter"] = 0
        metadata["openEdgesAfter"] = int(len(open_edges))
        metadata["proofDistanceBoundMm"] = 0.0
        return face_array.copy(), metadata

    adjacency: dict[int, set[int]] = {}
    for a, b in internal_edges:
        adjacency.setdefault(int(a), set()).add(int(b))
        adjacency.setdefault(int(b), set()).add(int(a))
    unseen = set(adjacency)
    components: list[tuple[np.ndarray, np.ndarray]] = []
    while unseen:
        seed = unseen.pop()
        stack = [seed]
        component_vertices = {seed}
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    component_vertices.add(neighbor)
                    stack.append(neighbor)
        vertex_ids = np.asarray(sorted(component_vertices), dtype=np.int64)
        mask = np.all(np.isin(internal_edges, vertex_ids), axis=1)
        components.append((vertex_ids, internal_edges[mask]))

    additions: list[np.ndarray] = []
    replacements: list[tuple[int, np.ndarray, np.ndarray]] = []
    for vertex_ids, component_edges in components:
        points = vertex_array[vertex_ids].astype(np.float64)
        lengths = np.linalg.norm(
            vertex_array[component_edges[:, 1]].astype(np.float64)
            - vertex_array[component_edges[:, 0]].astype(np.float64),
            axis=1,
        )
        max_edge = float(lengths.max()) if len(lengths) else 0.0
        if len(vertex_ids) == 3 and len(component_edges) == 3 and max_edge <= edge_tolerance_mm:
            order = vertex_ids.copy()
            cross = np.cross(
                vertex_array[order[1]].astype(np.float64) - vertex_array[order[0]].astype(np.float64),
                vertex_array[order[2]].astype(np.float64) - vertex_array[order[0]].astype(np.float64),
            )
            gradient = normal_array[order].astype(np.float64).sum(axis=0)
            if np.linalg.norm(gradient) <= 1e-12 or np.linalg.norm(cross) <= 1e-20:
                metadata["unresolved"].append(
                    {
                        "vertices": order.tolist(),
                        "edges": component_edges.tolist(),
                        "edgeLengthsMm": lengths.tolist(),
                        "maxEdgeMm": max_edge,
                        "reason": "numerical sliver has no usable gradient winding",
                    }
                )
                continue
            if float(np.dot(cross, gradient)) < 0.0:
                order[[1, 2]] = order[[2, 1]]
            additions.append(order)
            metadata["repaired"].append(
                {
                    "vertices": order.tolist(),
                    "edgeLengthsMm": lengths.tolist(),
                    "maxEdgeMm": max_edge,
                    "proofDistanceBoundMm": max_edge,
                }
            )
            continue

        split_done = False
        if len(vertex_ids) == 3 and len(component_edges) == 3:
            pairwise = np.linalg.norm(points[:, None, :] - points[None, :, :], axis=2)
            endpoint_positions = np.unravel_index(int(np.argmax(pairwise)), pairwise.shape)
            endpoint_a = int(vertex_ids[endpoint_positions[0]])
            endpoint_c = int(vertex_ids[endpoint_positions[1]])
            interior = [int(item) for item in vertex_ids if int(item) not in (endpoint_a, endpoint_c)]
            if len(interior) == 1:
                interior_b = interior[0]
                segment = vertex_array[endpoint_c].astype(np.float64) - vertex_array[endpoint_a].astype(np.float64)
                segment_length = float(np.linalg.norm(segment))
                if segment_length > 0.0:
                    projection = float(
                        np.dot(vertex_array[interior_b].astype(np.float64) - vertex_array[endpoint_a], segment)
                        / (segment_length * segment_length)
                    )
                    residual = float(
                        np.linalg.norm(
                            np.cross(
                                segment,
                                vertex_array[interior_b].astype(np.float64) - vertex_array[endpoint_a],
                            )
                        )
                        / segment_length
                    )
                    if (
                        residual <= collinear_tolerance_mm
                        and 1e-6 < projection < 1.0 - 1e-6
                    ):
                        candidate_faces = np.flatnonzero(
                            np.sum(np.isin(face_array, [endpoint_a, endpoint_c]), axis=1) == 2
                        )
                        if len(candidate_faces) == 1:
                            face_index = int(candidate_faces[0])
                            original = face_array[face_index].astype(np.int64)
                            pos_a = int(np.flatnonzero(original == endpoint_a)[0])
                            pos_c = int(np.flatnonzero(original == endpoint_c)[0])
                            if int(original[(pos_a + 1) % 3]) == endpoint_c:
                                u, v = endpoint_a, endpoint_c
                            else:
                                u, v = endpoint_c, endpoint_a
                            opposite = int(original[3 - pos_a - pos_c])
                            first = np.asarray([u, interior_b, opposite], dtype=face_array.dtype)
                            second = np.asarray([interior_b, v, opposite], dtype=face_array.dtype)
                            replacements.append((face_index, first, second))
                            metadata["splitCollinear"].append(
                                {
                                    "vertices": [endpoint_a, interior_b, endpoint_c],
                                    "faceIndex": face_index,
                                    "oldFace": original.tolist(),
                                    "newFaces": [first.tolist(), second.tolist()],
                                    "collinearResidualMm": residual,
                                    "projection": projection,
                                    "maxEdgeMm": max_edge,
                                    "proofDistanceBoundMm": residual,
                                }
                            )
                            split_done = True
        if split_done:
            continue
        metadata["unresolved"].append(
            {
                "vertices": vertex_ids.tolist(),
                "edges": component_edges.tolist(),
                "edgeLengthsMm": lengths.tolist(),
                "maxEdgeMm": max_edge,
                "reason": "internal boundary is not a numerical sliver or exactly collinear T-junction",
            }
        )

    repaired_faces = face_array.copy()
    for face_index, first, second in replacements:
        repaired_faces[face_index] = first
    if replacements:
        repaired_faces = np.concatenate(
            [repaired_faces, np.asarray([second for _, _, second in replacements], dtype=face_array.dtype)],
            axis=0,
        )
    if additions:
        repaired_faces = np.concatenate(
            [repaired_faces, np.asarray(additions, dtype=face_array.dtype)],
            axis=0,
        )
    metadata["repairedCount"] = int(len(additions) + len(replacements))
    metadata["splitCollinearCount"] = int(len(replacements))
    metadata["proofDistanceBoundMm"] = float(
        max(
            [item["proofDistanceBoundMm"] for item in metadata["repaired"]]
            + [item["proofDistanceBoundMm"] for item in metadata["splitCollinear"]]
            + [0.0]
        )
    )

    repaired_edges = np.sort(
        np.concatenate(
            [repaired_faces[:, [0, 1]], repaired_faces[:, [1, 2]], repaired_faces[:, [2, 0]]]
        ),
        axis=1,
    )
    repaired_unique_edges, repaired_counts = np.unique(repaired_edges, axis=0, return_counts=True)
    repaired_open_edges = repaired_unique_edges[repaired_counts == 1]
    repaired_endpoint = np.all(
        np.isclose(
            vertex_array[repaired_open_edges, 1],
            float(open_plane_y),
            rtol=0.0,
            atol=plane_tolerance_mm,
        ),
        axis=1,
    )
    metadata["internalOpenEdgesAfter"] = int(np.sum(~repaired_endpoint))
    metadata["openEdgesAfter"] = int(len(repaired_open_edges))
    if metadata["unresolved"] or metadata["internalOpenEdgesAfter"]:
        error = ValueError(
            "unresolved internal mesh boundary; numerical-hole repair refuses to fabricate a non-numerical patch"
        )
        error.metadata = metadata
        raise error
    return repaired_faces, metadata

def extract_field_slabs(
    field: np.ndarray,
    origin: np.ndarray,
    grid_mm: float = 1.0,
    extraction_mm: float = 0.5,
    foot_override: Optional[Tuple[np.ndarray, np.ndarray, float]] = None,
    slab_intervals: int = 32,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract a half-grid zero surface from a field in bounded Y slabs.

    Fields use XYZ axis order. A fine-foot override is
    (finefield, fine_origin, fine_spacing) and must use the requested
    extraction spacing. Its values replace the coarse resample wherever the
    rectangular grids overlap. Returned vertices are world millimetres.
    """
    array = np.asarray(field)
    if array.ndim != 3 or any(size < 2 for size in array.shape):
        raise ValueError(f"field must be a 3D grid with at least two samples per axis, got {array.shape}")
    if not np.issubdtype(array.dtype, np.number):
        raise TypeError("field must be numeric")
    if not np.isfinite(array).all():
        raise ValueError("field contains non-finite values")
    coarse_origin = _as_origin(origin)
    grid_mm = float(grid_mm)
    extraction_mm = float(extraction_mm)
    if not np.isfinite(grid_mm) or grid_mm <= 0:
        raise ValueError("grid_mm must be positive and finite")
    if not np.isfinite(extraction_mm) or extraction_mm <= 0:
        raise ValueError("extraction_mm must be positive and finite")
    if not np.isclose(extraction_mm, grid_mm / 2.0, rtol=0.0, atol=1e-9):
        raise ValueError("this extractor requires extraction_mm to be grid_mm / 2")
    slab_intervals = int(slab_intervals)
    if slab_intervals < 1:
        raise ValueError("slab_intervals must be positive")

    finefield = None
    fine_origin = None
    fine_spacing = None
    if foot_override is not None:
        if len(foot_override) != 3:
            raise ValueError("foot_override must be (finefield, fine_origin, fine_spacing)")
        finefield, fine_origin, fine_spacing = foot_override
        fine_spacing = float(fine_spacing)
        if not np.isclose(fine_spacing, extraction_mm, rtol=0.0, atol=1e-9):
            raise ValueError("fine foot spacing must equal extraction_mm")
        fine_origin = _as_origin(fine_origin)
        if np.asarray(finefield).ndim != 3:
            raise ValueError("fine foot field must be 3D")

    vertex_chunks: list[np.ndarray] = []
    face_chunks: list[np.ndarray] = []
    normal_chunks: list[np.ndarray] = []
    nx, ny, nz = map(int, array.shape)
    for start_y in range(0, ny - 1, slab_intervals):
        end_y = min(start_y + slab_intervals, ny - 1)
        coarse_chunk = array[:, start_y : end_y + 1, :]
        sampled = _zoom_half_grid(coarse_chunk)
        if finefield is not None:
            _overlay_fine(
                sampled,
                finefield,
                fine_origin,
                coarse_origin,
                extraction_mm,
                start_y,
                end_y,
            )
        minimum = float(np.min(sampled))
        maximum = float(np.max(sampled))
        if minimum == maximum or minimum > 0.0 or maximum < 0.0:
            continue
        vertices, faces, _, _ = marching_cubes(
            sampled,
            level=0.0,
            spacing=(extraction_mm, extraction_mm, extraction_mm),
            allow_degenerate=False,
            gradient_direction="ascent",
        )
        if len(vertices) == 0 or len(faces) == 0:
            continue
        world_vertices = vertices.astype(np.float64)
        world_vertices[:, 0] += coarse_origin[0]
        world_vertices[:, 1] += coarse_origin[1] + start_y * grid_mm
        world_vertices[:, 2] += coarse_origin[2]
        normals = _gradient_normals(sampled, extraction_mm, vertices)
        cross = np.cross(
            world_vertices[faces[:, 1]] - world_vertices[faces[:, 0]],
            world_vertices[faces[:, 2]] - world_vertices[faces[:, 0]],
        )
        outward = np.einsum("ij,ij->i", cross, normals[faces].mean(axis=1)) >= 0.0
        faces = faces.copy()
        faces[~outward] = faces[~outward][:, [0, 2, 1]]
        vertex_chunks.append(world_vertices.astype(np.float32))
        face_chunks.append(faces.astype(np.uint32))
        normal_chunks.append(normals.astype(np.float32))
    return _weld(vertex_chunks, face_chunks, normal_chunks)











"""Deterministic manifold winding repair for triangle surfaces.

The public helper only changes triangle index order. Vertices and supplied
normals are read-only; normals are used as a field-gradient vote for open
components and are never smoothed or rewritten.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

import numpy as np


def _validate_inputs(vertices: np.ndarray, faces: np.ndarray, normals: np.ndarray | None):
    vertices = np.asarray(vertices)
    faces = np.asarray(faces)
    if vertices.ndim != 2 or vertices.shape[1] != 3:
        raise ValueError("vertices must have shape (N, 3)")
    if faces.ndim != 2 or faces.shape[1] != 3:
        raise ValueError("faces must have shape (F, 3)")
    if not np.issubdtype(faces.dtype, np.integer):
        raise ValueError("faces must contain integer indices")
    if len(faces) and (int(faces.min()) < 0 or int(faces.max()) >= len(vertices)):
        raise ValueError("faces contain an out-of-range vertex index")
    if normals is not None:
        normals = np.asarray(normals)
        if normals.ndim != 2 or normals.shape[1] != 3:
            raise ValueError("normals must have shape (N, 3) or (F, 3)")
        if len(normals) not in (len(vertices), len(faces)):
            raise ValueError("normals must be per-vertex or per-face")
    return vertices, faces, normals


def _edge_groups(faces: np.ndarray):
    """Return paired manifold edge records and non-manifold diagnostics."""
    count = len(faces)
    if count == 0:
        empty_i = np.empty(0, dtype=np.int64)
        empty_u8 = np.empty(0, dtype=np.uint8)
        return empty_i, empty_i, empty_u8, empty_i, empty_i, empty_i, np.zeros(0, dtype=bool)

    local_edges = np.stack(
        (faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]), axis=1
    ).reshape(-1, 2)
    face_ids = np.repeat(np.arange(count, dtype=np.int64), 3)
    valid = local_edges[:, 0] != local_edges[:, 1]
    local_edges = local_edges[valid].astype(np.int64, copy=False)
    face_ids = face_ids[valid]
    direction = np.where(local_edges[:, 0] < local_edges[:, 1], 1, -1).astype(np.int8)
    keys = np.sort(local_edges, axis=1)
    order = np.lexsort((keys[:, 1], keys[:, 0]))
    sorted_keys = keys[order]
    same = np.all(sorted_keys[1:] == sorted_keys[:-1], axis=1)
    starts = np.concatenate((np.array([0], dtype=np.int64), np.flatnonzero(~same).astype(np.int64) + 1))
    ends = np.concatenate((starts[1:], np.array([len(order)], dtype=np.int64)))
    sizes = ends - starts

    pair_mask = sizes == 2
    pair_starts = starts[pair_mask]
    pair_a = np.empty(len(pair_starts), dtype=np.int64)
    pair_b = np.empty(len(pair_starts), dtype=np.int64)
    relation = np.empty(len(pair_starts), dtype=np.uint8)
    for index, start in enumerate(pair_starts):
        first = int(order[start])
        second = int(order[start + 1])
        pair_a[index] = face_ids[first]
        pair_b[index] = face_ids[second]
        relation[index] = np.uint8(direction[first] == direction[second])

    open_face = np.zeros(count, dtype=bool)
    boundary_groups = int(np.sum(sizes == 1))
    nonmanifold_groups = int(np.sum(sizes > 2))
    for start, end, size in zip(starts, ends, sizes):
        if size != 2:
            open_face[face_ids[order[start:end]]] = True

    return (
        pair_a, pair_b, relation,
        sizes[sizes == 1], sizes[sizes > 2],
        np.array([boundary_groups, nonmanifold_groups], dtype=np.int64),
        open_face,
    )


def _propagate(face_count: int, pair_a: np.ndarray, pair_b: np.ndarray, relation: np.ndarray):
    if not face_count:
        return np.empty(0, dtype=np.int8), np.empty(0, dtype=np.int32), 0

    rows = np.concatenate((pair_a, pair_b))
    cols = np.concatenate((pair_b, pair_a))
    parity = np.concatenate((relation, relation)).astype(np.uint8, copy=False)
    order = np.argsort(rows, kind="stable")
    sorted_rows = rows[order]
    degree = np.bincount(sorted_rows, minlength=face_count)
    indptr = np.empty(face_count + 1, dtype=np.int64)
    indptr[0] = 0
    np.cumsum(degree, out=indptr[1:])
    neighbours = cols[order]
    neighbour_parity = parity[order]

    assigned = np.full(face_count, -1, dtype=np.int8)
    labels = np.full(face_count, -1, dtype=np.int32)
    conflicts = 0
    components = 0
    for seed in range(face_count):
        if assigned[seed] >= 0:
            continue
        assigned[seed] = 0
        labels[seed] = components
        stack = [seed]
        while stack:
            face = stack.pop()
            lo, hi = int(indptr[face]), int(indptr[face + 1])
            for cursor in range(lo, hi):
                neighbour = int(neighbours[cursor])
                expected = int(assigned[face]) ^ int(neighbour_parity[cursor])
                current = int(assigned[neighbour])
                if current < 0:
                    assigned[neighbour] = expected
                    labels[neighbour] = components
                    stack.append(neighbour)
                elif current != expected:
                    conflicts += 1
        components += 1
    return assigned, labels, conflicts


def _signed_face_volumes(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    values = np.empty(len(faces), dtype=np.float64)
    chunk = 1_000_000
    for start in range(0, len(faces), chunk):
        stop = min(len(faces), start + chunk)
        tri = np.asarray(vertices[faces[start:stop]], dtype=np.float64)
        values[start:stop] = np.einsum(
            "ij,ij->i", tri[:, 0], np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        ) / 6.0
    return values


def _gradient_agreement(vertices: np.ndarray, faces: np.ndarray, normals: np.ndarray | None) -> np.ndarray:
    if normals is None or len(faces) == 0:
        return np.zeros(len(faces), dtype=np.float64)
    normals = np.asarray(normals, dtype=np.float64)
    values = np.empty(len(faces), dtype=np.float64)
    chunk = 1_000_000
    for start in range(0, len(faces), chunk):
        stop = min(len(faces), start + chunk)
        tri = np.asarray(vertices[faces[start:stop]], dtype=np.float64)
        cross = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        if len(normals) == len(vertices):
            expected = normals[faces[start:stop]].mean(axis=1)
        else:
            expected = normals[start:stop]
        values[start:stop] = np.einsum("ij,ij->i", cross, expected)
    return values


def orient_surface_consistently(
    vertices: np.ndarray,
    faces: np.ndarray,
    normals: np.ndarray | None = None,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Orient triangle winding across manifold components.

    Vertices and supplied normals are read-only. The returned face array is a
    copy; only rows whose winding must change are reversed. Two-incidence
    shared edges are propagated with parity BFS. Closed components are made
    outward by positive signed volume. Open components use majority
    face-normal agreement with supplied field-gradient normals. If an open
    component has no usable normal vote, its signed volume is retained as a
    diagnostic fallback.

    Returns (oriented_faces, stats).
    """
    vertices, faces, normals = _validate_inputs(vertices, faces, normals)
    original_faces = np.asarray(faces)
    oriented = np.array(original_faces, copy=True)
    pair_a, pair_b, relation, boundary_sizes, nonmanifold_sizes, group_counts, open_face = _edge_groups(oriented)
    assigned, labels, conflicts = _propagate(len(oriented), pair_a, pair_b, relation)
    parity_flip = assigned.astype(bool)
    oriented[parity_flip] = oriented[parity_flip][:, [0, 2, 1]]

    face_volume = _signed_face_volumes(vertices, oriented)
    gradient_vote = _gradient_agreement(vertices, oriented, normals)
    component_count = int(labels.max() + 1) if len(labels) else 0
    component_open = np.zeros(component_count, dtype=bool)
    if component_count:
        component_open = np.bincount(labels, weights=open_face.astype(np.int8), minlength=component_count) > 0
    component_volume = np.bincount(labels, weights=face_volume, minlength=component_count) if component_count else np.empty(0)
    component_vote = np.bincount(labels, weights=gradient_vote, minlength=component_count) if component_count else np.empty(0)
    component_flips = np.zeros(component_count, dtype=bool)
    component_records = []
    for component in range(component_count):
        is_open = bool(component_open[component])
        volume = float(component_volume[component])
        vote = float(component_vote[component])
        if is_open:
            usable_vote = normals is not None and np.isfinite(vote) and abs(vote) > 1e-12
            basis = "fieldGradient" if usable_vote else "signedVolumeFallback"
            measure = vote if usable_vote else volume
        else:
            basis = "signedVolume"
            measure = volume
        flip = bool(measure < 0.0)
        component_flips[component] = flip
        component_records.append({
            "component": component,
            "faces": int(np.sum(labels == component)),
            "open": is_open,
            "orientationBasis": basis,
            "signedVolume": -volume if flip else volume,
            "signedVolumeBeforeComponentFlip": volume,
            "gradientAgreement": (-vote if flip else vote) if normals is not None else None,
            "gradientAgreementBeforeComponentFlip": vote if normals is not None else None,
            "flipped": flip,
        })
    if component_count:
        component_flip_face = component_flips[labels]
        oriented[component_flip_face] = oriented[component_flip_face][:, [0, 2, 1]]

    final_flip = parity_flip.copy()
    if component_count:
        final_flip ^= component_flips[labels]
    # A paired edge is still directed the same way exactly when its original
    # relation survives the total face flips. This avoids rebuilding a second
    # full edge table for the post-repair diagnostic.
    after_disagreements = int(np.sum(
        relation.astype(np.int8) ^ final_flip[pair_a] ^ final_flip[pair_b]
    ))
    before_disagreements = int(np.sum(relation))
    stats = {
        "faceCount": int(len(oriented)),
        "vertexCount": int(len(vertices)),
        "components": component_records,
        "componentCount": component_count,
        "manifoldSharedEdges": int(len(pair_a)),
        "boundaryEdgeGroups": int(group_counts[0]),
        "nonManifoldEdgeGroups": int(group_counts[1]),
        "directedDisagreementsBefore": before_disagreements,
        "directedDisagreementsAfter": int(after_disagreements),
        "parityConflicts": int(conflicts),
        "degenerateFaces": int(np.sum(
            (faces[:, 0] == faces[:, 1]) |
            (faces[:, 1] == faces[:, 2]) |
            (faces[:, 2] == faces[:, 0])
        )),
        "facesFlippedByParity": int(np.sum(parity_flip)),
        "facesFlippedByComponentOrientation": int(np.sum(component_flips[labels])) if component_count else 0,
        "outwardClosedComponents": int(sum(not record["open"] for record in component_records)),
    }
    return oriented, stats


__all__ = ["orient_surface_consistently"]




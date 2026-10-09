"""Reusable foot/toe fine-field construction for the isolated skin prototype.

This module has no rendering or viewer dependencies. It builds a fine-grid foot
field from one side's own raster/body context, using independent axial YZ toe
sections and the established proximal make_field web gate.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
from skimage.draw import polygon


def upsample_exact(field: np.ndarray, order: int = 1) -> np.ndarray:
    """Resample a grid onto the same physical endpoints at half the spacing."""
    factors = tuple((2 * size - 1) / size for size in field.shape)
    result = ndi.zoom(field, factors, order=order, prefilter=False)
    expected = tuple(2 * size - 1 for size in field.shape)
    if result.shape != expected:
        raise RuntimeError(f"Unexpected exact-upsample shape {result.shape}; expected {expected}")
    return result


def _foot_context(shell: np.ndarray, toes: np.ndarray, origin: np.ndarray, h: float, meshes: list[dict[str, Any]], params: dict[str, Any]):
    shape = shell.shape
    foot_y = min(shape[1], int(math.ceil((params.get("skinCropTopYMm", 30.0) - origin[1]) / h)))
    foot_x = max(0, int((params.get("skinCropXMinMm", 65.0) - origin[0]) / h))
    sl = (slice(foot_x, None), slice(None, foot_y), slice(None))
    foot_origin = origin + np.array([foot_x * h, 0, 0])
    foot_shell = shell[sl]
    toe_labels = toes[sl]
    xyz = [foot_origin[i] + np.arange(foot_shell.shape[i]) * h for i in range(3)]
    head_points = []
    for index in range(1, 6):
        vertices = np.concatenate([
            mesh["vertices"]
            for mesh in meshes
            if mesh["region"] == "lower" and mesh["id"] == f"metatarsal-{index}"
        ])
        head_points.append(vertices[vertices[:, 0] > np.quantile(vertices[:, 0], 0.95)].mean(0))
    head_points = np.asarray(head_points)
    order = np.argsort(head_points[:, 2])
    head_x = np.interp(xyz[2], head_points[order, 2], head_points[order, 0])
    free = xyz[0][:, None, None] > head_x[None, None, :] + params["webDistalMm"]
    return sl, foot_origin, xyz, head_x, np.broadcast_to(free, foot_shell.shape).copy(), foot_shell, toe_labels


def _axial_section_fields(toe_labels: np.ndarray, free: np.ndarray, sigma_voxels: float):
    masks: list[np.ndarray] = []
    fields: list[np.ndarray] = []
    counts = {str(toe): 0 for toe in range(1, 6)}
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
            rows, cols = polygon(boundary[:, 0], boundary[:, 1], shape=mask.shape[1:])
            mask[ix, rows, cols] = True
            counts[str(toe)] += 1
        signed = ndi.distance_transform_edt(~mask) - ndi.distance_transform_edt(mask)
        signed = ndi.gaussian_filter(signed.astype(np.float32), sigma=(sigma_voxels,) * 3, mode="nearest")
        masks.append(mask)
        fields.append(signed)
    return masks, fields, counts


def _resolve_overlaps(fields: list[np.ndarray], assigned: np.ndarray, free: np.ndarray) -> int:
    masks = [(field <= 0) & free for field in fields]
    stacked = np.stack(masks)
    overlap = stacked.sum(axis=0) > 1
    changed = 0
    for ix, iy, iz in np.argwhere(overlap):
        labels = np.flatnonzero(stacked[:, ix, iy, iz])
        source_toe = int(assigned[ix, iy, iz])
        winner = source_toe - 1 if source_toe in labels + 1 else int(labels[np.argmin([fields[label][ix, iy, iz] for label in labels])])
        for label in labels:
            if int(label) != winner:
                fields[int(label)][ix, iy, iz] = 1.0
        changed += 1
    return changed


def _carve_boundaries(
    fields: list[np.ndarray],
    assigned: np.ndarray,
    protected_labels: np.ndarray,
    free: np.ndarray,
    iterations: int,
    moat_value: float,
) -> int:
    cross = np.zeros((3, 3), dtype=bool)
    cross[1, :] = True
    cross[:, 1] = True
    removed = 0
    structure = np.broadcast_to(cross, (1, 3, 3)).copy()
    for left in range(4):
        right = left + 1
        left_mask = (fields[left] <= 0) & free
        right_mask = (fields[right] <= 0) & free
        left_near = left_mask & ndi.binary_dilation(right_mask, structure=structure, iterations=iterations)
        right_near = right_mask & ndi.binary_dilation(left_mask, structure=structure, iterations=iterations)
        for label, near in ((left, left_near), (right, right_near)):
            cells = np.argwhere(near & (protected_labels != label + 1))
            for ix, iy, iz in cells:
                fields[label][ix, iy, iz] = moat_value
            removed += len(cells)
    return removed


def build_fine_foot(
    shell: np.ndarray,
    toes: np.ndarray,
    origin: np.ndarray,
    h: float,
    meshes: list[dict[str, Any]],
    params: dict[str, Any],
    base_field: np.ndarray,
) -> dict[str, Any]:
    """Build one side's fine foot field and integration metadata.

    base_field must be the established full field returned by make_field.
    The returned field covers x >= skinCropXMinMm and y <= skinCropTopYMm.
    """
    sl, foot_origin, xyz, head_x, free, foot_shell, toe_labels = _foot_context(shell, toes, origin, h, meshes, params)
    distances = [
        ndi.distance_transform_edt(~(toe_labels == toe), sampling=h).astype(np.float32)
        for toe in range(1, 6)
    ]
    nearest = np.argmin(np.stack(distances), axis=0) + 1
    assigned = np.where(foot_shell & free, nearest, 0).astype(np.uint8)
    assigned[toe_labels > 0] = toe_labels[toe_labels > 0]

    sigma = float(params.get("skinToeGaussianSigmaVoxels", 1.1))
    section_thickness = float(params.get("skinSectionThicknessMm", 0.65))
    carve_iterations = int(params.get("skinToeCarveIterations", 2))
    moat_value = float(params.get("skinToeMoatField", 1.2))
    repair_clearance = float(params.get("skinToeSourceRepairClearanceMm", 0.5))
    masks, fields, section_counts = _axial_section_fields(assigned, free, sigma)
    fields = [field - section_thickness for field in fields]
    resolved_overlaps = _resolve_overlaps(fields, assigned, free)
    carved_boundaries = _carve_boundaries(fields, assigned, toe_labels, free, carve_iterations, moat_value)
    fine_sections_coarse = np.min(np.stack(fields), axis=0)

    extraction_h = h / 2.0
    fine_base = upsample_exact(base_field[sl].astype(np.float32))
    fine_fields = [upsample_exact(field.astype(np.float32)) for field in fields]
    fine_sections = np.min(np.stack(fine_fields), axis=0)
    fine_free = upsample_exact(free.astype(np.uint8), order=0) > 0

    fine_x = foot_origin[0] + np.arange(fine_base.shape[0]) * extraction_h
    fine_z = foot_origin[2] + np.arange(fine_base.shape[2]) * extraction_h
    fine_head_x = np.interp(fine_z, xyz[2], head_x)
    distal_offset = fine_x[:, None, None] - fine_head_x[None, None, :] - params["webDistalMm"]
    gate = np.clip(distal_offset / params["webBlendMm"], 0, 1)
    main_gate = np.maximum(fine_base, (gate - 0.5) * 2 * params["webBlendMm"])
    fillet_width = float(params.get("webFilletMm", 2.0))
    fillet = np.maximum(fillet_width - np.abs(main_gate - fine_sections), 0) / max(fillet_width, 1e-6)
    fillet = np.asarray(fillet, dtype=np.float32)
    fine_field = np.minimum(main_gate, fine_sections) - fillet_width * 0.25 * fillet * fillet

    fine_labels = upsample_exact(assigned.astype(np.uint8), order=0)
    other_clearance = np.full(fine_sections.shape, np.inf, dtype=np.float32)
    for label in range(5):
        own = fine_labels == label + 1
        other = np.min(np.stack([fine_fields[j] for j in range(5) if j != label]), axis=0)
        other_clearance[own] = other[own]
    source_repair = fine_free & (fine_labels > 0) & (fine_field > 0) & (fine_base < 0) & (other_clearance > repair_clearance)
    fine_field[source_repair] = fine_base[source_repair]

    metadata = {
        "shape": [int(value) for value in fine_field.shape],
        "originMm": [float(value) for value in foot_origin],
        "spacingMm": extraction_h,
        "crop": {"xMinMm": float(foot_origin[0]), "yMaxMm": float(foot_origin[1] + (fine_field.shape[1] - 1) * extraction_h)},
        "gaussianSigmaVoxels": sigma,
        "sectionThicknessMm": section_thickness,
        "carveIterations": carve_iterations,
        "moatValue": moat_value,
        "sourceRepairClearanceMm": repair_clearance,
        "sectionCounts": section_counts,
        "resolvedOverlapVoxelCount": int(resolved_overlaps),
        "carvedBoundaryVoxelCount": int(carved_boundaries),
        "sourceRepairVoxels": int(source_repair.sum()),
        "method": "independent axial YZ convex sections, exact endpoint-preserving 0.5 mm resample, established proximal web gate and fillet",
    }
    return {
        "field": fine_field.astype(np.float32),
        "origin": foot_origin.astype(np.float32),
        "spacing": extraction_h,
        "coarseToeFields": np.stack(fields).astype(np.float32),
        "free": free.astype(np.uint8),
        "headX": head_x.astype(np.float32),
        "metadata": metadata,
    }

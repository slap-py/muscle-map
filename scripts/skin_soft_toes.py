"""Continuous rounded toe envelopes with smooth intertoe separators.

These are illustrative soft-tissue profiles, derived from each side's own toe
bones, cartilage and tendon endpoints. Grouped vessels do not define toe walls.
No vertex smoothing, voxel carving or patchwise source repair is used.
"""
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import cKDTree


def build_smooth_toes(shell, toes, origin, h, meshes, params, base_field):
    from skin_toes import _foot_context, upsample_exact
    sl, fo, xyz, head_x, free, foot_shell, labels = _foot_context(shell, toes, origin, h, meshes, params)
    spacing = h / 2
    base = upsample_exact(base_field[sl].astype(np.float32))
    axes = [fo[i] + np.arange(base.shape[i]) * spacing for i in range(3)]
    bones = [np.concatenate([m['vertices'] for m in meshes if m['region'] == 'lower' and m['id'].startswith(f'phalanx-{i}-')]) for i in range(1, 6)]
    centers = np.array([v.mean(0) for v in bones])
    grouped = [list() for _ in range(5)]
    for m in meshes:
        if m['region'] != 'lower':
            continue
        name = m['id']
        for i in range(5):
            if name.startswith(f'phalanx-{i+1}-') or name.startswith(f'cartilage-phalanx-{i+1}-'):
                grouped[i].append(m['vertices'])
        if name in ['extensor-hallucis-tendon', 'flexor-hallucis-tendon', 'abductor-hallucis-tendon']:
            grouped[0].append(m['vertices'])
        elif name in ['extensor-digitorum-tendons', 'flexor-digitorum-tendons', 'edb-tendons', 'abductor-digiti-tendon']:
            v = m['vertices']; endpoint = v[v[:,0] > np.quantile(v[:,0], .96)].mean(0)
            i = int(np.argmin(abs(centers[:,2] - endpoint[2])))
            grouped[i].append(v)
    # Grouped digital meshes lack independent toe IDs. Their vertices are
    # containment constraints associated with the closest own-side phalanges;
    # the smooth profile and continuous bisectors still define the toe walls.
    trees = [cKDTree(v) for v in bones]
    neurovascular_points = 0
    for m in meshes:
        if m['region'] != 'lower' or m.get('group') != 'neurovascular':
            continue
        v = m['vertices']; v = v[(v[:,0] > 80) & (v[:,1] < 10)]
        if not len(v):
            continue
        distances = np.stack([tree.query(v)[0] for tree in trees])
        owners = np.argmin(distances, axis=0)
        for i in range(5):
            grouped[i].append(v[owners == i])
        neurovascular_points += len(v)
    fields = []; profiles = []
    for i, pieces in enumerate(grouped):
        points = np.concatenate(pieces); bone = bones[i]
        start = float(bone[:,0].min() - 8); end = float(max(bone[:,0].max(), points[:,0].max()) + 3)
        samples = np.arange(np.floor(start), np.ceil(end) + 1, h)
        rows = []
        for x in samples:
            near = points[abs(points[:,0] - x) < 3]
            if len(near) < 3:
                near = points[np.argsort(abs(points[:,0] - x))[:30]]
            lo = near[:,1:].min(0); hi = near[:,1:].max(0)
            cy, cz = (lo + hi) / 2
            ry = max((hi[0]-lo[0])/2 + params['toeDorsalPaddingMm'], 5)
            rz = max((hi[1]-lo[1])/2 + params['toeLateralPaddingMm'], 4)
            # Enclose the labelled samples with an ellipse rather than a box.
            scale = max(1, np.max(np.sqrt(((near[:,1]-cy)/ry)**2 + ((near[:,2]-cz)/rz)**2)))
            rows.append([cy,cz,ry*scale,rz*scale])
        rows = ndi.gaussian_filter1d(np.asarray(rows), params['toeProfileSmoothingMm']/h, axis=0, mode='nearest')
        cy,cz,ry,rz = [np.interp(axes[0], samples, rows[:,j])[:,None,None] for j in range(4)]
        # Hemispherical tip over the last six millimetres; extended proximal
        # cap stays inside the main foot and does not expose a cut toe base.
        axial = np.maximum(axes[0]-(end-6),0)/6 + np.minimum(axes[0]-start,0)/8
        q = np.sqrt(((axes[1][None,:,None]-cy)/ry)**2 + ((axes[2][None,None,:]-cz)/rz)**2 + axial[:,None,None]**2)
        fields.append(((q-1)*np.minimum(ry,rz)).astype(np.float32))
        profiles.append(dict(toe=i+1,startMm=start,endMm=end,sectionSamples=len(samples)))
    # Smooth field bisectors make each gap continuous along the entire toe.
    # The gap is in approximate signed-distance units and is independently
    # checked on the exported triangles, including oblique source toes.
    separated = []
    gap = params['toeGapMm']
    for i, own in enumerate(fields):
        other = np.minimum.reduce([fields[j] for j in range(5) if j != i])
        separated.append(np.maximum(own, (own-other+gap)/2))
    sections = np.minimum.reduce(separated)
    fine_head = np.interp(axes[2], xyz[2], head_x)
    offset = axes[0][:,None,None]-fine_head[None,None,:]-params['webDistalMm']
    # A broad C1 transition tapers the forefoot onto the toe roots. A hard
    # maximum with an axial gate creates an artificial vertical shelf here.
    width = params.get('toeRootBlendMm', 22)
    blend = np.clip((offset + width - 3)/width, 0, 1)
    blend = blend*blend*(3-2*blend)
    field = (1-blend)*base + blend*sections
    return dict(field=field.astype(np.float32), origin=fo.astype(np.float32), spacing=spacing,
        coarseToeFields=np.stack([f[::2,::2,::2] for f in separated]), free=free.astype(np.uint8), headX=head_x.astype(np.float32),
        metadata=dict(shape=list(field.shape), originMm=fo.tolist(), spacingMm=spacing,
        crop=dict(xMinMm=float(fo[0]),yMaxMm=float(fo[1]+(field.shape[1]-1)*spacing)),
        method='smooth source-labelled elliptic toe sweeps; continuous field bisectors; rounded tips; C1 forefoot-to-toe blend',
        toeProfiles=profiles, neurovascularConstraintVertices=neurovascular_points, intendedGapMm=gap, sourceRepairVoxels=0, carvedBoundaryVoxelCount=0))

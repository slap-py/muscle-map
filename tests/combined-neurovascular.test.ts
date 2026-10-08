import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { combineRegionPacks, assemblyOffsets } from '../src/regions/combine';
import { clipGeometryAboveY } from '../src/regions/combinedGeometry';
import { lowerLegPack } from '../src/regions/lower-leg';
import { leftLowerLegPack } from '../src/regions/left-lower-leg';
import leftUpperLegPack from '../src/regions/upper-leg/left';
import rightUpperLegPack from '../src/regions/upper-leg/right';
import type { RegionPack } from '../src/regions';
import { createRegionAssetLoaders } from '../src/assets';
import { disposeObject } from '../src/viewerResources';
import { resolveStructureId } from '../src/viewerSession';
import type { Tissue } from '../src/data';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function section(pack: RegionPack, id: string, tissue: Tissue, source: string): RegionPack {
  const structure = { ...pack.structures.find(s => s.tissue === tissue)!, id, name: 'Shared structure' };
  return {
    ...pack, structures: [structure], byId: { [id]: structure },
    neurovascularSources: { [id]: source },
    neurovascularCropYMaxMm: pack.id === 'lower-leg' ? 80 - assemblyOffsets[pack.id][1] : undefined,
    createAnkle: () => {
      const root = new THREE.Group(), group = new THREE.Group(); root.add(group);
      return { root, parts: new Map([[id, { id, group, meshes: [] as THREE.Mesh[], anchor: new THREE.Vector3() }]]) };
    },
    loaders: createRegionAssetLoaders([structure], { bones: [], muscles: [], exterior: [], neurovascular: [id] }),
  };
}
function scene(pack: RegionPack, min: number, max: number) {
  const offset = new THREE.Vector3(...assemblyOffsets[pack.id]);
  const geometry = new THREE.BoxGeometry(.004, (max - min) / 1000, .004);
  geometry.translate(-offset.x / 1000, ((min + max) / 2 - offset.y) / 1000, -offset.z / 1000);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.userData.atlasId = pack.structures[0].id;
  const group = new THREE.Group(); group.add(mesh); return group;
}
const worldBounds = (mesh: THREE.Mesh) => {
  mesh.updateWorldMatrix(true, false);
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
};

describe('joined neurovascular anatomy', () => {
  it('joins source sections with different local IDs, keeps sides separate and retains both area memberships', () => {
    const combined = combineRegionPacks([lowerLegPack, leftLowerLegPack, rightUpperLegPack, leftUpperLegPack]);
    for (const [lower, upper] of [['lower-leg', 'right-upper-leg'], ['left-lower-leg', 'left-upper-leg']]) {
      const id = lower + ':vein-great-saphenous';
      expect(combined.structures.filter(s => s.id === id && s.name === 'Great saphenous vein')).toHaveLength(1);
      expect(resolveStructureId(combined, upper + ':great-saphenous-vein')).toBe(id);
      expect(combined.atlasIds(lower).has(id)).toBe(true);
      expect(combined.atlasIds(upper).has(id)).toBe(true);
      expect(combined.byId[upper + ':great-saphenous-vein']).toBeUndefined();
      expect(combined.structureRegions![id]).toHaveLength(2);
      expect(combined.byId[id].description).toBe((upper.startsWith('left') ? leftUpperLegPack : rightUpperLegPack).byId['great-saphenous-vein'].description);
      expect(combined.byId[id].facts!.length).toBeGreaterThanOrEqual(2);
      expect(new Set(combined.byId[id].references!.map(r => r.url)).size).toBe(combined.byId[id].references!.length);
      expect(resolveStructureId(combined, upper + ':tibial-nerve')).toBe(lower + ':nerve-tibial');
    }
    expect(combined.structures.filter(s => s.tissue === 'vein')).toHaveLength(42);
  });
  for (const tissue of ['artery', 'vein', 'nerve'] as const) {
    it('assembles both ' + tissue + ' sections for picking, framing and isolation without double overlap', async () => {
      const lower = section(lowerLegPack, 'distal', tissue, 'Shared.r');
      const upper = section(rightUpperLegPack, 'proximal', tissue, 'Shared.r');
      const combined = combineRegionPacks([upper, lower]);
      const model = combined.createAnkle();
      try {
        const report = await combined.loaders.loadNeurovascularAssets(model.parts, undefined, async url =>
          url === lower.assets.neurovascular ? scene(lower, 50, 80) : scene(upper, 70, 100));
        expect(report.loaded).toEqual(['lower-leg:distal']);
        expect(report.fallback).toEqual([]);
        const part = model.parts.get('lower-leg:distal')!;
        expect(part.meshes).toHaveLength(2);
        expect(part.group.userData.unavailable).toBe(false);
        const bounds = part.meshes.map(worldBounds).sort((a, b) => a.min.y - b.min.y);
        expect(bounds[0].min.y).toBeCloseTo(50, 3);
        expect(bounds[0].max.y).toBeCloseTo(80, 3);
        expect(bounds[1].min.y).toBeCloseTo(80, 3);
        expect(bounds[1].max.y).toBeCloseTo(100, 3);
        expect(part.anchor.y).toBeCloseTo(75, 3);
        for (const y of [60, 95]) {
          const hits = new THREE.Raycaster(new THREE.Vector3(20, y, 0), new THREE.Vector3(-1, 0, 0)).intersectObjects(part.meshes);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits.every(hit => hit.object.userData.id === part.id)).toBe(true);
        }
        expect(part.meshes.every(mesh => mesh.userData.atlasId === part.id && mesh.userData.thinStructure)).toBe(true);
        part.group.visible = false;
        expect(part.meshes.every(mesh => mesh.parent!.parent === part.group)).toBe(true);
      } finally { disposeObject(model.root); }
    });
  }
  for (const failed of ['lower', 'upper', 'both']) {
    it('keeps available sections usable when ' + failed + ' assets fail', async () => {
      const lower = section(lowerLegPack, 'distal', 'vein', 'Shared.r');
      const upper = section(rightUpperLegPack, 'proximal', 'vein', 'Shared.r');
      const combined = combineRegionPacks([lower, upper]), model = combined.createAnkle();
      try {
        const report = await combined.loaders.loadNeurovascularAssets(model.parts, undefined, async url => {
          const isLower = url === lower.assets.neurovascular;
          if (failed === 'both' || (isLower ? failed === 'lower' : failed === 'upper')) throw new Error('Unavailable');
          return isLower ? scene(lower, 50, 80) : scene(upper, 70, 100);
        });
        const part = model.parts.get('lower-leg:distal')!;
        expect(report.loaded).toEqual(failed === 'both' ? [] : [part.id]);
        expect(report.fallback).toEqual(failed === 'both' ? [part.id] : []);
        expect(part.group.userData.unavailable).toBe(failed === 'both');
        expect(part.meshes).toHaveLength(failed === 'both' ? 0 : 1);
        if (failed === 'lower') expect(worldBounds(part.meshes[0]).min.y).toBeCloseTo(70, 3);
      } finally { disposeObject(model.root); }
    });
  }
  for (const [lower, upper] of [[lowerLegPack, rightUpperLegPack], [leftLowerLegPack, leftUpperLegPack]]) {
    it('joins the shipped ' + lower.id + ' assets at their registered crop boundary', async () => {
      const combined = combineRegionPacks([lower, upper]), model = combined.createAnkle();
      try {
        const report = await combined.loaders.loadNeurovascularAssets(model.parts, undefined, async url => {
          const bytes = readFileSync('public' + url);
          return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
        });
        expect(report.loaded).toHaveLength(80);
        expect(report.fallback).toEqual([]);
        expect(report.warnings).toEqual([]);
        const seam = lower.neurovascularCropYMaxMm! + assemblyOffsets[lower.id][1];
        for (const local of ['vein-great-saphenous','vein-small-saphenous','nerve-saphenous','nerve-tibial']) {
          const part = model.parts.get(lower.id + ':' + local)!;
          expect(part.group.userData.unavailable).toBe(false);
          expect(part.meshes.length).toBeGreaterThan(0);
          for (const mesh of part.meshes) {
            expect(mesh.userData.id).toBe(part.id);
            expect(mesh.geometry.boundsTree).toBeDefined();
            const bounds = worldBounds(mesh);
            const belongsToLower = Math.abs(mesh.parent!.position.y - assemblyOffsets[lower.id][1]) < .001;
            if (belongsToLower) expect(bounds.max.y).toBeLessThanOrEqual(seam + .001);
            else expect(bounds.min.y).toBeGreaterThanOrEqual(seam - .001);
          }
          const bounds = part.meshes.reduce((box, mesh) => box.union(worldBounds(mesh)),new THREE.Box3());
          expect(part.anchor.distanceTo(bounds.getCenter(new THREE.Vector3()))).toBeLessThan(.001);
        }
      } finally { disposeObject(model.root); }
    });
  }
  it('uses exact source identity rather than display names or anatomical continuations', () => {
    const lower = section(lowerLegPack, 'distal', 'artery', 'Anterior tibial artery.r');
    const upper = section(rightUpperLegPack, 'proximal', 'artery', 'Popliteal artery.r');
    expect(combineRegionPacks([lower, upper]).structures).toHaveLength(2);
  });
});

describe('registered crop geometry', () => {
  it('clips crossing triangles with attributes and preserves winding', () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0,-1,0, 2,1,0, 0,1,0], 3));
    source.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,1, 0,1], 2));
    source.computeVertexNormals();
    const clipped = clipGeometryAboveY(source, 0)!;
    expect(clipped.getAttribute('position').count).toBe(6);
    expect(clipped.boundingBox!.min.y).toBe(0);
    expect(clipped.getAttribute('uv').count).toBe(6);
    const positions = clipped.getAttribute('position');
    for (let i = 0; i < positions.count; i += 3) {
      const [a,b,c] = [i,i+1,i+2].map(j => new THREE.Vector3().fromBufferAttribute(positions,j));
      expect(b.sub(a).cross(c.sub(a)).z).toBeGreaterThan(0);
    }
    source.dispose(); clipped.dispose();
  });
  it('keeps complete upper sections and removes complete overlap sections', () => {
    const geometry = new THREE.BoxGeometry(1,2,1);
    expect(clipGeometryAboveY(geometry,-2)).toBeUndefined();
    const empty = clipGeometryAboveY(geometry,2)!;
    expect(empty.getAttribute('position').count).toBe(0);
    geometry.dispose(); empty.dispose();
  });
});

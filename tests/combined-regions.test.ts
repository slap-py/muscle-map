import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fs from 'node:fs';
import { combineRegionPacks, assemblyOffsets } from '../src/regions/combine';
import { lowerLegPack } from '../src/regions/lower-leg';
import { leftLowerLegPack } from '../src/regions/left-lower-leg';
import leftUpperLegPack from '../src/regions/upper-leg/left';
import rightUpperLegPack from '../src/regions/upper-leg/right';
import { disposeObject } from '../src/viewerResources';
import { regionHref, regionsHref, parseRoute } from '../src/router';

const packs = [lowerLegPack, leftLowerLegPack, leftUpperLegPack, rightUpperLegPack];
const ids = packs.map(pack => pack.id);
describe('multiple body regions', () => {
  it('keeps single-region URLs and canonicalizes combined URLs with deep links', () => {
    expect(regionsHref([])).toBe('#/browser');
    expect(regionsHref(['lower-leg', 'lower-leg'], 'talus')).toBe(regionHref('lower-leg', 'talus'));
    const url = regionsHref(['left-upper-leg', 'left-lower-leg', 'left-upper-leg'], 'left-upper-leg:adductor-longus');
    expect(parseRoute(url, ids)).toEqual({ kind: 'regions', regionIds: ['left-lower-leg', 'left-upper-leg'], select: 'left-upper-leg:adductor-longus' });
    expect(parseRoute('#/regions?region=lower-leg', ids)).toEqual({ kind: 'region', regionId: 'lower-leg', select: null });
    for (const url of ['#/regions', '#/regions?region=unknown', '#/regions?region=lower-leg&region=unknown'])
      expect(parseRoute(url, ids)).toEqual({ kind: 'hub' });
  });
  it('restores the frozen source frames including the mirrored left lower leg', () => {
    const bones = JSON.parse(fs.readFileSync('public/models/bones.manifest.json', 'utf8'));
    const [x, y, z] = bones.registration.sourceTalusDatumMeters;
    expect(assemblyOffsets['lower-leg']).toEqual([-y * 1000, z * 1000, -x * 1000]);
    expect(assemblyOffsets['left-lower-leg']).toEqual([-y * 1000, z * 1000, x * 1000]);
    for (const side of ['left', 'right']) {
      const manifest = JSON.parse(fs.readFileSync(`public/models/${side}-upper-leg/manifest.json`, 'utf8'));
      const [x, y, z] = manifest.registration.datumSourceMeters;
      expect(assemblyOffsets[`${side}-upper-leg`]).toEqual([-y * 1000, z * 1000, -x * 1000]);
    }
  });
  it('creates a unique catalog, shares complete shafts and keeps opposite sides separate', () => {
    const combined = combineRegionPacks(packs);
    expect(new Set(combined.structures.map(s => s.id)).size).toBe(combined.structures.length);
    expect(combined.byId['left-lower-leg:tibia']).toBeDefined();
    expect(combined.byId['lower-leg:tibia']).toBeDefined();
    expect(combined.byId['left-upper-leg:tibia']).toBeUndefined();
    expect(combined.byId['right-upper-leg:tibia']).toBeUndefined();
    expect(combined.structures.filter(s => s.id.endsWith(':sacrum'))).toHaveLength(1);
    expect(combined.atlasIds('left-upper-leg').has('left-lower-leg:tibia')).toBe(true);
    expect(combined.atlasIds('left-lower-leg').has('lower-leg:tibia')).toBe(false);
    expect(combined.relatedIds('left-lower-leg:tibia').has('left-upper-leg:gracilis')).toBe(true);
    expect(combined.relatedIds('left-lower-leg:tibia').has('right-upper-leg:gracilis')).toBe(false);
    expect(combined.structureCounts.total).toBe(combined.structures.length);
    expect(combined.atlasAreas.map(area => area.id).length).toBe(new Set(combined.atlasAreas.map(area => area.id)).size);
  });
  it('loads both regions independently and namespaces reports, picking and anchors', async () => {
    const combined = combineRegionPacks([leftUpperLegPack, rightUpperLegPack]);
    const model = combined.createAnkle();
    const requested: string[] = [];
    const scene = async (url: string) => {
      requested.push(url);
      const result = new THREE.Group();
      const pack = url.includes('left-upper-leg') ? leftUpperLegPack : rightUpperLegPack;
      for (const structure of pack.structures.filter(s => ['bone', 'cartilage', 'ligament', 'fascia'].includes(s.tissue))) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, .02), new THREE.MeshStandardMaterial());
        mesh.userData.atlasId = structure.id;
        result.add(mesh);
      }
      return result;
    };
    try {
      const report = await combined.loaders.loadBoneAssets(model.parts, undefined, scene);
      expect(requested.sort()).toEqual([leftUpperLegPack.assets.bones, rightUpperLegPack.assets.bones].sort());
      expect(report.fallback).toEqual([]);
      for (const side of ['left', 'right']) {
        const id = `${side}-upper-leg:femur`, part = model.parts.get(id)!;
        expect(part.meshes[0].userData.id).toBe(id);
        expect(part.anchor.toArray()).toEqual(assemblyOffsets[`${side}-upper-leg`]);
        expect(combined.connectionsFor(model.parts, `${side}-upper-leg:adductor-longus`).every(c => c.record.structureId.startsWith(`${side}-upper-leg:`))).toBe(true);
      }
      const connections = combined.connectionsFor(model.parts, 'left-upper-leg:adductor-longus');
      expect(connections.length).toBeGreaterThan(0);
      const connection = connections[0];
      expect(combined.attachmentSources).toHaveProperty(connection.record.sourceIds[0]);
      expect(connection.footprint.centerMm[1]).toBeGreaterThan(600);
      const decal = combined.footprintDecal(model.parts, connection);
      expect(decal?.userData.boneId).toBe(connection.footprint.structureId);
      if (decal) disposeObject(decal);
    } finally { disposeObject(model.root); }
  });
  it('handles empty, duplicate and single-region selections', () => {
    expect(() => combineRegionPacks([])).toThrow(/at least one/);
    expect(() => combineRegionPacks([lowerLegPack, lowerLegPack])).toThrow(/Duplicate/);
    expect(combineRegionPacks([lowerLegPack])).toBe(lowerLegPack);
  });
});

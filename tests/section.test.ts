import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defaultSection, hiddenSide, isMostlyClosed, isClipped, isFullyClipped, normalizeSection, sectionPlanes, updateSectionPlane, withSectionFill } from '../src/section';

const bounds = new THREE.Box3(new THREE.Vector3(-10, 0, -20), new THREE.Vector3(30, 100, 20));
const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const box = (min: THREE.Vector3, max: THREE.Vector3) => new THREE.Box3(min, max);

beforeEach(() => { sectionPlanes.length = 0; });

describe('section planes', () => {
  it('is empty when off', () => {
    updateSectionPlane(defaultSection(), bounds);
    expect(sectionPlanes).toHaveLength(0);
    expect(isClipped(at(0, 0, 0))).toBe(false);
  });

  it.each([
    ['sagittal', at(0, 50, 10), at(0, 50, -10)],
    ['coronal', at(20, 50, 0), at(0, 50, 0)],
    ['transverse', at(10, 80, 0), at(10, 20, 0)],
  ] as const)('%s hides the +axis side by default and the other side when flipped', (axis, hidden, kept) => {
    updateSectionPlane({ axis, position: 0.5, flipped: false }, bounds);
    expect(sectionPlanes).toHaveLength(1);
    expect(isClipped(hidden)).toBe(true);
    expect(isClipped(kept)).toBe(false);
    updateSectionPlane({ axis, position: 0.5, flipped: true }, bounds);
    expect(sectionPlanes).toHaveLength(1);
    expect(isClipped(hidden)).toBe(false);
    expect(isClipped(kept)).toBe(true);
  });

  it('places the plane as a fraction of the bounds', () => {
    updateSectionPlane({ axis: 'transverse', position: 0.25, flipped: false }, bounds);
    expect(sectionPlanes[0].normal.toArray()).toEqual([0, -1, 0]);
    expect(sectionPlanes[0].constant).toBeCloseTo(25);
    expect(isClipped(at(0, 24, 0))).toBe(false);
    expect(isClipped(at(0, 26, 0))).toBe(true);
  });

  it('at 0% and 100% hides everything or nothing', () => {
    const whole = box(bounds.min.clone().addScalar(1), bounds.max.clone().addScalar(-1));
    updateSectionPlane({ axis: 'coronal', position: 0, flipped: false }, bounds);
    expect(isFullyClipped(whole)).toBe(true);
    updateSectionPlane({ axis: 'coronal', position: 1, flipped: false }, bounds);
    expect(isFullyClipped(whole)).toBe(false);
    expect(isClipped(bounds.max.clone().addScalar(-0.01))).toBe(false);
  });

  it('only calls a box fully clipped when it lies entirely on the hidden side', () => {
    updateSectionPlane({ axis: 'transverse', position: 0.5, flipped: false }, bounds);
    expect(isFullyClipped(box(at(0, 60, 0), at(1, 70, 1)))).toBe(true);
    expect(isFullyClipped(box(at(0, 40, 0), at(1, 60, 1)))).toBe(false);
    expect(isFullyClipped(box(at(0, 10, 0), at(1, 20, 1)))).toBe(false);
  });

  it('names the hidden side', () => {
    expect(hiddenSide({ axis: 'coronal', position: 0.5, flipped: false })).toBe('anterior');
    expect(hiddenSide({ axis: 'coronal', position: 0.5, flipped: true })).toBe('posterior');
    expect(hiddenSide({ axis: 'sagittal', position: 0.5, flipped: false })).toBe('right');
    expect(hiddenSide({ axis: 'transverse', position: 0.5, flipped: true })).toBe('inferior');
  });

  it('normalizes saved values', () => {
    expect(normalizeSection(undefined)).toEqual(defaultSection());
    expect(normalizeSection({ axis: 'bogus' as never, position: 4, flipped: true })).toEqual({ axis: 'off', position: 1, flipped: true });
  });
});

describe('withSectionFill', () => {
  it('chains the original onBeforeCompile and extends the cache key', () => {
    const material = new THREE.MeshStandardMaterial();
    let original = 0;
    material.onBeforeCompile = shader => { original++; shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n// original'); };
    const before = material.customProgramCacheKey();
    withSectionFill(material, new THREE.Color('#804020'));
    const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: '#include <common>\n#include <dithering_fragment>', vertexShader: '' };
    material.onBeforeCompile(shader as never, undefined as never);
    expect(original).toBe(1);
    expect(shader.fragmentShader).toContain('// original');
    expect(shader.fragmentShader).toContain('!gl_FrontFacing');
    expect(shader.uniforms.sectionColor).toBeDefined();
    expect(material.customProgramCacheKey()).toBe(before + '|section-fill-v4');
  });

  it('wraps only once and updates the color', () => {
    const material = new THREE.MeshStandardMaterial();
    withSectionFill(material, new THREE.Color('#ff0000'));
    const wrapped = material.onBeforeCompile;
    withSectionFill(material, new THREE.Color('#00ff00'));
    expect(material.onBeforeCompile).toBe(wrapped);
    expect(material.userData.sectionFill.value.getHexString()).toBe('00ff00');
  });
});

describe('isMostlyClosed', () => {
  it('accepts a closed solid even with split vertices and rejects an open sheet', () => {
    const box = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
    expect(isMostlyClosed(box)).toBe(true);
    expect(isMostlyClosed(new THREE.PlaneGeometry(2, 2, 4, 4))).toBe(false);
  });
});

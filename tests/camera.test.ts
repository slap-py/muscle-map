import { afterAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCameraControls, lookAtNearest, updateCamera, zoomBy } from "../src/camera";

import { cameraPreset } from "../src/coordinates";

// The controller permits a headless camera; these rectangles are only for DOM input.
vi.stubGlobal(
  "DOMRect",
  class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
  },
);
afterAll(() => vi.unstubAllGlobals());
function setup() {
  const camera = new THREE.PerspectiveCamera(34, 1, 10, 10000);
  camera.position.set(0, 0, 1000);
  const controls = createCameraControls(camera);
  void controls.setLookAt(0, 0, 1000, 0, 0, 0, false);
  controls.update(0);
  return { camera, controls };
}
describe("Cell Explorer camera behavior", () => {
  it("eases zoom over multiple frames and converges without overshoot", () => {
    const { camera, controls } = setup();
    expect(controls.smoothTime).toBe(0.25);
    expect(controls.dollyToCursor).toBe(true);
    zoomBy(controls, 0.5);
    expect(camera.position.z).toBeCloseTo(1000);
    updateCamera(controls, camera, 1 / 60);
    expect(camera.position.z).toBeGreaterThan(500);
    expect(camera.position.z).toBeLessThan(1000);
    let previous = camera.position.z;
    for (let i = 0; i < 180; i++) {
      updateCamera(controls, camera, 1 / 60);
      expect(camera.position.z).toBeLessThanOrEqual(previous + 1e-9);
      expect(camera.position.z).toBeGreaterThanOrEqual(500 - 1e-9);
      previous = camera.position.z;
    }
    expect(camera.position.z).toBeCloseTo(500, 4);
  });
  it("accumulates rapid zoom clicks and respects distance limits", () => {
    const { camera, controls } = setup();
    zoomBy(controls, 0.5);
    zoomBy(controls, 0.5);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(250);
    zoomBy(controls, 1000);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(3000);
    zoomBy(controls, 0.000001);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(2);
    for (let i = 0; i < 240; i++) updateCamera(controls, camera, 1 / 60);
    expect(camera.near).toBeCloseTo(0.05);
    expect(camera.far).toBeGreaterThan(3000);
  });
  it("uses elapsed time for similar convergence at different frame rates", () => {
    const a = setup(),
      b = setup();
    zoomBy(a.controls, 0.5);
    zoomBy(b.controls, 0.5);
    for (let i = 0; i < 30; i++) updateCamera(a.controls, a.camera, 1 / 30);
    for (let i = 0; i < 120; i++) updateCamera(b.controls, b.camera, 1 / 120);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1);
  });
});

describe("shortest camera view transitions", () => {
  it("takes at most half a turn from wrapped and multi-orbit headings to every compass view", () => {
    for (const turns of [-4, 0, 5]) for (const degrees of [-179, -90, 0, 90, 179]) {
      for (const view of ["foot", "medial", "lateral", "anterior", "posterior", "dorsal", "plantar"]) {
        const { camera, controls } = setup();
        controls.minPolarAngle = 0.001;
        controls.maxPolarAngle = Math.PI - 0.001;
        void controls.rotateTo(turns * Math.PI * 2 + THREE.MathUtils.degToRad(degrees), 1.4, false);
        controls.update(0);
        const before = camera.position.clone();
        const { position, target } = cameraPreset(view, 1);
        void lookAtNearest(controls, position, target);
        expect(camera.position.distanceTo(before)).toBe(0);
        const start = controls.getSpherical(new THREE.Spherical(), false).theta;
        const destination = controls.getSpherical(new THREE.Spherical(), true).theta;
        expect(Math.abs(destination - start)).toBeLessThanOrEqual(Math.PI + 1e-9);
        let previous = start, travel = 0;
        for (let i = 0; i < 180; i++) {
          updateCamera(controls, camera, 1 / 60);
          const current = controls.getSpherical(new THREE.Spherical(), false).theta;
          travel += Math.abs(current - previous);
          previous = current;
        }
        expect(travel).toBeLessThanOrEqual(Math.PI + 1e-6);
        expect(camera.position.distanceTo(position)).toBeLessThan(0.01);
        expect(controls.getTarget(new THREE.Vector3(), false).distanceTo(target)).toBeLessThan(0.01);
        controls.dispose();
      }
    }
  });
  it("chooses the closest destination from the current frame during rapid view changes", () => {
    const { camera, controls } = setup();
    void controls.rotateTo(5 * Math.PI * 2 + 3.1, 1.4, false);
    controls.update(0);
    for (const view of ["lateral", "medial", "posterior", "anterior"]) {
      const { position, target } = cameraPreset(view, 1);
      void lookAtNearest(controls, position, target);
      const current = controls.getSpherical(new THREE.Spherical(), false).theta;
      const end = controls.getSpherical(new THREE.Spherical(), true).theta;
      expect(Math.abs(end - current)).toBeLessThanOrEqual(Math.PI + 1e-9);
      for (let i = 0; i < 5; i++) updateCamera(controls, camera, 1 / 60);
    }
    for (let i = 0; i < 180; i++) updateCamera(controls, camera, 1 / 60);
    expect(camera.position.distanceTo(cameraPreset("anterior", 1).position)).toBeLessThan(0.01);
    controls.dispose();
  });
  it("supports immediate orientation for reduced motion", () => {
    const { camera, controls } = setup();
    const { position, target } = cameraPreset("medial", 1);
    void lookAtNearest(controls, position, target, false);
    controls.update(0);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-9);
    controls.dispose();
  });
});

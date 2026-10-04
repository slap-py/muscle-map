import { afterAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCameraControls, updateCamera, zoomBy } from "../src/camera";

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
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const controls = createCameraControls(camera);
  void controls.setLookAt(0, 0, 10, 0, 0, 0, false);
  controls.update(0);
  return { camera, controls };
}
describe("Cell Explorer camera behavior", () => {
  it("eases zoom over multiple frames and converges without overshoot", () => {
    const { camera, controls } = setup();
    expect(controls.smoothTime).toBe(0.25);
    expect(controls.dollyToCursor).toBe(true);
    zoomBy(controls, 0.5);
    expect(camera.position.z).toBeCloseTo(10);
    updateCamera(controls, camera, 1 / 60);
    expect(camera.position.z).toBeGreaterThan(5);
    expect(camera.position.z).toBeLessThan(10);
    let previous = camera.position.z;
    for (let i = 0; i < 180; i++) {
      updateCamera(controls, camera, 1 / 60);
      expect(camera.position.z).toBeLessThanOrEqual(previous + 1e-9);
      expect(camera.position.z).toBeGreaterThanOrEqual(5 - 1e-9);
      previous = camera.position.z;
    }
    expect(camera.position.z).toBeCloseTo(5, 4);
  });
  it("accumulates rapid zoom clicks and respects distance limits", () => {
    const { camera, controls } = setup();
    zoomBy(controls, 0.5);
    zoomBy(controls, 0.5);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(2.5);
    zoomBy(controls, 1000);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(30);
    zoomBy(controls, 0.000001);
    expect(
      controls.getPosition(new THREE.Vector3(), true).length(),
    ).toBeCloseTo(0.02);
    for (let i = 0; i < 240; i++) updateCamera(controls, camera, 1 / 60);
    expect(camera.near).toBeCloseTo(0.0005);
    expect(camera.far).toBeGreaterThan(10);
  });
  it("uses elapsed time for similar convergence at different frame rates", () => {
    const a = setup(),
      b = setup();
    zoomBy(a.controls, 0.5);
    zoomBy(b.controls, 0.5);
    for (let i = 0; i < 30; i++) updateCamera(a.controls, a.camera, 1 / 30);
    for (let i = 0; i < 120; i++) updateCamera(b.controls, b.camera, 1 / 120);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(0.01);
  });
});

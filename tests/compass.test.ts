import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { directions, projectDirection } from "../src/compass";
describe("anatomical compass", () => {
  it("preserves opposite anatomical axes and labels the right foot consistently", () => {
    expect(directions.find((d) => d.id === "medial")!.v).toEqual([1, 0, 0]);
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.7, -1.2, 0.2),
    );
    for (let i = 0; i < 6; i += 2) {
      const a = projectDirection(directions[i].v, q),
        b = projectDirection(directions[i + 1].v, q);
      expect(a.clone().add(b).length()).toBeCloseTo(0);
      expect(a.length()).toBeCloseTo(1);
    }
  });
  it("puts the medial axis toward the viewer from a medial camera", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const v = projectDirection([1, 0, 0], camera.quaternion);
    expect(v.z).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0);
  });
});

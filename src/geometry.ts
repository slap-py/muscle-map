import * as THREE from "three";
import type { Point } from "./foot";

/** Smooth closed loft: [longitudinal position, centerX, centerY, halfWidth, halfDepth]. */
export type Section = [number, number, number, number, number];
export function loft(
  sections: Section[],
  axis: "z" | "y" = "z",
  square = 0.95,
) {
  const curve = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s[1], s[2], s[0])),
  );
  const profile = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s[3], s[4], 0)),
  );
  const n = 64,
    k = 32,
    points: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (sections.length - 1),
      a = Math.min(sections.length - 2, Math.floor(t)),
      u = t - a;
    const c = curve.getPoint(i / n),
      shape = profile.getPoint(i / n),
      w = Math.max(0.001, shape.x),
      d = Math.max(0.001, shape.y);
    for (let j = 0; j <= k; j++) {
      const theta = (j / k) * Math.PI * 2,
        cos = Math.cos(theta),
        sin = Math.sin(theta);
      const x = c.x + Math.sign(cos) * Math.pow(Math.abs(cos), square) * w;
      const y = c.y + Math.sign(sin) * Math.pow(Math.abs(sin), square) * d;
      points.push(...(axis === "z" ? [x, y, c.z] : [x, c.z, y]));
      if (i < n && j < k) {
        const q = i * (k + 1) + j,
          r = q + k + 1;
        indices.push(
          ...(axis === "z"
            ? [q, q + 1, r, r, q + 1, r + 1]
            : [q, r, q + 1, r, r + 1, q + 1]),
        );
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function ribbon(path: Point[], width: number, thickness = 0.012, surfaceNormal?: Point) {
  const curve = new THREE.CatmullRomCurve3(
      path.map((p) => new THREE.Vector3(...p)),
    ),
    n = 48,
    positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const c = curve.getPoint(i / n),
      t = curve.getTangent(i / n);
    const reference = surfaceNormal ? new THREE.Vector3(...surfaceNormal).normalize() : new THREE.Vector3(0,1,0);
    let side = surfaceNormal ? new THREE.Vector3().crossVectors(reference,t) : reference.clone().addScaledVector(t,-reference.dot(t));
    if(side.lengthSq()<1e-8) side = new THREE.Vector3().crossVectors(t, Math.abs(t.x)<0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1));
    side.normalize().multiplyScalar(width/2);
    const normal = new THREE.Vector3()
      .crossVectors(t, side)
      .normalize()
      .multiplyScalar(thickness);
    for (const [s, d] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      positions.push(
        ...c
          .clone()
          .addScaledVector(side, s)
          .addScaledVector(normal, d)
          .toArray(),
      );
    if (i < n)
      for (let j = 0; j < 4; j++) {
        const a = i * 4 + j,
          b = i * 4 + ((j + 1) % 4);
        indices.push(a, b, a + 4, b, b + 4, a + 4);
      }
  }
  // Close both ends of the flattened band.
  indices.push(0,2,1,0,3,2,n*4,n*4+1,n*4+2,n*4,n*4+2,n*4+3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

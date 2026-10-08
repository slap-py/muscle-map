import * as THREE from 'three';

/** Keep the upper side of a registered crop plane, interpolating cut triangles.
 * No connector geometry is added between independently authored source regions.
 * Undefined means the original geometry already lies entirely above the plane.
 */
export function clipGeometryAboveY(source: THREE.BufferGeometry, y: number): THREE.BufferGeometry | undefined {
  source.computeBoundingBox();
  if (source.boundingBox!.min.y >= y) return;
  const attributes = Object.entries(source.attributes);
  const output = attributes.map(() => [] as number[]);
  const positionIndex = attributes.findIndex(([name]) => name === 'position');
  const index = source.index;
  const count = index?.count ?? source.getAttribute('position').count;
  const vertex = (i: number) => attributes.map(([, attribute]) =>
    Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(i, component)));
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(j => vertex(index ? index.getX(i + j) : i + j));
    const polygon: number[][][] = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const ay = a[positionIndex][1], by = b[positionIndex][1];
      if (ay >= y) polygon.push(a);
      if ((ay >= y) !== (by >= y)) {
        const t = (y - ay) / (by - ay);
        const cut = a.map((values, k) => values.map((v, component) => v + t * (b[k][component] - v)));
        cut[positionIndex][1] = y;
        polygon.push(cut);
      }
    }
    for (let j = 1; j + 1 < polygon.length; j++) {
      const points = [polygon[0], polygon[j], polygon[j + 1]];
      const [a, b, c] = points.map(p => new THREE.Vector3(...p[positionIndex] as [number, number, number]));
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-16) continue;
      for (const point of points) point.forEach((values, k) => output[k].push(...values));
    }
  }
  const geometry = new THREE.BufferGeometry();
  attributes.forEach(([name, attribute], k) => geometry.setAttribute(name, new THREE.Float32BufferAttribute(output[k], attribute.itemSize)));
  geometry.userData = { ...source.userData };
  if (geometry.getAttribute('normal')) geometry.normalizeNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

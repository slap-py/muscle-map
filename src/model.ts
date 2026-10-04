import * as THREE from "three";
import { allById as byId, colors } from "./data";
import { buildFoot } from "./foot";

type P = [number, number, number];
export const kneeHeight = 5.05;
export function bendPoint(x: number, y: number, z: number, angle: number): P {
  // A simple hinge, with a narrow blending zone for tissues crossing the knee.
  const weight = THREE.MathUtils.smoothstep(kneeHeight + 0.18 - y, 0, 0.42);
  const a = angle * weight,
    dy = y - kneeHeight;
  return [
    x,
    kneeHeight + dy * Math.cos(a) - z * Math.sin(a),
    dy * Math.sin(a) + z * Math.cos(a),
  ];
}
export interface Part {
  id: string;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  anchor: THREE.Vector3;
}
export function createLeg() {
  const root = new THREE.Group();
  const parts = new Map<string, Part>();
  for (const d of Object.values(byId)) {
    const group = new THREE.Group();
    root.add(group);
    parts.set(d.id, {
      id: d.id,
      group,
      meshes: [],
      anchor: new THREE.Vector3(),
    });
  }
  const muscleColors: Record<string, string> = {
    rectus: "#b76755",
    lateralis: "#b86e60",
    medialis: "#c77a65",
    intermedius: "#a95c4d",
    sartorius: "#d4977b",
    adductor: "#a96359",
    biceps: "#ae6557",
    semitendinosus: "#c17b63",
    semimembranosus: "#a65e51",
    gastrocnemius: "#b86552",
    soleus: "#a86c60",
    anterior: "#ba7f69",
    fibularis: "#b47762",
  };
  function add(id: string, geo: THREE.BufferGeometry, fiber = false) {
    const d = byId[id];
    const mat = new THREE.MeshStandardMaterial({
      color: fiber ? "#edb5a0" : (muscleColors[id] ?? colors[d.tissue]),
      roughness: d.tissue === "bone" ? 0.6 : 0.78,
      metalness: 0,
    });
    if (fiber) {
      mat.transparent = true;
      mat.opacity = 0.25;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = {
      id,
      fiber,
      rest: Float32Array.from(
        geo.attributes.position.array as ArrayLike<number>,
      ),
    };
    mesh.castShadow = !fiber;
    mesh.receiveShadow = true;
    const part = parts.get(id)!;
    part.group.add(mesh);
    part.meshes.push(mesh);
    return mesh;
  }
  function ellipsoid(id: string, position: P, scale: P) {
    const geo = new THREE.SphereGeometry(1, 32, 24);
    geo.scale(...scale);
    geo.translate(...position);
    add(id, geo);
  }
  function tube(id: string, points: P[], radius: number) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    add(id, new THREE.TubeGeometry(curve, 40, radius, 12, false));
  }
  function belly(
    id: string,
    points: P[],
    width: number,
    depth: number,
    fibers = true,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const segments = 48,
      sides = 24;
    const frames = curve.computeFrenetFrames(segments, false);
    const positions: number[] = [],
      indices: number[] = [];
    function point(i: number, theta: number) {
      const t = i / segments;
      const radius = 0.07 + 0.93 * Math.pow(Math.sin(Math.PI * t), 0.7);
      return curve
        .getPointAt(t)
        .addScaledVector(frames.normals[i], Math.cos(theta) * width * radius)
        .addScaledVector(frames.binormals[i], Math.sin(theta) * depth * radius);
    }
    for (let i = 0; i <= segments; i++)
      for (let j = 0; j <= sides; j++) {
        positions.push(...point(i, (j / sides) * Math.PI * 2).toArray());
        if (i < segments && j < sides) {
          const a = i * (sides + 1) + j,
            b = a + sides + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    add(id, geo);
    if (fibers)
      for (let j = 0; j < 16; j++) {
        const points = Array.from({ length: 45 }, (_, i) =>
          point(i + 2, (j / 16) * Math.PI * 2),
        );
        add(
          id,
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            44,
            0.007,
            3,
            false,
          ),
          true,
        );
      }
  }
  // Right lower limb: +X medial, +Z anterior. Coordinates are illustrative.
  tube(
    "femur",
    [
      [-0.24, 9.55, 0],
      [-0.28, 8.6, -0.06],
      [-0.08, 6.3, -0.05],
      [0, 5.3, 0],
    ],
    0.18,
  );
  tube(
    "femur",
    [
      [-0.25, 9.4, 0],
      [0.08, 9.65, 0.02],
      [0.48, 9.82, 0.01],
    ],
    0.19,
  );
  ellipsoid("femur", [0.5, 9.82, 0.01], [0.33, 0.34, 0.32]);
  ellipsoid("femur", [-0.38, 9.48, 0], [0.27, 0.36, 0.27]);
  ellipsoid("femur", [-0.23, 5.28, 0], [0.29, 0.33, 0.36]);
  ellipsoid("femur", [0.23, 5.28, 0], [0.29, 0.33, 0.36]);
  tube(
    "tibia",
    [
      [0.08, 4.9, 0],
      [0.08, 4.3, 0.03],
      [0.05, 2.2, 0.03],
      [0.03, 1.02, 0],
    ],
    0.15,
  );
  ellipsoid("tibia", [0.05, 4.85, 0], [0.43, 0.2, 0.32]);
  ellipsoid("tibia", [0.02, 1.08, 0], [0.24, 0.21, 0.25]);
  ellipsoid("tibia", [0.21, 0.93, 0], [0.1, 0.2, 0.13]);
  tube(
    "fibula",
    [
      [-0.44, 4.67, -0.04],
      [-0.46, 3, -0.06],
      [-0.37, 1, -0.03],
    ],
    0.073,
  );
  ellipsoid("fibula", [-0.44, 4.68, -0.04], [0.14, 0.17, 0.15]);
  ellipsoid("fibula", [-0.36, 0.9, -0.03], [0.11, 0.2, 0.15]);
  ellipsoid("patella", [0, 5.08, 0.43], [0.26, 0.3, 0.13]);
  buildFoot(add);
  belly(
    "intermedius",
    [
      [0, 9.1, 0.18],
      [0, 7.6, 0.29],
      [0, 5.6, 0.3],
    ],
    0.31,
    0.26,
  );
  belly(
    "rectus",
    [
      [0.03, 9.5, 0.34],
      [0.04, 7.85, 0.63],
      [0.03, 5.63, 0.45],
    ],
    0.35,
    0.29,
  );
  belly(
    "lateralis",
    [
      [-0.43, 9.25, 0.05],
      [-0.66, 7.8, 0.22],
      [-0.44, 6.4, 0.3],
      [-0.2, 5.52, 0.35],
    ],
    0.39,
    0.31,
  );
  belly(
    "medialis",
    [
      [0.24, 8.9, 0.1],
      [0.4, 7.25, 0.2],
      [0.48, 6.05, 0.37],
      [0.17, 5.5, 0.38],
    ],
    0.33,
    0.29,
  );
  belly(
    "adductor",
    [
      [0.58, 9.48, -0.03],
      [0.65, 8.4, -0.05],
      [0.19, 6.82, -0.04],
    ],
    0.34,
    0.23,
  );
  belly(
    "biceps",
    [
      [-0.2, 9.4, -0.3],
      [-0.53, 7.75, -0.47],
      [-0.42, 5.75, -0.35],
      [-0.44, 4.68, -0.1],
    ],
    0.31,
    0.29,
  );
  belly(
    "semimembranosus",
    [
      [0.3, 9.38, -0.3],
      [0.45, 7.52, -0.28],
      [0.25, 4.8, -0.15],
    ],
    0.3,
    0.23,
  );
  belly(
    "semitendinosus",
    [
      [0.25, 9.43, -0.38],
      [0.31, 7.6, -0.64],
      [0.4, 6.4, -0.46],
      [0.38, 4.6, 0.05],
    ],
    0.23,
    0.22,
  );
  belly(
    "sartorius",
    [
      [-0.55, 9.63, 0.42],
      [-0.37, 8.7, 0.69],
      [0.18, 7.05, 0.68],
      [0.65, 5.63, 0.31],
      [0.39, 4.58, 0.19],
    ],
    0.092,
    0.08,
  );
  belly(
    "soleus",
    [
      [0, 4.57, -0.2],
      [0, 3.5, -0.43],
      [0.02, 1.48, -0.24],
    ],
    0.45,
    0.3,
  );
  belly(
    "gastrocnemius",
    [
      [-0.22, 5.22, -0.25],
      [-0.32, 4.06, -0.7],
      [-0.19, 2.75, -0.52],
      [0, 1.95, -0.32],
    ],
    0.29,
    0.3,
  );
  belly(
    "gastrocnemius",
    [
      [0.25, 5.24, -0.25],
      [0.31, 4.03, -0.76],
      [0.19, 2.58, -0.52],
      [0, 1.95, -0.32],
    ],
    0.32,
    0.3,
  );
  belly(
    "anterior",
    [
      [-0.21, 4.72, 0.22],
      [-0.27, 3.63, 0.41],
      [-0.14, 2.18, 0.3],
      [0.07, 1.13, 0.27],
    ],
    0.2,
    0.18,
  );
  belly(
    "fibularis",
    [
      [-0.53, 4.62, 0.03],
      [-0.65, 3.66, 0.05],
      [-0.5, 2.38, -0.03],
      [-0.4, 1.19, -0.1],
    ],
    0.18,
    0.17,
  );
  belly(
    "achilles",
    [
      [0, 2.65, -0.47],
      [0, 1.78, -0.4],
      [0, 0.48, -0.5],
    ],
    0.11,
    0.075,
    false,
  );
  belly(
    "quadriceps",
    [
      [0, 5.99, 0.4],
      [0, 5.63, 0.43],
      [0, 5.32, 0.44],
    ],
    0.22,
    0.08,
    false,
  );
  belly(
    "patellar",
    [
      [0, 4.92, 0.45],
      [0, 4.69, 0.43],
      [0.02, 4.4, 0.3],
    ],
    0.16,
    0.06,
    false,
  );
  belly(
    "mcl",
    [
      [0.43, 5.44, -0.03],
      [0.48, 5.03, -0.03],
      [0.35, 4.45, 0.03],
    ],
    0.095,
    0.045,
    false,
  );
  tube(
    "lcl",
    [
      [-0.43, 5.41, -0.03],
      [-0.5, 5.04, -0.04],
      [-0.44, 4.65, -0.06],
    ],
    0.045,
  );
  for (const part of parts.values()) {
    const box = new THREE.Box3().setFromObject(part.group);
    box.getCenter(part.anchor);
  }
  function pose(degrees: number) {
    const angle = THREE.MathUtils.degToRad(degrees);
    for (const part of parts.values())
      for (const mesh of part.meshes) {
        const rest = mesh.userData.rest as Float32Array,
          position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i++)
          position.setXYZ(
            i,
            ...bendPoint(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], angle),
          );
        position.needsUpdate = true;
        if (!mesh.userData.fiber) mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      }
  }
  return { root, parts, pose };
}

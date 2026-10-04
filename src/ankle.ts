import * as THREE from "three";
import { structures, byId, colors } from "./data";
import { buildFoot, rays, type Point } from "./foot";
import { ankleDetails } from "./ankleDetails";
import { loft, ribbon, type Section } from "./geometry";

export function createAnkle() {
  const root = new THREE.Group();
  const parts = new Map<
    string,
    {
      id: string;
      group: THREE.Group;
      meshes: THREE.Mesh[];
      anchor: THREE.Vector3;
    }
  >();
  for (const s of structures) {
    const group = new THREE.Group();
    root.add(group);
    parts.set(s.id, {
      id: s.id,
      group,
      meshes: [],
      anchor: new THREE.Vector3(),
    });
  }
  function add(id: string, g: THREE.BufferGeometry, fiber = false) {
    const tissue = byId[id].tissue;
    const mat = new THREE.MeshStandardMaterial({
      color: fiber ? "#e9b19c" : colors[tissue],
      roughness:
        tissue === "cartilage" ? 0.36 : tissue === "bone" ? 0.76 : 0.68,
      side: tissue === "fascia" ? THREE.DoubleSide : THREE.FrontSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.userData = { id, fiber };
    m.castShadow = !fiber;
    m.receiveShadow = true;
    parts.get(id)!.group.add(m);
    parts.get(id)!.meshes.push(m);
    return m;
  }
  const tube = (id: string, path: Point[], r: number, fiber = false) =>
    add(
      id,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))),
        48,
        r,
        12,
        false,
      ),
      fiber,
    );
  function ellipsoid(id: string, p: Point, s: Point) {
    const g = new THREE.SphereGeometry(1, 40, 28);
    g.scale(...s);
    g.translate(...p);
    add(id, g);
  }
  buildFoot(add);
  // Distal shafts flare into the mortise rather than ending in ball-shaped joints.
  add(
    "tibia",
    loft(
      [
        [1.02, 0.04, 0.015, 0.17, 0.19],
        [1.09, 0.035, 0.01, 0.235, 0.205],
        [1.23, 0.025, 0, 0.235, 0.19],
        [1.46, 0.03, -0.01, 0.18, 0.16],
        [2.15, 0.02, -0.035, 0.14, 0.13],
        [3.15, 0.01, -0.04, 0.16, 0.14],
        [3.17, 0.01, -0.04, 0.001, 0.001],
      ],
      "y",
      0.66,
    ),
  );
  add(
    "tibia",
    loft(
      [
        [0.77, 0.225, 0.01, 0.015, 0.03],
        [0.84, 0.235, 0.02, 0.085, 0.125],
        [1.02, 0.225, 0.02, 0.105, 0.17],
        [1.22, 0.17, 0, 0.095, 0.14],
        [1.34, 0.13, 0, 0.01, 0.02],
      ],
      "y",
      0.72,
    ),
  );
  add(
    "fibula",
    loft(
      [
        [0.66, -0.34, -0.035, 0.008, 0.01],
        [0.72, -0.36, -0.04, 0.075, 0.105],
        [0.88, -0.375, -0.06, 0.105, 0.13],
        [1.06, -0.38, -0.075, 0.08, 0.1],
        [1.36, -0.4, -0.06, 0.061, 0.07],
        [2.3, -0.43, -0.055, 0.055, 0.058],
        [3.15, -0.45, -0.055, 0.067, 0.065],
        [3.17, -0.45, -0.055, 0.001, 0.001],
      ],
      "y",
      0.75,
    ),
  );
  // A fitted open cartilage patch on the trochlea; not a complete cartilage layer.
  const dome = new THREE.SphereGeometry(
    1,
    40,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.43,
  );
  dome.scale(0.231, 0.17, 0.255);
  dome.translate(0, 0.843, -0.015);
  add("talar-cartilage", dome);
  ellipsoid("sesamoid-medial", [0.535, 0.155, 1.75], [0.047, 0.042, 0.065]);
  ellipsoid("sesamoid-lateral", [0.425, 0.155, 1.75], [0.047, 0.042, 0.065]);

  function muscle(id: string, sections: Section[], axis: "y" | "z" = "y") {
    const g = loft(sections, axis);
    add(id, g);
    const pos = g.attributes.position;
    for (let j = 0; j < 32; j += 3) {
      const path: Point[] = [];
      for (let i = 2; i < 63; i++)
        path.push([
          pos.getX(i * 33 + j),
          pos.getY(i * 33 + j),
          pos.getZ(i * 33 + j),
        ]);
      tube(id, path, 0.0028, true);
    }
  }
  muscle("anterior", [
    [1.4, 0.07, 0.27, 0.02, 0.02],
    [1.7, -0.055, 0.29, 0.08, 0.09],
    [2.15, -0.12, 0.3, 0.14, 0.13],
    [2.65, -0.17, 0.26, 0.17, 0.145],
    [3.15, -0.18, 0.24, 0.16, 0.13],
    [3.17, -0.18, 0.24, 0.005, 0.005],
  ]);
  muscle("fibularis", [
    [1.19, -0.4, -0.1, 0.02, 0.02],
    [1.65, -0.49, -0.035, 0.085, 0.085],
    [2.35, -0.56, -0.02, 0.125, 0.13],
    [3.15, -0.54, -0.01, 0.12, 0.13],
    [3.17, -0.54, -0.01, 0.005, 0.005],
  ]);
  muscle("fibularis-brevis", [
    [1.5, -0.43, -0.07, 0.02, 0.02],
    [1.8, -0.47, 0.04, 0.1, 0.09],
    [2.4, -0.46, 0.06, 0.105, 0.115],
    [3.1, -0.4, 0.06, 0.07, 0.085],
    [3.17, -0.4, 0.06, 0.002, 0.002],
  ]);
  muscle("soleus-distal", [
    [1.5, 0, -0.32, 0.04, 0.06],
    [1.9, 0, -0.39, 0.16, 0.11],
    [2.5, -0.02, -0.39, 0.3, 0.18],
    [3.15, -0.03, -0.38, 0.29, 0.18],
    [3.17, -0.03, -0.38, 0.005, 0.005],
  ]);
  muscle("ehl", [
    [1.65, 0, 0.27, 0.019, 0.02],
    [2.02, 0.025, 0.19, 0.055, 0.075],
    [2.7, 0.06, 0.19, 0.06, 0.085],
    [3.15, 0.07, 0.19, 0.065, 0.08],
    [3.17, 0.07, 0.19, 0.002, 0.002],
  ]);
  muscle("edl", [
    [1.65, -0.22, 0.25, 0.025, 0.025],
    [2.05, -0.3, 0.19, 0.08, 0.1],
    [2.65, -0.32, 0.18, 0.09, 0.11],
    [3.15, -0.32, 0.18, 0.085, 0.1],
    [3.17, -0.32, 0.18, 0.002, 0.002],
  ]);
  muscle(
    "edb",
    [
      [0.35, -0.28, 0.52, 0.02, 0.02],
      [0.55, -0.34, 0.55, 0.13, 0.08],
      [0.82, -0.29, 0.57, 0.15, 0.075],
      [1.05, -0.19, 0.5, 0.07, 0.04],
      [1.18, -0.17, 0.46, 0.01, 0.01],
    ],
    "z",
  );
  muscle(
    "abductor-hallucis",
    [
      [-0.27, 0.15, 0.21, 0.015, 0.015],
      [0.08, 0.3, 0.23, 0.07, 0.08],
      [0.55, 0.42, 0.26, 0.085, 0.1],
      [1.12, 0.49, 0.21, 0.095, 0.08],
      [1.62, 0.52, 0.2, 0.065, 0.06],
      [1.95, 0.5, 0.2, 0.01, 0.01],
    ],
    "z",
  );
  muscle(
    "abductor-digiti",
    [
      [-0.28, -0.2, 0.22, 0.01, 0.01],
      [0.1, -0.32, 0.24, 0.055, 0.075],
      [0.6, -0.49, 0.22, 0.07, 0.065],
      [1.25, -0.62, 0.18, 0.065, 0.05],
      [1.78, -0.64, 0.2, 0.01, 0.01],
    ],
    "z",
  );
  tube(
    "achilles",
    [
      [0, 2.2, -0.43],
      [0, 1.62, -0.38],
      [0, 1.04, -0.41],
      [0, 0.49, -0.51],
    ],
    0.072,
  );
  for (const d of ankleDetails)
    if (d.paths)
      for (const path of d.paths) {
        if (d.tissue === "fascia") add(d.id, ribbon(path, d.width!));
        else tube(d.id, path, d.width!);
      }
  for (const ray of rays) {
    const path: Point[] = [
      [0, 0.14, -0.25],
      [ray.head[0] * 0.25, 0.14, 0.55],
      [ray.head[0] * 0.7, 0.14, 1.13],
      [ray.head[0], 0.13, ray.head[2] + 0.04],
    ];
    const curve = new THREE.CatmullRomCurve3(
      path.map((p) => new THREE.Vector3(...p)),
    );
    // Flattened strips span the sole, keeping the central arch clear above them.
    const g = new THREE.TubeGeometry(curve, 48, 0.035, 8, false);
    g.scale(1, 0.32, 1);
    g.translate(0, 0.08, 0);
    add("plantar-fascia", g);
  }
  for (const part of parts.values())
    new THREE.Box3().setFromObject(part.group).getCenter(part.anchor);
  return { root, parts };
}

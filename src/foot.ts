import { attachmentRecords } from './attachments';
import { jointSurfaces, cartilageId } from './joints';
import * as THREE from "three";
import type { Structure } from "./data";
import { loft } from "./geometry";
import { ankleDetails } from "./ankleDetails";

export type Point = [number, number, number];
interface FootBone {
  id: string;
  name: string;
  group: string;
  center?: Point;
  size?: Point;
  start?: Point;
  end?: Point;
  radius?: number;
}
interface Connection {
  id: string;
  name: string;
  tissue: "tendon" | "ligament";
  group: string;
  attachments: string[];
  paths: Point[][];
  radius: number;
  description: string;
  role: string;
}

// LEGACY authoring coordinates only: +X medial, +Y up, +Z anterior.
// createAnkle bakes these into ISB-aligned millimeters; see COORDINATES.md.
export const footBones: FootBone[] = [
  {
    id: "talus",
    name: "Talus",
    group: "Tarsals",
    center: [0, 0.84, 0.05],
    size: [0.24, 0.19, 0.29],
  },
  {
    id: "calcaneus",
    name: "Calcaneus",
    group: "Tarsals",
    center: [-0.04, 0.4, -0.12],
    size: [0.27, 0.26, 0.42],
  },
  {
    id: "navicular",
    name: "Navicular",
    group: "Tarsals",
    center: [0.12, 0.63, 0.48],
    size: [0.27, 0.15, 0.17],
  },
  {
    id: "cuboid",
    name: "Cuboid",
    group: "Tarsals",
    center: [-0.31, 0.4, 0.65],
    size: [0.2, 0.16, 0.24],
  },
  {
    id: "cuneiform-medial",
    name: "Medial cuneiform",
    group: "Tarsals",
    center: [0.35, 0.51, 0.82],
    size: [0.14, 0.18, 0.2],
  },
  {
    id: "cuneiform-intermediate",
    name: "Intermediate cuneiform",
    group: "Tarsals",
    center: [0.095, 0.56, 0.78],
    size: [0.105, 0.14, 0.155],
  },
  {
    id: "cuneiform-lateral",
    name: "Lateral cuneiform",
    group: "Tarsals",
    center: [-0.105, 0.5, 0.84],
    size: [0.09, 0.15, 0.19],
  },
];
export const rays = [
  {
    base: [0.36, 0.45, 1.05] as Point,
    head: [0.48, 0.28, 1.77] as Point,
    lengths: [0.27, 0.2],
  },
  {
    base: [0.105, 0.5, 0.965] as Point,
    head: [0.2, 0.27, 1.89] as Point,
    lengths: [0.24, 0.15, 0.13],
  },
  {
    base: [-0.105, 0.45, 1.055] as Point,
    head: [-0.1, 0.25, 1.81] as Point,
    lengths: [0.22, 0.14, 0.12],
  },
  {
    base: [-0.29, 0.35, 0.93] as Point,
    head: [-0.37, 0.23, 1.68] as Point,
    lengths: [0.19, 0.13, 0.11],
  },
  {
    base: [-0.49, 0.3, 0.85] as Point,
    head: [-0.62, 0.21, 1.53] as Point,
    lengths: [0.17, 0.11, 0.1],
  },
];
for (let i = 0; i < 5; i++) {
  const ray = rays[i],
    n = i + 1;
  footBones.push({
    id: `metatarsal-${n}`,
    name: `Metatarsal ${n}`,
    group: "Metatarsals",
    start: ray.base,
    end: ray.head,
    radius: i === 0 ? 0.091 : 0.059,
  });
  let z = ray.head[2] + 0.09;
  ray.lengths.forEach((length, j) => {
    const segment =
      j === 0 ? "proximal" : j === ray.lengths.length - 1 ? "distal" : "middle";
    footBones.push({
      id: `phalanx-${n}-${segment}`,
      name: `${n === 1 ? "Great toe" : `Toe ${n}`} · ${segment} phalanx`,
      group: "Phalanges",
      start: [ray.head[0], 0.21, z],
      end: [ray.head[0] + (i === 0 ? 0.018 : -0.012), 0.19, z + length],
      radius: i === 0 ? 0.061 : 0.038,
    });
    z += length + 0.035;
  });
}

export const footConnections: Connection[] = [
  {
    id: "atfl",
    group: "Lateral ankle ligaments",
    name: "Anterior talofibular ligament",
    tissue: "ligament",
    attachments: ["fibula", "talus"],
    paths: [
      [
        [-0.37, 0.9, 0.06],
        [-0.31, 0.78, 0.19],
        [-0.18, 0.8, 0.25],
      ],
    ],
    radius: 0.034,
    description: "A band across the front of the lateral ankle.",
    role: "Helps restrain anterior translation and inversion of the talus.",
  },
  {
    id: "cfl",
    group: "Lateral ankle ligaments",
    name: "Calcaneofibular ligament",
    tissue: "ligament",
    attachments: ["fibula", "calcaneus"],
    paths: [
      [
        [-0.37, 0.86, -0.025],
        [-0.34, 0.62, -0.13],
        [-0.29, 0.41, -0.22],
      ],
    ],
    radius: 0.03,
    description: "A lateral band descending from the outer ankle to the heel.",
    role: "Contributes to lateral ankle and subtalar stability.",
  },
  {
    id: "ptfl",
    group: "Lateral ankle ligaments",
    name: "Posterior talofibular ligament",
    tissue: "ligament",
    attachments: ["fibula", "talus"],
    paths: [
      [
        [-0.37, 0.9, -0.14],
        [-0.28, 0.85, -0.25],
        [-0.08, 0.81, -0.23],
      ],
    ],
    radius: 0.03,
    description: "The posterior band of the lateral ankle ligament complex.",
    role: "Helps restrain posterior displacement of the talus.",
  },
  {
    id: "deltoid",
    group: "Medial (deltoid) ligament",
    name: "Deltoid ligament complex",
    tissue: "ligament",
    attachments: ["tibia", "talus", "calcaneus", "navicular"],
    paths: [
      [
        [0.23, 0.95, 0],
        [0.29, 0.8, 0.18],
        [0.33, 0.66, 0.44],
      ],
      [
        [0.23, 0.95, 0],
        [0.29, 0.66, -0.05],
        [0.2, 0.4, -0.07],
      ],
      [
        [0.23, 0.95, 0],
        [0.25, 0.85, -0.13],
        [0.18, 0.79, -0.18],
      ],
    ],
    radius: 0.037,
    description: "A simplified fan of medial ankle ligament bundles.",
    role: "Supports the medial ankle and limits excessive eversion.",
  },
  {
    id: "aitfl",
    group: "Syndesmosis",
    name: "Anterior inferior tibiofibular ligament",
    tissue: "ligament",
    attachments: ["tibia", "fibula"],
    paths: [
      [
        [-0.11, 1.19, 0.18],
        [-0.26, 1.05, 0.16],
        [-0.37, 0.96, 0.06],
      ],
    ],
    radius: 0.025,
    description:
      "An anterior component of the distal tibiofibular syndesmosis.",
    role: "Helps hold the ankle mortise together.",
  },
  {
    id: "spring",
    group: "Midfoot ligaments",
    name: "Spring ligament complex",
    tissue: "ligament",
    attachments: ["calcaneus", "navicular"],
    paths: [
      [
        [0.18, 0.49, 0.06],
        [0.24, 0.43, 0.26],
        [0.27, 0.51, 0.48],
      ],
      [
        [0.11, 0.44, 0.09],
        [0.13, 0.41, 0.28],
        [0.14, 0.49, 0.48],
      ],
    ],
    radius: 0.033,
    description:
      "The plantar calcaneonavicular connection, under the head of the talus.",
    role: "Supports the medial longitudinal arch.",
  },
  {
    id: "long-plantar",
    group: "Midfoot ligaments",
    name: "Long plantar ligament",
    tissue: "ligament",
    attachments: [
      "calcaneus",
      "cuboid",
      "metatarsal-2",
      "metatarsal-3",
      "metatarsal-4",
      "metatarsal-5",
    ],
    paths: [
      [
        [0, 0.17, -0.02],
        [-0.16, 0.2, 0.4],
        [-0.25, 0.21, 0.73],
        [-0.1, 0.33, 1.08],
      ],
      [
        [0, 0.17, -0.02],
        [-0.23, 0.2, 0.49],
        [-0.38, 0.18, 0.73],
        [-0.47, 0.22, 0.95],
      ],
      [
        [0, 0.17, -0.02],
        [-0.15, 0.2, 0.4],
        [-0.2, 0.21, 0.73],
        [0.105, 0.39, 1.03],
      ],
      [
        [0, 0.17, -0.02],
        [-0.18, 0.2, 0.4],
        [-0.26, 0.21, 0.73],
        [-0.29, 0.26, 1.02],
      ],
    ],
    radius: 0.035,
    description:
      "A plantar band with distal slips toward the metatarsal bases.",
    role: "Helps support the lateral longitudinal arch.",
  },
  {
    id: "lisfranc",
    group: "Midfoot ligaments",
    name: "Lisfranc ligament",
    tissue: "ligament",
    attachments: ["cuneiform-medial", "metatarsal-2"],
    paths: [
      [
        [0.24, 0.43, 0.89],
        [0.18, 0.44, 0.97],
        [0.13, 0.44, 1.04],
      ],
    ],
    radius: 0.033,
    description:
      "An oblique connection between the medial cuneiform and second metatarsal base.",
    role: "Stabilizes the medial midfoot.",
  },
  {
    id: "dorsal-talonavicular",
    group: "Midfoot ligaments",
    name: "Dorsal talonavicular ligament",
    tissue: "ligament",
    attachments: ["talus", "navicular"],
    paths: [
      [
        [0.03, 0.96, 0.25],
        [0.07, 0.88, 0.35],
        [0.13, 0.76, 0.46],
      ],
    ],
    radius: 0.035,
    description: "A short band over the talonavicular joint.",
    role: "Reinforces the dorsal joint capsule.",
  },
  {
    id: "tibialis-anterior-tendon",
    group: "Extensor tendons",
    name: "Tibialis anterior tendon",
    tissue: "tendon",
    attachments: ["anterior", "cuneiform-medial", "metatarsal-1"],
    paths: [
      [
        [0.07, 1.4, 0.27],
        [0.16, 0.99, 0.32],
        [0.35, 0.73, 0.54],
        [0.45, 0.49, 0.83],
      ],
      [
        [0.35, 0.73, 0.54],
        [0.45, 0.54, 0.79],
        [0.42, 0.4, 1.07],
      ],
    ],
    radius: 0.035,
    description:
      "A separately selectable continuation of tibialis anterior across the front of the ankle.",
    role: "Transmits force to the medial cuneiform and first metatarsal.",
  },
  {
    id: "fibularis-longus-tendon",
    group: "Fibular tendons",
    name: "Fibularis longus tendon",
    tissue: "tendon",
    attachments: ["fibularis", "cuneiform-medial", "metatarsal-1"],
    paths: [
      [
        [-0.4, 1.19, -0.1],
        [-0.48, 0.88, -0.21],
        [-0.49, 0.51, 0.03],
        [-0.47, 0.24, 0.6],
        [-0.19, 0.2, 0.78],
        [0.14, 0.23, 0.94],
        [0.34, 0.32, 1.05],
      ],
      [
        [0.14, 0.23, 0.94],
        [0.27, 0.26, 0.84],
        [0.35, 0.34, 0.82],
      ],
    ],
    radius: 0.03,
    description:
      "Runs behind the lateral ankle, beneath the cuboid, and across the sole.",
    role: "Transmits fibularis longus force to the medial foot.",
  },
  {
    id: "extensor-hallucis-tendon",
    group: "Extensor tendons",
    name: "Extensor hallucis longus tendon",
    tissue: "tendon",
    attachments: ["phalanx-1-distal"],
    paths: [
      [
        [0, 1.65, 0.27],
        [0.03, 1.05, 0.29],
        [0.21, 0.83, 0.56],
        [0.39, 0.67, 0.9],
        [0.47, 0.39, 1.7],
        [0.49, 0.29, 2.29],
      ],
    ],
    radius: 0.025,
    description:
      "Distal tendon path to the great toe. Its proximal muscle belly is not included.",
    role: "Transmits force to extend the great toe.",
  },
  {
    id: "extensor-digitorum-tendons",
    group: "Extensor tendons",
    name: "Extensor digitorum longus tendons",
    tissue: "tendon",
    attachments: [2, 3, 4, 5].flatMap((n) => [
      `phalanx-${n}-middle`,
      `phalanx-${n}-distal`,
    ]),
    paths: rays.slice(1).map((r, i) => [
      [-0.22, 1.65, 0.25],
      [-0.22, 1.05, 0.3],
      [-0.2, 0.76, 0.69],
      [r.head[0], 0.42, r.head[2] - 0.14],
      [
        r.head[0],
        0.29,
        r.head[2] +
          0.09 +
          r.lengths.reduce((a, b) => a + b, 0) +
          0.035 * (r.lengths.length - 1),
      ],
    ]),
    radius: 0.019,
    description:
      "Four distal tendon slips to toes 2–5, shown with simplified extensor expansions. The muscle belly is omitted.",
    role: "Transmits force to extend the lesser toes.",
  },
];
for (let i = 0; i < 5; i++) {
  const ray = rays[i],
    n = i + 1;
  const proximal = footBones.find((b) => b.id === `phalanx-${n}-proximal`)!;
  const r = i === 0 ? 0.08 : 0.06;
  footConnections.push({
    id: `mtp-collateral-${n}`,
    // The fixed atlas taxonomy collects foot ligaments here, including forefoot MTP bands.
    group: "Midfoot ligaments",
    name: `Toe ${n} MTP collateral ligaments`,
    tissue: "ligament",
    attachments: [`metatarsal-${n}`, `phalanx-${n}-proximal`],
    paths: [-1, 1].map((side) => [
      [ray.head[0] + side * r, ray.head[1], ray.head[2] - 0.015],
      [ray.head[0] + side * (r + 0.02), 0.23, ray.head[2] + 0.06],
      [proximal.start![0] + side * r, 0.21, proximal.start![2] + 0.05],
    ]),
    radius: 0.018,
    description: "Paired side bands at this metatarsophalangeal joint.",
    role: "Limit excessive side-to-side movement at the base of the toe.",
  });
}

export const footStructures: Structure[] = [
  ...footBones.map((b): Structure => ({
    id: b.id,
    name: b.name,
    tissue: "bone",
    region: "Foot",
    group: b.group,
    description:
      b.group === "Tarsals"
        ? `An individually modeled ${b.name.toLowerCase()} in the hindfoot or midfoot.`
        : b.group === "Metatarsals"
          ? `The long bone of foot ray ${b.id.split("-")[1]}.`
          : `An individual toe bone. The great toe has two phalanges; each lesser toe has three.`,
    role:
      b.id === "talus"
        ? "Transfers load from the leg into the foot."
        : b.id === "calcaneus"
          ? "Forms the heel and receives the Achilles tendon."
          : "Contributes to the articulated framework of the foot.",
    connection: "Explore adjacent bones and modeled attachments below.",
    hint: "Use Focus for a close-up, or Neighbors to keep related structures visible.",
  })),
  ...footConnections.map((c): Structure => ({
    id: c.id,
    name: c.name,
    tissue: c.tissue,
    region: "Foot",
    group: c.group,
    description: c.description,
    role: c.role,
    connection: c.attachments
      .map(
        (id) =>
          footBones.find((b) => b.id === id)?.name ??
          {
            tibia: "Tibia",
            fibula: "Fibula",
            anterior: "Tibialis anterior",
            fibularis: "Fibularis longus",
          }[id] ??
          id,
      )
      .join(" ↔ "),
    hint: "Use Neighbors to inspect its attachment bones. Paths and bundle widths are simplified.",
  })),
];

/** Adjacency represents articulations and modeled soft-tissue attachments, not bone fusion. */
export const footLinks: [string, string][] = [
  ["gastrocnemius", "achilles"],
  ["gastrocnemius", "soleus-distal"],
  ["talus", "tibia"],
  ["talus", "fibula"],
  ["talus", "calcaneus"],
  ["talus", "navicular"],
  ["calcaneus", "cuboid"],
  ["navicular", "cuboid"],
  ["cuboid", "cuneiform-lateral"],
  ["navicular", "cuneiform-medial"],
  ["navicular", "cuneiform-intermediate"],
  ["navicular", "cuneiform-lateral"],
  ["cuneiform-medial", "cuneiform-intermediate"],
  ["cuneiform-intermediate", "cuneiform-lateral"],
  ["cuneiform-medial", "metatarsal-1"],
  ["cuneiform-medial", "metatarsal-2"],
  ["cuneiform-intermediate", "metatarsal-2"],
  ["cuneiform-lateral", "metatarsal-2"],
  ["cuneiform-lateral", "metatarsal-3"],
  ["cuneiform-lateral", "metatarsal-4"],
  ["cuboid", "metatarsal-4"],
  ["cuboid", "metatarsal-5"],
  ["calcaneus", "achilles"],
];
for (let n = 1; n <= 5; n++) {
  footLinks.push([`metatarsal-${n}`, `phalanx-${n}-proximal`]);
  if (n > 1) {
    footLinks.push(
      [`phalanx-${n}-proximal`, `phalanx-${n}-middle`],
      [`phalanx-${n}-middle`, `phalanx-${n}-distal`],
    );
    if (n < 5) footLinks.push([`metatarsal-${n}`, `metatarsal-${n + 1}`]);
  } else footLinks.push(["phalanx-1-proximal", "phalanx-1-distal"]);
}
for (const c of footConnections)
  for (const a of c.attachments) footLinks.push([c.id, a]);
for (const d of ankleDetails)
  for (const id of d.attachments) footLinks.push([d.id, id]);
for (const a of attachmentRecords) {
  footLinks.push([a.structureId, a.from.structureId], [a.structureId, a.to.structureId]);
  for (const guide of a.guidePoints) footLinks.push([a.structureId, guide.supportId]);
}
for (const joint of jointSurfaces) for (const bone of joint.bones) {
  footLinks.push([cartilageId(bone), bone]);
  for (const other of joint.bones) footLinks.push([cartilageId(bone), other]);
}
export function relatedIds(id: string) {
  return new Set(
    footLinks.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])),
  );
}

export function buildFoot(
  add: (id: string, geo: THREE.BufferGeometry) => unknown,
) {
  const mass = (id: string, p: Point, s: Point) => {
    const g = new THREE.SphereGeometry(1, 36, 28);
    g.scale(...s);
    g.translate(...p);
    add(id, g);
  };
  // Bone-specific longitudinal sections: body, neck, tuberosities and articular ends.
  add(
    "calcaneus",
    loft(
      [
        [-0.54, -0.035, 0.4, 0.025, 0.03],
        [-0.49, -0.035, 0.4, 0.2, 0.2],
        [-0.34, -0.04, 0.41, 0.25, 0.26],
        [-0.12, -0.045, 0.43, 0.26, 0.24],
        [0.08, -0.07, 0.45, 0.23, 0.21],
        [0.24, -0.14, 0.38, 0.21, 0.15],
        [0.36, -0.22, 0.37, 0.18, 0.13],
        [0.41, -0.23, 0.37, 0.015, 0.025],
      ],
      "z",
      0.73,
    ),
  );
  mass("calcaneus", [0.19, 0.53, 0.02], [0.13, 0.065, 0.15]); // sustentaculum tali
  mass("calcaneus", [-0.285, 0.4, 0.04], [0.047, 0.055, 0.08]);
  add(
    "talus",
    loft(
      [
        [-0.25, 0, 0.81, 0.025, 0.025],
        [-0.2, 0, 0.83, 0.19, 0.13],
        [-0.05, 0, 0.85, 0.235, 0.16],
        [0.12, 0.015, 0.83, 0.225, 0.16],
        [0.22, 0.045, 0.77, 0.145, 0.105],
        [0.31, 0.09, 0.72, 0.18, 0.135],
        [0.38, 0.11, 0.7, 0.12, 0.1],
        [0.41, 0.11, 0.7, 0.02, 0.025],
      ],
      "z",
      0.83,
    ),
  );
  add(
    "navicular",
    loft(
      [
        [0.32, 0.13, 0.63, 0.035, 0.035],
        [0.37, 0.13, 0.64, 0.24, 0.12],
        [0.47, 0.13, 0.63, 0.265, 0.145],
        [0.56, 0.12, 0.6, 0.235, 0.14],
        [0.63, 0.12, 0.59, 0.195, 0.12],
        [0.66, 0.12, 0.59, 0.02, 0.02],
      ],
      "z",
      0.63,
    ),
  );
  mass("navicular", [0.35, 0.57, 0.46], [0.09, 0.075, 0.09]);
  add(
    "cuboid",
    loft(
      [
        [0.38, -0.27, 0.37, 0.02, 0.02],
        [0.43, -0.28, 0.39, 0.17, 0.14],
        [0.59, -0.32, 0.4, 0.185, 0.155],
        [0.77, -0.34, 0.37, 0.185, 0.15],
        [0.86, -0.33, 0.35, 0.155, 0.14],
        [0.9, -0.33, 0.35, 0.015, 0.02],
      ],
      "z",
      0.5,
    ),
  );
  for (const b of footBones.filter((b) => b.id.startsWith("cuneiform"))) {
    const [x, y, z] = b.center!,
      [w, h, l] = b.size!;
    add(
      b.id,
      loft(
        [
          [z - l, x, y, 0.01, 0.01],
          [z - l * 0.8, x, y, w * 0.76, h * 0.78],
          [z, x, y, w * 0.97, h],
          [z + l * 0.78, x, y - 0.015, w, h * 0.83],
          [z + l, x, y - 0.015, 0.012, 0.01],
        ],
        "z",
        0.48,
      ),
    );
  }
  for (const b of footBones.filter((b) => b.start)) {
    const start = b.start!,
      end = b.end!,
      r = b.radius!,
      length = end[2] - start[2];
    const sections: [number, number, number, number, number][] = [];
    const distal = b.id.endsWith("-distal"),
      met = b.group === "Metatarsals";
    for (const [t, w, h] of [
      [0, 0.12, 0.12],
      [0.06, 1.45, 1.15],
      [0.18, 1.18, 0.95],
      [0.38, 0.73, 0.74],
      [0.63, 0.69, 0.74],
      [0.81, distal ? 1.12 : 0.9, 0.85],
      [0.91, distal ? 1.4 : 1.4, distal ? 0.65 : 1.18],
      [0.98, 1.02, 0.86],
      [1, 0.08, 0.08],
    ]) {
      const arch = met ? Math.sin(t * Math.PI) * 0.025 : 0;
      sections.push([
        start[2] + length * t,
        THREE.MathUtils.lerp(start[0], end[0], t),
        THREE.MathUtils.lerp(start[1], end[1], t) + arch,
        r * w,
        r * h,
      ]);
    }
    add(b.id, loft(sections, "z", met ? 0.85 : 0.95));
    // Rounded articular bases and heads meet across narrow joint spaces.
    mass(b.id, start, [r * 1.25, r * 1.08, r * 0.42]);
    mass(b.id, end, [
      r * (distal ? 1.24 : 1.3),
      r * (distal ? 0.72 : 1.08),
      r * 0.5,
    ]);
    if (b.id === "metatarsal-5")
      mass(b.id, [-0.55, 0.29, 0.9], [0.09, 0.072, 0.11]);
  }
  for (const c of footConnections)
    for (const path of c.paths)
      add(
        c.id,
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))),
          48,
          c.radius,
          12,
          false,
        ),
      );
}

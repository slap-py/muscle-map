// Paths below are legacy procedural authoring inputs; see COORDINATES.md.
import type { Structure, Tissue } from "./data";
import type { Point } from "./foot";

export interface Detail {
  id: string;
  name: string;
  tissue: Tissue;
  description: string;
  role: string;
  attachments: string[];
  paths?: Point[][];
  width?: number;
}
export const ankleDetails: Detail[] = [
  {
    id: "soleus-distal",
    name: "Soleus · distal portion",
    tissue: "muscle",
    description:
      "The lower portion of the deep calf muscle, cut at the top of this regional model.",
    role: "Plantar flexion through the Achilles tendon.",
    attachments: ["achilles"],
  },
  {
    id: "fibularis-brevis",
    name: "Fibularis brevis · distal portion",
    tissue: "muscle",
    description: "Distal lateral-compartment muscle beside fibularis longus.",
    role: "Everts the foot.",
    attachments: ["fibularis-brevis-tendon"],
  },
  {
    id: "ehl",
    name: "Extensor hallucis longus · distal portion",
    tissue: "muscle",
    description:
      "A narrow muscle belly continuing into the great-toe extensor tendon.",
    role: "Extends the great toe; assists dorsiflexion.",
    attachments: ["extensor-hallucis-tendon"],
  },
  {
    id: "edl",
    name: "Extensor digitorum longus · distal portion",
    tissue: "muscle",
    description:
      "A distal anterior-compartment muscle leading to the four lesser toes.",
    role: "Extends toes 2–5; assists dorsiflexion.",
    attachments: ["extensor-digitorum-tendons"],
  },
  {
    id: "edb",
    name: "Extensor digitorum brevis",
    tissue: "muscle",
    description:
      "An intrinsic muscle on the dorsolateral foot, as visible in the lateral reference images.",
    role: "Assists extension of toes 2–4.",
    attachments: ["calcaneus", "edb-tendons"],
  },
  {
    id: "abductor-hallucis",
    name: "Abductor hallucis",
    tissue: "muscle",
    description:
      "A superficial intrinsic muscle along the medial border of the foot.",
    role: "Abducts and assists flexion of the great toe.",
    attachments: ["calcaneus", "phalanx-1-proximal"],
  },
  {
    id: "abductor-digiti",
    name: "Abductor digiti minimi",
    tissue: "muscle",
    description:
      "A longitudinal intrinsic muscle along the lateral plantar border.",
    role: "Abducts and assists flexion of the little toe.",
    attachments: ["calcaneus", "phalanx-5-proximal"],
  },
  {
    id: "fibularis-brevis-tendon",
    name: "Fibularis brevis tendon",
    tissue: "tendon",
    description:
      "Runs behind the lateral malleolus and forward to the fifth metatarsal tuberosity.",
    role: "Transfers force to the lateral forefoot.",
    attachments: ["fibularis-brevis", "metatarsal-5"],
    paths: [
      [
        [-0.43, 1.5, -0.07],
        [-0.44, 0.89, -0.15],
        [-0.46, 0.58, 0.13],
        [-0.52, 0.38, 0.59],
        [-0.55, 0.3, 0.9],
      ],
    ],
    width: 0.027,
  },
  {
    id: "edb-tendons",
    name: "Extensor digitorum brevis tendons",
    tissue: "tendon",
    description:
      "Three slips joining the dorsal extensor apparatus of toes 2–4.",
    role: "Transfers force from the short toe extensor.",
    attachments: [
      "edb",
      "phalanx-2-proximal",
      "phalanx-3-proximal",
      "phalanx-4-proximal",
    ],
    paths: [
      [
        [-0.2, 0.52, 1.03],
        [0.05, 0.41, 1.48],
        [0.2, 0.29, 1.99],
      ],
      [
        [-0.2, 0.52, 1.03],
        [-0.12, 0.37, 1.48],
        [-0.1, 0.28, 1.91],
      ],
      [
        [-0.2, 0.52, 1.03],
        [-0.3, 0.36, 1.41],
        [-0.37, 0.26, 1.78],
      ],
    ],
    width: 0.018,
  },
  {
    id: "superior-extensor",
    name: "Superior extensor retinaculum",
    tissue: "fascia",
    description: "A transverse retaining band at the front of the distal leg.",
    role: "Holds the extensor tendons near the ankle.",
    attachments: [
      "tibia",
      "fibula",
      "tibialis-anterior-tendon",
      "extensor-hallucis-tendon",
      "extensor-digitorum-tendons",
    ],
    paths: [
      [
        [-0.44, 1.39, 0.12],
        [-0.3, 1.38, 0.34],
        [-0.06, 1.38, 0.39],
        [0.18, 1.38, 0.32],
        [0.26, 1.39, 0.12],
      ],
    ],
    width: 0.2,
  },
  {
    id: "inferior-extensor",
    name: "Inferior extensor retinaculum",
    tissue: "fascia",
    description:
      "A simplified Y-shaped band across the front of the ankle and hindfoot.",
    role: "Restrains the extensor tendons as they turn toward the toes.",
    attachments: [
      "calcaneus",
      "tibia",
      "tibialis-anterior-tendon",
      "extensor-hallucis-tendon",
      "extensor-digitorum-tendons",
    ],
    paths: [
      [
        [-0.34, 0.58, 0.23],
        [-0.29, 0.79, 0.45],
        [-0.12, 0.91, 0.48],
        [0.15, 1.03, 0.36],
        [0.26, 1.03, 0.12],
      ],
      [
        [-0.25, 0.8, 0.45],
        [-0.03, 0.78, 0.63],
        [0.24, 0.69, 0.72],
        [0.43, 0.48, 0.7],
      ],
    ],
    width: 0.115,
  },
  {
    id: "superior-fibular",
    name: "Superior fibular retinaculum",
    tissue: "fascia",
    description: "A retaining band behind the lateral malleolus.",
    role: "Keeps the fibular tendons in their retromalleolar course.",
    attachments: [
      "fibula",
      "calcaneus",
      "fibularis-longus-tendon",
      "fibularis-brevis-tendon",
    ],
    paths: [
      [
        [-0.37, 0.91, -0.07],
        [-0.5, 0.76, -0.14],
        [-0.45, 0.54, -0.28],
        [-0.29, 0.46, -0.29],
      ],
    ],
    width: 0.13,
  },
  {
    id: "inferior-fibular",
    name: "Inferior fibular retinaculum",
    tissue: "fascia",
    description: "A lateral calcaneal band retaining the fibular tendon paths.",
    role: "Keeps the tendons close to the lateral hindfoot.",
    attachments: [
      "calcaneus",
      "fibularis-longus-tendon",
      "fibularis-brevis-tendon",
    ],
    paths: [
      [
        [-0.33, 0.62, 0.22],
        [-0.48, 0.46, 0.27],
        [-0.46, 0.26, 0.35],
        [-0.31, 0.23, 0.29],
      ],
    ],
    width: 0.1,
  },
  {
    id: "plantar-fascia",
    name: "Plantar aponeurosis",
    tissue: "fascia",
    description:
      "A simplified fan of plantar fascia from the heel toward the bases of the toes.",
    role: "Helps support the longitudinal arch.",
    attachments: [
      "calcaneus",
      "phalanx-1-proximal",
      "phalanx-2-proximal",
      "phalanx-3-proximal",
      "phalanx-4-proximal",
      "phalanx-5-proximal",
    ],
    width: 0.065,
  },
  {
    id: "talar-cartilage",
    name: "Talar dome · articular cartilage",
    tissue: "cartilage",
    description:
      "A thin illustrative cartilage surface over the talar trochlea.",
    role: "Provides a smooth bearing surface in the ankle mortise.",
    attachments: ["talus", "tibia", "fibula"],
  },
  {
    id: "sesamoid-medial",
    name: "Medial hallux sesamoid",
    tissue: "bone",
    description: "The medial sesamoid under the first metatarsal head.",
    role: "Supports the great-toe flexor mechanism.",
    attachments: ["metatarsal-1"],
  },
  {
    id: "sesamoid-lateral",
    name: "Lateral hallux sesamoid",
    tissue: "bone",
    description: "The lateral sesamoid under the first metatarsal head.",
    role: "Supports the great-toe flexor mechanism.",
    attachments: ["metatarsal-1"],
  },
];
export const ankleStructures: Structure[] = ankleDetails.map((d) => ({
  id: d.id,
  name: d.name,
  tissue: d.tissue,
  region: "Foot",
  group:
    d.tissue === "fascia"
      ? "Retinacula & plantar fascia"
      : d.tissue === "muscle"
        ? "Regional muscles"
        : d.tissue === "bone"
          ? "Hallux sesamoids"
          : "Ankle details",
  description: d.description,
  role: d.role,
  connection: "See modeled attachments below.",
  hint: "Select Focus to inspect. Turn off the fascia layer to reveal underlying tendon paths.",
}));

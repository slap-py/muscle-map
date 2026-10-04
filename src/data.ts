import { ankleStructures } from "./ankleDetails";
import { footStructures } from "./foot";
export type Tissue =
  "muscle" | "bone" | "tendon" | "ligament" | "fascia" | "cartilage";
export type Region = "Thigh" | "Knee" | "Lower leg" | "Foot";
export interface Structure {
  id: string;
  name: string;
  tissue: Tissue;
  region: Region;
  group: string;
  description: string;
  role: string;
  connection: string;
  hint: string;
}
export const tissueNames: Record<Tissue, string> = {
  muscle: "Muscles",
  bone: "Bones",
  tendon: "Tendons",
  ligament: "Ligaments",
  fascia: "Fascia & retinacula",
  cartilage: "Cartilage",
};
export const colors: Record<Tissue, string> = {
  muscle: "#b96857",
  bone: "#d9c8a2",
  tendon: "#adc2bb",
  ligament: "#bca16b",
  fascia: "#9bb8bd",
  cartilage: "#6caac3",
};
export const allStructures: Structure[] = [
  {
    id: "femur",
    name: "Femur",
    tissue: "bone",
    region: "Thigh",
    group: "Skeleton",
    description: "The thigh’s long bone, between the hip and knee.",
    role: "Supports the thigh and provides leverage for movement.",
    connection: "Hip socket → tibia at the knee",
    hint: "Switch to Skeleton to see its rounded head and distal condyles.",
  },
  {
    id: "patella",
    name: "Patella",
    tissue: "bone",
    region: "Knee",
    group: "Skeleton",
    description: "The kneecap sits in the quadriceps tendon.",
    role: "Improves the quadriceps’ leverage.",
    connection: "Quadriceps tendon → patellar ligament",
    hint: "Best seen from the front.",
  },
  {
    id: "tibia",
    name: "Tibia",
    tissue: "bone",
    region: "Lower leg",
    group: "Skeleton",
    description: "The larger, medial bone of the lower leg.",
    role: "Carries most of the load through the lower leg.",
    connection: "Femur → talus",
    hint: "Find the broad upper end directly below the knee.",
  },
  {
    id: "fibula",
    name: "Fibula",
    tissue: "bone",
    region: "Lower leg",
    group: "Skeleton",
    description: "The slender bone alongside the tibia.",
    role: "Provides muscle attachments and lateral ankle support.",
    connection: "Lateral tibia → outer ankle",
    hint: "The fibula is on the lateral, or outer, side.",
  },
  ...footStructures,
  {
    id: "rectus",
    name: "Rectus femoris",
    tissue: "muscle",
    region: "Thigh",
    group: "Quadriceps",
    description: "The central superficial muscle of the quadriceps.",
    role: "Extends the knee; assists hip flexion.",
    connection: "Pelvis → patella → tibial tuberosity",
    hint: "Its long belly runs down the front of the thigh.",
  },
  {
    id: "lateralis",
    name: "Vastus lateralis",
    tissue: "muscle",
    region: "Thigh",
    group: "Quadriceps",
    description: "The large outer quadriceps muscle.",
    role: "Extends the knee.",
    connection: "Femur → patella → tibial tuberosity",
    hint: "Look on the lateral side of the thigh.",
  },
  {
    id: "medialis",
    name: "Vastus medialis",
    tissue: "muscle",
    region: "Thigh",
    group: "Quadriceps",
    description:
      "The medial quadriceps muscle, with a teardrop-shaped lower portion.",
    role: "Extends the knee.",
    connection: "Femur → patella → tibial tuberosity",
    hint: "Look just above the inner side of the knee.",
  },
  {
    id: "intermedius",
    name: "Vastus intermedius",
    tissue: "muscle",
    region: "Thigh",
    group: "Quadriceps · deep",
    description: "A deep quadriceps muscle beneath rectus femoris.",
    role: "Extends the knee.",
    connection: "Femur → quadriceps tendon",
    hint: "Select it to reveal the deep layer through nearby structures.",
  },
  {
    id: "sartorius",
    name: "Sartorius",
    tissue: "muscle",
    region: "Thigh",
    group: "Anterior thigh",
    description: "A long, strap-like muscle crossing the thigh diagonally.",
    role: "Assists hip flexion and knee flexion.",
    connection: "Anterior pelvis → medial proximal tibia",
    hint: "Follow its diagonal course across the front.",
  },
  {
    id: "adductor",
    name: "Adductor longus",
    tissue: "muscle",
    region: "Thigh",
    group: "Medial thigh",
    description: "A fan-shaped muscle on the inner thigh.",
    role: "Draws the thigh toward the midline.",
    connection: "Pubis → femur",
    hint: "Rotate toward the medial side.",
  },
  {
    id: "biceps",
    name: "Biceps femoris",
    tissue: "muscle",
    region: "Thigh",
    group: "Hamstrings",
    description: "The lateral hamstring; shown as a simplified combined belly.",
    role: "Flexes the knee; the long head extends the hip.",
    connection: "Pelvis / femur → fibular head",
    hint: "Use Posterior view to see the hamstrings.",
  },
  {
    id: "semitendinosus",
    name: "Semitendinosus",
    tissue: "muscle",
    region: "Thigh",
    group: "Hamstrings",
    description: "A superficial medial hamstring with a long distal tendon.",
    role: "Flexes the knee and extends the hip.",
    connection: "Ischial tuberosity → medial tibia",
    hint: "Runs along the back and inner side of the thigh.",
  },
  {
    id: "semimembranosus",
    name: "Semimembranosus",
    tissue: "muscle",
    region: "Thigh",
    group: "Hamstrings · deep",
    description: "A broad medial hamstring, deeper than semitendinosus.",
    role: "Flexes the knee and extends the hip.",
    connection: "Ischial tuberosity → medial tibial condyle",
    hint: "Select to reveal it under the superficial hamstring.",
  },
  {
    id: "gastrocnemius",
    name: "Gastrocnemius",
    tissue: "muscle",
    region: "Lower leg",
    group: "Posterior compartment",
    description: "The two-headed superficial calf muscle.",
    role: "Plantar flexes the ankle; also flexes the knee.",
    connection: "Femoral condyles → calcaneus via Achilles tendon",
    hint: "Rotate to Posterior to see both calf heads.",
  },
  {
    id: "soleus",
    name: "Soleus",
    tissue: "muscle",
    region: "Lower leg",
    group: "Posterior compartment · deep",
    description: "A broad calf muscle beneath gastrocnemius.",
    role: "Plantar flexes the ankle.",
    connection: "Tibia / fibula → calcaneus via Achilles tendon",
    hint: "Its lower edges extend beyond gastrocnemius.",
  },
  {
    id: "anterior",
    name: "Tibialis anterior",
    tissue: "muscle",
    region: "Lower leg",
    group: "Anterior compartment",
    description: "A muscle alongside the front of the shin.",
    role: "Dorsiflexes and inverts the foot.",
    connection: "Lateral tibia → medial midfoot",
    hint: "Find it immediately lateral to the tibial crest.",
  },
  {
    id: "fibularis",
    name: "Fibularis longus",
    tissue: "muscle",
    region: "Lower leg",
    group: "Lateral compartment",
    description: "A superficial muscle on the outside of the lower leg.",
    role: "Everts the foot; assists plantar flexion.",
    connection: "Fibula → medial foot through the sole",
    hint: "Select Fibularis longus tendon to follow its path behind the outer ankle and across the sole.",
  },
  {
    id: "achilles",
    name: "Achilles tendon",
    tissue: "tendon",
    region: "Lower leg",
    group: "Connective tissue",
    description: "The shared tendon of the gastrocnemius and soleus.",
    role: "Transfers calf force to the heel.",
    connection: "Calf muscles → calcaneus",
    hint: "The pale cord at the back of the ankle.",
  },
  {
    id: "quadriceps",
    name: "Quadriceps tendon",
    tissue: "tendon",
    region: "Knee",
    group: "Connective tissue",
    description: "The tendon immediately above the kneecap.",
    role: "Transfers quadriceps force to the patella.",
    connection: "Quadriceps → superior patella",
    hint: "Compare it with the patellar ligament below the kneecap.",
  },
  {
    id: "patellar",
    name: "Patellar ligament",
    tissue: "ligament",
    region: "Knee",
    group: "Connective tissue",
    description:
      "The strong band between kneecap and shinbone, also called the patellar tendon.",
    role: "Completes the knee extensor mechanism.",
    connection: "Patella → tibial tuberosity",
    hint: "A bone-to-bone connection on the front of the knee.",
  },
  {
    id: "mcl",
    name: "Medial collateral ligament",
    tissue: "ligament",
    region: "Knee",
    group: "Knee stabilizers",
    description: "A broad band on the inner side of the knee.",
    role: "Resists excessive inward angulation of the knee.",
    connection: "Medial femur → medial tibia",
    hint: "Use Connective view to inspect the side of the knee.",
  },
  {
    id: "lcl",
    name: "Lateral collateral ligament",
    tissue: "ligament",
    region: "Knee",
    group: "Knee stabilizers",
    description: "A cord-like band on the outer side of the knee.",
    role: "Resists excessive outward angulation of the knee.",
    connection: "Lateral femur → fibular head",
    hint: "It attaches to the fibula rather than the tibia.",
  },
];
export const structures: Structure[] = [
  ...allStructures.filter(
    (s) =>
      s.region === "Foot" ||
      ["tibia", "fibula", "anterior", "fibularis", "achilles"].includes(s.id),
  ),
  ...ankleStructures,
];
for (const d of structures) {
  if (d.id === "tibia") {
    d.name = "Distal tibia";
    d.description =
      "The distal tibial shaft, plafond and medial malleolus. The proximal leg is outside this study.";
    d.hint = "Notice the medial malleolus descending alongside the talus.";
  }
  if (d.id === "fibula") {
    d.name = "Distal fibula";
    d.description =
      "The distal fibular shaft and lateral malleolus, which extends lower than the medial malleolus.";
  }
  if (d.id === "anterior" || d.id === "fibularis") {
    d.name += " · distal portion";
    d.description += " Only the distal segment is shown.";
  }
  if (d.id === "extensor-hallucis-tendon")
    d.description =
      "The distal tendon of extensor hallucis longus crosses the anterior ankle and continues to the great toe.";
  if (d.id === "extensor-digitorum-tendons")
    d.description =
      "Four distal tendon slips from the regional extensor digitorum longus belly to toes 2–5. Extensor expansions remain simplified.";
}
export const byId = Object.fromEntries(structures.map((s) => [s.id, s]));
export const allById = Object.fromEntries(allStructures.map((s) => [s.id, s]));

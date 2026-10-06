/** Concise study facts for the muscles included in the regional explorer.
 * References describe typical anatomy; mesh cutoffs and variants can differ.
 */
export interface MuscleFacts {
  origin?: string;
  insertion?: string;
  action?: string;
  innervation?: string;
  bloodSupply?: string;
  references: { title: string; url: string }[];
}
const source = (title: string, url: string) => ({ title, url });
const table = source('Loyola University Chicago · Lower extremity muscle table', 'https://www.stritch.luc.edu/lumen/meded/grossanatomy/homepage/muscletables/lowerextremitymuscletable.pdf');
const anterior = source('NCBI · Leg anterior compartment', 'https://www.ncbi.nlm.nih.gov/books/NBK539725/');
const lateral = source('NCBI · Leg lateral compartment', 'https://www.ncbi.nlm.nih.gov/books/NBK519526/');
const foot = source('NCBI · Foot muscles', 'https://www.ncbi.nlm.nih.gov/books/NBK539705/');

export const muscleFacts: Record<string, MuscleFacts> = {
  gastrocnemius: {
    origin: 'Medial and lateral femoral condylar regions, with contributions from the knee capsule.',
    insertion: 'Posterior calcaneus through the Achilles tendon.',
    action: 'Plantar flexes the ankle and assists knee flexion.',
    innervation: 'Tibial nerve.',
    bloodSupply: 'Sural branches of the popliteal artery.',
    references: [source('NCBI · Gastrocnemius muscle', 'https://www.ncbi.nlm.nih.gov/books/NBK532946/'), source('NCBI · Gastrocnemius rupture: anatomy', 'https://www.ncbi.nlm.nih.gov/books/NBK560869/')],
  },
  'soleus-distal': {
    origin: 'Posterior proximal fibula and tibial soleal line.',
    insertion: 'Calcaneus via Achilles tendon.',
    action: 'Plantar flexes the ankle; steadies the leg over the foot.',
    innervation: 'Tibial nerve.',
    bloodSupply: 'Popliteal, posterior tibial and fibular arteries.',
    references: [table],
  },
  anterior: {
    origin: 'Lateral tibial condyle, upper lateral tibia and interosseous membrane.',
    insertion: 'Medial cuneiform and first metatarsal base, on their medial/plantar surfaces.',
    action: 'Dorsiflexes the ankle and inverts the foot.',
    innervation: 'Deep fibular nerve.',
    bloodSupply: 'Anterior tibial artery.',
    references: [table, source('NCBI · Tibialis anterior muscles', 'https://www.ncbi.nlm.nih.gov/books/NBK513304/')],
  },
  fibularis: {
    origin: 'Fibular head and proximal lateral fibula.',
    insertion: 'Plantar medial cuneiform and base of the first metatarsal.',
    action: 'Everts and plantar flexes the foot; helps support its transverse arch.',
    innervation: 'Superficial fibular nerve.',
    bloodSupply: 'Anterior tibial and fibular artery branches.',
    references: [source('NCBI · Fibularis longus muscle', 'https://www.ncbi.nlm.nih.gov/books/NBK546650/'), lateral],
  },
  'fibularis-brevis': {
    origin: 'Lower two-thirds of the lateral fibula and anterior intermuscular septum.',
    insertion: 'Tuberosity at the base of the fifth metatarsal.',
    action: 'Everts the foot and assists ankle plantar flexion.',
    innervation: 'Superficial fibular nerve.',
    bloodSupply: 'Anterior tibial and fibular artery branches.',
    references: [source('NCBI · Fibularis brevis muscle', 'https://www.ncbi.nlm.nih.gov/books/NBK535427/'), lateral],
  },
  ehl: {
    origin: 'Middle fibula and adjacent interosseous membrane.',
    insertion: 'Dorsal base of the distal great-toe phalanx.',
    action: 'Extends the great toe and assists ankle dorsiflexion.',
    innervation: 'Deep fibular nerve.',
    bloodSupply: 'Anterior tibial artery.',
    references: [source('A cadaveric study of extensor hallucis longus morphology', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6607556/'), anterior],
  },
  edl: {
    origin: 'Lateral tibial condyle, upper anterior fibula and interosseous membrane.',
    insertion: 'Middle/distal phalanges of toes 2–5 through extensor expansions.',
    action: 'Extends toes 2–5 and dorsiflexes the ankle.',
    innervation: 'Deep fibular nerve.',
    bloodSupply: 'Anterior tibial artery.',
    references: [table, anterior],
  },
  edb: {
    origin: 'Dorsolateral calcaneus, inferior extensor retinaculum and talocalcaneal interosseous ligament.',
    insertion: 'Extensor expansions of toes 2–4, joining the long extensor tendons.',
    action: 'Assists extension of toes 2–4.',
    innervation: 'Deep fibular nerve.',
    bloodSupply: 'Dorsalis pedis, anterior tibial and fibular arteries.',
    references: [foot],
  },
  'abductor-hallucis': {
    origin: 'Calcaneal tuberosity, flexor retinaculum and plantar aponeurosis.',
    insertion: 'Medial base of the proximal great-toe phalanx.',
    action: 'Abducts and assists flexion of the great toe.',
    innervation: 'Medial plantar nerve.',
    bloodSupply: 'Medial plantar artery.',
    references: [foot, table],
  },
  'abductor-digiti': {
    origin: 'Calcaneal tuberosity, plantar aponeurosis and intermuscular septum.',
    insertion: 'Lateral base of the fifth proximal phalanx.',
    action: 'Abducts and flexes the fifth toe.',
    innervation: 'Lateral plantar nerve.',
    bloodSupply: 'Lateral plantar and fifth-toe digital arteries.',
    references: [table, foot],
  },
  'tibialis-posterior': {
    origin: 'Posterior proximal tibia and fibula, and the interosseous membrane.',
    insertion: 'Mainly navicular tuberosity; expansions to cuneiforms, cuboid, bases of metatarsals 2–4 and sustentaculum tali.',
    action: 'Inverts and plantar flexes the foot; supports the medial arch.',
    innervation: 'Tibial nerve.',
    bloodSupply: 'Predominantly posterior tibial artery branches.',
    references: [source('NCBI · Tibialis posterior muscle', 'https://www.ncbi.nlm.nih.gov/books/NBK539913/')],
  },
  fdl: {
    origin: 'Posteromedial tibia below the soleal line.',
    insertion: 'Plantar distal phalangeal bases of toes 2–5.',
    action: 'Flexes toes 2–5; assists ankle plantar flexion.',
    innervation: 'Tibial nerve.',
    bloodSupply: 'Posterior tibial artery.',
    references: [table],
  },
  fhl: {
    origin: 'Lower posterior fibula and interosseous membrane.',
    insertion: 'Plantar base of the distal great-toe phalanx.',
    action: 'Flexes the great toe; assists ankle plantar flexion.',
    innervation: 'Tibial nerve.',
    bloodSupply: 'Fibular artery.',
    references: [table, source('NCBI · Flexor hallucis longus muscle', 'https://www.ncbi.nlm.nih.gov/books/NBK539776/')],
  },
};

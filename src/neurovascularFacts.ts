import catalog from './neurovascularCatalog.json';
import type { Structure, Tissue } from './data';

/** Typical anatomy, independently summarized from the linked references.
 * Each entry is a source object (sometimes a branch group), not a claim that
 * the mesh reproduces every branch, clinical variant, or terminal territory.
 */
export interface NeurovascularFact {
  text: string;
  source: { title: string; url: string };
}
const source = (title: string, url: string) => ({ title, url });
const arteries = source('UAMS · Arteries of the lower limb', 'https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/artery-tables/arteries-of-the-lower-limb/');
const nerves = source('UAMS · Nerves of the lower limb', 'https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/nerve-tables/nerves-of-the-lower-limb/');
const veins = source('UAMS · Selected veins of the lower limb', 'https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/vein-tables/selected-veins-of-the-lower-limb/');
const arches = source('NCBI · Arches of the foot', 'https://www.ncbi.nlm.nih.gov/books/NBK587361/');
const ankle = source('NCBI · Ankle joint: vascular anatomy', 'https://www.ncbi.nlm.nih.gov/books/NBK545158/');
const calf = source('NCBI · Calf: vascular anatomy', 'https://www.ncbi.nlm.nih.gov/books/NBK459362/');
const anterior = source('NCBI · Leg anterior compartment', 'https://www.ncbi.nlm.nih.gov/books/NBK539725/');
const posteriorPulse = source('NCBI · Posterior tibial artery', 'https://www.ncbi.nlm.nih.gov/books/NBK536981/');
const pulse = source('NCBI · Peripheral pulse', 'https://www.ncbi.nlm.nih.gov/books/NBK542175/');
const tunnel = source('Cadaveric study · Posterior tibial artery in the tarsal tunnel', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10130123/');
const footNerves = source('NCBI · Foot nerves', 'https://www.ncbi.nlm.nih.gov/books/NBK537292/');
const fibular = source('Cadaveric study · Superficial peroneal nerve in the ankle and foot', 'https://pubmed.ncbi.nlm.nih.gov/8050234/');
const footVeins = source('NCBI · Foot veins', 'https://www.ncbi.nlm.nih.gov/books/NBK542295/');
const foot = source('NCBI · Foot muscles: venous drainage', 'https://www.ncbi.nlm.nih.gov/books/NBK539705/');
const deepVeins = source('NCBI · Peripheral vascular anatomy', 'https://www.ncbi.nlm.nih.gov/books/NBK27355/');
const saphenous = source('NCBI · Saphenous nerve, artery, and vein', 'https://www.ncbi.nlm.nih.gov/books/NBK541045/');
const saphenousVeins = source('NCBI · Saphenous vein grafts: anatomy', 'https://www.ncbi.nlm.nih.gov/books/NBK537035/');
const medialBranch = source('Cadaveric study · Medial plantar superficial branch artery', 'https://pubmed.ncbi.nlm.nih.gov/29575166/');
const facts = (reference: NeurovascularFact['source'], ...text: string[]): NeurovascularFact[] => text.map(text => ({ text, source: reference }));

// Explicit source-name keys make missing fact coverage fail instead of silently
// replacing unfamiliar structures with generic or inferred anatomical claims.
const bySource: Record<string, NeurovascularFact[]> = {
  'Anterior tibial artery.r': facts(anterior, 'Crosses the interosseous membrane into the anterior leg.', 'Continues at the ankle as dorsalis pedis.'),
  'Arcuate artery.r': facts(arteries, 'Branches from dorsalis pedis.', 'Gives rise to dorsal metatarsal arteries.'),
  'Calcaneal branches of fibular artery.r': facts(arches, 'Fibular artery branches reach the lateral heel.', 'Join the heel arterial network.'),
  'Calcaneal branches of posterior tibial artery.r': facts(ankle, 'Arise from the posterior tibial artery.', 'Reach the medial heel.'),
  'Common plantar digital arteries.r': facts(arches, 'Belong to the plantar digital arterial system.', 'Continue toward the toes from the plantar metatarsal vessels.'),
  'Deep plantar artery.r': facts(arteries, 'Branches from dorsalis pedis.', 'Joins the lateral plantar artery in the plantar arch.'),
  'Dorsal digital arteries of foot.r': facts(arteries, 'Branch from dorsal metatarsal vessels.', 'Run on the dorsal toes; nail beds receive plantar arterial supply.'),
  'Dorsal metatarsal arteries.r': facts(arteries, 'Continue toward the dorsal digital arteries.', 'Communicate with the plantar circulation through perforating branches.'),
  'Dorsalis pedis artery.r': [...facts(anterior, 'Continues the anterior tibial artery across the dorsal foot.'), ...facts(pulse, 'Its pulse site is just lateral to the extensor hallucis longus tendon.')],
  'Fibular artery.r': facts(calf, 'Also called the peroneal artery.', 'Usually arises from the posterior tibial artery.'),
  'Lateral plantar artery.r': facts(ankle, 'A terminal branch of the posterior tibial artery.', 'Continues into the deep plantar arch.'),
  'Lateral tarsal artery.r': facts(arteries, 'Branches from dorsalis pedis.', 'Joins the arcuate artery near the lateral tarsus.'),
  'Medial plantar artery.r': facts(ankle, 'A terminal branch of the posterior tibial artery.', 'Runs along the medial sole.'),
  'Perforating branches of plantar metatarsal arteries.r': facts(arteries, 'Connect plantar and dorsal metatarsal circulations.', 'Pass between the metatarsals.'),
  'Plantar arch.r': facts(ankle, 'Joins lateral plantar and deep plantar arteries.', 'Lies in the deep sole.'),
  'Plantar metatarsal arteries.r': facts(arteries, 'Branch from the plantar arch.', 'Continue into digital vessels toward the toes.'),
  'Posterior tibial artery.r': [...facts(tunnel, 'Passes through the tarsal tunnel with tibial nerve and posterior tibial veins.'), ...facts(posteriorPulse, 'Its pulse site lies behind the medial malleolus.')],
  'Proper plantar digital arteries.r': facts(arteries, 'Run along the plantar toes.', 'Their territory includes the distal dorsal toe and nail bed.'),
  'Superficial branch of medial plantar artery.r': facts(medialBranch, 'A branch of the medial plantar artery.', 'Emerges into subcutaneous tissue and gives cutaneous perforators.'),
  'Common plantar digital branches of lateral plantar nerve.r': facts(nerves, 'Arise from the superficial lateral plantar branch.', 'Divide into proper digital nerves.'),
  'Common plantar digital branches of medial plantar nerve': facts(nerves, 'Arise from the medial plantar nerve.', 'Divide into proper digital nerves.'),
  'Deep fibular nerve.r': facts(footNerves, 'A branch of the common fibular nerve.', 'Its medial terminal branch carries sensation from the first dorsal web space.'),
  'Dorsal digital branches of deep fibular nerve.r': facts(footNerves, 'Continue from the medial terminal deep fibular branch.', 'Carry sensation from the first dorsal web space.'),
  'Dorsal digital branches of superficial fibular nerve.r': facts(footNerves, 'Continue the superficial fibular sensory branches.', 'Reach dorsal toe skin outside the first web space; territories vary.'),
  'Intermediate dorsal cutaneous nerve of foot.r': facts(fibular, 'A terminal superficial fibular branch.', 'Its course relative to the distal fibula varies.'),
  'Lateral plantar nerve.r': facts(nerves, 'A terminal branch of the tibial nerve.', 'Carries sensation from the lateral sole and lateral one-and-a-half toes.'),
  'Medial dorsal cutaneous nerve of foot.r': facts(fibular, 'A terminal superficial fibular branch.', 'May emerge separately from the intermediate dorsal cutaneous nerve.'),
  'Medial plantar nerve.r': facts(nerves, 'A terminal branch of the tibial nerve.', 'Carries sensation from the medial sole and medial three-and-a-half toes.'),
  'Muscular branches of deep fibular nerve.r': facts(footNerves, 'Motor branches of the deep fibular nerve.', 'The lateral terminal branch enters the dorsal foot muscle group.'),
  'Proper plantar digital branches of lateral plantar nerve.r': facts(nerves, 'Terminal sensory branches toward the lateral toes.', 'Plantar digital territories include toe tips and nail beds.'),
  'Proper plantar digital branches of medial plantar nerve.r': facts(nerves, 'Terminal sensory branches toward the medial toes.', 'Plantar digital territories include toe tips and nail beds.'),
  'Saphenous nerve.r': facts(saphenous, 'A sensory branch of the femoral nerve.', 'Follows the medial leg toward the medial ankle and foot.'),
  'Superficial fibular nerve.r': facts(fibular, 'Becomes subcutaneous above the ankle.', 'Usually divides into medial and intermediate dorsal cutaneous branches.'),
  'Sural nerve.r': facts(nerves, 'Carries sensation from the lateral foot.', 'Passes behind the lateral malleolus.'),
  'Tibial nerve.r': facts(tunnel, 'Passes behind the medial malleolus beneath the flexor retinaculum.', 'Shares the tarsal tunnel with posterior tibial vessels and the tibialis posterior, flexor digitorum longus and flexor hallucis longus tendons.'),
  'Anterior tibial veins.r': facts(anterior, 'Accompany the anterior tibial artery.', 'Drain toward the popliteal vein.'),
  'Dorsal digital veins of foot.r': facts(veins, 'Drain dorsal toe tissues.', 'Join dorsal metatarsal veins toward the dorsal venous arch.'),
  'Dorsal metatarsal veins.r': facts(veins, 'Receive dorsal digital veins.', 'Drain into the dorsal venous arch.'),
  'Dorsal venous arch of foot.r': facts(veins, 'Collects superficial blood from the dorsal foot.', 'Connects medially to great saphenous and laterally to small saphenous drainage.'),
  'Fibular veins.r': [...facts(deepVeins, 'Paired deep veins accompanying the fibular artery.'), ...facts(calf, 'Drain into the posterior tibial veins.')],
  'Great saphenous vein.r': facts(saphenousVeins, 'Runs anterior to the medial malleolus.', 'Ascends superficially along the medial lower limb.'),
  'Intercapitular veins of foot.r': facts(foot, 'Cross the interdigital spaces.', 'Connect venous channels in the forefoot.'),
  'Lateral plantar veins.r': facts(arches, 'Accompany the lateral plantar artery.', 'Unite with medial plantar veins to form posterior tibial veins.'),
  'Medial plantar veins.r': facts(arches, 'Accompany the medial plantar artery.', 'Unite with lateral plantar veins to form posterior tibial veins.'),
  'Plantar digital veins.r': facts(footVeins, 'Collect blood from the plantar toes.', 'Drain toward the plantar venous arch.'),
  'Plantar metatarsal veins.r': facts(foot, 'Receive converging digital veins.', 'Continue toward the deep plantar venous arch.'),
  'Plantar venous arch.r': facts(arches, 'Collects venous blood in the sole.', 'Continues into medial and lateral plantar veins.'),
  'Posterior tibial veins.r': [...facts(deepVeins, 'Paired deep veins accompanying the posterior tibial artery.'), ...facts(tunnel, 'Pass through the tarsal tunnel alongside tibial nerve and artery.')],
  'Small saphenous vein.r': facts(saphenousVeins, 'Passes behind the lateral malleolus.', 'Ascends in the superficial posterior calf.'),
};

export const neurovascularFacts: Record<string, NeurovascularFact[]> = Object.fromEntries(catalog.map(entry => {
  const entries = bySource[entry.sourceObject];
  if (!entries) throw new Error(`Missing neurovascular facts: ${entry.sourceObject}`);
  return [entry.id, entries];
}));

export const neurovascularStructures: Structure[] = catalog.map(entry => {
  const entries = neurovascularFacts[entry.id];
  return {
    id: entry.id, name: entry.name, tissue: entry.tissue as Tissue,
    region: entry.group === 'Leg' ? 'Lower leg' : 'Foot', group: entry.group,
    description: `${entry.name} in the right ${entry.group === 'Leg' ? 'lower leg' : entry.group.toLowerCase()}.${/branches|arteries|veins/i.test(entry.name) ? ' This entry groups the named branches together.' : ''}`,
    role: entry.tissue === 'artery' ? 'Arterial circulation.' : entry.tissue === 'vein' ? 'Venous return.' : 'Peripheral nerve signaling.',
    connection: entry.group,
    hint: 'Use Neurovascular, then Focus or Isolate to inspect this structure. Branching and sensory territories vary between people.',
    facts: entries,
    references: [...new Map(entries.map(fact => [fact.source.url, fact.source])).values()],
  };
});

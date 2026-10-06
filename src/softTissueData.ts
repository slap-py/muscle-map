import type { Structure } from './data';
import { cartilageBoneIds, cartilageId } from './joints';
const entry=(id:string,name:string,tissue:Structure['tissue'],description:string):Structure=>({id,name,tissue,description,region:'Foot',group:tissue==='cartilage'?'Joint surface cartilage':tissue==='muscle'?'Deep posterior compartment':'Registered soft tissues',role:'Explore the modeled attachment records and connected structures.',connection:'Surface-fitted footprints and guide points.',hint:'Use Focus or Use Neighbors to inspect.'});
export const softTissueStructures:Structure[]=[
  entry('tibialis-posterior','Tibialis posterior','muscle','Source muscle belly continuing into the tendon behind the medial malleolus.'),
  entry('fdl','Flexor digitorum longus','muscle','Source muscle belly continuing into four long digital flexor slips.'),
  entry('fhl','Flexor hallucis longus','muscle','Source muscle belly continuing into the tendon beneath the sustentaculum tali.'),
  entry('tibialis-posterior-tendon','Tibialis posterior tendon','tendon','Medial retromalleolar tendon with a main navicular insertion and plantar expansions.'),
  entry('flexor-digitorum-tendons','Flexor digitorum longus tendons','tendon','Medial retromalleolar course and four slips to the plantar distal phalanges of toes 2–5.'),
  entry('flexor-hallucis-tendon','Flexor hallucis longus tendon','tendon','Passes behind the medial ankle, beneath the sustentaculum tali and between the hallux sesamoids.'),
  entry('abductor-hallucis-tendon','Abductor hallucis tendon','tendon','Medial insertion at the base of the proximal hallux phalanx.'),
  entry('abductor-digiti-tendon','Abductor digiti minimi tendon','tendon','Lateral insertion at the base of the proximal fifth phalanx.'),
  entry('short-plantar','Short plantar ligament','ligament','A broad plantar calcaneocuboid band deep to the long plantar ligament.'),
  entry('flexor-retinaculum','Flexor retinaculum','fascia','Broad medial band over the tibialis posterior, FDL and FHL tendon paths.'),
  ...cartilageBoneIds.filter(b=>b!=='talus').map(b=>entry(cartilageId(b),`${b.replaceAll('-',' ')} · articular cartilage`,'cartilage','Thin offset shells on selected opposing joint surfaces of this bone.')),
];

const roles:Record<string,string>={
  'tibialis-posterior':'Inverts and plantar flexes the foot; supports the medial arch.',
  'tibialis-posterior-tendon':'Transmits tibialis posterior force to the navicular and plantar midfoot.',
  'fdl':'Flexes the lesser toes; assists plantar flexion.',
  'flexor-digitorum-tendons':'Transmit long-flexor force to the distal phalanges of toes 2–5.',
  'fhl':'Flexes the great toe; assists plantar flexion.',
  'flexor-hallucis-tendon':'Transmits long-flexor force to the distal hallux phalanx.',
  'abductor-hallucis-tendon':'Transmits abductor hallucis force to the medial great toe.',
  'abductor-digiti-tendon':'Transmits abductor digiti minimi force to the fifth toe.',
  'short-plantar':'Reinforces the plantar calcaneocuboid joint.',
  'flexor-retinaculum':'Retains the medial flexor tendons near the ankle.',
};
for(const structure of softTissueStructures) {
  structure.role=roles[structure.id] ?? 'Provides a smooth bearing layer at modeled joint surfaces.';
  structure.name=structure.name[0].toUpperCase()+structure.name.slice(1);
}

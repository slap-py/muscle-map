import neurovascularCatalog from './neurovascularCatalog.json';
import { structures, byId } from './data';
import { relatedIds } from './foot';
import { attachmentRecords } from './attachments';
export const atlasTabs = [
  ['all','All'], ['leg','Leg'], ['ankle','Ankle & heel'], ['midfoot','Midfoot'],
  ['toe-1','Big toe'], ['toe-2','Toe 2'], ['toe-3','Toe 3'], ['toe-4','Toe 4'], ['toe-5','Toe 5'],
] as const;
const toeMembers = (n: number) => {
  const ids = new Set(structures.filter(s => s.id === `metatarsal-${n}` || s.id.startsWith(`phalanx-${n}-`) || (n === 1 && s.id.startsWith('sesamoid-'))).map(s => s.id));
  const bones = new Set(ids);
  for (const id of bones) for (const other of relatedIds(id)) if (byId[other].tissue !== 'bone' && byId[other].tissue !== 'cartilage') ids.add(other);
  // Cartilage belongs to its own ray, even when it articulates with a neighboring bone.
  for (const id of bones) if(byId[`cartilage-${id}`]) ids.add(`cartilage-${id}`);
  for (const r of attachmentRecords) if(ids.has(r.structureId) && byId[r.from.structureId]?.tissue === 'muscle') ids.add(r.from.structureId);
  return ids;
};
const toes = Array.from({length:5},(_,i)=>toeMembers(i+1));
export function atlasIds(tab: string): Set<string> {
  if(tab.startsWith('toe-')) return toes[Number(tab.slice(4))-1] ?? new Set();
  if(tab === 'all') return new Set(structures.map(s=>s.id));
  if(tab === 'leg') return new Set(structures.filter(s=>s.region==='Lower leg' || ['fdl','fhl','tibialis-posterior','cartilage-tibia','cartilage-fibula'].includes(s.id)).map(s=>s.id));
  const bones = tab === 'ankle' ? ['talus','calcaneus','tibia','fibula'] : ['navicular','cuboid','cuneiform-medial','cuneiform-intermediate','cuneiform-lateral'];
  const ids = new Set(bones);
  // The source stores digital branches as whole-foot groups: do not invent
  // per-toe membership or relationship edges. Foot entries remain discoverable
  // in Midfoot, with ankle-crossing leg trunks also visible in Ankle & heel.
  for (const entry of neurovascularCatalog) {
    if (tab === 'midfoot' && entry.group !== 'Leg') ids.add(entry.id);
    if (tab === 'ankle' && (entry.group === 'Leg' || entry.sourceObject.includes('Calcaneal'))) ids.add(entry.id);
  }
  for(const id of bones) for(const other of relatedIds(id)) if(byId[other].tissue !== 'bone') ids.add(other);
  return ids;
}

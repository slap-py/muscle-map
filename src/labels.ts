import { structures } from './data';
const overview = new Set(['tibia','fibula','talus','calcaneus','navicular','cuboid','achilles','gastrocnemius','anterior','plantar-fascia','metatarsal-1','superior-extensor']);
const longTendons = new Set(['tibialis-anterior-tendon','tibialis-posterior-tendon','extensor-hallucis-tendon','extensor-digitorum-tendons','flexor-hallucis-tendon','flexor-digitorum-tendons','fibularis-longus-tendon','fibularis-brevis-tendon']);
const regional = new Set(['atfl','cfl','deltoid','spring','lisfranc']);
/** Cartilage is intentionally absent: it is labeled only on selection or hover. */
export const labelTier: Record<string, 1 | 2 | 3> = Object.fromEntries(
  structures.filter(s=>s.tissue!=='cartilage').map(s=>[s.id,overview.has(s.id)?1:s.tissue==='bone'||s.tissue==='muscle'||longTendons.has(s.id)||regional.has(s.id)?2:3]),
);
export function tierForZoom(ratio: number): 1 | 2 | 3 { return ratio > .7 ? 1 : ratio >= .35 ? 2 : 3; }

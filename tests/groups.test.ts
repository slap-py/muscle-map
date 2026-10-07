import { describe, expect, it } from 'vitest';
import { byId, structures, type Tissue } from '../src/data';
import { atlasIds, atlasTabs } from '../src/atlas';

const allowed: Record<Exclude<Tissue, 'skin'>, readonly string[]> = {
  muscle: ['Anterior compartment', 'Lateral compartment', 'Superficial posterior compartment', 'Deep posterior compartment', 'Dorsal foot muscles', 'Plantar foot muscles'],
  bone: ['Leg bones', 'Tarsals', 'Metatarsals', 'Phalanges', 'Sesamoids'],
  ligament: ['Lateral ankle ligaments', 'Medial (deltoid) ligament', 'Syndesmosis', 'Midfoot ligaments'],
  tendon: ['Extensor tendons', 'Flexor tendons', 'Fibular tendons', 'Achilles'],
  fascia: ['Retinacula', 'Plantar fascia'],
  cartilage: ['Articular cartilage'],
  artery: ['Leg', 'Dorsal foot', 'Plantar foot'],
  vein: ['Leg', 'Dorsal foot', 'Plantar foot'],
  nerve: ['Leg', 'Dorsal foot', 'Plantar foot'],
};

const members: Record<string, string[]> = {
  'Anterior compartment': ['anterior', 'ehl', 'edl'],
  'Lateral compartment': ['fibularis', 'fibularis-brevis'],
  'Superficial posterior compartment': ['gastrocnemius', 'soleus-distal'],
  'Deep posterior compartment': ['tibialis-posterior', 'fdl', 'fhl'],
  'Dorsal foot muscles': ['edb'],
  'Plantar foot muscles': ['abductor-hallucis', 'abductor-digiti'],
  'Leg bones': ['tibia', 'fibula'],
  'Tarsals': ['talus', 'calcaneus', 'navicular', 'cuboid', 'cuneiform-medial', 'cuneiform-intermediate', 'cuneiform-lateral'],
  'Metatarsals': Array.from({ length: 5 }, (_, i) => `metatarsal-${i + 1}`),
  'Phalanges': Array.from({ length: 5 }, (_, i) => ['proximal', ...(i ? ['middle'] : []), 'distal'].map(segment => `phalanx-${i + 1}-${segment}`)).flat(),
  'Sesamoids': ['sesamoid-medial', 'sesamoid-lateral'],
  'Lateral ankle ligaments': ['atfl', 'cfl', 'ptfl'],
  'Medial (deltoid) ligament': ['deltoid'],
  'Syndesmosis': ['aitfl'],
  // The prescribed taxonomy includes forefoot MTP bands in its foot-ligament bucket.
  'Midfoot ligaments': ['spring', 'long-plantar', 'short-plantar', 'lisfranc', 'dorsal-talonavicular', ...Array.from({ length: 5 }, (_, i) => `mtp-collateral-${i + 1}`)],
  'Extensor tendons': ['tibialis-anterior-tendon', 'extensor-hallucis-tendon', 'extensor-digitorum-tendons', 'edb-tendons'],
  'Flexor tendons': ['tibialis-posterior-tendon', 'flexor-digitorum-tendons', 'flexor-hallucis-tendon', 'abductor-hallucis-tendon', 'abductor-digiti-tendon'],
  'Fibular tendons': ['fibularis-longus-tendon', 'fibularis-brevis-tendon'],
  'Achilles': ['achilles'],
  'Retinacula': ['superior-extensor', 'inferior-extensor', 'superior-fibular', 'inferior-fibular', 'flexor-retinaculum'],
  'Plantar fascia': ['plantar-fascia'],
};

describe('anatomical atlas groups', () => {
  it('uses the prescribed tissue-specific groups across every regional atlas tab', () => {
    expect(atlasIds('all').size).toBe(structures.length);
    for (const [tab] of atlasTabs) for (const id of atlasIds(tab)) {
      const structure = byId[id];
      expect(structure, `${tab}/${id}`).toBeDefined();
      if (structure.tissue === 'skin') continue;
      expect(allowed[structure.tissue], `${tab}/${id}: ${structure.group}`).toContain(structure.group);
    }
  });

  it.each(Object.entries(members))('assigns anatomically consistent members to %s', (group, ids) => {
    expect(structures.filter(s => s.group === group).map(s => s.id).sort()).toEqual([...ids].sort());
  });

  it('groups every articular surface together regardless of joint or bone region', () => {
    const cartilage = structures.filter(s => s.tissue === 'cartilage');
    expect(cartilage.length).toBeGreaterThan(1);
    expect(cartilage.some(s => s.id === 'talar-cartilage')).toBe(true);
    expect(cartilage.some(s => s.id === 'cartilage-tibia')).toBe(true);
    for (const structure of cartilage) expect(structure.group).toBe('Articular cartilage');
  });

  it('explicitly exempts the exterior skin from the tissue-specific group taxonomy', () => {
    const skin = structures.filter(s => s.tissue === 'skin');
    expect(skin.map(s => s.id)).toEqual(['skin']);
    expect(skin[0].group).toBe('Outer surface');
    expect(atlasIds('all').has('skin')).toBe(true);
    expect(Object.values(allowed).flat()).not.toContain(skin[0].group);
  });
});

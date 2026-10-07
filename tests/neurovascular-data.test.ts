import { describe, expect, it } from 'vitest';
import catalog from '../src/neurovascularCatalog.json';
import { byId, colors, structures, tissueNames } from '../src/data';
import { atlasIds } from '../src/atlas';
import { neurovascularFacts } from '../src/neurovascularFacts';

describe('neurovascular atlas and fact coverage', () => {
  it('exposes each explicit source object exactly once as a stable atlas ID', () => {
    expect(catalog).toHaveLength(49);
    expect(new Set(catalog.map(s => s.id)).size).toBe(49);
    expect(new Set(catalog.map(s => s.sourceObject)).size).toBe(49);
    expect(catalog.filter(s => s.tissue === 'artery')).toHaveLength(19);
    expect(catalog.filter(s => s.tissue === 'vein')).toHaveLength(14);
    expect(catalog.filter(s => s.tissue === 'nerve')).toHaveLength(16);
    for (const entry of catalog) {
      expect(structures.filter(s => s.id === entry.id)).toHaveLength(1);
      expect(byId[entry.id].name).toBe(entry.name);
      expect(byId[entry.id].tissue).toBe(entry.tissue);
      expect(entry.id).toMatch(new RegExp(`^${entry.tissue}-[a-z0-9-]+$`));
      expect(atlasIds('all').has(entry.id)).toBe(true);
      expect(atlasIds(entry.group === 'Leg' ? 'leg' : 'midfoot').has(entry.id)).toBe(true);
    }
  });

  it('gives every inspector entry two or three individually sourced facts', () => {
    expect(Object.keys(neurovascularFacts).sort()).toEqual(catalog.map(s => s.id).sort());
    for (const { id } of catalog) {
      const facts = byId[id].facts!;
      expect(facts.length).toBeGreaterThanOrEqual(2);
      expect(facts.length).toBeLessThanOrEqual(3);
      for (const fact of facts) {
        expect(fact.text.length).toBeGreaterThan(10);
        expect(fact.source.title.length).toBeGreaterThan(5);
        expect(new URL(fact.source.url).protocol).toBe('https:');
        expect(byId[id].references).toContainEqual(fact.source);
      }
    }
  });

  it('retains pulse-site and tarsal-tunnel study facts', () => {
    expect(neurovascularFacts['artery-dorsalis-pedis'].map(f => f.text).join(' ')).toMatch(/pulse.*lateral.*extensor hallucis longus/i);
    expect(neurovascularFacts['artery-posterior-tibial'].map(f => f.text).join(' ')).toMatch(/pulse.*behind the medial malleolus/i);
    expect(neurovascularFacts['nerve-tibial'].map(f => f.text).join(' ')).toMatch(/tarsal tunnel.*posterior tibial.*tibialis posterior.*flexor digitorum longus.*flexor hallucis longus/i);
  });

  it('uses fixed anatomy colors and excludes lymph and upstream exception anatomy', () => {
    expect([colors.artery, colors.vein, colors.nerve]).toEqual(['#c0392b', '#2f5d9e', '#e0b43a']);
    expect([tissueNames.artery, tissueNames.vein, tissueNames.nerve]).toEqual(['Arteries', 'Veins', 'Nerves']);
    for (const entry of catalog) expect(entry.sourceObject).not.toMatch(/lymph|cranial|foramina|inner ear|kidney|brainder|white matter/i);
    // One verified right-foot source object lacks the usual right-side suffix.
    expect(catalog.filter(s => !s.sourceObject.endsWith('.r')).map(s => s.sourceObject)).toEqual(['Common plantar digital branches of medial plantar nerve']);
  });
});

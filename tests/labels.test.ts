import {describe,it,expect} from 'vitest';
import {byId,structures} from '../src/data';
import {labelTier,tierForZoom} from '../src/labels';
describe('zoom label tiers',()=>{
 it('references only real, non-cartilage structures',()=>{for(const id of Object.keys(labelTier)){expect(byId[id]).toBeDefined();expect(byId[id].tissue).not.toBe('cartilage');}expect(Object.keys(labelTier)).toHaveLength(structures.filter(s=>s.tissue!=='cartilage').length);});
 it('keeps the twelve overview landmarks in tier one',()=>{expect(Object.keys(labelTier).filter(id=>labelTier[id]===1)).toHaveLength(12);expect(labelTier.anterior).toBe(1);expect(labelTier['phalanx-1-distal']).toBe(2);expect(labelTier['edb-tendons']).toBe(3);expect(labelTier['flexor-hallucis-tendon']).toBe(2);});
 it('changes tiers at the specified zoom boundaries',()=>{expect([.71,.7,.35,.349].map(tierForZoom)).toEqual([1,2,2,3]);});
});

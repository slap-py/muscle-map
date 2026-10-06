import {describe,it,expect} from 'vitest';
import {structures,byId} from '../src/data';
import {muscleFacts} from '../src/muscleFacts';
describe('muscle inspector facts',()=>{
 it('covers exactly the active muscles with cited information',()=>{
  expect(Object.keys(muscleFacts).sort()).toEqual(structures.filter(s=>s.tissue==='muscle').map(s=>s.id).sort());
  for(const id of Object.keys(muscleFacts)){
   const d=byId[id];
   for(const key of ['origin','insertion','action','innervation','bloodSupply'] as const)expect(d[key]?.length,id+' '+key).toBeGreaterThan(0);
   expect(d.references?.length,id+' sources').toBeGreaterThan(0);
   for(const source of d.references??[])expect(new URL(source.url).protocol).toBe('https:');
  }
 });
 it('does not author new fact fields for other tissues',()=>{
  for(const d of structures.filter(s=>s.tissue!=='muscle'))for(const key of ['origin','insertion','action','innervation','bloodSupply','articulations'] as const)expect(d[key],d.id+' '+key).toBeUndefined();
 });
});

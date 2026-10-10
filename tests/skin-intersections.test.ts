import {describe,it,expect} from 'vitest';
import {Triangle,Vector3} from 'three';
// @ts-expect-error Standalone audit helper intentionally runs as JavaScript.
import {trianglesIntersect} from '../scripts/skin-intersections.mjs';
const triangle=(points:number[][])=>new Triangle(...points.map(p=>new Vector3(...p as [number,number,number])) as [Vector3,Vector3,Vector3]);
describe('skin self-intersection audit',()=>{
 it('rejects the disjoint nearly coplanar marching-cubes pair that the BVH predicate reports as intersecting',()=>{
  const a=triangle([[139.5,-53.71604919433594,47],[140,-53.5,47.28395080566406],[139.71604919433594,-53.5,47]]);
  const b=triangle([[139.5,-54,47.28395080566406],[139.71604919433594,-54,47.5],[140,-53.71604919433594,47.5]]);
  expect(trianglesIntersect(a,b)).toBe(false);
 });
 it('detects a transverse crossing and coplanar overlap',()=>{
  const a=triangle([[0,0,0],[2,0,0],[0,2,0]]);
  expect(trianglesIntersect(a,triangle([[.5,.5,-1],[.5,.5,1],[1,.5,0]]))).toBe(true);
  expect(trianglesIntersect(a,triangle([[.2,.2,0],[.7,.2,0],[.2,.7,0]]))).toBe(true);
  expect(trianglesIntersect(a,triangle([[2,2,0],[3,2,0],[2,3,0]]))).toBe(false);
 });
});

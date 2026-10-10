import {Vector3} from 'three';
/** Independent separating-axis test, including axes for coplanar triangles.
 * Project relative to one vertex so millimetre world offsets do not amplify
 * roundoff in the nearly coplanar contours produced by marching cubes. */
export function trianglesIntersect(a,b,toleranceMm=1e-7) {
 const aa=[a.a,a.b,a.c],bb=[b.a,b.b,b.c];
 const edges=t=>[new Vector3().subVectors(t[1],t[0]),new Vector3().subVectors(t[2],t[1]),new Vector3().subVectors(t[0],t[2])];
 const ea=edges(aa),eb=edges(bb),na=new Vector3().crossVectors(ea[0],ea[1]),nb=new Vector3().crossVectors(eb[0],eb[1]);
 const axes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1),na,nb,...ea,...eb];
 for(const x of ea)for(const y of eb)axes.push(new Vector3().crossVectors(x,y));
 for(const e of ea)axes.push(new Vector3().crossVectors(na,e));
 for(const e of eb)axes.push(new Vector3().crossVectors(nb,e));
 for(const axis of axes) {
  if(axis.lengthSq()<1e-24)continue;axis.normalize();
  const project=t=>t.map(v=>new Vector3().subVectors(v,aa[0]).dot(axis));
  const x=project(aa),y=project(bb);
  if(Math.max(...x)<Math.min(...y)-toleranceMm || Math.max(...y)<Math.min(...x)-toleranceMm)return false;
 }
 return true;
}

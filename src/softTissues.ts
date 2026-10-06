import type { MeshBVH } from 'three-mesh-bvh';
import * as THREE from 'three';
import { attachmentRecords, type Footprint, type MmPoint } from './attachments';
import { jointSurfaces, cartilageId } from './joints';
import { colors } from './data';
import { ribbon } from './geometry';
import { enableMeshPicking } from './picking';
import type { createAnkle } from './ankle';
export type AnatomyParts = ReturnType<typeof createAnkle>['parts'];
export interface ResolvedFootprint {
  structureId:string; landmark:string; centerMm:MmPoint; normal:MmPoint;
  radiusMm:number; boundaryMm:MmPoint[]; meshIndex:number; faceIndex:number;
}
export interface SoftTissueReport { attachments:number; cartilagePatches:number; warnings:string[]; }
const v=(p:readonly number[])=>new THREE.Vector3(p[0],p[1],p[2]);
const tuple=(p:THREE.Vector3)=>p.toArray() as MmPoint;
function nearest(parts:AnatomyParts,id:string,point:THREE.Vector3) {
  let best:{point:THREE.Vector3;normal:THREE.Vector3;distance:number;faceIndex:number;meshIndex:number}|undefined;
  parts.get(id)?.meshes.forEach((mesh,meshIndex)=>{
    if(mesh.userData.fiber) return;
    const hit=(mesh.geometry.boundsTree as MeshBVH | undefined)?.closestPointToPoint(point);
    if(!hit || (best && hit.distance>=best.distance)) return;
    const pos=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index;
    const indices=[0,1,2].map(i=>idx?idx.getX(hit.faceIndex*3+i):hit.faceIndex*3+i);
    const tri=new THREE.Triangle(...indices.map(i=>new THREE.Vector3().fromBufferAttribute(pos,i)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
    best={point:hit.point.clone(),normal:tri.getNormal(new THREE.Vector3()),distance:hit.distance,faceIndex:hit.faceIndex,meshIndex};
  });
  return best;
}
export function resolveFootprint(parts:AnatomyParts,footprint:Footprint):ResolvedFootprint {
  const seed=v(footprint.seedMm),hit=nearest(parts,footprint.structureId,seed);
  // Soft-to-soft insertions (extensor apparatus, tibiospring) are not mislabeled as bone footprints.
  const center=hit?.point ?? seed,normal=hit?.normal ?? new THREE.Vector3(0,1,0);
  const u=new THREE.Vector3().crossVectors(normal,Math.abs(normal.y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize();
  const w=new THREE.Vector3().crossVectors(normal,u).normalize();
  const boundary:MmPoint[]=[];
  for(let i=0;i<12;i++) {
    const p=center.clone().addScaledVector(u,Math.cos(i*Math.PI/6)*footprint.radiusMm).addScaledVector(w,Math.sin(i*Math.PI/6)*footprint.radiusMm);
    boundary.push(tuple(nearest(parts,footprint.structureId,p)?.point ?? p));
  }
  return {structureId:footprint.structureId,landmark:footprint.landmark,centerMm:tuple(center),normal:tuple(normal),radiusMm:footprint.radiusMm,boundaryMm:boundary,meshIndex:hit?.meshIndex ?? -1,faceIndex:hit?.faceIndex ?? -1};
}
function replace(parts:AnatomyParts,id:string,meshes:THREE.Mesh[]) {
  const part=parts.get(id);if(!part) throw new Error(`Unknown soft tissue ${id}`);
  for(const old of part.meshes) {
    part.group.remove(old);old.geometry.dispose();
    for(const m of Array.isArray(old.material)?old.material:[old.material])m.dispose();
  }
  part.meshes.splice(0,part.meshes.length,...meshes);part.group.add(...meshes);
  const box=new THREE.Box3();
  for(const mesh of meshes) {mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox!);}
  if(!box.isEmpty())box.getCenter(part.anchor);
}
function meshFor(id:string,tissue:'tendon'|'ligament'|'fascia'|'cartilage',geometry:THREE.BufferGeometry,metadata:Record<string,unknown>) {
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[tissue],roughness:tissue==='cartilage'?0.36:0.68,side:THREE.DoubleSide}));
  mesh.name=id;mesh.userData={id,atlasId:id,fiber:false,source:'registered-procedural',...metadata};mesh.castShadow=true;mesh.receiveShadow=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();enableMeshPicking(mesh);return mesh;
}
/** Project penetrations and near-surface points outside the local bone triangle.
 * This is a static clearance correction, not a wrapping/biomechanics solver.
 */
function clearBones(parts:AnatomyParts,point:THREE.Vector3,clearance:number,bones:string[]) {
  const p=point.clone();
  for(let pass=0;pass<3;pass++) {
    let changed=false;
    for(const bone of bones) {
      const meshes=parts.get(bone)?.meshes ?? [];
      if(!meshes.some(m=>m.geometry.boundingBox && m.geometry.boundingBox.distanceToPoint(p)<=clearance))continue;
      const hit=nearest(parts,bone,p);if(!hit)continue;
      const signed=p.clone().sub(hit.point).dot(hit.normal);
      if(signed<clearance && hit.distance<20) {
        p.copy(hit.point).addScaledVector(hit.normal,clearance);changed=true;
      }
    }
    if(!changed)break;
  }
  return p;
}
/** Centripetal interpolation through explicit junction, pulley guides and insertion. */
export function tendonCurve(points:THREE.Vector3[]) { return new THREE.CatmullRomCurve3(points,false,'centripetal'); }
function tendonGeometry(parts:AnatomyParts,points:THREE.Vector3[],diameter:number,bones:string[]) {
  const curve=tendonCurve(points), count=(points.length-1)*48;
  // Fit densely sampled centerline to bone clearance while retaining exact junction/insertion.
  const samples=Array.from({length:count+1},(_,i)=>i===0?points[0].clone():i===count?points.at(-1)!.clone():i%48===0?points[i/48].clone():clearBones(parts,curve.getPoint(i/count),diameter/2+0.4,bones));
  // CurvePath uses smooth segments between the collision-corrected samples.
  const fitted=new THREE.CatmullRomCurve3(samples,false,'centripetal');
  const geo=new THREE.TubeGeometry(fitted,count,diameter/2,10,false);
  geo.userData.centerlineMm=samples.map(tuple);
  return geo;
}
function bandGeometry(parts:AnatomyParts,points:THREE.Vector3[],width:number,thickness:number,normal:MmPoint,bones:string[]) {
  const geometry=ribbon(points.map(tuple),width,thickness/2,normal);
  const pos=geometry.getAttribute('position');
  // The first/last rings are footprint edges; their vertices are projected below.
  for(let i=4;i<pos.count-4;i++) {
    const p=clearBones(parts,new THREE.Vector3().fromBufferAttribute(pos,i),0.35,bones);pos.setXYZ(i,p.x,p.y,p.z);
  }
  geometry.computeVertexNormals();return geometry;
}
function fitBandEnds(parts:AnatomyParts,geometry:THREE.BufferGeometry,from:Footprint,to:Footprint) {
  const pos=geometry.getAttribute('position');
  for(const [foot,base] of [[from,0],[to,pos.count-4]] as [Footprint,number][]) for(let i=0;i<4;i++) {
    const point=new THREE.Vector3().fromBufferAttribute(pos,base+i),hit=nearest(parts,foot.structureId,point);
    if(hit) {point.copy(hit.point).addScaledVector(hit.normal,0.15+(i>1?0.5:0));pos.setXYZ(base+i,point.x,point.y,point.z);}
  }
  geometry.computeVertexNormals();
}
/** Generate closed offset shells from actual indexed bone triangles selected by
 * local opposing-surface distance and normals. Every mask retains source face IDs.
 */
export function cartilagePatch(parts:AnatomyParts,bone:string,other:string,maxGap:number,jointId:string) {
  const mesh=parts.get(bone)?.meshes.find(m=>!m.userData.fiber),mate=parts.get(other)?.meshes.find(m=>!m.userData.fiber);
  if(!mesh || !mate) return;
  const geo=mesh.geometry,pos=geo.getAttribute('position'),idx=geo.index;
  const sourceNormals=geo.getAttribute('normal'), selected:number[]=[],triangles:number[][]=[];
  const thickness=new Map<number,number>();
  const count=(idx?.count??pos.count)/3;
  for(let face=0;face<count;face++) {
    const ids=[0,1,2].map(i=>idx?idx.getX(face*3+i):face*3+i);
    const vertices=ids.map(i=>new THREE.Vector3().fromBufferAttribute(pos,i));
    const center=vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3);
    // Restrict proximal tibiofibular patch to the proximal joint, not the syndesmosis.
    if(jointId==='proximal-tibiofibular' && center.y<290)continue;
    // Intermetatarsal joints occur at the bases; exclude neighboring shaft surfaces.
    if(jointId.startsWith('intermetatarsal') && center.x>70)continue;
    if(mate.geometry.boundingBox && mate.geometry.boundingBox.distanceToPoint(center)>maxGap)continue;
    const hit=nearest(parts,other,center);if(!hit || hit.distance>maxGap || hit.distance<0.05)continue;
    const normal=new THREE.Triangle(...vertices as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getNormal(new THREE.Vector3());
    const toward=hit.point.clone().sub(center).normalize();
    if(normal.dot(toward)<0.35 || normal.dot(hit.normal)>-0.2)continue;
    selected.push(face);triangles.push(ids);
    for(const i of ids) {
      const p=new THREE.Vector3().fromBufferAttribute(pos,i);
      const distance=nearest(parts,other,p)?.distance ?? hit.distance;
      thickness.set(i,Math.min(thickness.get(i)??0.65,Math.max(0.06,distance*0.3)));
    }
  }
  if(!triangles.length)return;
  const positions:number[]=[],indices:number[]=[],map=new Map<number,number>(),edges=new Map<string,{a:number;b:number;count:number}>();
  const addVertex=(i:number)=>{
    if(map.has(i))return map.get(i)!;
    const base=positions.length/3,p=new THREE.Vector3().fromBufferAttribute(pos,i),n=new THREE.Vector3().fromBufferAttribute(sourceNormals,i).normalize();
    positions.push(...p.clone().addScaledVector(n,0.02).toArray(),...p.clone().addScaledVector(n,thickness.get(i)!).toArray());map.set(i,base);return base;
  };
  for(const tri of triangles) {
    const [a,b,c]=tri.map(addVertex);indices.push(a+1,b+1,c+1,c,b,a);
    for(let j=0;j<3;j++) {const x=tri[j],y=tri[(j+1)%3],key=[x,y].sort((a,b)=>a-b).join(':');const e=edges.get(key);if(e)e.count++;else edges.set(key,{a:x,b:y,count:1});}
  }
  for(const e of edges.values())if(e.count===1){const a=map.get(e.a)!,b=map.get(e.b)!;indices.push(a,b,b+1,a,b+1,a+1);}
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();
  shell.userData={boneId:bone,opposingBoneId:other,jointId,sourceFaceIndices:selected,offsetMm:[0.02,Math.max(...thickness.values())]};return shell;
}
export function rebuildSoftTissues(parts:AnatomyParts):SoftTissueReport {
  const report:SoftTissueReport={attachments:0,cartilagePatches:0,warnings:[]};
  for(const part of parts.values())for(const mesh of part.meshes)mesh.geometry.computeBoundingBox();
  // Use actual tissue metadata for fallback and imported bones alike.
  const boneIds=[...new Set(jointSurfaces.flatMap(j=>j.bones))];
  const staged=new Map<string,THREE.Mesh[]>();
  // Spring is installed before the tibiospring attachment resolves its soft footprint.
  const sorted=[...attachmentRecords].sort((a,b)=>(a.structureId==='spring'?-1:0)-(b.structureId==='spring'?-1:0));
  for(const record of sorted) {
    const from=resolveFootprint(parts,record.from),to=resolveFootprint(parts,record.to);
    const guides=record.guidePoints.map(g=>({...g,authoredPositionMm:g.positionMm,positionMm:tuple(clearBones(parts,v(g.positionMm),record.kind==='tendon'?record.widthMm/2+0.4:0.8,boneIds))}));
    const points=[v(from.centerMm),...guides.map(g=>v(g.positionMm)),v(to.centerMm)];
    const geometry=record.kind==='tendon'?tendonGeometry(parts,points,record.widthMm,boneIds):bandGeometry(parts,points,record.widthMm,record.thicknessMm,record.normal,boneIds);
    if(record.kind!=='tendon')fitBandEnds(parts,geometry,record.from,record.to);
    const mesh=meshFor(record.structureId,record.kind,geometry,{attachmentId:record.id,component:record.component,fromFootprint:from,toFootprint:to,guidePoints:guides,sourceIds:record.sourceIds});
    const list=staged.get(record.structureId)??[];list.push(mesh);staged.set(record.structureId,list);report.attachments++;
    if(record.structureId==='spring' && list.length===3)replace(parts,'spring',list);
  }
  for(const [id,meshes] of staged)if(id!=='spring')replace(parts,id,meshes);
  const patches=new Map<string,THREE.Mesh[]>();
  for(const joint of jointSurfaces)for(const [bone,other] of [joint.bones,[...joint.bones].reverse()] as [string,string][]) {
    let geometry=cartilagePatch(parts,bone,other,joint.maxGapMm,joint.id);
    if(!geometry && parts.get(bone)?.meshes[0]?.userData.source!=='z-anatomy') geometry=cartilagePatch(parts,bone,other,40,joint.id);
    if(!geometry){report.warnings.push(`No opposing surface patch: ${joint.id}/${bone}`);continue;}
    const id=cartilageId(bone),list=patches.get(id)??[];
    list.push(meshFor(id,'cartilage',geometry,geometry.userData));patches.set(id,list);report.cartilagePatches++;
  }
  for(const [id,meshes] of patches)replace(parts,id,meshes);
  return report;
}

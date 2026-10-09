import fs from 'node:fs';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
const sides=process.argv.slice(2).length?process.argv.slice(2):['right','left'];
function array(path,Type){const b=fs.readFileSync(path);return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function geometry(v,f){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.setIndex(new THREE.BufferAttribute(f,1));g.boundsTree=new MeshBVH(g,{indirect:true});return g;}
for(const side of sides) {
 const base='output/skin/'+side+'/';
 const source=geometry(array(base+'source.vertices.bin',Float32Array),array(base+'source.faces.bin',Uint32Array));
 const samples=array(base+'clearance.samples.bin',Float32Array),intended=array(base+'clearance.intended.bin',Float32Array);
 const point=new THREE.Vector3(),hit={},rows=[];
 for(let i=0;i<intended.length;i++){
  point.fromArray(samples,i*3);const closest=source.boundsTree.closestPointToPoint(point,hit,0,Infinity);
  rows.push({positionMm:point.toArray(),clearanceMm:closest.distance,intendedMm:intended[i],differenceMm:Math.abs(closest.distance-intended[i])});
 }
 const diffs=rows.map(r=>r.differenceMm).sort((a,b)=>a-b),distances=rows.map(r=>r.clearanceMm).sort((a,b)=>a-b);
 const report={side,method:'Exact point-to-source-triangle distance at 10000 deterministic skin vertices; crop caps excluded',samples:rows.length,toleranceMm:.5,minimumClearanceMm:distances[0],maximumClearanceMm:distances.at(-1),medianClearanceMm:distances[Math.floor(distances.length/2)],maximumDeviationFromIntendedMm:diffs.at(-1),medianDeviationMm:diffs[Math.floor(diffs.length/2)],fractionWithinHalfMm:rows.filter(r=>r.differenceMm<=.5).length/rows.length,passed:diffs.at(-1)<=.5,outlierSamples:rows.filter(r=>r.differenceMm>.5)};
 fs.writeFileSync('validation/skin-clearance-'+side+'.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,outlierSamples:report.outlierSamples.length}));
 source.dispose();
}


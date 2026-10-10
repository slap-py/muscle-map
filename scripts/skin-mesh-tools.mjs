import fs from 'node:fs';
import {MeshoptSimplifier} from 'meshoptimizer';
import earcut from '../node_modules/three/src/extras/lib/earcut.js';
const [mode, path] = process.argv.slice(2);
const meshoptimizerVersion=JSON.parse(fs.readFileSync(new URL('../node_modules/meshoptimizer/package.json',import.meta.url),'utf8')).version;
if(meshoptimizerVersion!=='0.22.0') throw new Error('Revalidate skin after changing meshoptimizer 0.22.0');
if (mode === 'simplify') {
 const meta = JSON.parse(fs.readFileSync(path+'.json','utf8').replace(/^\uFEFF/,''));
 const vb = fs.readFileSync(path+'.vertices.bin'), fb=fs.readFileSync(path+'.faces.bin');
 const v=new Float32Array(vb.buffer,vb.byteOffset,vb.byteLength/4);
 const f=new Uint32Array(fb.buffer,fb.byteOffset,fb.byteLength/4);
 await MeshoptSimplifier.ready;
 let indices,error;
 if(fs.existsSync(path+'.locks.bin')) {
  MeshoptSimplifier.useExperimentalFeatures=true;const locks=new Uint8Array(fs.readFileSync(path+'.locks.bin'));
  [indices,error]=MeshoptSimplifier.simplifyWithAttributes(f,v,3,new Float32Array(v.length/3),1,[],locks,meta.targetTriangles*3,meta.errorMm,['LockBorder','ErrorAbsolute']);
 } else [indices,error] = MeshoptSimplifier.simplify(f,v,3,meta.targetTriangles*3,meta.errorMm,['LockBorder','ErrorAbsolute']);
 fs.writeFileSync(path+'.simplified.bin',Buffer.from(indices.buffer,indices.byteOffset,indices.byteLength));
 fs.writeFileSync(path+'.simplification.json',JSON.stringify({algorithm:'meshoptimizer quadric with locked boundaries',meshoptimizerVersion,targetTriangles:meta.targetTriangles,inputTriangles:f.length/3,triangles:indices.length/3,quadricErrorMm:error,requestedErrorMm:meta.errorMm},null,2));
 console.log(JSON.stringify({triangles:indices.length/3,errorMm:error}));
} else if(mode==='cap') {
 const {points}=JSON.parse(fs.readFileSync(path+'.json','utf8'));
 const f = earcut(points.flat(),[],2);
 fs.writeFileSync(path+'.faces.bin',Buffer.from(new Uint32Array(f).buffer));
} else throw new Error('Use simplify or cap');


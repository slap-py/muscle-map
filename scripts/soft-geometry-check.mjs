import {createServer} from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true}});
try{
 const {createAnkle}=await server.ssrLoadModule('/src/ankle.ts');
 const {installBoneAssets,installMuscleAssets}=await server.ssrLoadModule('/src/assets.ts');
 const {rebuildSoftTissues}=await server.ssrLoadModule('/src/softTissues.ts');
 const {structures}=await server.ssrLoadModule('/src/data.ts');
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const start=performance.now(),model=createAnkle();
 console.log('fallback ms',performance.now()-start,'empty', [...model.parts.values()].filter(p=>!p.meshes.length).map(p=>p.id));
 for(const [file,install] of [['bones',installBoneAssets],['muscles',installMuscleAssets]]){
  const buffer=await fs.readFile(`public/models/${file}.glb`);
  console.log(file,install((await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene,model.parts));
 }
 const then=performance.now(),report=rebuildSoftTissues(model.parts);
 console.log('registered ms',performance.now()-then,report,'empty',[...model.parts.values()].filter(p=>!p.meshes.length).map(p=>p.id),'structures',structures.length);
 await fs.writeFile('validation/soft-geometry-check.json',JSON.stringify({report,structures:structures.length,parts:[...model.parts.values()].map(p=>({id:p.id,meshes:p.meshes.length,anchor:p.anchor.toArray()}))},null,2));
}finally{await server.close();}

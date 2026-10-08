import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { upperLegFacts } from './facts';
import { upperLegSupportFacts } from './supportFacts';
import { lowerLegPack } from '../lower-leg';
import { validateRegionPack, type RegionPack } from '..';
import { type Structure, type Tissue, colors, tissueNames } from '../../data';
import { createRegionAssetLoaders } from '../../assets';
import { resolveFootprint, type AnatomyParts } from '../../softTissues';
import { type AttachmentRecord, type MmPoint } from '../../attachments';
import { type Connection, connectionCameraPose, connectionOccluders } from '../../connections';

export interface SourceRecord {
  id: string; name: string; tissue: string; assetGroup: string; sourceObject: string;
  triangles: number; boundsMm: number[][]; boundaryEdges: number;
  sourceAttachments: { from?: {seedMm: number[]; sourceObject: string}; to?: {seedMm: number[]; sourceObject: string} };
}
export interface UpperManifest { side: string; structures: SourceRecord[]; }
const source = {title: 'Z-Anatomy · Pinned anatomical source',url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy/tree/b722f392d2b09d21f0527229fe1338f27a3bc04e'};
const hosts: Record<string, [string, string]> = {
  'rectus-femoris':['hip-bone','patella'], 'vastus-lateralis':['femur','patella'], 'vastus-medialis':['femur','patella'], 'vastus-intermedius':['femur','patella'],
  sartorius:['hip-bone','tibia'], 'tensor-fasciae-latae':['hip-bone','iliotibial-tract'],
  'gluteus-maximus':['hip-bone','femur'], 'gluteus-medius':['hip-bone','femur'], 'gluteus-minimus':['hip-bone','femur'],
  iliacus:['hip-bone','femur'], 'psoas-major':['lumbar-spine','femur'], pectineus:['hip-bone','femur'],
  'adductor-longus':['hip-bone','femur'], 'adductor-brevis':['hip-bone','femur'], 'adductor-magnus':['hip-bone','femur'],gracilis:['hip-bone','tibia'],
  'biceps-femoris-long-head':['hip-bone','fibula'], 'biceps-femoris-short-head':['femur','fibula'], semitendinosus:['hip-bone','tibia'], semimembranosus:['hip-bone','tibia'],
  'obturator-externus':['hip-bone','femur'], 'obturator-internus':['hip-bone','femur'], 'superior-gemellus':['hip-bone','femur'], 'inferior-gemellus':['hip-bone','femur'],
  'quadratus-femoris':['hip-bone','femur'],piriformis:['sacrum','femur'],popliteus:['femur','tibia'],
};
const jointPairs: Record<string,[string,string]> = {
  'anterior-cruciate-ligament':['femur','tibia'],'posterior-cruciate-ligament':['femur','tibia'],
  'fibular-collateral-ligament':['femur','fibula'],'superficial-part-of-tibial-collateral-ligament':['femur','tibia'],
  'deep-part-of-tibial-collateral-ligament':['femur','tibia'],'patellar-ligament':['patella','tibia'],
  'descending-part-of-iliofemoral-ligament':['hip-bone','femur'],'transverse-part-of-iliofemoral-ligament':['hip-bone','femur'],
  'ischiofemoral-ligament':['hip-bone','femur'],'pubofemoral-ligament':['hip-bone','femur'],'ligament-of-head-of-femur':['hip-bone','femur'],
};
const centerOf=(r:SourceRecord)=>new THREE.Vector3(...r.boundsMm[0]).add(new THREE.Vector3(...r.boundsMm[1])).multiplyScalar(.5);

export function createUpperLegPack(manifest: UpperManifest): RegionPack {
  const side=manifest.side as 'left'|'right', title=`${side === 'left' ? 'Left' : 'Right'} Upper Leg`, id=`${side}-upper-leg`;
  const unique=[...new Map(manifest.structures.map(r=>[r.id,r])).values()];
  const sourceById=Object.fromEntries(unique.map(r=>[r.id,r]));
  const structures: Structure[]=unique.map(r=>{
    const tissue=r.tissue as Tissue, parent=r.id.replace(/-tendon$/,''), facts=upperLegFacts[r.id], parentFacts=upperLegFacts[parent];
    const name=r.id==='skin'?'Skin exterior':facts?.name ?? (r.id.endsWith('-cartilage') ? `${r.name} articular cartilage` : tissue==='tendon' ? `${parentFacts?.name ?? r.name} tendon` : r.name);
    const group=facts?.group ?? (tissue==='tendon' ? `${parentFacts?.group ?? 'Thigh'} tendons` : tissue==='bone'?'Skeleton':tissue==='skin'?'Regional surface':tissue==='cartilage'?'Joint surfaces':tissue==='ligament'?'Hip & knee ligaments':tissue==='fascia'?'Thigh fascia':tissueNames[tissue]);
    const structure:Structure = {id:r.id,name,tissue,region:centerOf(r).y < -140 ? 'Knee':'Thigh',group,
      description:facts?.description ?? (tissue==='skin' ? `Combined ${side} hip, thigh and knee surface regions from Z-Anatomy.` : tissue==='tendon' ? `Tendon-material surfaces separated from the source ${parentFacts?.name ?? r.name}.` : `${name} from the ${side} hip, thigh and knee source anatomy.`),
      role:facts?.action ?? (tissue==='tendon'?'Transfers muscle tension through the source attachment surfaces.':tissue==='bone'?'Provides skeletal support and attachment surfaces.':tissue==='cartilage'?'Forms part of a joint surface or fibrocartilaginous joint structure.':tissue==='ligament'?'Connects and supports the joint structures.':tissue==='fascia'?'Connective tissue surrounding or separating the thigh structures.':tissue==='artery'?'Carries blood to the regional tissues.':tissue==='vein'?'Returns blood from the regional tissues.':tissue==='nerve'?'Conveys motor and/or sensory signals along its anatomical course.':'Shows the source body-region exterior.'),
      connection:facts?`${facts.origin} → ${facts.insertion}`:tissue==='tendon'?`Associated with ${parentFacts?.name ?? r.name}.`:'Select related structures to explore the regional anatomy.',
      hint:'Use Focus, Isolate, tissue layers and the anatomical views to study this structure.',
      references:[source]};
    return Object.assign(structure,facts,upperLegSupportFacts[r.id]);
  });
  const byId=Object.fromEntries(structures.map(s=>[s.id,s]));
  const tissueKeys=[...lowerLegPack.tissueKeys].filter(t=>structures.some(s=>s.tissue===t));
  const counts={total:structures.length,byTissue:Object.fromEntries(tissueKeys.map(t=>[t,structures.filter(s=>s.tissue===t).length]))};
  const base=`${import.meta.env.BASE_URL}models/${id}/`;
  const assets={bones:base+'bones.glb',muscles:base+'muscles.glb',exterior:base+'exterior.glb',neurovascular:base+'neurovascular.glb'};
  const groupIds=(group:string)=>unique.filter(r=>r.assetGroup===group).map(r=>r.id);
  const loaders=createRegionAssetLoaders(structures,{bones:groupIds('bones'),muscles:groupIds('muscles'),exterior:groupIds('exterior'),neurovascular:groupIds('neurovascular')});
  const directionSign=side==='left'?-1:1;
  const cameraViews:Record<string,[number,number,number]>={overview:[1,.22,.7*directionSign],anterior:[1,.04,0],posterior:[-1,.04,0],medial:[0,.04,-directionSign],lateral:[0,.04,directionSign],superior:[.01,1,0],inferior:[.01,-1,0]};
  const cameraPreset=(view:string,aspect:number)=>{const target=new THREE.Vector3(0,10,0);return {target,position:target.clone().addScaledVector(new THREE.Vector3(...(cameraViews[view]??cameraViews.overview)).normalize(),1250*Math.max(1,.8/aspect))};};
  const directions=[
    {id:'anterior',short:'A',label:'Anterior · front',v:[1,0,0] as [number,number,number],color:'var(--compass-anterior)'},
    {id:'posterior',short:'P',label:'Posterior · back',v:[-1,0,0] as [number,number,number],color:'var(--compass-anterior)'},
    {id:'medial',short:'M',label:'Medial · inner side',v:[0,0,-directionSign] as [number,number,number],color:'var(--compass-medial)'},
    {id:'lateral',short:'L',label:'Lateral · outer side',v:[0,0,directionSign] as [number,number,number],color:'var(--compass-medial)'},
    {id:'superior',short:'S',label:'Superior · toward hip',v:[0,1,0] as [number,number,number],color:'var(--compass-dorsal)'},
    {id:'inferior',short:'I',label:'Inferior · toward knee',v:[0,-1,0] as [number,number,number],color:'var(--compass-dorsal)'},
  ];
  const createAnkle=()=>{
    const root=new THREE.Group(),parts:AnatomyParts=new Map();
    for(const s of structures){const group=new THREE.Group();group.name=s.id;root.add(group);parts.set(s.id,{id:s.id,group,meshes:[],anchor:centerOf(sourceById[s.id])});}
    return {root,parts};
  };
  const attachmentRecords:AttachmentRecord[]=[];
  // Only source origin/insertion patches produce muscle attachment focus cards.
  // Missing source patches remain documented in the textual origin/insertion facts.
  for(const r of unique.filter(r=>r.tissue==='muscle')){
    const pair=hosts[r.id];if(!pair)continue;
    for(const [end,index] of [['from',0],['to',1]] as const){
      const patch=r.sourceAttachments[end],host=pair[index];if(!patch||!byId[host])continue;
      // Psoas origins are lumbar, outside this crop; never substitute the sacrum.
      if(r.id==='psoas-major'&&end==='from')continue;
      const endpoint={structureId:host,landmark:`${end==='from'?'Origin':'Insertion'} · source attachment patch`,seedMm:patch.seedMm as MmPoint,radiusMm:6,kind:byId[host].tissue==='bone'?'surface' as const:'soft-tissue' as const};
      const junction={structureId:r.id,landmark:'Muscle surface context',seedMm:patch.seedMm as MmPoint,radiusMm:4,kind:'junction' as const};
      attachmentRecords.push({id:`${r.id}:${end}`,structureId:r.id,component:end==='from'?'origin':'insertion',kind:'tendon',from:end==='from'?endpoint:junction,to:end==='to'?endpoint:junction,guidePoints:[],widthMm:8,thicknessMm:2,normal:[1,0,0],sourceIds:['upperSource'],note:`Focus derived from ${patch.sourceObject}, projected onto the host surface. Footprint size is illustrative; this does not reconstruct every attachment or variant.`,coordinateStatus:'illustrative-surface-fit'});
    }
  }
  const muscleAttachmentCount=attachmentRecords.length;
  const rebuildSoftTissues=(parts:AnatomyParts)=>{
    attachmentRecords.splice(muscleAttachmentCount);
    // Source ligament contact seeds are sampled on the ligament mesh and fitted
    // to the adjacent bone. No connecting geometry is invented.
    const nearestSeed=(structure:string,host:string):MmPoint|undefined=>{
      let best=Infinity,seed:MmPoint|undefined;
      for(const mesh of parts.get(structure)?.meshes??[]){
        const positions=mesh.geometry.getAttribute('position');
        const stride=Math.max(1,Math.floor(positions.count/500));
        for(let i=0;i<positions.count;i+=stride){
          const point=new THREE.Vector3().fromBufferAttribute(positions,i);
          for(const bone of parts.get(host)?.meshes??[]){
            const hit=(bone.geometry.boundsTree as MeshBVH | undefined)?.closestPointToPoint(point);
            if(hit&&hit.distance<best){best=hit.distance;seed=hit.point.toArray() as MmPoint;}
          }
        }
      }
      return seed;
    };
    for(const [structureId,pair] of Object.entries(jointPairs)){
      if(!byId[structureId])continue;
      const from=nearestSeed(structureId,pair[0]),to=nearestSeed(structureId,pair[1]);
      if(!from||!to)continue;
      const endpoint=(host:string,seedMm:MmPoint)=>({structureId:host,landmark:'Source ligament contact · illustrative surface fit',seedMm,radiusMm:4,kind:'surface' as const});
      attachmentRecords.push({id:`${structureId}:contact`,structureId,component:'joint-contact',kind:'ligament',from:endpoint(pair[0],from),to:endpoint(pair[1],to),guidePoints:[],widthMm:6,thicknessMm:2,normal:[1,0,0],sourceIds:['upperSource'],note:'Nearest sampled source-ligament contact projected to each bone. Footprint extent is illustrative, not a measured attachment boundary.',coordinateStatus:'illustrative-surface-fit'});
    }
    return {attachments:attachmentRecords.length,cartilagePatches:[...parts.values()].filter(p=>byId[p.id].tissue==='cartilage'&&p.meshes.length).length,warnings:[]};
  };
  const relatedIds=(selected:string)=>{
    const ids=new Set<string>();const add=(id:string)=>{if(id!==selected&&byId[id])ids.add(id);};
    const parent=selected.replace(/-tendon$/,'');
    if(upperLegFacts[parent]){add(parent);add(parent+'-tendon');for(const host of hosts[parent]??[])add(host);}
    if(jointPairs[selected])jointPairs[selected].forEach(add);
    if(byId[selected]?.tissue==='bone'){
      for(const [muscle,pair]of Object.entries(hosts))if(pair.includes(selected)){add(muscle);add(muscle+'-tendon');}
      for(const [ligament,pair]of Object.entries(jointPairs))if(pair.includes(selected)){add(ligament);pair.forEach(add);}
      add(selected+'-cartilage');
      const bones:Record<string,string[]>={'hip-bone':['femur','sacrum'],femur:['hip-bone','tibia','patella'],patella:['femur'],tibia:['femur','fibula'],fibula:['tibia'],sacrum:['hip-bone']};(bones[selected]??[]).forEach(add);
    }
    if(selected.endsWith('-cartilage'))add(selected.replace(/-cartilage$/,''));
    return ids;
  };
  const connectionHighlightIds=(selected:string)=>new Set([selected,...relatedIds(selected)]);
  const connectionsFor=(parts:AnatomyParts,selected:string):Connection[]=>attachmentRecords.filter(r=>r.structureId===selected||r.from.structureId===selected||r.to.structureId===selected||r.structureId+'-tendon'===selected).flatMap(record=>{
    const ends:('from'|'to')[]=record.component==='joint-contact'?['from','to']:[record.component==='origin'?'from':'to'];
    return ends.filter(end=>parts.get(record[end].structureId)?.meshes.length).map(end=>({key:`${record.id}:${end}`,record,end,footprint:resolveFootprint(parts,record[end])}));
  });
  const footprintDecal=(parts:AnatomyParts,c:Connection)=>{
    const f=c.footprint;if(byId[f.structureId]?.tissue!=='bone')return;
    const bone=parts.get(f.structureId)?.meshes[f.meshIndex];if(!bone)return;
    bone.updateWorldMatrix(true,false);
    const orientation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...f.normal).normalize()));
    const geometry=new DecalGeometry(bone,new THREE.Vector3(...f.centerMm),orientation,new THREE.Vector3(f.radiusMm*2,f.radiusMm*2,f.radiusMm));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#21bda8',transparent:true,opacity:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,side:THREE.DoubleSide}));
    mesh.userData.connectionKey=c.key;mesh.renderOrder=5;return mesh;
  };
  const areas=[{id:'all',label:'All areas',group:''},{id:'hip',label:'Hip & gluteal',group:''},{id:'anterior',label:'Anterior thigh',group:''},{id:'medial',label:'Medial thigh',group:''},{id:'posterior',label:'Posterior thigh',group:''},{id:'knee',label:'Knee',group:''}];
  const atlasIds=(area:string)=>new Set(structures.filter(s=>{
    if(area==='all')return true;const r=sourceById[s.id],group=(upperLegFacts[s.id.replace(/-tendon$/,'')]?.group??'').toLowerCase();
    if(area==='knee')return r.boundsMm[0][1]<-150;
    if(area==='hip')return group.includes('hip')||group.includes('gluteal')||r.boundsMm[1][1]>180;
    if(area==='anterior')return group.includes('quadriceps')||group.includes('anterior');
    return group.includes(area);
  }).map(s=>s.id));
  const overview=`Explore the ${side} upper leg from hip to knee, with original side-specific Z-Anatomy bones, muscles, tendons, joint tissues, vessels and nerves.`;
  const about={...lowerLegPack.about,title,overview,overviewHtml:`<p>${overview}</p><p class="stats">${counts.total} selectable structures · ${counts.byTissue.muscle} muscles</p><p>Includes the ipsilateral hip bone, sacrum, knee and proximal lower-leg shafts to show attachment context. Psoas and proximal nerves are cropped at the superior regional boundary.</p><p>Muscle attachment focus cards use source origin/insertion patches where available, projected to bone surfaces. Footprint extents are illustrative. All muscles have source-linked origin, insertion, action, innervation and blood-supply descriptions.</p><p>The exterior combines source body-region surface patches. Fascia and some joint tissues are thin source sheets. This static study model makes no biomechanical predictions.</p>`,controlsHtml:lowerLegPack.about.controlsHtml.replace('Overview, dorsal, plantar, medial, lateral','Overview, anterior, posterior, medial, lateral')};
  const labelTier=Object.fromEntries(structures.map(s=>[s.id,(['femur','patella','hip-bone','rectus-femoris','gluteus-maximus','sartorius'].includes(s.id)?1:s.tissue==='muscle'||s.tissue==='bone'?2:3) as 1|2|3]));
  return validateRegionPack({...lowerLegPack,id,title,description:overview,assetFailureMessage:"Some models could not load. Unavailable structures are hidden; return home and reopen the region to retry.",thumbnail:`${import.meta.env.BASE_URL}regions/${id}.png`,structures,byId,neurovascularSources:Object.fromEntries(unique.filter(r=>r.assetGroup==='neurovascular').map(r=>[r.id,r.sourceObject])),neurovascularCropYMaxMm:undefined,tissueKeys,colors,tissueNames,assets,assetUrls:assets,loaders,structureCounts:counts,createAnkle,
    rebuildSoftTissues,
    atlasAreas:areas,atlasTabs:areas,atlasIds,relatedIds,directlyAttachedIds:connectionHighlightIds,connectionHighlightIds,connectionsFor,footprintDecal,connectionCameraPose,connectionOccluders,connectionClinicalPoints:{},
    attachmentSources:{...lowerLegPack.attachmentSources,...{upperSource:{...source,section:'Side-specific muscular origin and insertion patches'}}},
    presets:lowerLegPack.presets.map(p=>p.id==='anatomy'?{...p,tissues:p.tissues.filter(t=>t!=='fascia')}:p),cameraViews,cameraPreset,directions,defaultView:'overview',viewPresets:['overview','anterior','posterior','medial','lateral'].map(view=>({id:view,label:view[0].toUpperCase()+view.slice(1),direction:view==='overview'?'anterior':view,preset:(aspect:number)=>cameraPreset(view,aspect)})),labelTier,about,
    scene:{initialCamera:cameraPreset('overview',1).position,keyPosition:new THREE.Vector3(700,700,500*directionSign),keyTarget:new THREE.Vector3(),fillPosition:new THREE.Vector3(-500,300,-400*directionSign),fillTarget:new THREE.Vector3(),floorPosition:new THREE.Vector3(0,-350,0)},
  });
}

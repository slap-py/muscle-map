/** Registered attachment authoring data. All positions are anatomical millimeters.
 * Seeds select footprints on surfaces; they are NOT label anchors or measurements.
 * Each record identifies one independently rendered slip/band and its evidence.
 */
import muscleLandmarks from './muscleLandmarks.json';
export type MmPoint = [number, number, number];
export interface Footprint {
  structureId: string;
  landmark: string;
  seedMm: MmPoint;
  radiusMm: number;
  kind: 'surface' | 'junction' | 'soft-tissue';
}
export interface GuidePoint {
  landmark: string;
  positionMm: MmPoint;
  supportId: string;
}
export interface AttachmentRecord {
  id: string;
  structureId: string;
  component: string;
  kind: 'tendon' | 'ligament' | 'fascia';
  from: Footprint;
  to: Footprint;
  guidePoints: GuidePoint[];
  widthMm: number;
  thicknessMm: number;
  /** Broad direction of a band's surface normal, not its longitudinal direction. */
  normal: MmPoint;
  sourceIds: string[];
  note: string;
  coordinateStatus: 'illustrative-surface-fit';
}
export const attachmentSources = {
  sono: {title:'Advanced Ankle and Foot Sonoanatomy: Imaging Beyond the Basics',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7151198/',section:'Tendons, medial/lateral ligaments, plantar ligaments and retinacula; figures 10 and 16'},
  deltoid: {title:'The Anatomy and Function of the Individual Bands of the Deltoid Ligament',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC9201323/',section:'Cadaver dissection results and ligament bands; variable anterior components'},
  spring: {title:'Anatomy of the spring ligament',url:'https://pubmed.ncbi.nlm.nih.gov/14630849/',section:'Results: three-component calcaneonavicular complex'},
  plantar: {title:'Morphological characteristics of the plantar calcaneocuboid ligaments',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7792160/',section:'Long and short plantar ligament attachment morphology'},
  cuboid: {title:'The peroneocuboid joint: morphogenesis and anatomical study',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4313902/',section:'Fibularis longus course around the cuboid'},
  flexor: {title:'Significance of the anatomical relationship between flexor digitorum longus and sustentaculum tali',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC9458735/',section:'Tendon courses and common sheath at the sustentaculum tali'},
};
const fp = (structureId:string, landmark:string, seedMm:MmPoint, radiusMm=3, kind:Footprint['kind']='surface'):Footprint => ({structureId,landmark,seedMm,radiusMm,kind});
const g = (supportId:string, landmark:string, positionMm:MmPoint):GuidePoint => ({supportId,landmark,positionMm});
const mtj = (id:keyof typeof muscleLandmarks) => fp(id,'Distal muscle–tendon material seam',muscleLandmarks[id].junctionMm as MmPoint,2,'junction');
export const attachmentRecords: AttachmentRecord[] = [];
function add(structureId:string, component:string, kind:AttachmentRecord['kind'], from:Footprint, to:Footprint, guidePoints:GuidePoint[], widthMm:number, normal:MmPoint, sourceIds=['sono'], thicknessMm=0.9) {
  attachmentRecords.push({id:`${structureId}:${component}`,structureId,component,kind,from,to,guidePoints,widthMm,thicknessMm,normal,sourceIds,note:`${from.landmark} → ${to.landmark}.${guidePoints.length ? ' Course: ' + guidePoints.map(g=>g.landmark).join(' → ') + '.' : ''}`,coordinateStatus:'illustrative-surface-fit'});
}
const tendon=(id:string, component:string, muscle:keyof typeof muscleLandmarks, to:Footprint, guides:GuidePoint[], diameter=3, sources=['sono'])=>add(id,component,'tendon',mtj(muscle),to,guides,diameter,[0,1,0],sources,diameter);
const lateral=(longus:boolean):GuidePoint[]=>[
  g('fibula','Retromalleolar groove behind lateral malleolus',[-25,9,longus?29:25]),
  g('calcaneus','Under superior fibular retinaculum',[-23,-13,longus?30:26]),
  g('calcaneus','Under inferior fibular retinaculum',[1,longus?-34:-26,30]),
];
const extensor=(z:number):GuidePoint[]=>[
  g('tibia','Under superior extensor retinaculum',[20,53,z]),
  g('talus','Under inferior extensor retinaculum',[23,20,z]),
  g('navicular','Dorsal midfoot',[40,6,z]),
];
const medial=(offset:number):GuidePoint[]=>[
  g('tibia','Retromalleolar groove behind medial malleolus',[-17-offset,18,-25+offset]),
  g('talus','Under flexor retinaculum',[-15-offset,-4,-25+offset]),
];
tendon('achilles','common-calcaneal','soleus-distal',fp('calcaneus','Posterior calcaneal tuberosity',[-55,-33,0],6),[g('calcaneus','Posterior heel approach',[-48,5,0])],8);
// Gastrocnemius aponeuroses converge with soleus at the common Achilles junction.
// The junction is an illustrative shared seam, not insertion into soleus muscle.
for(const [head,seed] of [['medial',[-48,139,-12]],['lateral',[-48,153,20]]] as [string,MmPoint][]) {
  add('achilles',`gastrocnemius-${head}`,'tendon',fp('gastrocnemius',`${head} head distal aponeurosis`,seed,3,'junction'),
    {...mtj('soleus-distal'),landmark:'Shared calcaneal aponeurosis at the distal soleus seam'},
    [g('soleus-distal','Posterior calf convergence',[-44,111,-5])],5,[0,0,1]);
}
for(const [bone,seed] of [['cuneiform-medial',[53,-25,-16]],['metatarsal-1',[65,-29,-12]]] as [string,MmPoint][]) {
  tendon('tibialis-anterior-tendon',bone,'anterior',fp(bone,'Medial plantar insertion',seed,3),[...extensor(-12),g('cuneiform-medial','Medial turn',[49,-6,-20])],3.6);
  tendon('fibularis-longus-tendon',bone,'fibularis',fp(bone,'Plantar insertion',seed,3),[...lateral(true),g('cuboid','Entry to cuboid groove',[28,-40,33]),g('cuboid','Cuboid groove plantar pulley',[33,-41,18]),g('cuneiform-medial','Across plantar midfoot',[48,-36,1])],3.2,['sono','cuboid']);
}
tendon('fibularis-brevis-tendon','fifth-metatarsal','fibularis-brevis',fp('metatarsal-5','Fifth metatarsal tuberosity',[25,-34,42],3),lateral(false),3.2);
tendon('extensor-hallucis-tendon','hallux','ehl',fp('phalanx-1-distal','Dorsal base',[147,-46,3],2),[...extensor(0),g('metatarsal-1','Dorsal first ray',[108,-35,-1]),g('phalanx-1-proximal','Dorsal hallux',[134,-38,1])],2.5);
const toeZ=[0,22,37,51,65];
const toeBaseX=[120,121,115,108,94];
const distalX=[147,162,156,142,124];
for(let n=2;n<=5;n++) {
  const z=toeZ[n-1], x=toeBaseX[n-1];
  for(const segment of ['middle','distal']) {
    tendon('extensor-digitorum-tendons',`toe-${n}-${segment}`,'edl',fp(`phalanx-${n}-${segment}`,'Dorsal base via extensor expansion',[segment==='middle'?x+25:distalX[n-1],-48,z+3],1.3),[...extensor(17),g(`metatarsal-${n}`,'Dorsal metatarsal',[x-10,-37,z-5]),g(`phalanx-${n}-proximal`,'Extensor expansion',[x+10,-41,z])],1.8);
  }
  if(n<=4) tendon('edb-tendons',`toe-${n}-expansion`,'edb',fp(`phalanx-${n}-proximal`,'Dorsal extensor apparatus',[x+10,-41,z],2,'soft-tissue'),[g(`metatarsal-${n}`,'Dorsal extensor slip',[x-14,-35,z])],1.6);
  tendon('flexor-digitorum-tendons',`toe-${n}`,'fdl',fp(`phalanx-${n}-distal`,'Plantar base',[distalX[n-1],-59,z+3],1.5),[...medial(5),g('calcaneus','Anterior sustentacular turn',[-1,-28,-19]),g('navicular','Plantar crossing with FHL',[30,-40,-3]),g(`metatarsal-${n}`,'Plantar digital sheath',[x-8,-60,z-5]),g(`phalanx-${n}-proximal`,'Plantar toe',[x+12,-59,z])],2,['flexor']);
}
tendon('flexor-hallucis-tendon','hallux','fhl',fp('phalanx-1-distal','Plantar base',[149,-58,2],2),[...medial(10),g('talus','Posterior talar groove',[-26,-12,-9]),g('calcaneus','Under sustentaculum tali',[-2,-27,-17]),g('navicular','Plantar medial arch',[32,-37,-10]),g('metatarsal-1','Between hallux sesamoids',[109,-58,-3]),g('phalanx-1-proximal','Plantar hallux',[132,-58,0])],2.6,['flexor']);
tendon('tibialis-posterior-tendon','navicular','tibialis-posterior',fp('navicular','Navicular tuberosity',[29,-15,-22],4),[...medial(0),g('calcaneus','Medial sustentacular course',[0,-16,-24])],3.5,['flexor']);
for(const [bone,seed] of [['cuneiform-medial',[48,-28,-8]],['cuneiform-intermediate',[47,-22,8]],['cuneiform-lateral',[42,-28,18]],['cuboid',[30,-38,17]],...([2,3,4].map(n=>[`metatarsal-${n}`,[n===4?47:57,-32,n*7]]))] as [string,MmPoint][]) {
  tendon('tibialis-posterior-tendon',`plantar-slip-${bone}`,'tibialis-posterior',fp(bone,'Plantar expansion',seed,2),[...medial(0),g('navicular','Navicular division',[29,-20,-21])],1.6,['flexor','sono']);
}
tendon('abductor-hallucis-tendon','hallux','abductor-hallucis',fp('phalanx-1-proximal','Medial base',[121,-50,-14],3),[],2.5);
tendon('abductor-digiti-tendon','fifth-toe','abductor-digiti',fp('phalanx-5-proximal','Lateral base',[95,-55,64],2.5),[],2.2);
const lig=(id:string,component:string,a:Footprint,b:Footprint,width:number,normal:MmPoint,via:GuidePoint[]=[],sources=['sono'])=>add(id,component,'ligament',a,b,via,width,normal,sources);
lig('atfl','anterior-talofibular',fp('fibula','Anterior lateral malleolus',[-7,0,28],3),fp('talus','Lateral talar neck',[7,-4,18],3),6,[0,0,1]);
lig('cfl','calcaneofibular',fp('fibula','Malleolar tip',[-13,-9,27],3),fp('calcaneus','Lateral calcaneal wall',[-33,-22,17],4),6,[0,0,1]);
lig('ptfl','posterior-talofibular',fp('fibula','Malleolar fossa',[-18,0,21],3),fp('talus','Posterolateral talar tubercle',[-26,-6,10],4),7,[-1,0,0]);
lig('aitfl','anterior-syndesmosis',fp('tibia','Anterolateral distal tibia',[8,31,24],3),fp('fibula','Anterior distal fibula',[-3,8,29],3),7,[1,0,0]);
const malleolus=()=>fp('tibia','Medial malleolus',[-1,13,-25],4);
lig('deltoid','tibionavicular',malleolus(),fp('navicular','Medial navicular',[26,-8,-20],4),8,[0,0,-1],[],['deltoid']);
lig('deltoid','tibiocalcaneal',malleolus(),fp('calcaneus','Sustentaculum tali',[-3,-15,-18],4),8,[0,0,-1],[],['deltoid']);
lig('deltoid','tibiospring',malleolus(),fp('spring','Superomedial spring band',[13,-17,-16],4,'soft-tissue'),8,[0,0,-1],[],['deltoid']);
lig('deltoid','deep-anterior-tibiotalar',fp('tibia','Anterior medial malleolus',[3,12,-22],3),fp('talus','Anteromedial talus',[8,0,-17],3),6,[0,0,-1],[],['deltoid']);
lig('deltoid','deep-posterior-tibiotalar',fp('tibia','Posterior medial malleolus',[-11,14,-23],4),fp('talus','Posteromedial talar body',[-15,-2,-17],4),10,[0,0,-1],[],['deltoid']);
lig('spring','superomedial',fp('calcaneus','Medial sustentaculum',[-1,-15,-18],4),fp('navicular','Superomedial navicular',[28,-11,-18],4),9,[0,0,-1],[g('talus','Under medial talar head',[14,-17,-16])],['spring']);
lig('spring','medioplantar-oblique',fp('calcaneus','Anterior sustentacular notch',[6,-22,-7],3),fp('navicular','Navicular tuberosity',[28,-18,-16],3),7,[0,-1,0],[],['spring']);
lig('spring','inferoplantar-longitudinal',fp('calcaneus','Anterior calcaneal facet margin',[9,-24,0],3),fp('navicular','Plantar navicular beak',[29,-20,-2],3),8,[0,-1,0],[],['spring']);
lig('short-plantar','plantar-calcaneocuboid',fp('calcaneus','Anterior plantar tubercle',[5,-39,9],4),fp('cuboid','Plantar cuboid proximal to groove',[20,-37,18],4),12,[0,-1,0],[],['plantar']);
lig('long-plantar','deep-calcaneocuboid',fp('calcaneus','Plantar calcaneus',[-23,-49,5],5),fp('cuboid','Cuboid ridge',[34,-39,23],5),14,[0,-1,0],[g('calcaneus','Plantar arch',[2,-47,13])],['plantar']);
for(let n=2;n<=5;n++) lig('long-plantar',`superficial-metatarsal-${n}`,fp('calcaneus','Plantar calcaneus',[-23,-50,7],4),fp(`metatarsal-${n}`,'Plantar metatarsal base',[n===5?33:n===4?47:57,-37,n*7],3),5,[0,-1,0],[g('cuboid','Roof of fibularis longus tunnel',[33,-44,23])],['plantar']);
lig('lisfranc','interosseous',fp('cuneiform-medial','Lateral medial cuneiform',[55,-14,6],2),fp('metatarsal-2','Medial second metatarsal base',[57,-15,8],2),4,[0,1,0]);
lig('dorsal-talonavicular','dorsal',fp('talus','Dorsal talar neck',[23,5,0],3),fp('navicular','Dorsal navicular',[33,8,0],3),8,[0,1,0]);
for(let n=1;n<=5;n++) for(const side of [-1,1]) {
  const x=toeBaseX[n-1], z=toeZ[n-1], w=n===1?10:6;
  lig(`mtp-collateral-${n}`,side<0?'medial':'lateral',fp(`metatarsal-${n}`,'Metatarsal head collateral footprint',[x-5,-49,z+side*w],2),fp(`phalanx-${n}-proximal`,'Proximal phalangeal collateral footprint',[x+4,-51,z+side*w],2),3,[0,0,side]);
}
const fascia=(id:string,component:string,a:Footprint,b:Footprint,via:GuidePoint[],width:number,normal:MmPoint)=>add(id,component,'fascia',a,b,via,width,normal);
fascia('superior-extensor','transverse',fp('fibula','Anterior fibula above ankle',[0,55,32],4),fp('tibia','Anterior medial tibia',[9,55,-20],4),[g('tibia','Over extensor tendon group',[24,55,9])],14,[1,0,0]);
fascia('inferior-extensor','superomedial',fp('calcaneus','Lateral calcaneal root',[13,-11,25],4),fp('tibia','Medial malleolar limb',[1,20,-22],4),[g('talus','Y-stem over extensor tendons',[26,17,19]),g('talus','Superomedial limb',[27,21,-3])],9,[1,1,0]);
fascia('inferior-extensor','inferomedial',fp('calcaneus','Lateral calcaneal root',[13,-11,25],4),fp('cuneiform-medial','Medial fascial continuation',[48,-19,-16],4),[g('talus','Y-stem over extensor tendons',[26,17,19]),g('navicular','Inferomedial limb',[42,9,0])],8,[0,1,0]);
fascia('superior-fibular','retromalleolar',fp('fibula','Posterior lateral malleolus',[-19,6,25],3),fp('calcaneus','Lateral posterior calcaneus',[-37,-24,15],4),[g('calcaneus','Over fibular tendons',[-29,-9,32])],10,[-1,0,1]);
fascia('inferior-fibular','calcaneal',fp('calcaneus','Above fibular trochlea',[0,-18,24],3),fp('calcaneus','Below fibular trochlea',[-1,-39,23],3),[g('calcaneus','Over separated fibular tendons',[3,-28,35])],8,[0,0,1]);
fascia('flexor-retinaculum','tarsal-tunnel',fp('tibia','Medial malleolus',[-9,15,-25],4),fp('calcaneus','Medial calcaneal tubercle',[-32,-46,-13],4),[g('talus','Roof over medial tendon group',[-26,-3,-28]),g('calcaneus','Roof of tarsal tunnel',[-21,-26,-25])],16,[0,0,-1]);
for(let n=1;n<=5;n++) fascia('plantar-fascia',`digital-slip-${n}`,fp('calcaneus','Medial plantar calcaneal tubercle',[-34,-53,-5],5),fp(`phalanx-${n}-proximal`,'Plantar plate and digital sheath',[toeBaseX[n-1]+3,-59,toeZ[n-1]],3,'soft-tissue'),[g('calcaneus','Plantar aponeurosis',[0,-60,6]),g(`metatarsal-${n}`,'Longitudinal plantar fascial slip',[75,-63,toeZ[n-1]*0.8])],n===1?9:7,[0,-1,0]);
export const attachmentsFor = (id:string) => attachmentRecords.filter(a=>a.structureId===id || a.from.structureId===id || a.to.structureId===id);

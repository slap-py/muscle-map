/** Explicit synovial interfaces. Syndesmoses and ligament footprints are excluded.
 * Surface masks are selected from opposing bone triangles, not ellipsoids.
 */
export interface JointSurfacePair { id:string; bones:[string,string]; maxGapMm:number; }
const pair=(id:string,a:string,b:string,maxGapMm=4):JointSurfacePair=>({id,bones:[a,b],maxGapMm});
export const jointSurfaces:JointSurfacePair[]=[
  pair('ankle-tibial','tibia','talus'),pair('ankle-fibular','fibula','talus'),
  pair('subtalar-facets','talus','calcaneus',4),pair('talonavicular','talus','navicular'),
  pair('calcaneocuboid','calcaneus','cuboid'),pair('naviculocuboid','navicular','cuboid',3),
  pair('navicular-medial','navicular','cuneiform-medial'),pair('navicular-intermediate','navicular','cuneiform-intermediate'),pair('navicular-lateral','navicular','cuneiform-lateral'),
  pair('intercuneiform-medial','cuneiform-medial','cuneiform-intermediate',3),pair('intercuneiform-lateral','cuneiform-intermediate','cuneiform-lateral',3),pair('cuneocuboid','cuneiform-lateral','cuboid',3),
  pair('tmt-1','cuneiform-medial','metatarsal-1'),pair('tmt-2','cuneiform-intermediate','metatarsal-2'),pair('tmt-2-medial','cuneiform-medial','metatarsal-2',3),pair('tmt-2-lateral','cuneiform-lateral','metatarsal-2',3),pair('tmt-3','cuneiform-lateral','metatarsal-3'),pair('tmt-4','cuboid','metatarsal-4'),pair('tmt-5','cuboid','metatarsal-5'),
  pair('hallux-sesamoid-medial','metatarsal-1','sesamoid-medial',3),pair('hallux-sesamoid-lateral','metatarsal-1','sesamoid-lateral',3),
  pair('proximal-tibiofibular','tibia','fibula',3),
];
for(let n=1;n<=5;n++) {
  jointSurfaces.push(pair(`mtp-${n}`,`metatarsal-${n}`,`phalanx-${n}-proximal`,3));
  if(n===1) jointSurfaces.push(pair('hallux-ip','phalanx-1-proximal','phalanx-1-distal',3));
  else {
    jointSurfaces.push(pair(`pip-${n}`,`phalanx-${n}-proximal`,`phalanx-${n}-middle`,3),pair(`dip-${n}`,`phalanx-${n}-middle`,`phalanx-${n}-distal`,3));
    if(n<5) jointSurfaces.push(pair(`intermetatarsal-${n}-${n+1}`,`metatarsal-${n}`,`metatarsal-${n+1}`,2.5));
  }
}
export const cartilageId=(bone:string)=>bone==='talus'?'talar-cartilage':`cartilage-${bone}`;
export const cartilageBoneIds=[...new Set(jointSurfaces.flatMap(p=>p.bones))];

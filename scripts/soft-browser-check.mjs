import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const source=JSON.parse(await fs.readFile('public/models/bones.manifest.json','utf8'));
const bones=new Set(source.bones.map(b=>b.atlasId));
// Thin, lazy-loaded vessels and nerves have dedicated tolerance/loading checks
// in neurovascular-browser-check.mjs; retain this suite's original tissue scope.
const neurovascular=new Set(JSON.parse(await fs.readFile('src/neurovascularCatalog.json','utf8')).map(s=>s.id));
const checked=[];
let currentStructure;
try{
 await page.goto(viewerUrl(),{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.softTissues==='ready');
 assert.equal(await page.locator('#viewport').getAttribute('data-loaded-muscles'),'13');
 assert.equal(await page.locator('#viewport').getAttribute('data-cartilage-patches'),'78');
 await page.locator('[data-atlas-type="cartilage"]').click();
 const ids=(await page.locator('.structure-row').evaluateAll(rows=>rows.map(r=>r.dataset.id))).filter(id=>!bones.has(id)&&!neurovascular.has(id));
 for(const id of ids){
  currentStructure=id;
  await page.locator('.structure-row[data-id="'+id+'"]').click();
  await page.locator('#isolate').click();await page.locator('#focus-selected').click();
  await page.waitForTimeout(160);
  const bounds=await page.locator('canvas').boundingBox();
  const inspector=await page.locator('.inspector').boundingBox();
  const freeCenterX=(bounds.x+Math.min(bounds.x+bounds.width,inspector.x))/2;
  let hit=false;
  const offsets=[[0,0],[-25,0],[25,0],[0,25],[0,-25],[-50,0],[50,0],[0,60],[0,-60]];
  for(let y=-140;y<=140;y+=35)for(let x=-140;x<=140;x+=35)offsets.push([x,y]);
  // Tibia/fibula cartilage has proximal and distal patches far from its centroid.
  if(['cartilage-tibia','cartilage-fibula'].includes(id))for(const sign of [-1,1])for(let y=180;y<=330;y+=10)for(let x=-170;x<=170;x+=10)offsets.push([x,y*sign]);
  for(const [dx,dy] of offsets){
   await page.mouse.move(freeCenterX+dx,bounds.y+bounds.height/2+dy);await page.waitForTimeout(15);
   if(await page.locator('.structure-row.hovered[data-id="'+id+'"]').count()){
    assert(await page.locator('.model-label[data-id="'+id+'"]').count()>0);hit=true;break;
   }
  }
  if(!hit)await page.screenshot({path:`validation/phase4-missed-${id}.png`});
  assert(hit,'Focused soft tissue should be hoverable: '+id);checked.push(id);
  if(['deltoid','spring','flexor-hallucis-tendon','fibularis-longus-tendon','talar-cartilage'].includes(id)){
   await page.screenshot({path:`validation/phase4-${id}.png`});
   if(id!=='talar-cartilage')assert(await page.locator('.attachment-details').count());
  }
 }
 await page.route('**/models/muscles.glb',route=>route.fulfill({status:404,body:'missing'}));
 await page.reload({waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.softTissues==='ready');
 // Gastrocnemius remains imported from exterior.glb when the other muscle asset fails.
 assert.equal(await page.locator('#viewport').getAttribute('data-loaded-muscles'),'1');
 assert.equal(await page.locator('#viewport').getAttribute('data-exterior-assets'),'ready');
 assert.equal(await page.locator('.structure-row[data-id="gastrocnemius"]').count(),1);
 await page.locator('[data-atlas-type="cartilage"]').click();
 assert.equal(await page.locator('.structure-row').count(),156);
 await page.locator('.structure-row[data-id="fhl"]').click();await page.locator('#isolate').click();await page.locator('#focus-selected').click();
 await page.waitForTimeout(250);await page.screenshot({path:'validation/phase4-muscle-fallback.png'});
 assert.deepEqual(errors,[]);
 const result={checkedSoftTissues:checked.length,selectionHoverFocusIsolateLabels:checked,loadedMuscles:13,cartilagePatches:78,muscle404:'All 156 structures retained; gastrocnemius remains imported from exterior.glb',errors};
 await fs.writeFile('validation/soft-browser-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
 console.error(JSON.stringify({currentStructure,checked,errors},null,2));
 await page.screenshot({path:'validation/soft-browser-failure.png',timeout:3000}).catch(()=>{});
 throw error;
}finally{await browser.close();}

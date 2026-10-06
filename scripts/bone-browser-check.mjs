import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const manifest=JSON.parse(await fs.readFile('public/models/bones.manifest.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.VIEWER_URL??'http://127.0.0.1:5176';
const checked=[];
try {
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.boneAssets==='ready');
  assert.equal(await page.locator('#viewport').getAttribute('data-loaded-bones'),'30');
  await page.locator('[data-mode="skeleton"]').click();
  await page.screenshot({path:'validation/phase4-skeleton.png'});
  const bounds=await page.locator('canvas').boundingBox();
  for(const {atlasId:id} of manifest.bones){
    await page.locator('.structure-row[data-id="'+id+'"]').click();
    await page.locator('#isolate').click();
    await page.locator('#focus-selected').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#isolate').getAttribute('aria-pressed'),'true');
    let hit=false;
    for(const [dx,dy] of [[0,0],[-25,0],[25,0],[0,25],[0,-25],[-50,0],[50,0],[0,60],[0,-60]]){
      const x=bounds.x+bounds.width/2+dx,y=bounds.y+bounds.height/2+dy;
      await page.mouse.move(x,y);await page.waitForTimeout(100);
      if(await page.locator('.structure-row.hovered[data-id="'+id+'"]').count()){
        assert(await page.locator('.model-label[data-id="'+id+'"]').count()>0);
        await page.mouse.click(x,y);
        assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),id);
        hit=true;break;
      }
    }
    assert(hit,'Focused imported bone should be pickable: '+id);
    if(id==='talus')await page.screenshot({path:'validation/phase4-talus.png'});
    checked.push(id);
  }
  // Simulate an unavailable deployment asset: all procedural records remain usable.
  await page.route('**/models/bones.glb',route=>route.fulfill({status:404,body:'missing'}));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.boneAssets==='fallback');
  assert.equal(await page.locator('#viewport').getAttribute('data-loaded-bones'),'0');
  assert.equal(await page.locator('.structure-row').count(),105);
  await page.locator('.structure-row[data-id="talus"]').click();
  await page.locator('#isolate').click();await page.locator('#focus-selected').click();
  await page.waitForTimeout(200);
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.waitForTimeout(150);
  assert(await page.locator('.structure-row.hovered[data-id="talus"]').count()>0);
  assert.deepEqual(errors,[]);
  const result={checkedBones:checked.length,selectionHoverIsolateFocusLabels:checked,fallback:'404 keeps all 105 records; procedural talus remains pickable',errors};
  await fs.writeFile('validation/bone-browser-check.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}

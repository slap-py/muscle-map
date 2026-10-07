import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';
const url=viewerUrl('http://127.0.0.1:5174/');
const catalog=JSON.parse(await fs.readFile(new URL('../src/neurovascularCatalog.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],shaderErrors=[],checks=[];
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/shader error|VALIDATE_STATUS|WebGLProgram.*error/i.test(m.text()))shaderErrors.push(m.text());});}
try{
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();watch(page);let requests=0;
  page.on('request',r=>{if(r.url().endsWith('/neurovascular.glb'))requests++;});
  await page.goto(url,{waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'detached'});
  assert.equal(requests,0,'optional anatomy must not load at startup');
  for(const t of ['artery','vein','nerve'])assert.equal(await page.locator(`[data-layer="${t}"]`).isChecked(),false);
  assert.equal(await page.locator('.structure-row[data-id^="artery-"]').count(),19);
  assert.equal(await page.locator('.structure-row[data-id^="vein-"]').count(),14);
  assert.equal(await page.locator('.structure-row[data-id^="nerve-"]').count(),16);
  if(theme==='light'){await page.mouse.move(0,0);await page.waitForTimeout(600);await page.locator('#viewport > canvas').screenshot({path:'validation/neurovascular-default-canvas.png'});}
  await page.screenshot({path:`validation/neurovascular-default-${theme}.png`});
  await page.locator('[data-layer="artery"]').check();
  await page.waitForFunction(()=>document.querySelector('#viewport').dataset.neurovascularAssets==='ready');
  assert.equal(requests,1);assert.equal(await page.locator('#viewport').getAttribute('data-loaded-neurovascular'),'49');
  await page.locator('[data-layer="vein"]').check();await page.locator('[data-layer="nerve"]').check();assert.equal(requests,1);
  // Search every source entry and inspect its source-backed facts; no hidden layer is silently missing.
  for(const d of catalog){
   await page.locator('#search').fill(d.name);
   const row=page.locator(`.structure-row[data-id="${d.id}"]`);assert.equal(await row.count(),1,d.id);await row.click();
   assert.equal(await page.locator('#details h2').innerText(),d.name);
   assert((await page.locator('.neurovascular-facts p').count())>=2,d.id);
   const references = await page.locator('.structure-references a[href^="https:"]').evaluateAll(links => links.map(link => link.href));
   assert(references.length >= 1, d.id + ' has a source reference');
   assert.equal(new Set(references).size, references.length, d.id + ' references are deduplicated');
  }
  await page.locator('#reset').click();await page.locator('[data-mode="neurovascular"]').click();
  for(const t of ['bone','muscle','artery','vein','nerve'])assert(await page.locator(`[data-layer="${t}"]`).isChecked());
  assert.equal(await page.locator('#opacity').inputValue(),'20');
  await page.locator('[data-view="dorsal"]').click();await page.mouse.move(0,0);await page.waitForTimeout(600);
  await page.screenshot({path:`validation/neurovascular-${theme}-dorsal.png`});
  await page.locator('#search').fill('dorsalis pedis');await page.locator('.structure-row[data-id="artery-dorsalis-pedis"]').click();await page.locator('#focus-selected').click();
  await page.locator('#isolate').click();await page.locator('#neurovascular-opacity').fill('60');assert.equal(await page.locator('#neurovascular-opacity-value').innerText(),'60%');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#isolate').count(),0);assert.equal(await page.locator('#neurovascular-opacity').inputValue(),'60');
  await page.locator('#neurovascular-opacity').fill('100');
  // Keep only arteries, retain the close camera, and locate an actual canvas hit (not a list/label click).
  for(const t of ['bone','muscle','vein','nerve'])await page.locator(`[data-layer="${t}"]`).uncheck();
  await page.locator('#search').fill('');await page.locator('#labels').click();
  const box=await page.locator('#viewport > canvas').boundingBox();let hit;
  const freeWidth=box.width-(await page.locator('.inspector').boundingBox()).width-12;
  for(let dy=-90;dy<=90&&!hit;dy+=15)for(let dx=-90;dx<=90&&!hit;dx+=15){
   const x=box.x+freeWidth/2+dx,y=box.y+box.height/2+dy;
   await page.mouse.move(x,y);await page.waitForTimeout(35);
   const id=await page.locator('.structure-row.hovered').evaluateAll(rows=>rows[0]?.dataset.id);
   if(id?.startsWith('artery-'))hit={x,y,id};
  }
  assert(hit,'thin artery should be pickable in the canvas');await page.mouse.click(hit.x,hit.y);
  assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),hit.id);
  await page.waitForTimeout(500);await page.screenshot({path:`validation/neurovascular-${theme}-picked.png`});
  checks.push(`${theme}: lazy 49-object load; all searchable with sourced facts; layers, preset, opacity, Escape, thin canvas picking`);
  await page.locator('#reset').click();await page.locator('[data-mode="neurovascular"]').click();await page.setViewportSize({width:390,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`validation/neurovascular-${theme}-narrow.png`,fullPage:true});
  // An asset failure hides all three layers and never fabricates replacement vessels.
  await page.route('**/models/neurovascular.glb',r=>r.fulfill({status:404,body:'missing'}));await page.reload({waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('[data-mode="neurovascular"]').click();await page.waitForFunction(()=>document.querySelector('#viewport').dataset.neurovascularAssets==='fallback');
  assert.equal(await page.locator('#viewport').getAttribute('data-loaded-neurovascular'),'0');
  for(const t of ['artery','vein','nerve']){assert.equal(await page.locator(`[data-layer="${t}"]`).isChecked(),false);assert(await page.locator(`[data-layer="${t}"]`).isDisabled());}
  assert.match(await page.locator('#neurovascular-status').innerText(),/unavailable/);assert(await page.locator('[data-layer="bone"]').isChecked());
  await page.screenshot({path:`validation/neurovascular-${theme}-fallback.png`,fullPage:true});checks.push(`${theme}: narrow layout and graceful 404`);await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(shaderErrors,[]);
 await fs.writeFile('validation/neurovascular-browser-check.json',JSON.stringify({checks,errors,shaderErrors},null,2));console.log(JSON.stringify({checks,errors,shaderErrors},null,2));
}finally{await browser.close();}

import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const origin=process.env.VIEWER_URL??'http://127.0.0.1:5178/';
const browser=await chromium.launch({channel:'msedge',headless:true});const rows=[];
try {
 for(const side of ['right','left'])for(const graphics of ['high','low']) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(g=>localStorage.setItem('muscle-map-graphics',g),graphics);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const lower=side==='left'?'left-lower-leg':'lower-leg';const start=Date.now();
  await page.goto(origin+'#/regions?region='+lower+'&region='+side+'-upper-leg',{waitUntil:'domcontentloaded'});
  await page.locator('#viewport').waitFor();await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.boneAssets==='ready');
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});const skeletonReadyMs=Date.now()-start;
  const skinStart=Date.now();await page.locator('[data-mode="exterior"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready'&&window.__viewerDiagnostics?.pendingLoads===0,undefined,{timeout:90000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const dataset=await page.locator('#viewport').evaluate(e=>({...e.dataset}));assert.equal(dataset.graphics,graphics);assert.deepEqual(errors,[]);
  rows.push({side,graphics,cache:'fresh browser context, local production preview',skeletonReadyMs,exteriorSwitchReadyMs:Date.now()-skinStart,totalReadyMs:Date.now()-start,dataset,errors,resources:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>({name:new URL(r.name).pathname,durationMs:r.duration,transferSize:r.transferSize}))) });
  await context.close();
 }
 await fs.writeFile('validation/skin-load-budget.json',JSON.stringify({origin,productionPreview:true,rows},null,2));console.log(JSON.stringify(rows.map(({resources,dataset,...r})=>r),null,2));
}finally{await browser.close();}

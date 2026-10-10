import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin=process.env.VIEWER_URL??'http://127.0.0.1:5178/';
const out=process.env.SKIN_PERF_OUT??'validation/skin-performance-current.json';
const browser=await chromium.launch({channel:'msedge',headless:true});
const rows=[];
const labels=process.env.SKIN_PERF_LABELS==='true';
try {
 for(const side of ['right','left']) for(const graphics of ['high','low']) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(({graphics,labels})=>{localStorage.setItem('muscle-map-graphics',graphics);localStorage.setItem('muscle-map-settings',JSON.stringify({labelsDefault:labels}));},{graphics,labels});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'#/regions?region='+(side==='left'?'left-lower-leg':'lower-leg')+'&region='+side+'-upper-leg');
  await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('[data-mode="exterior"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready'&&window.__viewerDiagnostics?.pendingLoads===0);
  assert.equal(await page.locator('#labels').getAttribute('aria-pressed'),String(labels));
  for(const opacity of [100,50]) {
   await page.locator('#skin-opacity').fill(String(opacity));
   await page.waitForTimeout(1200);
   const rect=await page.locator('canvas').first().boundingBox();
   const x=rect.x+rect.width*.48,y=rect.y+rect.height*.45;
   await page.mouse.move(x,y);await page.mouse.down();
   await page.evaluate(()=>{window.__skinFrames=[];window.__skinRunning=true;let prev=performance.now();function sample(t){if(!window.__skinRunning)return;window.__skinFrames.push(t-prev);prev=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
   const start=Date.now();
   for(let i=0;i<45;i++){await page.mouse.move(x+Math.sin(i/44*Math.PI*2)*100,y+Math.cos(i/44*Math.PI*2)*40);await page.waitForTimeout(16);}
   await page.mouse.up();
   const metrics=await page.evaluate(()=>{window.__skinRunning=false;const a=window.__skinFrames.slice(1).sort((a,b)=>a-b);return {frames:a.length,medianFrameMs:a[Math.floor(a.length*.5)],p95FrameMs:a[Math.floor(a.length*.95)],maxFrameMs:a.at(-1),meanFrameMs:a.reduce((s,v)=>s+v,0)/a.length};});
   assert.deepEqual(errors,[]);
   rows.push({side,graphics,opacity,labels,elapsedMs:Date.now()-start,...metrics,errors:[...errors]});
   console.log(JSON.stringify(rows.at(-1)));
  }
  await context.close();
 }
 await fs.writeFile(out,JSON.stringify({origin,method:'45-step real pointer drag, 1440x1000, fresh Edge headless contexts; RAF intervals during drag include CPU label work and rendering; local observations',rows},null,2));
}finally{await browser.close();}

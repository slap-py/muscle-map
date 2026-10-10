import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>localStorage.setItem('muscle-map-settings',JSON.stringify({skinCapsDefault:false,skinCapOpacityDefault:0})));
const rows=[];
try {
 await page.goto('http://127.0.0.1:5176/#/regions?region=lower-leg&region=right-upper-leg');
 await page.locator('#loading').waitFor({state:'detached',timeout:90000});
 assert.equal(await page.locator('#skin-cap-controls,#skin-caps,#skin-cap-opacity,#setting-skin-caps,#setting-skin-cap-opacity').count(),0);
 assert.equal(await page.locator('.atlas [data-atlas-type="skin"],.atlas [data-tissue="skin"],.atlas .structure-row[data-id$=":skin"]').count(),0);
 assert.equal(await page.locator('#search').getAttribute('placeholder'),'Search 268 structures');
 await page.locator('[data-mode="exterior"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready',undefined,{timeout:90000});
 assert.equal(await page.locator('[data-layer="skin"]').isChecked(),true);
 await page.locator('#skin-opacity').fill('40');assert.equal(await page.locator('#skin-opacity-value').textContent(),'40%');
 await page.locator('#skin-opacity').fill('100');
 await page.locator('#all-layers').click();
 await page.waitForFunction(()=>window.__viewerDiagnostics?.pendingLoads===0,undefined,{timeout:90000});
 for(const [width,expanded] of [[1440,false],[1440,true],[1024,false]]) {
  await page.setViewportSize({width,height:1000});
  if((await page.locator('#expand-inspector').getAttribute('aria-pressed'))!==String(expanded))await page.locator('#expand-inspector').click();
  const sliders=await page.locator('.layer-section input[type="range"]').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,width:r.width,left:r.left,right:r.right,visible:r.height>0};}));
  assert.equal(sliders.length,4);assert(sliders.every(s=>s.visible));
  assert(Math.max(...sliders.map(s=>s.width))-Math.min(...sliders.map(s=>s.width))<.5);
  assert(Math.max(...sliders.map(s=>s.left))-Math.min(...sliders.map(s=>s.left))<.5);
  rows.push({width,expanded,sliders});
  await page.screenshot({path:'validation/skin-controls-'+width+'-'+(expanded?'expanded':'normal')+'.png'});
 }
 await page.locator('#about').click();await page.locator('[data-about-tab="settings"]').click();
 assert.equal(await page.locator('#about-panel-settings').getByText(/cap/i).count(),0);
 await page.screenshot({path:'validation/skin-controls-settings.png'});
 await page.locator('.dialog-close').click();await page.locator('#reset').click();
 assert.equal(await page.locator('#type-filters [data-atlas-type="skin"]').count(),0);
 assert.deepEqual(errors,[]);
 await fs.writeFile('validation/skin-controls-check.json',JSON.stringify({errors,rows,skinExcludedFromAtlas:true,capControlsRemoved:true},null,2));
 console.log('Cap controls absent, skin hidden from atlas, four opacity sliders aligned at all three layouts, no browser errors.');
} finally {await browser.close();}

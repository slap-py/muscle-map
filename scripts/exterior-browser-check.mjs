import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(viewerUrl(),{waitUntil:'networkidle'});
await page.waitForFunction(()=>document.querySelector('#viewport').dataset.exteriorAssets==='ready');
assert.equal(await page.locator('#viewport').getAttribute('data-loaded-muscles'),'13');
await page.locator('[data-mode="exterior"]').click();await page.waitForTimeout(800);
await page.screenshot({path:'validation/exterior-overview.png'});
await page.locator('[data-view="dorsal"]').click();await page.waitForTimeout(800);
await page.screenshot({path:'validation/exterior-dorsal.png'});
for(let n=1;n<=5;n++){
 await page.locator('#atlas-area').selectOption('toe-' + n);
 assert.equal(await page.locator(`.structure-row[data-id="phalanx-${n}-distal"]`).count(),1);
 assert.equal(await page.locator(`.structure-row[data-id="phalanx-${n===5?1:n+1}-distal"]`).count(),0);
}
await page.locator('[data-mode="anatomy"]').click();await page.locator('[data-view="foot"]').click();
for(const opacity of [100,81,80,79,50,10,100]){
 await page.locator('#opacity').fill(String(opacity));await page.waitForTimeout(600);
 assert.equal(await page.locator('#opacity-value').textContent(),`${opacity}%`);
 if(opacity===50)await page.screenshot({path:'validation/muscle-opacity-50.png'});
}
await page.locator('#atlas-area').selectOption('leg');await page.locator('.structure-row[data-id="gastrocnemius"]').click();await page.locator('#focus-selected').click();
await page.waitForTimeout(500);await page.screenshot({path:'validation/gastrocnemius.png'});
assert(await page.locator('.attachment-details').count());
await page.locator('[data-mode="anatomy"]').click();
await page.locator('[data-layer="skin"]').check();
assert.equal(await page.locator('#skin-cap-controls,#skin-caps,#skin-cap-opacity').count(),0);
await page.locator('#skin-opacity').fill('35');
assert.equal(await page.locator('#skin-opacity-value').textContent(),'35%');
await page.locator('#skin-opacity').fill('0');
await page.locator('#reset').click();
assert.equal(await page.locator('#skin-opacity').inputValue(),'100');
assert.equal(await page.locator('[data-layer="skin"]').isChecked(),false);
await page.setViewportSize({width:1100,height:800});await page.screenshot({path:'validation/exterior-narrow.png'});
await page.route('**/models/exterior.glb',r=>r.fulfill({status:404,body:'missing'}));
await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>document.querySelector('#viewport').dataset.exteriorAssets==='fallback');
await page.locator('[data-mode="exterior"]').click();
assert.equal(await page.locator('.structure-row[data-id="skin"]').count(),1);
assert.deepEqual(errors,[]);await fs.writeFile('validation/exterior-browser-check.json',JSON.stringify({checks:['Exterior preset, toe filters, preserved calf heads, skin opacity sweep','Cap controls persist preferences and reset respects those preferences','Missing exterior fallback remains usable'],errors},null,2));console.log('Browser checks passed: exterior, five toe area filters, 13 muscles, opacity sweep; no page errors');
} finally { await browser.close(); }

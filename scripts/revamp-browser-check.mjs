import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const url=process.env.VIEWER_URL??'http://127.0.0.1:5176';
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.loadingStates=[];document.addEventListener('DOMContentLoaded',()=>{const el=document.querySelector('#loading');if(el)new MutationObserver(()=>window.loadingStates.push({text:el.innerText,determinate:el.classList.contains('determinate')})).observe(el,{attributes:true,childList:true,subtree:true,characterData:true});});});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready');
 await page.locator('#loading').waitFor({state:'detached'});
 assert.equal(await page.title(),'Foot & Ankle Explorer');
 assert.equal(await page.locator('.brand .title').innerText(),'Foot & Ankle Explorer');
 assert(await page.evaluate(()=>window.loadingStates.some(s=>s.determinate&&/100%/.test(s.text))));
 checks.push('shared brand and byte-based determinate model loading');
 assert.equal(await page.locator('#labels').getAttribute('aria-pressed'),'true');
 const labels=await page.locator('.model-label.shown').count();assert(labels>=8&&labels<=12,`overview labels ${labels}`);
 const boxes=await page.locator('.model-label.shown').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'overview labels overlap');}
 assert.equal(await page.locator('.label-leaders line').count(),labels);
 await page.locator('[data-layer="bone"]').uncheck();assert.equal(await page.locator('.model-label.shown[data-id="talus"]').count(),0);
 await page.locator('#opacity').fill('40');assert.equal(await page.locator('.model-label.shown[data-id="gastrocnemius"]').count(),0);
 await page.locator('#reset').click();
 checks.push('8–12 non-overlapping overview labels with leaders; hidden and faded structures excluded');
 assert.equal(await page.locator('[data-atlas-type="cartilage"]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#list-count').innerText(),'Showing 77 of 107');
 await page.locator('#atlas-area').selectOption('toe-1');assert.equal(await page.locator('.structure-row[data-id="phalanx-1-distal"]').count(),1);assert.equal(await page.locator('.structure-row[data-id="phalanx-2-distal"]').count(),0);
 await page.locator('#clear-filters').click();await page.locator('#search').fill('tibia');assert(await page.locator('mark').count()>0);await page.locator('#clear-filters').click();
 await page.locator('#only-visible').check();await page.locator('[data-layer="bone"]').uncheck();assert.equal(await page.locator('.tissue-section[data-tissue="bone"]').count(),0);await page.locator('#reset').click();
 await page.locator('[data-atlas-type="cartilage"]').click();await page.locator('.structure-row[data-id="talar-cartilage"]').click();await page.locator('[data-atlas-type="cartilage"]').click();assert.equal(await page.locator('.structure-row[data-id="talar-cartilage"]').count(),1);await page.locator('#clear').click();assert.equal(await page.locator('.structure-row[data-id="talar-cartilage"]').count(),0);
 await page.locator('.structure-row').first().focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('.structure-row.selected').count(),1);assert.equal(await page.locator('.structure-row:focus').count(),1);await page.locator('#reset').click();
 await page.locator('.tissue-section[data-tissue="bone"]>summary').click();await page.waitForTimeout(100);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.tissue-section[data-tissue="bone"]').getAttribute('open'),null);await page.locator('#search').fill('talus');assert.notEqual(await page.locator('.tissue-section[data-tissue="bone"]').getAttribute('open'),null);await page.locator('.structure-row[data-id="talus"]').click();assert.equal(await page.locator('#details .quick-facts dt').innerText(),'Articulations');await page.locator('#reset').click();
 checks.push('type/area/visibility filters, search highlighting, selected-row override, keyboard selection, persistent collapse');
 assert.equal(await page.locator('.empty-inspector').innerText(),'Select a structure to see details.');
 await page.locator('#search').fill('tibialis anterior');await page.locator('.structure-row[data-id="anterior"]').click();assert.equal(await page.locator('.quick-facts dt').count(),5);assert(await page.locator('.structure-references a').count()>0);
 const handle=page.getByRole('separator',{name:'Resize details panel'});await handle.focus();await page.keyboard.press('ArrowLeft');assert.equal(await handle.getAttribute('aria-valuenow'),'324');await page.locator('#expand-inspector').click();assert.equal(await page.locator('#expand-inspector').getAttribute('aria-pressed'),'true');assert.equal(await handle.getAttribute('aria-valuenow'),'640');assert(await page.locator('.inspector--wide').count());await page.waitForTimeout(300);await page.screenshot({path:'validation/revamp-inspector-wide.png'});await page.locator('#expand-inspector').click();assert.equal(await handle.getAttribute('aria-valuenow'),'324');await page.reload({waitUntil:'networkidle'});assert.equal(await handle.getAttribute('aria-valuenow'),'324');
 checks.push('muscle facts and sources, computed bone articulations, resize keyboard, expand/restore and persistence');
 await page.locator('#search').fill('achilles');await page.locator('.structure-row[data-id="achilles"]').click();await page.locator('[data-connection="achilles:common-calcaneal:to"]').click();assert.equal(await page.locator('#viewport').getAttribute('data-ghost'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#viewport').getAttribute('data-ghost'),'false');await page.locator('#reset').click();await page.locator('#home').click();
 await page.locator('#search').fill('metatarsal 1');await page.locator('.structure-row[data-id="metatarsal-1"]').click();await page.locator('#focus-selected').click();await page.waitForTimeout(200);assert(Number(await page.locator('#viewport').getAttribute('data-label-tier'))>=2);assert(await page.locator('.model-label.shown[data-id="metatarsal-1"]').count());await page.screenshot({path:'validation/revamp-forefoot.png'});await page.locator('#reset').click();
 checks.push('attachment focus, Escape, Reset, and forefoot zoom label tiers');
 await page.locator('[data-mode="exterior"]').click();assert.equal(await page.locator('[data-layer="bone"]').isChecked(),true);assert.equal(await page.locator('[data-layer="skin"]').isChecked(),true);await page.locator('#skin-opacity').fill('40');await page.screenshot({path:'validation/exterior-40.png'});await page.locator('[data-mode="exterior"]').click();assert.equal(await page.locator('#skin-opacity').inputValue(),'100');await page.locator('#reset').click();
 await page.locator('#about').click();assert.match(await page.locator('.about-footer').innerText(),/Version 1.0.0 · Updated October 2026/);await page.locator('[data-about-tab="overview"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-about-tab="controls"]').getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.locator('[data-about-tab="sources"]').getAttribute('aria-selected'),'true');await page.keyboard.press('Escape');
 await page.screenshot({path:'validation/revamp-overview.png'});
 for(const width of [820,390]){
  await page.setViewportSize({width,height:1000});assert.equal(await handle.isVisible(),false);await page.locator('#atlas-area').selectOption('toe-2');assert(await page.locator('.structure-row[data-id="phalanx-2-distal"]').count());await page.locator('#clear-filters').click();
  if(width<700){assert.equal(await page.locator('#labels').isVisible(),false);await page.locator('.actions-menu>summary').click();await page.locator('#labels').click();assert.equal(await page.locator('#labels').getAttribute('aria-pressed'),'false');await page.locator('#reset').click();await page.locator('.actions-menu>summary').click();}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:`validation/revamp-narrow-${width}.png`,fullPage:true});
 }
 checks.push('Exterior skeleton and opacity reset; About tabs and shortcuts; 820px/390px layout and overflow menu');
 await page.setViewportSize({width:1440,height:1000});await page.route('**/models/*.glb',r=>r.fulfill({status:404,body:'missing'}));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#loading')?.classList.contains('load-failed'));assert.match(await page.locator('#loading p').innerText(),/Some models couldn't load/);const shownAt=Date.now();await page.locator('#loading').waitFor({state:'detached'});assert(Date.now()-shownAt>=2000);await page.locator('#search').fill('talus');await page.locator('.structure-row[data-id="talus"]').click();assert.equal(await page.locator('#details h2').innerText(),'Talus');
 checks.push('all-asset failure displays a 2.5-second message and preserves procedural interaction');
 const blocked=await browser.newPage({viewport:{width:1440,height:1000}});blocked.on('pageerror',e=>errors.push(e.message));await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};});await blocked.goto(url,{waitUntil:'networkidle'});await blocked.locator('.tissue-section[data-tissue="bone"]>summary').click();await blocked.getByRole('separator').focus();await blocked.keyboard.press('ArrowLeft');checks.push('blocked localStorage leaves filters and resize usable');
 assert.deepEqual(errors,[]);await fs.writeFile('validation/revamp-browser-check.json',JSON.stringify({checks,overviewLabels:labels,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}

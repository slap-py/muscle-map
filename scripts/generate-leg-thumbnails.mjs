import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base=(process.env.VIEWER_URL??'http://127.0.0.1:5181/').replace(/#.*$/,'').replace(/\/$/,'');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:720,height:800},reducedMotion:'reduce'});
await page.addInitScript(()=>localStorage.setItem('muscle-map-graphics','high'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const id of ['right-upper-leg','left-upper-leg','left-lower-leg']){
 await page.goto(base+'/#/'+id,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready',{},{timeout:90000});
 await page.locator('#loading').waitFor({state:'detached',timeout:90000});
 await page.waitForTimeout(1000);
 await page.addStyleTag({content:'.inspector,.compass-wrap,.view-controls,.canvas-tools,#label-layer,.graphics-prompt{visibility:hidden!important}'});
 for(const theme of ['light','dark']){
  await page.locator(`[data-theme-choice="${theme}"]`).click();await page.waitForTimeout(800);
  await page.locator('#viewport > canvas').first().screenshot({path:`public/regions/${id}${theme==='dark'?'-dim':''}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.reload();await page.locator('#loading').waitFor({state:'detached',timeout:90000});await page.waitForTimeout(1000);
 await page.screenshot({path:`validation/${id}-overview.png`});
 console.log(id,await page.locator('#viewport').evaluate(e=>({...e.dataset})),errors);
 await page.setViewportSize({width:720,height:800});
}
await fs.writeFile('validation/leg-thumbnail-errors.json',JSON.stringify(errors));await browser.close();

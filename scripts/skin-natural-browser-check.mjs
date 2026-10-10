import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2]??'after';
const origin=process.env.VIEWER_URL??'http://127.0.0.1:5174/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await fs.mkdir('validation/skin-natural',{recursive:true});
try {
for(const side of ['right','left']) {
 await page.goto(origin+'#/regions?region='+(side==='left'?'left-lower-leg':'lower-leg')+'&region='+side+'-upper-leg');
 await page.locator('#viewport').waitFor({timeout:90000});
 await page.locator('#loading').waitFor({state:'detached',timeout:90000});
 await page.locator('[data-mode="exterior"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready',undefined,{timeout:90000});
 for(const direction of ['anterior','lateral']){
  await page.locator('[data-view="'+direction+'"]').first().click({force:true});
  await page.waitForTimeout(1300);
  await page.screenshot({path:'validation/skin-natural/'+phase+'-'+side+'-'+direction+'.png'});
 }
 if(side==='right'){
  await page.locator('#search').fill('Femur');
  const row=page.locator('.structure-row[data-id="right-upper-leg:femur"]');
  await row.click();
  await page.locator('#focus-selected').click();
  await page.locator('#clear').click();
  for(let i=0;i<2;i++)await page.locator('#zoom-in').click();
  await page.waitForTimeout(1400);
  await page.screenshot({path:'validation/skin-natural/'+phase+'-thigh.png'});
  if(phase==='after'){
   await page.locator('#skin-opacity').fill('40');
   await page.waitForTimeout(1000);
   await page.screenshot({path:'validation/skin-natural/after-opacity40.png'});
   await page.locator('#skin-opacity').fill('100');
   await page.waitForTimeout(1000);
   await page.screenshot({path:'validation/skin-natural/after-controls.png'});
  }
 }
}
if(errors.length)throw Error(errors.join('\n'));
await fs.writeFile('validation/skin-natural/'+phase+'-browser.json',JSON.stringify({errors,bilateral:true,origin},null,2));
console.log('Bilateral skin screenshots captured; no browser errors.');
} finally {await browser.close();}


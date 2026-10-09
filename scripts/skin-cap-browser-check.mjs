import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.env.VIEWER_URL??'http://127.0.0.1:5178/';
const out='validation/skin-cut-caps';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[],captures=[];page.on('pageerror',error=>errors.push(error.message));
try {
 for(const side of ['right','left']) {
  await page.goto(origin+'#/'+side+'-upper-leg',{waitUntil:'domcontentloaded'});
  await page.locator('#viewport').waitFor();
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.boneAssets==='ready',undefined,{timeout:90000});
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  await page.locator('[data-mode="exterior"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.exteriorAssets==='ready'&&window.__viewerDiagnostics?.pendingLoads===0,undefined,{timeout:90000});
  for(const theme of ['light','dark']) {
   await page.locator('#about').click();await page.locator('[data-about-tab="settings"]').click();
   await page.locator('[data-theme-choice="'+theme+'"]').click();await page.locator('#about-dialog .dialog-close').click();
   for(const [end,direction] of [['proximal','Superior'],['seam','Inferior']]) {
    await page.getByRole('button',{name:new RegExp('^View from '+direction+'(?: \u00b7|$)')}).evaluate(element=>element.click());
    await page.waitForTimeout(500);
    for(const caps of [true,false]) {
     await page.locator('#skin-caps').setChecked(caps);await page.locator('#skin-opacity').fill('100');await page.locator('#skin-cap-opacity').fill('100');
     await page.waitForTimeout(150);
     const file=out+'/'+side+'-'+theme+'-'+end+'-'+(caps?'on':'off')+'.png';
     await page.screenshot({path:file});captures.push({side,theme,end,caps,file});
    }
   }
  }
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify({captures,errors},null,2));
 console.log(JSON.stringify({captures:captures.length,errors}));
}finally{await browser.close();}

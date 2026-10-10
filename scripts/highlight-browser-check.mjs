import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],errors=[];
const check=(condition,message)=>{assert(condition,message);checks.push(message);};
try {
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 for(const [route,query,id] of [['/lower-leg','tibialis anterior','anterior'],['/right-upper-leg','sartorius','sartorius'],['/regions?region=left-lower-leg&region=left-upper-leg','sartorius','left-upper-leg:sartorius']]) {
  await page.goto('http://127.0.0.1:5175/#'+route);
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  const toggle=page.locator('#highlight-connections');
  check(await toggle.isEnabled(),'Highlight is available before selection: '+route);
  await toggle.click();
  check(await toggle.getAttribute('aria-pressed')==='true','Highlight can be enabled before selection: '+route);
  await page.locator('#search').fill(query);
  await page.locator(`.structure-row[data-id="${id}"]`).click();
  await page.waitForFunction(()=>document.querySelector('#viewport').dataset.highlightedStructures?.split(',').length>1,undefined,{timeout:30000});
  check(await toggle.getAttribute('aria-pressed')==='true','Selecting a muscle keeps highlight enabled and reveals connections: '+route);
  await toggle.click();
  check(await page.locator('#viewport').getAttribute('data-highlighted-structures')==='','Turning highlight off removes highlighted connections: '+route);
  await toggle.click();
  check((await page.locator('#viewport').getAttribute('data-highlighted-structures')).split(',').length>1,'Highlight can be toggled back on with a selection: '+route);
  await page.locator('#clear').click();
  check(await toggle.isEnabled() && await toggle.getAttribute('aria-pressed')==='false','Clearing selection turns highlight off and leaves control available: '+route);
  await page.locator('[data-mode="skeleton"]').click();
  check(await toggle.isEnabled(),'Highlight remains available in Skeleton: '+route);
 }
 check(errors.length===0,'No browser runtime errors');
 await fs.writeFile('validation/highlight-check.json',JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}

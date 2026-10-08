import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], warnings = [], checks = [];
function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
}
async function ready(page, neurovascular = false) {
  try {
  await page.locator('#viewport').waitFor({ timeout: 60000 });
  await page.waitForFunction(neuro => document.querySelector('#viewport')?.dataset.boneAssets === 'ready'
    && (!neuro || document.querySelector('#viewport')?.dataset.neurovascularAssets === 'ready')
    && window.__viewerDiagnostics?.pendingLoads === 0, neurovascular, { timeout: 60000 }); } catch (error) {
    console.log(JSON.stringify({url:page.url(),errors,warnings,state:await page.evaluate(() => ({viewport:{...document.querySelector('#viewport')?.dataset},diagnostics:window.__viewerDiagnostics,details:document.querySelector('#details')?.innerText}))},null,2));
    await page.screenshot({path:'validation/combined-neurovascular-failure.png'}); throw error;
  }
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
}
async function changeRegions(page, id, included) {
  const previous = await page.locator('#viewport').elementHandle();
  await page.locator('.region-menu > summary').click();
  await page.locator('.region-menu input[value="' + id + '"]').setChecked(included);
  await page.locator('.region-menu button[type="submit"]').click();
  await page.waitForFunction(previous => !previous.isConnected, previous);
  await previous.dispose();
  await ready(page, true);
}
try {
  for (const [graphics, lower, upper] of [['low','lower-leg','right-upper-leg'], ['high','left-lower-leg','left-upper-leg']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(tier => { localStorage.setItem('muscle-map-graphics', tier); localStorage.setItem('muscle-map-theme', 'light'); }, graphics);
    const page = await context.newPage(); watch(page);
    let neuroRequests = 0;
    page.on('request', request => { if (request.url().endsWith('/neurovascular.glb')) neuroRequests++; });
    await page.goto(viewerUrl(undefined, '/' + lower)); await ready(page);
    assert.equal(neuroRequests,0);
    await page.locator('[data-mode="neurovascular"]').click(); await ready(page,true);
    await page.locator('#search').fill('great saphenous');
    await page.locator('.structure-row[data-id="vein-great-saphenous"]').click();
    await page.locator('#neurovascular-opacity').fill('60');
    await page.locator('#labels').click();
    await page.locator('#only-visible').check();
    await page.locator('#atlas-area').selectOption('leg');
    await page.locator('[data-view="medial"]').click();
    await changeRegions(page,upper,true);
    assert.equal(await page.locator('[data-mode="neurovascular"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#opacity').inputValue(),'20');
    assert.equal(await page.locator('#neurovascular-opacity').inputValue(),'60');
    assert.equal(await page.locator('#labels').getAttribute('aria-pressed'),'false');
    assert(await page.locator('#only-visible').isChecked());
    assert.equal(await page.locator('#search').inputValue(),'great saphenous');
    assert.equal(await page.locator('#atlas-area').inputValue(),lower + ':leg');
    assert.equal(await page.locator('[data-view="medial"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#viewport').getAttribute('data-loaded-neurovascular'),'80');
    assert.equal(await page.locator('.structure-row').count(),1);
    assert.match(await page.locator('.structure-coverage').innerText(),/Spans.*Foot.*Upper Leg/);
    assert.match(await page.locator('.structure-tag').innerText(),/Across regions/i);
    assert.match(await page.locator('.structure-description').innerText(),/superficial vein.*lower limb/i);
    for (const area of [lower,upper]) {
      await page.locator('#atlas-area').selectOption(area);
      const row = page.locator('.structure-row'); assert.equal(await row.count(),1);
      assert.equal(await row.getAttribute('data-id'),lower + ':vein-great-saphenous');
      await row.click();
    }
    await page.locator('#focus-selected').click(); await page.locator('#isolate').click();
    await page.mouse.move(0,0); await page.waitForTimeout(500);
    await page.screenshot({path:'validation/combined-neurovascular-' + graphics + '.png'});
    checks.push(graphics + ': joined selection, both Area filters, Focus/Isolate and retained view settings');
    await changeRegions(page,lower,false);
    assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),'great-saphenous-vein');
    assert.equal(await page.locator('.structure-coverage').count(),0);
    assert.equal(await page.locator('#neurovascular-opacity').inputValue(),'60');
    await changeRegions(page,lower,true);
    assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),lower + ':vein-great-saphenous');
    assert.equal(await page.locator('.structure-row').count(),1);
    checks.push(graphics + ': shared selection follows the remaining region and rejoins on add');
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:'validation/combined-neurovascular-' + graphics + '-390.png',fullPage:true});
    await page.locator('.viewer-home').click(); await page.locator('#hub').waitFor();
    await page.waitForFunction(() => window.__viewerDiagnostics.pendingLoads === 0);
    const diagnostics = await page.evaluate(() => window.__viewerDiagnostics);
    assert.equal(diagnostics.activeViewers,0); assert.equal(diagnostics.activeWorkers,0); assert.equal(diagnostics.activeListeners,0);
    await context.close();
    console.log('Passed joined neurovascular navigation in ' + graphics + ' graphics.');
  }
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}); watch(page);
  await page.addInitScript(() => localStorage.setItem('muscle-map-graphics','low'));
  await page.goto(viewerUrl(undefined,'/regions?region=lower-leg&region=left-lower-leg&region=right-upper-leg&region=left-upper-leg&select=right-upper-leg%3Agreat-saphenous-vein'));
  await ready(page,true);
  assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),'lower-leg:vein-great-saphenous');
  assert.equal(await page.locator('#viewport').getAttribute('data-loaded-neurovascular'),'160');
  await page.locator('#search').fill('great saphenous');
  assert.equal(await page.locator('.structure-row').count(),2);
  assert.match(await page.locator('#details h2').innerText(),/Right/);
  await page.locator('.structure-row[data-id="left-lower-leg:vein-great-saphenous"]').click();
  assert.match(await page.locator('#details h2').innerText(),/Left/);
  checks.push('Four regions retain two sided veins, 160 unique neurovascular structures and legacy upper-region deep links');
  await page.locator('#focus-selected').click(); await page.locator('#isolate').click();
  await page.mouse.move(0,0); await page.waitForTimeout(500);
  await page.screenshot({path:'validation/combined-neurovascular-four-regions.png'});
  await page.close();
  assert.deepEqual(errors,[]); assert.deepEqual(warnings,[]);
  await fs.writeFile('validation/combined-neurovascular-browser-check.json',JSON.stringify({checks,errors,warnings},null,2));
  console.log(JSON.stringify({checks,errors,warnings},null,2));
} finally { await browser.close(); }

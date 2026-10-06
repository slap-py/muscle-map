import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) errors.push(message.text());
});
const data = () => page.locator('#viewport').evaluate(element => ({...element.dataset}));
const highlighted = async () => (await data()).highlightedStructures.split(',').filter(Boolean);
const choose = id => page.locator(`.structure-row[data-id="${id}"]`).click();
const layers = () => page.locator('[data-layer]').evaluateAll(elements => elements.map(element => [element.dataset.layer, element.checked]));
const ready = () => page.waitForFunction(() => document.querySelector('#viewport')?.dataset.softTissues === 'ready');
try {
  await page.goto(process.env.VIEWER_URL ?? 'http://127.0.0.1:5176', {waitUntil: 'networkidle'});
  await ready();
  await choose('edl');
  assert.deepEqual(await highlighted(), []);
  await page.locator('[data-layer="tendon"]').uncheck();
  const savedLayers = await layers();
  await page.locator('#highlight-connections').click();
  assert.equal(await page.locator('#highlight-connections').getAttribute('aria-pressed'), 'true');
  const edl = await highlighted();
  assert.equal(edl.length, 10);
  assert(edl.includes('edl'));
  assert(edl.includes('extensor-digitorum-tendons'));
  for (let toe = 2; toe <= 5; toe++) for (const segment of ['middle', 'distal']) assert(edl.includes(`phalanx-${toe}-${segment}`));
  assert.equal(await page.locator('.structure-row.connected').count(), 9);
  assert.equal(await page.locator('[data-layer="tendon"]').isChecked(), false);
  await page.locator('#focus-selected').click();
  await page.waitForTimeout(250);
  await page.screenshot({path: 'validation/misc-highlight-connections.png'});
  checks.push('EDL highlights its tendons and eight toe insertion endpoints; Focus frames full path while layer choices stay unchanged');

  await choose('anterior');
  assert.deepEqual((await highlighted()).sort(), ['anterior', 'cuneiform-medial', 'metatarsal-1', 'tibialis-anterior-tendon'].sort());
  assert.equal(await page.locator('.structure-row[data-id="extensor-digitorum-tendons"]').evaluate(element => element.classList.contains('connected')), false);
  await page.locator('#highlight-connections').focus();
  await page.keyboard.press('Space');
  assert.deepEqual(await highlighted(), []);
  assert.deepEqual(await layers(), savedLayers);
  await page.keyboard.press('Space');
  assert((await highlighted()).includes('tibialis-anterior-tendon'));
  checks.push('persistent mode follows selection, keyboard toggling works, and disabling restores hidden tendon layer');

  await page.locator('#isolate').click();
  assert.deepEqual(await highlighted(), []);
  await page.locator('#focus-selected').click();
  await page.locator('#isolate').click();
  assert((await highlighted()).includes('tibialis-anterior-tendon'));
  await page.locator('#clear').click();
  assert.deepEqual(await highlighted(), []);
  assert.equal((await data()).ghost, 'false');
  assert.equal(await page.locator('#highlight-connections').getAttribute('aria-pressed'), 'true');
  await choose('edl');
  assert.equal((await highlighted()).length, 10);
  await page.locator('[data-connection="extensor-digitorum-tendons:toe-2-middle:to"]').click();
  assert.equal((await data()).ghost, 'true');
  assert.equal((await data()).focusedConnection, 'extensor-digitorum-tendons:toe-2-middle:to');
  assert.equal((await highlighted()).length, 10);
  await page.keyboard.press('Escape');
  assert.deepEqual(await highlighted(), []);
  assert.equal((await data()).ghost, 'false');
  assert.equal(await page.locator('#highlight-connections').getAttribute('aria-pressed'), 'true');
  await page.locator('#reset').click();
  assert.equal(await page.locator('#highlight-connections').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await highlighted(), []);
  checks.push('isolation takes precedence; ghost, clear selection, and reset coexist with highlighting');

  await page.emulateMedia({reducedMotion: 'no-preference'});
  for (const direction of ['Medial', 'Posterior', 'Lateral', 'Anterior', 'Dorsal', 'Plantar']) {
    await page.getByRole('button', {name: new RegExp('^View from ' + direction)}).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#view-name').innerText(), 'PLANTAR VIEW');
  checks.push('six compass directions and interrupted animated view changes settle on latest selection');

  await page.emulateMedia({reducedMotion: 'reduce'});
  await choose('edl');
  await page.locator('#highlight-connections').click();
  await page.locator('#focus-selected').click();
  await page.setViewportSize({width: 820, height: 1000});
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#highlight-connections').isVisible(), true);
  await page.locator('#skin-opacity').scrollIntoViewIfNeeded();
  const sliderBounds = await page.locator('#skin-opacity').boundingBox();
  const panelBounds = await page.locator('.inspector').boundingBox();
  assert(sliderBounds.y >= panelBounds.y);
  assert(sliderBounds.y + sliderBounds.height <= panelBounds.y + panelBounds.height);
  await page.screenshot({path: 'validation/misc-highlight-narrow.png', fullPage: true});
  checks.push('connection control remains accessible on narrow layout');

  await page.setViewportSize({width: 1440, height: 1000});
  await page.route('**/models/*.glb', route => route.fulfill({status: 404, body: 'missing'}));
  await page.reload({waitUntil: 'networkidle'});
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.boneAssets === 'fallback');
  await choose('edl');
  await page.locator('#highlight-connections').click();
  assert.equal((await highlighted()).length, 10);
  await page.locator('#focus-selected').click();
  checks.push('connection highlighting and framing work with procedural asset fallback');
  await page.unroute('**/models/*.glb');
  await page.route('**/models/*.glb', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  // Simulate an existing selection while the initial loading overlay blocks pointer input.
  await page.locator('.structure-row[data-id="edl"]').evaluate(element => element.click());
  await page.locator('#highlight-connections').evaluate(element => element.click());
  await page.locator('#focus-selected').evaluate(element => element.click());
  await ready();
  assert.equal((await highlighted()).length, 10);
  assert.equal(await page.locator('#highlight-connections').getAttribute('aria-pressed'), 'true');
  checks.push('highlight selection persists through late bone and muscle asset loading');
  assert.deepEqual(errors, []);
  const result = {checks, errors};
  await fs.writeFile('validation/misc-browser-check.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

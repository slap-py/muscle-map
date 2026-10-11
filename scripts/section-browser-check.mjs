import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';

const out = process.env.SECTION_OUT ?? 'validation/section';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], checks = [];

async function open(graphics, route) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text()); });
  await page.addInitScript(value => localStorage.setItem('muscle-map-graphics', value), graphics);
  await page.goto(viewerUrl(undefined, route));
  await page.locator('#viewport').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.boneAssets === 'ready', undefined, { timeout: 60000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => window.__viewerDiagnostics?.pendingLoads === 0, undefined, { timeout: 60000 });
  return page;
}
const frame = async page => { await page.waitForTimeout(500); return page.locator('#viewport').screenshot(); };
const setAxis = (page, axis) => page.locator(`[data-section-axis="${axis}"]`).click();
const setPosition = (page, value) => page.locator('#section-position').fill(String(value));
const selectedName = page => page.locator('#details h2').allInnerTexts();

async function run(label, graphics, route) {
  const page = await open(graphics, route);
  try {
    await page.locator('[data-mode="anatomy"]').click();
    await page.waitForFunction(() => Number(document.querySelector('#viewport')?.dataset.loadedMuscles) > 0, undefined, { timeout: 60000 });
    await page.waitForFunction(() => window.__viewerDiagnostics?.pendingLoads === 0, undefined, { timeout: 60000 });
    const labelsButton = page.locator('#labels');
    if ((await labelsButton.getAttribute('aria-pressed')) !== 'true') await labelsButton.click();

    assert.equal(await page.locator('#section-options').isHidden(), true, 'position and flip are hidden while off');
    const off = await frame(page);
    const offLabels = await page.locator('.model-label:not(.leaving)').count();
    assert(offLabels > 0, 'labels are visible before sectioning');

    for (const axis of ['sagittal', 'coronal', 'transverse']) {
      await setAxis(page, axis);
      assert.equal(await page.locator('#section-options').isVisible(), true);
      const half = await frame(page);
      assert(!half.equals(off), `${axis} changes the render`);
      await fs.writeFile(`${out}/${label}-${axis}.png`, half);
      await page.locator('#section-flip').click();
      assert.equal(await page.locator('#section-flip').getAttribute('aria-pressed'), 'true');
      const flipped = await frame(page);
      assert(!flipped.equals(half) && !flipped.equals(off), `${axis} flip shows the other side`);
      await fs.writeFile(`${out}/${label}-${axis}-flipped.png`, flipped);
      const text = await page.locator('#section-position').getAttribute('aria-valuetext');
      assert.match(text, /^50%, \w+ half hidden$/);
      await page.locator('#section-flip').click();
    }

    // At 0% the default transverse cut hides the whole model.
    await setPosition(page, 0);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.model-label:not(.leaving)').count(), 0, 'labels for fully clipped structures disappear');
    await page.locator('#viewport canvas').click({ position: { x: 720, y: 450 } });
    await page.waitForTimeout(200);
    assert.deepEqual(await selectedName(page), [], 'clicking the hidden side selects nothing');
    await setPosition(page, 100);
    await page.waitForTimeout(400);
    assert((await page.locator('.model-label:not(.leaving)').count()) > 0, 'nothing is hidden at 100%');

    // Selecting a clipped structure from the atlas still works and explains itself.
    await setPosition(page, 0);
    await page.locator('.structure-row').first().click();
    assert.match(await page.locator('#layer-hint').innerText(), /Hidden by the section plane/);
    await page.locator('#layer-hint button').click();
    assert.equal(await page.locator('#layer-hint').innerText(), '');
    assert.equal(await page.locator('[data-section-axis="off"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#clear').click();

    // Reset turns the section off.
    await setAxis(page, 'coronal');
    await setPosition(page, 30);
    await page.locator('#reset').click();
    assert.equal(await page.locator('[data-section-axis="off"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#section-options').isHidden(), true);
    assert.equal(await page.locator('#section-position').inputValue(), '50');
    checks.push(`${label}: render, flip, picking, labels, atlas hint, reset`);
  } finally { await page.close(); }
}

async function roundTrip() {
  const page = await open('low', '/left-upper-leg');
  try {
    await setAxis(page, 'coronal');
    await setPosition(page, 35);
    await page.locator('#section-flip').click();
    await page.evaluate(() => { location.hash = '#/regions?region=left-lower-leg&region=left-upper-leg'; });
    await page.waitForFunction(() => document.querySelector('.title')?.textContent === 'Left Leg', undefined, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.boneAssets === 'ready', undefined, { timeout: 60000 });
    assert.equal(await page.locator('[data-section-axis="coronal"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#section-position').inputValue(), '35');
    assert.equal(await page.locator('#section-flip').getAttribute('aria-pressed'), 'true');
    checks.push('session round-trip keeps the section');
  } finally { await page.close(); }
}

try {
  await run('single-high', 'high', '/left-upper-leg');
  await run('combined-low', 'low', '/regions?region=left-lower-leg&region=left-upper-leg');
  await roundTrip();
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); }

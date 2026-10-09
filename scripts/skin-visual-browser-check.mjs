import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { viewerUrl } from './browser-url.mjs';

const outputDir = process.env.SKIN_VISUAL_OUT ?? 'validation/skin-visual';
const side = process.env.SKIN_VISUAL_SIDE ?? 'right';
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
const warnings = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = query => query === '(max-width: 767px), (max-height: 499px) and (pointer: coarse)' ? { matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : original(query);
});
page.on('console', message => {
  if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});

const lowerId = side === 'left' ? 'left-lower-leg' : 'lower-leg';
const upperId = side + '-upper-leg';
const wholeLimbUrl = viewerUrl(undefined, '/regions?region=' + lowerId + '&region=' + upperId);
const lowerLegUrl = viewerUrl(undefined, '/' + lowerId);
if (process.env.SKIN_VISUAL_STAGED === 'true') {
  await page.route('**/models/' + (side === 'left' ? 'left-lower-leg/' : '') + 'exterior.glb', route => route.fulfill({path: 'output/skin/' + side + '/lower-exterior.glb', contentType: 'model/gltf-binary'}));
  await page.route('**/models/' + side + '-upper-leg/exterior.glb', route => route.fulfill({path: 'output/skin/' + side + '/upper-exterior.glb', contentType: 'model/gltf-binary'}));
}
const timings = [];
const captures = [];
const directions = {
  anterior: 'Anterior',
  medial: 'Medial',
  lateral: 'Lateral',
  posterior: 'Posterior',
  dorsal: 'Superior',
  plantar: 'Inferior',
};

const waitForViewer = async () => {
  await page.locator('#viewport').waitFor({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.boneAssets === 'ready', undefined, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.waitForFunction(() => window.__viewerDiagnostics?.pendingLoads === 0, undefined, { timeout: 90000 });
};

const openDialog = async () => {
  let dialog = page.locator('#about-dialog');
  if (!(await dialog.count())) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForViewer();
    await setExterior();
    dialog = page.locator('#about-dialog');
  }
  if (!(await dialog.getAttribute('open'))) {
    await page.locator('#about').evaluate(element => element.click());
    await dialog.waitFor({state:'visible'});
  }
  return dialog;
};

const closeDialog = async () => {
  const dialog = page.locator('#about-dialog');
  if (await dialog.isVisible()) await dialog.locator('.dialog-close').click();
};

const setSettings = async (theme, graphics) => {
  const dialog = await openDialog();
  await dialog.locator('[data-about-tab="settings"]').click();
  await dialog.locator('[data-theme-choice="' + theme + '"]').click();
  await dialog.locator('[data-graphics-choice="' + graphics + '"]').click();
  await closeDialog();
};

const setExterior = async () => {
  await page.locator('[data-mode="exterior"]').click();
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.exteriorAssets === 'ready', undefined, { timeout: 90000 });
  const skin = page.locator('[data-layer="skin"]');
  if (!(await skin.isChecked())) await skin.check();
};

const setCaps = async enabled => {
  const control = page.locator('#skin-caps');
  const current = await control.isChecked();
  if (current !== enabled) {
    if (enabled) await control.check();
    else await control.uncheck();
  }
};

const capture = async (name, metadata) => {
  const file = outputDir + '/' + name + '.png';
  if (page.viewportSize().width === 390) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: file, fullPage: page.viewportSize().width > 390 });
  captures.push({ file, ...metadata });
};

const clickDirection = async direction => {
  const viewId = { anterior: 'anterior', medial: 'medial', lateral: 'lateral', posterior: 'posterior', dorsal: 'superior', plantar: 'inferior' }[direction];
  const preset = page.locator('[data-view="' + viewId + '"]');
  if (await preset.count()) await preset.click({ force: true });
  else await page.getByRole('button', { name: new RegExp('^View from ' + directions[direction] + '(?:.*|$)') }).evaluate(element => element.click());
  await page.waitForTimeout(450);
};

const sizes = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
].filter(size => !process.env.SKIN_VISUAL_WIDTH || size.name === process.env.SKIN_VISUAL_WIDTH);
const themes = [
  { name: 'light', control: 'light' },
  { name: 'dim', control: 'dark' },
];
const opacities = [100, 50, 20];

try {
  await page.goto(wholeLimbUrl, { waitUntil: 'domcontentloaded' });
  const normalStarted = Date.now();
  await waitForViewer();
  timings.push({
    graphics: 'normal',
    elapsedMs: Date.now() - normalStarted,
    route: 'combined',
    viewport: await page.locator('#viewport').evaluate(element => ({ ...element.dataset })),
  });

  await setExterior();
  await setCaps(true);

  if (process.env.SKIN_VISUAL_SCOPE !== 'closeups') for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of themes) {
      await setSettings(theme.control, 'high');
      for (const opacity of opacities) {
        await page.locator('#skin-opacity').fill(String(opacity));
        assert.equal(await page.locator('#skin-opacity-value').textContent(), opacity + '%');
        for (const direction of Object.keys(directions)) {
          await clickDirection(direction);
          for (const caps of [true, false]) {
            await setCaps(caps);
            const name = [side, size.name, theme.name, direction, 'skin' + opacity, 'caps' + (caps ? 'on' : 'off')].join('-');
            await capture(name, {
              route: 'combined',
              size: size.name,
              theme: theme.name,
              direction,
              skinOpacity: opacity,
              caps,
              graphics: 'high',
            });
          }
        }
      }
    }
  }

  await page.goto(lowerLegUrl, { waitUntil: 'domcontentloaded' });
  await waitForViewer();
  await setExterior();

  const closeups = [
    { name: 'ankle', area: 'ankle', id: 'talus', direction: 'anterior' },
    { name: 'heel', area: 'ankle', id: 'calcaneus', direction: 'posterior' },
    { name: 'heel', area: 'ankle', id: 'calcaneus', direction: 'plantar' },
    { name: 'toes', area: 'toe-1', id: 'phalanx-1-distal', direction: 'dorsal' },
    { name: 'toes', area: 'toe-1', id: 'phalanx-1-distal', direction: 'plantar' },
  ];

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of themes) {
      await setSettings(theme.control, 'high');
      for (const opacity of opacities) {
        await page.locator('#skin-opacity').fill(String(opacity));
        assert.equal(await page.locator('#skin-opacity-value').textContent(), opacity + '%');
        for (const closeup of closeups) {
          await page.locator('#atlas-area').selectOption(closeup.area);
          await page.locator('#search').fill('');
          const row = page.locator('.structure-row[data-id="' + closeup.id + '"]');
          await row.waitFor({ timeout: 90000 });
          await clickDirection(closeup.direction);
          await row.click();
          await page.locator('#focus-selected').click();
          await page.waitForTimeout(600);
          // Keep the requested directional camera pose while clearing selection dimming.
          await page.locator('#clear').click();
          for (let zoom = 0; zoom < (closeup.name === 'toes' ? 7 : 3); zoom++) {
            await page.locator('#zoom-out').evaluate(element => element.click());
            await page.waitForTimeout(250);
          }
          for (const caps of [true, false]) {
            await setCaps(caps);
            await capture([side, 'closeup', size.name, theme.name, closeup.name, closeup.direction, 'skin' + opacity, 'caps' + (caps ? 'on' : 'off')].join('-'), {
              route: lowerLegUrl,
              closeup: closeup.name,
              direction: closeup.direction,
              size: size.name,
              theme: theme.name,
              skinOpacity: opacity,
              caps,
              graphics: 'high',
            });
          }
          if (await page.locator('#clear').isVisible()) await page.locator('#clear').click();
        }
      }
    }
  }

  await setSettings('light', 'low');
  await page.goto(wholeLimbUrl, { waitUntil: 'domcontentloaded' });
  const lowStarted = Date.now();
  await waitForViewer();
  timings.push({
    graphics: 'low',
    elapsedMs: Date.now() - lowStarted,
    route: 'combined',
    viewport: await page.locator('#viewport').evaluate(element => ({ ...element.dataset })),
  });
  await setExterior();
  assert.equal(await page.locator('#viewport').getAttribute('data-graphics'), 'low');

  await fs.writeFile(outputDir + '/skin-visual-browser-check.json', JSON.stringify({
    wholeLimbUrl,
    lowerLegUrl,
    stagedAssets:process.env.SKIN_VISUAL_STAGED === 'true',
    qaPhoneGateBypass:true,
    productionPhoneViewerSupported:false,
    timings,
    captures,
    errors,
    warnings,
  }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ captures: captures.length, timings, errors, warnings, outputDir }, null, 2));
} catch (error) {
  await fs.writeFile(outputDir + '/skin-visual-browser-failure.json', JSON.stringify({
    wholeLimbUrl,
    lowerLegUrl,
    stagedAssets:process.env.SKIN_VISUAL_STAGED === 'true',
    qaPhoneGateBypass:true,
    productionPhoneViewerSupported:false,
    timings,
    captures,
    errors,
    warnings,
    failure: String(error),
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}







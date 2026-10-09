import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { appUrl, viewerUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [], errors = [], requests = [], layouts = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await fs.mkdir('validation', { recursive: true });
  const startUrl = new URL(appUrl()); startUrl.hash = '';
  await page.goto(startUrl.toString(), { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).hash, '#/');
  assert.match(await page.locator('h1').innerText(), /Anatomy you can\s+take apart/);
  assert.equal(await page.locator('.intro-feature-grid article').count(), 4);
  assert.equal(await page.locator('.body-map').count(), 0);
  for (const mode of ['skeleton', 'anatomy']) {
    await page.locator(`[data-preview="${mode}"]`).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(`[data-preview="${mode}"]`).getAttribute('aria-pressed'), 'true');
    assert(await page.locator(`[data-preview-view="${mode}"]`).isVisible());
  }
  for (const theme of ['light', 'dark']) {
    await page.locator(`[data-theme-choice="${theme}"]`).click();
    for (const width of [320, 390, 600, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.offsetParent !== null).map(image => image.decode())); });
      const layout = await page.evaluate(() => {
        const header = [...document.querySelector('.intro-header').children].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        const overlaps = header.some((a, i) => header.slice(i + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
        const visibleModel = [...document.querySelectorAll('[data-preview-view="anatomy"] img')].filter(el => getComputedStyle(el).display !== 'none');
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overlaps, visibleModels: visibleModel.length, modelSrc: visibleModel[0]?.getAttribute('src') };
      });
      assert(layout.scrollWidth <= width && !layout.overlaps, `${theme} introduction fits ${width}px`);
      assert.equal(layout.visibleModels, 1);
      assert.equal(layout.modelSrc.includes('-dim'), theme === 'dark');
      layouts.push({ theme, ...layout });
      if ([390, 1440].includes(width)) await page.screenshot({ path: `validation/introduction-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.locator('[data-theme-choice="system"]').click();
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    assert(await page.locator(`.intro-model-${colorScheme === 'light' ? 'light' : 'dim'}`).first().isVisible());
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('.intro-cta a[href="#/how-it-works"]').click();
  await page.locator('.intro-steps').waitFor();
  assert.equal(new URL(page.url()).hash, '#/how-it-works');
  assert.equal(await page.locator('.intro-steps li').count(), 4);
  assert.match(await page.locator('.intro-steps').innerText(), /Layers[\s\S]*Focus[\s\S]*Highlight connections[\s\S]*same side/);
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if ([390, 1440].includes(width)) await page.screenshot({ path: `validation/how-it-works-${width}.png`, fullPage: true });
  }
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.intro-steps li').count(), 4);
  await page.locator('.site-footer a').click();
  await page.locator('.credits-main').waitFor();
  assert.match(await page.locator('.credits-main').innerText(), /Gauthier Kervyn[\s\S]*BodyParts3D[\s\S]*CC BY-SA/);
  assert(await page.locator('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]').count() > 0);
  await page.locator('.credits-back').click();
  await page.locator('.intro-steps').waitFor();
  assert.equal(new URL(page.url()).hash, '#/how-it-works');
  await page.locator('.intro-guide-heading a[href="#/browser"]').click();
  await page.locator('.body-map').waitFor();
  assert.equal(new URL(page.url()).hash, '#/browser');
  assert.equal(await page.locator('.body-section').count(), 6);
  for (const width of [320, 390, 600, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Browser still fits ' + width + 'px');
  }
  await page.locator('.hub-brand').click();
  await page.locator('.intro-hero').waitFor();
  assert.deepEqual(requests.filter(url => /\.glb(?:[?#]|$)|\/src\/main\.ts/.test(url)), []);
  checks.push('Introduction, guide, credits, and browser stay lightweight until a region is opened');
  checks.push('Both model stills work with keyboard controls and follow Light, Dim, and System themes');
  checks.push('Introduction and guide fit phone, tablet, and desktop widths without header overlap or horizontal overflow');
  await page.locator('.intro-cta a[href="#/browser"]').click();
  await page.locator('[data-section="left-foot-ankle"]').click();
  await page.locator('[data-section="left-hip-leg"]').click();
  await page.locator('[data-body-go]').click();
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.locator('#viewport').waitFor();
  assert.match(new URL(page.url()).hash, /regions\?/);
  assert.match(await page.locator('.brand .title').innerText(), /Left Leg/);
  await page.locator('.site-nav a[href="#/browser"]').click();
  await page.locator('.body-map').waitFor();
  assert.equal(new URL(page.url()).hash, '#/browser');
  await page.locator('.hub-brand').click();
  await page.locator('.intro-hero').waitFor();
  assert.equal(await page.evaluate(() => window.__viewerDiagnostics.activeViewers), 0);
  await page.goBack(); await page.locator('.body-map').waitFor();
  await page.goForward(); await page.locator('.intro-hero').waitFor();
  checks.push('Start exploring reaches the unchanged body browser, opens combined regions, returns to the browser, and disposes the viewer');
  await page.goto(viewerUrl(undefined, '/lower-leg?select=talus'));
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
  assert.match(await page.locator('#details h2').innerText(), /Talus/);
  await page.locator('.viewer-home').click(); await page.locator('.intro-hero').waitFor();
  assert.equal(new URL(page.url()).hash, '#/');
  checks.push('Existing region and structure deep links keep working');
  assert.deepEqual(errors, []);
  const report = { checks, layouts, errors };
  await fs.writeFile('validation/introduction-browser-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

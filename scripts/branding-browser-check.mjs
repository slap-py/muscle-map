import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { appUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], checks = [], layouts = [];
const url = new URL(appUrl());
const route = hash => { url.hash = hash; return url.toString(); };
await fs.mkdir('validation', { recursive: true });
function check(condition, message) {
  assert(condition, message);
  checks.push(message);
}
async function capture(page, name, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `validation/branding-${name}.png`, fullPage });
}
async function switches(page) {
  const controls = await page.locator('.switch').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().height > 0).map(el => {
    const track = el.getBoundingClientRect(), knob = getComputedStyle(el, '::after');
    const shift = knob.transform === 'none' ? 0 : new DOMMatrixReadOnly(knob.transform).m41;
    const left = parseFloat(knob.left) + shift, top = parseFloat(knob.top);
    return { left, top, right: track.width - left - parseFloat(knob.width), bottom: track.height - top - parseFloat(knob.height) };
  }));
  check(controls.length >= 10 && controls.every(control => Math.abs(control.top - control.bottom) < 0.1 && Math.min(control.left, control.right) >= 2), 'Layer, connection and settings knobs stay centered inside their tracks');
}
async function layout(page) {
  return page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; };
    const groups = [...document.querySelector('.topbar').children].map(el => ({ name:el.className, ...rect(el) }));
    const overlaps = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push([a.name,b.name]);
    }
    const center = r => (r.top+r.bottom)/2;
    const word = rect(document.querySelector('.viewer-home .brand-wordmark'));
    const description = document.querySelector('.structure-description p');
    const facts = document.querySelector('.quick-facts dd');
    return { width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth, overlaps,
      wordmarkTitleOffset:Math.abs(center(word)-center(rect(document.querySelector('.brand .title')))),
      wordmarkBarOffset:innerWidth > 900 ? Math.abs(center(word)-center(rect(document.querySelector('.topbar')))) : null,
      descriptionFont:description && getComputedStyle(description).fontSize,
      factsFont:facts && getComputedStyle(facts).fontSize,
      headingFont:description && getComputedStyle(document.querySelector('.structure-description h3')).fontSize };
  });
}
function checkLayout(result) {
  check(result.scrollWidth <= result.width && !result.overlaps.length, `No horizontal overflow or topbar overlap at ${result.width}px`);
  check(result.wordmarkTitleOffset < 1 && (result.wordmarkBarOffset === null || result.wordmarkBarOffset < 1), `Wordmark and title align at ${result.width}px`);
  if (result.descriptionFont) check(result.descriptionFont === result.factsFont && parseFloat(result.headingFont) <= 14, `Inspector description matches compact facts at ${result.width}px`);
  layouts.push(result);
}
async function selectMuscle(page) {
  await page.locator('#search').fill('tibialis anterior');
  await page.locator('.structure-row[data-id="anterior"]').click();
}
try {
  const page = await browser.newPage({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route('/browser'), {waitUntil:'networkidle'});
  check(!(await page.locator('.hub-eyebrow').count()), 'Home tagline removed');
  await capture(page, 'home', true);
  for (const width of [820,600,390,320]) {
    await page.setViewportSize({width,height:800});
    const result = await page.evaluate(() => {
      const figure = document.querySelector('.body-map-stage').getBoundingClientRect();
      const panel = document.querySelector('.body-map-panel').getBoundingClientRect();
      return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth, overlap:panel.top < figure.bottom };
    });
    check(result.scrollWidth <= width && !result.overlap, `Home selection stays below the body map at ${width}px`);
    if (width === 390) await capture(page, 'home-390', true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-section="right-foot-ankle"]').click();
  await page.locator('[data-body-go]').click();
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  await selectMuscle(page);
  check(!(await page.locator('.brand-subtitle').count()), 'Viewer tagline removed');
  for (const width of [1440,1024,901,820,600,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(() => document.fonts.ready);
    checkLayout(await layout(page));
    await switches(page);
    if ([1440,390].includes(width)) await capture(page, `viewer-${width}`, true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-layer="bone"]').uncheck();
  await switches(page);
  await page.locator('[data-layer="bone"]').check();
  await page.locator('#highlight-connections').click();
  await switches(page);
  await page.locator('#highlight-connections').click();
  await page.locator('#details').evaluate(el => { el.scrollTop = 200; });
  check(await page.evaluate(() => document.querySelector('#details').getBoundingClientRect().top >= Math.max(...['#clear','#expand-inspector'].map(selector => document.querySelector(selector).getBoundingClientRect().bottom))), 'Scrolling inspector text stays below the clear and expand controls');
  await capture(page, 'inspector-scrolled');
  await page.locator('#about').click();
  await page.locator('[data-about-tab="settings"]').click();
  await switches(page);
  await page.locator('#setting-fps').click();
  await page.locator('#setting-labels-default').click();
  await switches(page);
  await page.locator('#setting-fps').click();
  await page.locator('#setting-labels-default').click();
  await capture(page, 'settings');
  await page.locator('[data-theme-choice="dark"]').click();
  await switches(page);
  await capture(page, 'settings-dim');
  await page.setViewportSize({width:320,height:568});
  check(await page.locator('#about-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), 'Settings fit the narrow dialog');
  await capture(page, 'settings-320');
  await page.locator('.dialog-close').click();
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#details').evaluate(el => { el.scrollTop = 0; });
  await capture(page, 'viewer-dim');
  await page.locator('#expand-inspector').click();
  await capture(page, 'inspector-wide');
  await page.locator('#expand-inspector').click();
  await page.locator('[data-mode="neurovascular"]').click();
  await selectMuscle(page);
  for (const height of [700,600,400]) {
    await page.setViewportSize({width:1024,height});
    check(await page.evaluate(() => document.querySelector('.inspector').getBoundingClientRect().bottom <= innerHeight), `Inspector stays inside a ${height}px tall window`);
    await page.locator('.layer-section').evaluate(el => { el.scrollTop = el.scrollHeight; });
    check(await page.locator('#neurovascular-opacity-controls .slider-row').evaluate(el => {
      const row = el.getBoundingClientRect(), label = el.querySelector('label').getBoundingClientRect();
      const input = el.querySelector('input').getBoundingClientRect(), output = el.querySelector('output').getBoundingClientRect();
      return label.top >= row.top && label.bottom <= row.bottom && label.right <= input.left && input.right <= output.left && output.right <= row.right + 0.5;
    }), `Vessels and nerves slider label fits its row at ${height}px tall`);
    if (height === 600) await capture(page, 'short-window');
  }
  await page.locator('#clear').click();
  check(await page.evaluate(() => document.querySelector('.inspector').getBoundingClientRect().bottom <= innerHeight), 'Empty inspector also stays inside a short window');
  await page.locator('.viewer-home').click();
  await page.locator('a[href="#/credits"]').click();
  await page.setViewportSize({width:390,height:1000});
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Credits fit at 390px');
  await page.goto(route('/regions?region=left-lower-leg&region=left-upper-leg'), {waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  for (const width of [1440,901,390,320]) {
    await page.setViewportSize({width,height:1000});
    checkLayout(await layout(page));
  }
  await capture(page, 'combined-320');
  check(errors.length === 0, 'No browser runtime errors');
  console.log(`${checks.length} branding browser checks passed`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await fs.writeFile('validation/branding-check.json', JSON.stringify({checks,layouts,errors},null,2));
  await browser.close();
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { appUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [], errors = [];
const url = route => appUrl('http://127.0.0.1:5177/', route);
const check = (value, message) => { assert(value, message); checks.push(message); };
async function notice(page) {
  await page.locator('#phone-screen-title').waitFor();
  check(await page.locator('.phone-screen-content').innerText().then(text => text.includes('Fabrica is not designed to be used on phone-size screens') && text.includes('computer or tablet')), 'Notice explains phone support and directs users to a computer or tablet');
  check(await page.locator('#viewport, .body-map, #loading').count() === 0, 'Phone routes do not mount the browser, viewer, or model loader');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notice fits without horizontal overflow');
  check(await page.locator('.phone-screen-content').evaluate(el => { const rect = el.getBoundingClientRect(); return Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 1; }), 'Notice content is centered across the full screen');
}
try {
  await fs.mkdir('validation', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  const models = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/models/')) models.push(request.url()); });
  for (const route of ['/browser', '/lower-leg?select=anterior', '/regions?region=left-lower-leg&region=left-upper-leg']) {
    await page.goto(url(route), { waitUntil: 'networkidle' });
    await notice(page);
  }
  check(models.length === 0, 'Fresh phone links never request anatomy models');
  for (const width of [320, 390, 600, 767]) {
    await page.setViewportSize({ width, height: 844 });
    await notice(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'validation/mobile-screen-light.png', fullPage: true });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: 'validation/mobile-screen-dim.png', fullPage: true });
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.locator('.intro-hero').waitFor();
  check(await page.locator('#phone-screen-title').count() === 0, 'Home remains accessible on phones');
  await page.getByRole('link', { name: 'How it works', exact: true }).first().click();
  await page.waitForFunction(() => document.title === 'How it works · Fabrica');
  check(await page.locator('#phone-screen-title').count() === 0, 'How it works remains accessible on phones');
  await page.goto(url('/browser'));
  for (const width of [768, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.body-map').waitFor({ state: 'attached' });
    check(await page.locator('#phone-screen-title').count() === 0, `Browser opens at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 400 });
  check(await page.locator('.body-map').count() === 1, 'Short computer windows retain browser access');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(url('/lower-leg?select=anterior'));
  await page.locator('#viewport canvas').first().waitFor({ timeout: 60000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await notice(page);
  check(await page.evaluate(() => window.__viewerDiagnostics.activeViewers === 0 && window.__viewerDiagnostics.activeWorkers === 0 && window.__viewerDiagnostics.activeListeners === 0), 'Resizing to phone size disposes viewer resources');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('#viewport canvas').first().waitFor({ timeout: 60000 });
  check(await page.evaluate(() => location.hash === '#/lower-leg?select=anterior'), 'Returning to tablet size reopens the original route');
  await page.setViewportSize({ width: 390, height: 844 });
  await notice(page);
  await page.waitForTimeout(1000);
  check(await page.locator('#viewport').count() === 0, 'In-flight viewer loads do not replace the phone notice');
  const touchPage = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  touchPage.on('pageerror', error => errors.push(error.message));
  await touchPage.goto(url('/browser'));
  await notice(touchPage);
  check(await touchPage.evaluate(() => matchMedia('(pointer: coarse)').matches), 'Landscape phone detection uses the touch-screen media query');
  await touchPage.setViewportSize({ width: 1024, height: 768 });
  await touchPage.locator('.body-map').waitFor({ state: 'attached' });
  check(await touchPage.locator('#phone-screen-title').count() === 0, 'Landscape tablets retain browser access');
  check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
  await fs.writeFile('validation/mobile-screen-check.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}

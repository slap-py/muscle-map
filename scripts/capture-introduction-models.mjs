import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Capture the product's own model views; no illustration or invented anatomy.
const base = process.env.VIEWER_URL ?? 'http://127.0.0.1:5174/';
const url = new URL(base);
url.hash = '/regions?region=left-lower-leg&region=left-upper-leg';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 860, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('muscle-map-theme', 'light');
    localStorage.setItem('muscle-map-graphics', 'high');
    localStorage.setItem('muscle-map-settings', JSON.stringify({ labelsDefault: true, maxLabels: 6, showFps: false }));
  });
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.boneAssets === 'ready', undefined, { timeout: 90000 });
  await page.addStyleTag({ content: 'body{overflow:hidden!important}.topbar,.atlas,.inspector,.site-footer,.compass-wrap,.view-controls,.canvas-tools,.graphics-prompt,#fps-meter{display:none!important}body> #app> main{display:block!important;height:100vh!important;padding:0!important}.model-label{font-size:32px!important;padding:8px 12px!important}#viewport{width:100vw!important;height:100vh!important;border:0!important;border-radius:0!important}' });
  await fs.mkdir('public/introduction', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(choice => { localStorage.setItem('muscle-map-theme', choice); document.documentElement.dataset.theme = choice; }, theme);
    for (const mode of ['anatomy', 'skeleton']) {
      await page.locator(`[data-mode="${mode}"]`).evaluate(el => el.click());
      await page.locator('#home').evaluate(el => el.click());
      await page.waitForTimeout(1500);
      await page.locator('#viewport').screenshot({ path: `public/introduction/leg-${mode}${theme === 'dark' ? '-dim' : ''}.png` });
    }
  }
  console.log('Captured anatomy and skeleton views in Light and Dim.');
} finally { await browser.close(); }

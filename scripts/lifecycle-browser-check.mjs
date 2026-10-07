import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { appUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
});

const hub = appUrl();
const diagnostics = () => page.evaluate(() => {
  const value = window.__viewerDiagnostics;
  if (!value) return null;
  return JSON.parse(JSON.stringify(value));
});
const globalListeners = () => page.evaluate(() => window.__globalListenerDiagnostics?.() ?? null);
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const collectionSize = value => Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : numeric(value);
const waitHub = () => page.locator('#hub').waitFor({ state: 'visible', timeout: 30000 });
const waitViewer = async () => {
  await page.waitForFunction(() => {
    const viewport = document.querySelector('#viewport');
    if (!viewport) return false;
    return ['boneAssets', 'exteriorAssets', 'softTissues'].every(key => ['ready', 'fallback'].includes(viewport.dataset[key] ?? ''));
  }, undefined, { timeout: 60000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => {
    const value = window.__viewerDiagnostics?.pendingLoads;
    return value === 0 || (Array.isArray(value) && value.length === 0) || (value && typeof value === 'object' && Object.keys(value).length === 0);
  }, undefined, { timeout: 60000 });
  await page.waitForTimeout(200);
};
const go = async hash => {
  await page.evaluate(value => { window.location.hash = value; }, hash);
  if (hash === '#/') await waitHub();
  else await waitViewer();
};

// Track live registrations on long-lived targets without retaining detached
// canvas nodes. The app diagnostics cover viewer scope; this supplements them
// with the global window/document/media-query baseline across route changes.
await page.addInitScript(() => {
  const registrations = new Set();
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  const targetKind = target => {
    if (target === window) return 'window';
    if (target === document) return 'document';
    if (typeof MediaQueryList !== 'undefined' && target instanceof MediaQueryList) return 'media-query';
    if (typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement) return 'canvas';
    return null;
  };
  const capture = options => typeof options === 'boolean' ? options : Boolean(options?.capture);
  const prune = () => {
    for (const record of registrations) {
      const target = record.target.deref();
      const listener = record.listener.deref();
      if (!target || !listener || (record.kind === 'canvas' && !target.isConnected)) registrations.delete(record);
    }
  };
  const snapshot = () => {
    prune();
    const byTarget = {};
    for (const record of registrations) byTarget[record.kind] = (byTarget[record.kind] ?? 0) + 1;
    return { active: registrations.size, byTarget };
  };
  proto.addEventListener = function(type, listener, options) {
    const kind = targetKind(this);
    if (kind && listener && (typeof listener === 'object' || typeof listener === 'function')) {
      registrations.add({ kind, type, capture: capture(options), target: new WeakRef(this), listener: new WeakRef(listener) });
    }
    return add.call(this, type, listener, options);
  };
  proto.removeEventListener = function(type, listener, options) {
    const result = remove.call(this, type, listener, options);
    const kind = targetKind(this);
    if (kind) {
      const useCapture = capture(options);
      for (const record of registrations) {
        if (record.kind === kind && record.type === type && record.capture === useCapture && record.target.deref() === this && record.listener.deref() === listener) registrations.delete(record);
      }
      prune();
    }
    return result;
  };
  window.__globalListenerDiagnostics = snapshot;
});

try {
  await fs.mkdir('validation', { recursive: true });
  await page.goto(hub, { waitUntil: 'networkidle', timeout: 60000 });
  await waitHub();
  // Prime Playwright's injected listener bookkeeping before recording the hub baseline.
  await page.waitForFunction(() => document.querySelector('#hub'));
  const hubListenerBaseline = await globalListeners();
  assert(hubListenerBaseline, 'global listener tracker should be available on the hub');

  await go('#/lower-leg');
  const first = await diagnostics();
  assert(first, 'viewer diagnostics should be exposed');
  const listenerBaseline = numeric(first.activeListeners);
  const geometryBaseline = collectionSize(first.geometries);
  assert(numeric(first.activeViewers) >= 1, 'one viewer should be active after mount');
  assert(geometryBaseline > 0, 'viewer should own renderer geometries after mount');
  checks.push('diagnostics expose an active viewer and renderer geometry baseline');

  const cycles = [];
  for (let cycle = 0; cycle < 10; cycle += 1) {
    await go('#/');
    const disposed = await diagnostics();
    assert(disposed, `diagnostics missing after hub transition ${cycle + 1}`);
    assert.equal(numeric(disposed.activeListeners), 0, `scoped listener leak after cycle ${cycle + 1}`);
    assert.equal(numeric(disposed.activeViewers), 0, `viewer leak after cycle ${cycle + 1}`);
    assert.equal(numeric(disposed.activeWorkers), 0, `worker leak after cycle ${cycle + 1}`);
    assert.equal(collectionSize(disposed.geometries), 0, `geometry leak after cycle ${cycle + 1}`);
    assert.equal(collectionSize(disposed.lastDisposedGeometries), 0, `disposed geometry memory after cycle ${cycle + 1}`);
    assert.equal(collectionSize(disposed.pendingLoads), 0, `pending load after cycle ${cycle + 1}`);
    assert.deepEqual(await globalListeners(), hubListenerBaseline, `global listener baseline changed after cycle ${cycle + 1}`);

    await go('#/lower-leg');
    const mounted = await diagnostics();
    assert(mounted, `diagnostics missing after remount ${cycle + 1}`);
    assert.equal(numeric(mounted.activeViewers), 1, `duplicate viewer after cycle ${cycle + 1}`);
    assert.equal(numeric(mounted.activeListeners), listenerBaseline, `listener baseline changed after cycle ${cycle + 1}`);
    assert.equal(collectionSize(mounted.geometries), geometryBaseline, `geometry baseline changed after cycle ${cycle + 1}`);
    assert(collectionSize(mounted.pendingLoads) >= 0, `invalid pending load count after cycle ${cycle + 1}`);
    cycles.push({ cycle: cycle + 1, disposed, mounted, globalListeners: await globalListeners() });
    console.log(`Lifecycle cycle ${cycle + 1}/10 passed`);
  }
  checks.push('10 hub/viewer mount cycles return to stable listener, worker and geometry baselines');

  // Start deliberately slow low-graphics asset loads, then leave immediately.
  // This exercises cancellation while the viewer may still be building BVHs.
  await page.evaluate(() => localStorage.setItem('muscle-map-graphics', 'low'));
  await page.route('**/models/*.glb', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await route.abort();
    } catch (error) {
      if (!/already handled|target closed|browser has been closed/i.test(String(error))) throw error;
    }
  });
  await go('#/');
  await page.evaluate(value => { window.location.hash = value; }, '#/lower-leg');
  await page.waitForTimeout(80);
  const duringCancellation = await diagnostics();
  await page.evaluate(() => { window.location.hash = '#/'; });
  await waitHub();
  await page.waitForTimeout(250);
  const cancelled = await diagnostics();
  assert(cancelled, 'diagnostics missing after cancellation');
  assert.equal(numeric(cancelled.activeViewers), 0);
  assert.equal(numeric(cancelled.activeWorkers), 0);
  assert.equal(collectionSize(cancelled.pendingLoads), 0);
  assert.deepEqual(await globalListeners(), hubListenerBaseline, 'global listener baseline changed after cancellation');
  checks.push('rapid low-graphics route cancellation clears pending asset loads and workers');
  await page.unroute('**/models/*.glb');

  console.log('Checking Low graphics worker lifecycle');
  await go('#/lower-leg');
  const low = await diagnostics();
  assert(low, 'diagnostics missing in low graphics mode');
  assert.equal(numeric(low.activeViewers), 1);
  assert.equal(await page.locator('button[data-graphics-choice="low"]').getAttribute('aria-pressed'), 'true');
  assert(collectionSize(low.activeWorkers) > 0, 'low graphics should create a picking worker while mounted');
  assert.equal(collectionSize(low.pendingLoads), 0);
  await go('#/');
  const lowDisposed = await diagnostics();
  assert(lowDisposed, 'diagnostics missing after low graphics disposal');
  assert.equal(numeric(lowDisposed.activeViewers), 0);
  assert.equal(collectionSize(lowDisposed.activeWorkers), 0);
  assert.equal(collectionSize(lowDisposed.pendingLoads), 0);
  assert.equal(collectionSize(lowDisposed.geometries), 0);
  assert.equal(collectionSize(lowDisposed.lastDisposedGeometries), 0);
  assert.deepEqual(await globalListeners(), hubListenerBaseline, 'global listener baseline changed after low graphics disposal');
  checks.push('low graphics creates a picking worker and releases it on viewer disposal');

  assert.deepEqual(errors, []);
  const result = { checks, errors, baseline: first, cycles, duringCancellation, cancelled, low, lowDisposed, hubListenerBaseline };
  await fs.writeFile('validation/lifecycle-browser-check.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks, errors, baseline: first, cancelled, low }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ checks, errors, diagnostics: await diagnostics().catch(() => null), globalListeners: await globalListeners().catch(() => null), url: page.url() }, null, 2));
  await page.screenshot({ path: 'validation/lifecycle-browser-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { viewerUrl } from "./browser-url.mjs";

const routes = [
  { id: "lower-leg", title: "Right Foot & Ankle", loadedMuscles: 13, sourcePrefix: /\/models\/(?:bones|muscles|exterior|neurovascular)\.glb(?:[?#]|$)/, focus: "achilles" },
  { id: "left-lower-leg", title: "Left Lower Leg & Foot", loadedMuscles: 13, sourcePrefix: /\/models\/left-lower-leg\//, focus: "achilles" },
  { id: "left-upper-leg", title: "Left Upper Leg", loadedMuscles: 27, sourcePrefix: /\/models\/left-upper-leg\//, focus: "adductor-longus" },
  { id: "right-upper-leg", title: "Right Upper Leg", loadedMuscles: 27, sourcePrefix: /\/models\/right-upper-leg\//, focus: "adductor-longus" },
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors = [];
const checks = [];
const routeResults = [];
let requests = [];
page.on("request", request => requests.push(request.url()));
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(message.text()); });

async function waitViewer() {
  await page.locator("#viewport").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => ["ready", "fallback"].includes(document.querySelector("#viewport")?.dataset.boneAssets ?? ""), undefined, { timeout: 60000 });
  await page.locator("#loading").waitFor({ state: "detached", timeout: 60000 });
  await page.waitForFunction(() => {
    const pending = window.__viewerDiagnostics?.pendingLoads;
    return pending === 0 || (Array.isArray(pending) && pending.length === 0) || (pending && typeof pending === "object" && Object.keys(pending).length === 0);
  }, undefined, { timeout: 60000 });
}

async function ensureMusclesAndExterior() {
  const muscle = page.locator('[data-layer="muscle"]');
  if (await muscle.count() && !(await muscle.isChecked())) await muscle.check();
  const skin = page.locator('[data-layer="skin"]');
  if (await skin.count() && !(await skin.isChecked())) await skin.check();
  await page.waitForFunction(() => {
    const viewport = document.querySelector("#viewport");
    return [viewport?.dataset.layerAssets, viewport?.dataset.exteriorAssets].some(value => value === "ready" || value === "fallback");
  }, undefined, { timeout: 60000 });
  await page.waitForTimeout(250);
}

async function checkResponsiveViewerTitle(route) {
  if (route.id === "lower-leg") return;
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const title = document.querySelector(".title")?.getBoundingClientRect();
      const home = document.querySelector(".viewer-home")?.getBoundingClientRect();
      const actions = document.querySelector(".topbar-actions")?.getBoundingClientRect();
      return { title, home, actions, viewport: innerWidth };
    });
    assert(layout.title && layout.home && layout.actions, `${route.id} should expose responsive title controls at ${width}px`);
    assert(layout.title.left >= layout.home.right - 1, `${route.id} title overlaps home control at ${width}px`);
    assert(layout.title.right <= layout.actions.left + 1, `${route.id} title overlaps actions at ${width}px`);
    assert(layout.title.right <= layout.viewport + 1, `${route.id} title is clipped at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  checks.push(`${route.id} title and topbar controls remain separated at 390px and 820px`);
}

async function checkMissingRegionalBones() {
  const failurePage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  try {
    await failurePage.route(/\/models\/right-upper-leg\/bones\.glb(?:[?#]|$)/i, route => route.fulfill({ status: 404, body: "missing regional bones" }));
    await failurePage.goto(viewerUrl(undefined, "/right-upper-leg"), { waitUntil: "domcontentloaded", timeout: 60000 });
    await failurePage.waitForFunction(() => document.querySelector("#viewport")?.dataset.boneAssets === "fallback", undefined, { timeout: 60000 });
    await failurePage.waitForFunction(() => /Unavailable structures are hidden/.test(document.querySelector("#loading p")?.textContent ?? ""), undefined, { timeout: 10000 });
    assert.equal(await failurePage.locator("#viewport").getAttribute("data-loaded-bones"), "0", "failed regional bones should leave unavailable femur geometry hidden");
    checks.push("regional bone failures show the regional retry message and hide unavailable structures");
  } finally {
    await failurePage.close();
  }
}

async function runLowGraphicsPass() {
  for (const route of routes.slice(1)) {
    await page.evaluate(() => localStorage.setItem("muscle-map-graphics", "low"));
    requests = [];
    await page.goto(viewerUrl(undefined, `/${route.id}`), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('[data-mode="skeleton"]').click();
    await waitViewer();
    assert.equal(await page.locator("#viewport").getAttribute("data-graphics"), "low", `${route.id} should use Low graphics`);
    const earlyModels = requests.filter(url => /\/models\/[^/?#]+\.glb(?:[?#]|$)|\/models\/[^?#]+\/[^/?#]+\.glb(?:[?#]|$)/i.test(url));
    assert(earlyModels.some(url => /bones\.glb(?:[?#]|$)/.test(url)), `${route.id} Low graphics should load its regional bones`);
    assert(earlyModels.every(url => route.sourcePrefix.test(url)), `${route.id} Low graphics requested another region asset: ${earlyModels.join(", ")}`);
    assert(!earlyModels.some(url => /neurovascular\.glb/i.test(url)), `${route.id} Low graphics should keep neurovascular lazy`);
    const activeWorkers = await page.evaluate(() => window.__viewerDiagnostics?.activeWorkers ?? 0);
    assert(activeWorkers > 0, `${route.id} should have an active BVH worker in Low graphics`);
    await ensureMusclesAndExterior();
    assert.equal(await page.locator("#viewport").getAttribute("data-exterior-assets"), "ready", `${route.id} Low graphics exterior should be ready`);
    assert.equal(await page.locator("#viewport").getAttribute("data-loaded-muscles"), String(route.loadedMuscles));
  await page.goto(viewerUrl(undefined, "/"), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("#hub").waitFor({ timeout: 30000 });
    const disposed = await page.evaluate(() => window.__viewerDiagnostics);
    assert.equal(disposed.activeWorkers, 0, `${route.id} should dispose its BVH worker on return home`);
  }
  checks.push("Low graphics defers layers, loads exterior on demand, and disposes workers for all new regions");
}

try {
  for (const route of routes) {
    requests = [];
    await page.goto(viewerUrl(undefined, `/${route.id}`), { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitViewer();
    assert.match(page.url(), new RegExp(`#/${route.id}(?:$|[?])`));
    assert.equal(await page.locator(".title").innerText(), route.title);
    await checkResponsiveViewerTitle(route);
    assert(await page.locator(".structure-row").count() > 10, `${route.id} should expose its own catalog`);
    const initialRows = await page.locator(".structure-row").count();
    const initialNeurovascularRequests = requests.filter(url => /neurovascular\.glb/i.test(url));
    assert.deepEqual(initialNeurovascularRequests, [], `${route.id} neurovascular assets should remain lazy before layer activation`);
    await ensureMusclesAndExterior();
    const artery = page.locator(`[data-layer="artery"]`);
    if (await artery.count()) {
      if (await artery.isChecked()) await artery.uncheck();
      await artery.check();
      await page.waitForFunction(() => ["ready", "fallback"].includes(document.querySelector("#viewport")?.dataset.neurovascularAssets ?? ""), undefined, { timeout: 60000 });
      assert.equal(await page.locator("#viewport").getAttribute("data-neurovascular-assets"), "ready", `${route.id} neurovascular assets should load without fallback`);
    }
    const modelRequests = requests.filter(url => /\/models\/[^/?#]+\.glb(?:[?#]|$)|\/models\/[^?#]+\/[^/?#]+\.glb(?:[?#]|$)/i.test(url));
    assert(modelRequests.length >= 1, `${route.id} should request source GLBs`);
    assert(modelRequests.every(url => route.sourcePrefix.test(url)), `${route.id} requested another region's GLB: ${modelRequests.join(", ")}`);
    assert.equal(await page.locator("#viewport").getAttribute("data-bone-assets"), "ready", `${route.id} bones should load without fallback`);
    assert.equal(await page.locator("#viewport").getAttribute("data-exterior-assets"), "ready", `${route.id} exterior should be ready`);
    assert.equal(await page.locator("#viewport").getAttribute("data-loaded-muscles"), String(route.loadedMuscles), `${route.id} should load its expected muscle count`);

    const row = page.locator(`.structure-row[data-id="${route.focus}"]`);
    await row.waitFor({ state: "visible", timeout: 30000 });
    await row.click();
    assert.equal(await page.locator(".structure-row.selected").getAttribute("data-id"), route.focus);
    assert(await page.locator("#details h2").count(), `${route.id} should show selected source facts`);
    await page.locator("#focus-selected").click();
    await page.locator("#isolate").click();
    assert.equal(await page.locator("#isolate").getAttribute("aria-pressed"), "true");
    await page.locator("#isolate").click();
    if (route.id.includes("upper-leg")) {
      assert(await page.locator(".quick-facts").count(), `${route.id} should show source facts for adductor-longus`);
      const references = page.locator(".structure-references a");
      assert(await references.count() > 0, `${route.id} should expose source references`);
    }
    const attachments = page.locator(".attachment-details");
    assert.equal(await attachments.count(), 1, `${route.id} ${route.focus} should expose attachments`);
    await attachments.locator("summary").first().click();
    const focus = attachments.locator(".connection-focus").first();
    assert(await focus.count() >= 1, `${route.id} ${route.focus} should expose an attachment focus control`);
    await focus.click();
    assert.equal(await focus.getAttribute("aria-pressed"), "true");
    await page.waitForFunction(() => Boolean(document.querySelector("#viewport")?.dataset.focusedConnection), undefined, { timeout: 10000 });
    for (const view of ["medial", "lateral"]) {
      const control = page.locator(`[data-view="${view}"]`);
      await control.click();
      assert.equal(await control.getAttribute("aria-pressed"), "true", `${route.id} ${view} camera should be selectable`);
    }
    routeResults.push({ id: route.id, title: route.title, initialRows, modelRequests });
    checks.push(`${route.id} opens its own catalog, loads isolated assets, supports facts, focus, attachments and medial/lateral cameras`);
  }
  await checkMissingRegionalBones();
  await runLowGraphicsPass();
  await page.goto(viewerUrl(undefined, "/"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#hub").waitFor({ timeout: 30000 });
  assert.equal(await page.locator(".body-section[data-state='available']").count(), 4);
  await page.waitForTimeout(250);
  const diagnostics = await page.evaluate(() => window.__viewerDiagnostics);
  assert.equal(diagnostics.activeViewers, 0);
  assert.equal(diagnostics.activeListeners, 0);
  assert.equal(diagnostics.activeWorkers, 0);
  checks.push("switching through all four regions returns viewer disposal counters to zero");
  assert.deepEqual(errors, []);
  await fs.mkdir("validation", { recursive: true });
  const result = { checks, routeResults, diagnostics, errors };
  await fs.writeFile("validation/leg-regions-browser-check.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }

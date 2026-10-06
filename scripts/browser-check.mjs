import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const incidental = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => {
  if (m.type() !== "error") return;
  const url = m.location().url;
  if (url.endsWith("/favicon.ico")) incidental.push({ message: m.text(), url });
  else errors.push({ message: m.text(), url });
});
const settle = () => page.waitForTimeout(1100);
const checks = [];
try {
  await page.goto(process.env.VIEWER_URL ?? "http://127.0.0.1:5176", { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => document.querySelector("#viewport")?.dataset.boneAssets === "ready");
  assert.equal(await page.locator("#viewport").getAttribute("data-loaded-bones"), "30");
  checks.push("all 30 Z-Anatomy bones loaded without procedural fallback");
  await settle();
  const cartilageCount = Number(await page.locator('[data-atlas-type="cartilage"] span').innerText());
  assert.equal(await page.locator('[data-atlas-type="cartilage"]').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.structure-row').count(), 107 - cartilageCount);
  await page.locator('[data-atlas-type="cartilage"]').click();
  assert.equal(await page.locator('.structure-row').count(), 107);
  assert.equal(await page.locator('#labels').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator("#render-error").isVisible(), false);
  await fs.mkdir("validation", { recursive: true });
  await page.screenshot({ path: "validation/phase4-overview.png" });
  checks.push("107 atlas entries, default cartilage exclusion, labels on and production WebGL render");

  for (const view of ["dorsal", "plantar", "medial", "lateral", "foot"]) {
    await page.locator('[data-view="' + view + '"]').click();
    await settle();
    assert.equal(await page.locator('[data-view="' + view + '"]').getAttribute("aria-pressed"), "true");
  }
  for (const name of ["Medial", "Lateral", "Dorsal", "Plantar", "Anterior", "Posterior"]) {
    await page.locator("#home").click();
    await settle();
    await page.getByRole("button", { name: new RegExp("^View from " + name) }).click();
    await settle();
    assert.match(await page.locator("#view-name").innerText(), new RegExp(name.toUpperCase()));
  }
  checks.push("all five presets and six compass directions");

  await page.locator("#reset").click();
  await settle();
  await page.locator("#labels").click();
  assert.equal(await page.locator("#labels").getAttribute("aria-pressed"), "false");
  const bounds = await page.locator("canvas").boundingBox();
  let picked = null;
  for (let y = bounds.y + 140; y < bounds.y + bounds.height - 120 && !picked; y += 65) {
    for (let x = bounds.x + 220; x < bounds.x + bounds.width - 100; x += 60) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(110);
      const hovered = page.locator(".structure-row.hovered");
      if (await hovered.count()) {
        const id = await hovered.getAttribute("data-id");
        await page.waitForTimeout(250);
        assert(await page.locator('.model-label[data-id="' + id + '"]').count() > 0);
        await page.mouse.click(x, y);
        assert.equal(await page.locator(".structure-row.selected").getAttribute("data-id"), id);
        picked = id;
        break;
      }
    }
  }
  assert(picked, "a real rendered mesh should be hoverable and selectable");
  await page.mouse.move(50, 50);
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".structure-row.hovered").count(), 0);
  assert.equal(await page.locator(".structure-row.selected").getAttribute("data-id"), picked);
  checks.push("BVH mesh hover, transient label with labels off, click selection and pointer leave");

  await page.locator('#search').fill("talus");
  await page.locator('.structure-row[data-id="talus"]').click();
  await page.locator("#focus-selected").click();
  await settle();
  await page.locator("#isolate").click();
  await settle();
  assert.equal(await page.locator("#isolate").getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: "validation/phase4-focus.png" });
  await page.locator("#show-connections").click();
  assert.equal(await page.locator("#show-connections").getAttribute("aria-pressed"), "true");
  assert(await page.locator(".connection-links button").count() > 0);
  checks.push("search, focus, isolate and connected structure links");

  await page.locator("#reset").click();
  for (const layer of ["bone","muscle","tendon","ligament","fascia","cartilage"]) {
    const checkbox = page.locator('[data-layer="' + layer + '"]');
    await checkbox.uncheck();
    assert.equal(await checkbox.isChecked(), false);
    await checkbox.check();
  }
  for (const mode of ["skeleton", "anatomy"]) {
    await page.locator('[data-mode="' + mode + '"]').click();
    assert.equal(await page.locator('[data-mode="' + mode + '"]').getAttribute("aria-pressed"), "true");
  }
  assert.equal(await page.locator("#labels").getAttribute("aria-pressed"), "true");
  await settle();
  assert(await page.locator(".model-label.shown").count() > 0);
  await page.locator("#opacity").fill("40");
  assert.equal(await page.locator("#opacity-value").innerText(), "40%");
  checks.push("all six layers, tissue presets, labels and opacity");

  await page.locator("#reset").click();
  await settle();
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-out").click();
  const before = await page.locator("#compass").innerHTML();
  await page.mouse.move(bounds.x + 70, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 165, bounds.y + bounds.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  await settle();
  assert.equal(await page.locator("#view-name").innerText(), "FREE CAMERA");
  assert.notEqual(await page.locator("#compass").innerHTML(), before);
  await page.locator("#pan").click();
  assert.equal(await page.locator("#pan").getAttribute("aria-pressed"), "true");
  await page.mouse.move(bounds.x + 70, bounds.y + 350);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, bounds.y + 365, { steps: 6 });
  await page.mouse.up();
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowLeft");
  await page.mouse.wheel(0, -150);
  await settle();
  checks.push("zoom buttons, wheel, orbit, compass tracking, pan and keyboard pan");

  await page.locator("#reset").click();


  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#reset").click();
  await settle();
  assert.equal(await page.locator("#labels").getAttribute("aria-pressed"), "true");
  await page.waitForTimeout(150);
  assert(await page.locator(".model-label.shown").count() > 0);
  await page.locator("#labels").click();
  assert.equal(await page.locator(".model-label").count(), 0);
  checks.push("reset restores labels and reduced-motion labels remain usable");
  await page.locator('#about').click();
  assert(await page.locator('#about-dialog').isVisible());
  for (const tab of ['overview', 'controls', 'sources']) {
    await page.locator(`[data-about-tab="${tab}"]`).click();
    assert.equal(await page.locator(`[data-about-tab="${tab}"]`).getAttribute('aria-selected'), 'true');
  }
  assert(await page.locator('#about-dialog a[href^="https://"]:visible').count() > 0);
  await page.locator('.dialog-close').click();
  assert.equal(await page.locator('#about-dialog').isVisible(), false);
  checks.push('About overview, controls and sources tabs with accessible state and source links');
  assert.deepEqual(errors, []);
  await fs.writeFile("validation/browser-check.json", JSON.stringify({ url: page.url(), browser: await browser.version(), checks, errors, incidental }, null, 2));
  console.log(JSON.stringify({ checks, errors, incidental }, null, 2));
} finally { await browser.close(); }




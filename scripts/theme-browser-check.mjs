import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { viewerUrl } from './browser-url.mjs';

const browser = await chromium.launch({ channel: "msedge", headless: true });
const url = viewerUrl('http://127.0.0.1:5174/');
const errors = [];
const checks = [];
try {
  await fs.mkdir("validation", { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /shader|webgl|three/i.test(message.text())) errors.push(message.text());
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("muscle-map-theme"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#viewport")?.dataset.boneAssets === "ready");
  await page.locator("#loading").waitFor({state:"detached"});
  assert.equal(await page.locator("#viewport > canvas").getAttribute("data-scene-theme"), "dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), null);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(42, 47, 54)");
  await page.screenshot({ path: "validation/theme-dim-system.png" });
  checks.push("System follows dark OS preference and uses slate background");

  await page.locator('[data-theme-choice="light"]').click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(239, 237, 232)");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  checks.push("Light override applies immediately and persists across reload");

  await page.locator('[data-theme-choice="dark"]').click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(42, 47, 54)");
  const contrast = await page.evaluate(() => {
    const parse = (value) => { const m = value.trim().match(/^#([0-9a-f]{6})/i); if (!m) return [0, 0, 0]; return [0, 1, 2].map(i => parseInt(m[1].slice(i * 2, i * 2 + 2), 16) / 255); };
    const lum = (rgb) => rgb.reduce((sum, channel, i) => sum + (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i], 0);
    const css = getComputedStyle(document.documentElement); const bg = parse(css.getPropertyValue("--surface")); const values = ["--accent", "--teal", "--amber"].map(name => parse(css.getPropertyValue(name)));
    return ["--surface", "--surface-2"].flatMap(surface => { const base=lum(parse(css.getPropertyValue(surface))); return values.map(fg => { const top = Math.max(lum(fg), base), bottom = Math.min(lum(fg), base); return (top + 0.05) / (bottom + 0.05); }); });
  });
  assert(contrast.every(value => value >= 4.5), "dim theme contrast " + contrast);
  await page.screenshot({ path: "validation/theme-dim-forced.png" });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  checks.push("Dim override applies immediately and persists across reload");

  await page.locator('[data-theme-choice="system"]').click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), null);
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(239, 237, 232)");
  checks.push("System override removes the attribute and responds to OS media changes");

  await page.locator('[data-theme-choice="dark"]').click();
  for (const width of [1100,1280,1440,820,390]) {
    await page.setViewportSize({width,height:1000});
    const boxes=await page.locator('.topbar > .brand,.topbar > .modes,.topbar > .theme-control,.topbar > .topbar-actions').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5,`topbar overlaps at ${width}`);}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "validation/theme-dim-narrow.png", fullPage: true });
  checks.push("390px layout has no horizontal overflow");
  const blocked=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'});
  blocked.on('pageerror',e=>errors.push(e.message));
  await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};});
  await blocked.goto(url,{waitUntil:'networkidle'});await blocked.locator('#loading').waitFor({state:'detached'});
  await blocked.locator('[data-theme-choice="dark"]').click();
  await blocked.emulateMedia({colorScheme:'dark'});await blocked.emulateMedia({colorScheme:'light'});
  assert.equal(await blocked.locator('#viewport > canvas').getAttribute('data-scene-theme'),'dark');
  await blocked.locator('[data-theme-choice="system"]').click();
  assert.equal(await blocked.locator('#viewport > canvas').getAttribute('data-scene-theme'),'light');
  checks.push('blocked storage retains manual scene choice across OS changes; System restores OS following');
  await blocked.close();
  assert.deepEqual(errors, []);
  const result = { checks, contrast, errors };
  await fs.writeFile("validation/theme-browser-check.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

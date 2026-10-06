import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors = [], checks = [];
page.on('pageerror',error=>errors.push(error.message));
const choose = id => page.locator(`.structure-row[data-id="${id}"]`).click();
const hoverAt = point => page.evaluate(async ({x,y})=>{
  const canvas = document.querySelector('canvas');
  // Permanent selection labels are buttons; exercise points on the model canvas.
  if(document.elementFromPoint(x,y) !== canvas) {
    canvas.dispatchEvent(new PointerEvent('pointerleave'));
    return null;
  }
  canvas.dispatchEvent(new PointerEvent('pointermove',{
    clientX:x,clientY:y,pointerType:'mouse',bubbles:true,
  }));
  await new Promise(resolve=>setTimeout(resolve,30));
  return document.querySelector('.structure-row.hovered')?.dataset.id ?? null;
},point);
try {
  await page.goto(process.env.VIEWER_URL ?? 'http://127.0.0.1:5177',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.softTissues==='ready');
  await choose('edl');
  await page.locator('#focus-selected').click();
  await page.waitForTimeout(300);
  const anchor = await page.locator('.model-label[data-id="edl"]').evaluate(element=>{
    const viewport=document.querySelector('#viewport').getBoundingClientRect();
    return {x:viewport.x+parseFloat(element.style.left),y:viewport.y+parseFloat(element.style.top)};
  });
  const candidates = [];
  for(const dx of [-90,-75,-65,-55,-40,40,55,65,75,90]) {
    for(const dy of [0,-20,20,-60,60,-120,120]) candidates.push({x:anchor.x+dx,y:anchor.y+dy});
  }
  let musclePoint, unrelated = [];
  const allowed = new Set(['edl','extensor-digitorum-tendons',...Array.from({length:4},(_,i)=>i+2).flatMap(toe=>[`phalanx-${toe}-middle`,`phalanx-${toe}-distal`])]);
  for(const point of candidates) {
    const id = await hoverAt(point);
    if(id==='edl') musclePoint ??= point;
    else if(id && !allowed.has(id)) unrelated.push({...point,id});
    if(musclePoint && unrelated.length>=6) break;
  }
  assert(musclePoint,'find EDL muscle hover on actual model');
  assert(unrelated.length,'find unrelated visible tissue to hover');
  await page.locator('#highlight-connections').click();
  assert.equal(await hoverAt(musclePoint),'edl');
  assert.equal(await page.locator('.model-label.hovered[data-id="edl"]').count(),1);
  let suppressed;
  for(const point of unrelated) {
    const id = await hoverAt(point);
    assert(!id || allowed.has(id),'only active connection group may produce hover labels');
    if(!id) suppressed ??= point;
  }
  assert(suppressed,'an unrelated tissue hover is suppressed');
  assert.equal(await page.locator('.model-label.hovered').count(),0);
  checks.push('highlight mode labels EDL and suppresses hover labels for dimmed, unrelated tissue');

  await page.locator('#highlight-connections').focus();
  await page.keyboard.press('Space');
  assert.equal(await hoverAt(suppressed),suppressed.id);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.structure-row.hovered').count(),0);
  assert.equal(await page.locator('.model-label.hovered').count(),0);
  checks.push('disabling restores ordinary hover; enabling clears a stale hover without moving the pointer');

  await page.mouse.click(suppressed.x,suppressed.y);
  assert.equal(await page.locator('.structure-row.selected').getAttribute('data-id'),suppressed.id);
  checks.push('unrelated structures remain clickable with highlight mode on');

  await choose('extensor-digitorum-tendons');
  assert.equal(await hoverAt(musclePoint),'edl');
  assert.equal(await page.locator('.model-label.hovered[data-id="edl"]').count(),1);
  await page.locator('.structure-row[data-id="tibia"]').evaluate(element=>element.click());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.model-label.hovered[data-id="edl"]').count(),0);
  checks.push('a selected tendon allows hover on its connected muscle; changing selection clears stale connection labels');

  await choose('edl');
  await page.locator('#isolate').click();
  assert.equal(await hoverAt(musclePoint),'edl');
  await page.locator('#isolate').click();
  await page.locator('#clear').click();
  await hoverAt(musclePoint);
  assert.equal(await page.locator('.structure-row.hovered').count(),0);
  checks.push('isolation keeps selected-muscle hover and clearing selection removes connection hover labels');
  assert.deepEqual(errors,[]);
  const result = {checks,errors,suppressed};
  await fs.writeFile('validation/hover-connections-browser-check.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }

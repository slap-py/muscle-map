import { browsableCounts, regionCatalog, type RegionCatalogEntry } from './regions/catalog';
import { regionsHref } from './router';

export type Side = 'right' | 'left';
/** Most sections that can be explored together; more would be slow to render. */
export const MAX_SELECTED_SECTIONS = 3;
type Segment = 'arm-back' | 'hip-leg' | 'foot-ankle';

export interface BodySection {
  id: string; side: Side; segment: Segment; title: string;
  /** Catalog region opened for this section; null while it is not built yet. */
  regionId: string | null;
}

/** Head to toe. Neighbouring segments on the same side touch; nothing crosses the midline. */
const segmentOrder: readonly Segment[] = ['arm-back', 'hip-leg', 'foot-ankle'];
const segmentTitles: Record<Segment, string> = { 'arm-back': 'Arm & Back', 'hip-leg': 'Hip & Upper Leg', 'foot-ankle': 'Lower Leg & Foot' };
const segmentRegions: Record<Side, Record<Segment, string | null>> = {
  right: { 'arm-back': null, 'hip-leg': 'right-upper-leg', 'foot-ankle': 'lower-leg' },
  left: { 'arm-back': null, 'hip-leg': 'left-upper-leg', 'foot-ankle': 'left-lower-leg' },
};
const comingSoonCopy: Record<Segment, string> = {
  'arm-back': 'Shoulder girdle, arm and back muscles, with their attachments, vessels and nerves.',
  'hip-leg': '', 'foot-ankle': '',
};

export const bodySections: readonly BodySection[] = (['right', 'left'] as const).flatMap(side => segmentOrder.map(segment => ({
  id: `${side}-${segment}`, side, segment,
  title: `${side === 'right' ? 'Right' : 'Left'} ${segmentTitles[segment]}`,
  regionId: segmentRegions[side][segment],
})));

const sectionById = new Map(bodySections.map(section => [section.id, section]));
export const sectionForRegion = (regionId: string) => bodySections.find(section => section.regionId === regionId);
const catalogFor = (section: BodySection): RegionCatalogEntry | undefined => regionCatalog.find(region => region.id === section.regionId);

/** A selection is valid when it is empty, or one side's sections form an unbroken chain. */
export function isValidSelection(ids: readonly string[]) {
  const sections = ids.map(id => sectionById.get(id));
  if (ids.length > MAX_SELECTED_SECTIONS) return false;
  if (sections.some(section => !section?.regionId)) return false;
  if (new Set(sections.map(section => section!.side)).size > 1) return false;
  const steps = [...new Set(sections.map(section => segmentOrder.indexOf(section!.segment)))].sort((a, b) => a - b);
  return steps.every((step, index) => index === 0 || step === steps[index - 1] + 1);
}

export function canToggle(selected: readonly string[], id: string) {
  const next = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
  return isValidSelection(next);
}

/** Explains why a section is not clickable right now, or returns null when it is. */
export function blockedReason(selected: readonly string[], id: string): string | null {
  const section = sectionById.get(id);
  if (!section) return 'Unknown section';
  if (!section.regionId) return 'Coming soon';
  if (canToggle(selected, id)) return null;
  if (!selected.includes(id) && selected.length >= MAX_SELECTED_SECTIONS) return `Up to ${MAX_SELECTED_SECTIONS} regions at once`;
  if (selected.includes(id)) return 'Deselect the end of your selection first';
  const sides = new Set(selected.map(item => sectionById.get(item)?.side));
  if (!sides.has(section.side)) return `Clear your selection to switch to the ${section.side} side`;
  return 'Only sections that touch your selection can be added';
}

// Front view in anatomical position (palms forward, thumbs out), so the subject's right side is drawn on the viewer's left.
// Left-side shapes mirror these across the midline (x = 120).
const shapes: Record<Segment, string> = {
  'arm-back': 'M120 82 L111 80 C102 86 92 88 82 92 C70 95 62 104 60 118 C58 136 57 150 55 168 C53 180 52 184 51 192 C48 214 46 238 44 258 L43 263 C38 267 33 272 31 279 C30 284 33 287 36 284 C38 281 40 279 42 279 C40 287 40 295 42 301 C44 307 53 308 56 302 C58 296 59 284 58 268 L59 258 C61 238 63 216 65 196 C66 188 67 184 68 180 C70 166 74 150 79 138 C81 134 82 134 83 138 C85 156 86 176 89 196 C90 214 86 234 81 250 L120 250 Z',
  'hip-leg': 'M120 252 L81 252 C77 268 74 288 74 310 C74 336 78 360 82 382 C90 388 102 388 110 383 C111 360 113 330 115 306 C116 296 118 290 120 288 Z',
  'foot-ankle': 'M82 387 C90 393 102 393 110 388 C112 404 111 420 108 440 C106 454 106 462 107 468 C109 471 109 475 108 478 C111 484 115 491 116 499 C117 506 114 510 109 510 C106 510 104 508 103 506 Q100 508 97 506 Q94 508 91 505 Q88 506 85 503 Q81 503 80 500 C79 496 82 490 85 484 C83 481 83 476 85 473 C85 462 84 452 82 440 C78 424 78 404 82 387 Z',
};

// Non-interactive landmarks for one side (collarbone, chest, fingers, kneecap, toes); mirrored like the shapes.
const sideDetails = 'M111 90 C102 94 94 93 86 95 M88 122 C96 133 108 136 117 132 M46.5 295 L46.5 302 M50 296 L50 304 M53.5 295 L53.5 302 M91 366 C92 376 104 376 105 366 M103 506 L103.5 499 M97 506 L97 502.5 M91 505 L91 502 M85.5 503 L85.5 500.5';
const faceMarkup = `<path class="body-head" d="M110 62 L130 62 L131 80 C127 82 113 82 109 80 Z"/>
        <ellipse class="body-head" cx="97.5" cy="47" rx="3.5" ry="6"/><ellipse class="body-head" cx="142.5" cy="47" rx="3.5" ry="6"/>
        <ellipse class="body-head" cx="120" cy="45" rx="22" ry="26"/>
        <path class="body-hair" d="M97 47 C95 28 105 16 120 16 C135 16 145 28 143 47 C141 38 137 32 131 29 C124 33 112 33 107 29 C101 33 98 40 97 47 Z"/>
        <g class="body-face"><circle cx="112" cy="46" r="1.8"/><circle cx="128" cy="46" r="1.8"/><path d="M107 40 Q112 38 116 40 M124 40 Q128 38 133 40 M119.5 48 C118.5 52 117.5 54 118 55.5 L121.5 55.5 M114.5 61 Q120 64 125.5 61"/></g>`;

const tissueLabels: Record<string, string> = { bone: 'bones', muscle: 'muscles', ligament: 'ligaments', nerve: 'nerves', artery: 'arteries', vein: 'veins', tendon: 'tendons', fascia: 'fascia & retinacula', cartilage: 'cartilage structures' };

export function renderBodyMap() {
  const sectionMarkup = bodySections.map(section => {
    const mirror = section.side === 'left' ? ' transform="matrix(-1 0 0 1 240 0)"' : '';
    return `<path class="body-section" d="${shapes[section.segment]}"${mirror} data-section="${section.id}" data-state="${section.regionId ? 'available' : 'soon'}" role="checkbox" aria-checked="false" aria-label="${section.title}${section.regionId ? '' : ' (coming soon)'}" aria-describedby="body-map-tip" tabindex="0"/>`;
  }).join('');
  return `<section class="body-map" aria-label="Choose a body region">
    <div class="body-map-stage">
      <svg class="body-figure" viewBox="0 0 240 516" role="group" aria-label="Body regions, front view">
        <defs><pattern id="soon-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><line x1="3" y1="0" x2="3" y2="6" class="hatch-line"/></pattern></defs>
        ${faceMarkup}
        ${sectionMarkup}
        <g class="body-details" aria-hidden="true"><path d="${sideDetails}"/><path d="${sideDetails}" transform="matrix(-1 0 0 1 240 0)"/><ellipse cx="120" cy="200" rx="1.6" ry="2.6"/></g>
      </svg>
      <div class="body-side-labels" aria-hidden="true"><span>Right</span><span>Left</span></div>
      <div class="body-map-tip" id="body-map-tip" role="tooltip" hidden></div>
    </div>
    <div class="body-map-panel">
      <p class="body-map-label">Selection</p>
      <p class="body-map-selection" data-body-selection role="status" aria-live="polite"></p>
      <p class="body-map-hint" data-body-hint></p>
      <p class="body-map-warning" data-body-warning role="status" hidden>Performance may be impacted when multiple regions are loaded.</p>
      <div class="body-map-actions"><button type="button" class="button" data-body-clear>Clear</button><button type="button" class="button primary" data-body-go disabled>Go <span aria-hidden="true">→</span></button></div>
    </div>
  </section>`;
}

function tipHtml(section: BodySection, reason: string | null, selected: boolean) {
  const region = catalogFor(section);
  const availableCounts = region ? browsableCounts(region.structureCounts) : undefined;
  const status = !region ? '<span class="tip-badge soon">Coming soon</span>'
    : selected ? '<span class="tip-badge on">Selected</span>' : '';
  const counts = availableCounts ? `<p class="tip-counts"><strong>${availableCounts.total}</strong> structures · ${Object.entries(availableCounts.byTissue).map(([tissue, count]) => `${count} ${tissueLabels[tissue] ?? tissue}`).join(', ')}</p>` : '';
  const action = !region ? '' : reason ? `<p class="tip-action blocked">${reason}</p>` : `<p class="tip-action">${selected ? 'Click to deselect' : 'Click to select'}</p>`;
  return `<div class="tip-head"><strong>${section.title}</strong>${status}</div><p>${region?.description ?? comingSoonCopy[section.segment]}</p>${counts}${action}`;
}

/** Wires a rendered body map. Replacing the page removes these element-bound handlers. */
export function bindBodyMap(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.body-map-stage')!;
  const tip = root.querySelector<HTMLElement>('.body-map-tip')!;
  const paths = [...root.querySelectorAll<SVGPathElement>('.body-section')];
  const go = root.querySelector<HTMLButtonElement>('[data-body-go]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-body-clear]')!;
  const status = root.querySelector<HTMLElement>('[data-body-selection]')!;
  const hint = root.querySelector<HTMLElement>('[data-body-hint]')!;
  const warning = root.querySelector<HTMLElement>('[data-body-warning]')!;
  let selected: string[] = [];
  let tipFor: string | null = null;
  const regionIds = () => bodySections.filter(section => selected.includes(section.id)).map(section => section.regionId!);

  function showTip(id: string) {
    const section = sectionById.get(id)!;
    const path = paths.find(item => item.dataset.section === id)!;
    tipFor = id;
    tip.innerHTML = tipHtml(section, blockedReason(selected, id), selected.includes(id));
    tip.hidden = false;
    const box = path.getBoundingClientRect(), area = stage.getBoundingClientRect();
    const gap = 14, width = tip.offsetWidth, height = tip.offsetHeight;
    // Open away from the midline so the tip never covers the other side's sections.
    // The tip may extend past the figure column but never past the window.
    const minLeft = 8 - area.left, maxLeft = document.documentElement.clientWidth - 8 - area.left - width;
    let left = section.side === 'right' ? box.left - area.left - width - gap : box.right - area.left + gap;
    if (left < minLeft || left > maxLeft) left = Math.min(Math.max(minLeft, box.left - area.left + box.width / 2 - width / 2), maxLeft);
    const top = Math.min(Math.max(0, box.top - area.top + box.height / 2 - height / 2), Math.max(0, area.height - height));
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  function hideTip(id?: string) { if (!id || tipFor === id) { tip.hidden = true; tipFor = null; } }

  function update() {
    for (const path of paths) {
      const id = path.dataset.section!;
      const on = selected.includes(id);
      const reason = blockedReason(selected, id);
      path.dataset.state = !sectionById.get(id)!.regionId ? 'soon' : on ? 'selected' : reason ? 'blocked' : selected.length ? 'addable' : 'available';
      path.setAttribute('aria-checked', String(on));
      path.setAttribute('aria-disabled', String(!!reason));
    }
    const titles = bodySections.filter(section => selected.includes(section.id)).map(section => section.title);
    status.textContent = titles.length ? titles.join(' + ') : 'Nothing selected';
    hint.textContent = selected.length ? 'Add a highlighted neighboring section, or press Go.' : 'Click a body region to select it. Hover for details.';
    warning.hidden = selected.length < 2;
    go.disabled = !selected.length;
    clear.disabled = !selected.length;
    if (tipFor) showTip(tipFor);
  }

  function toggle(id: string) {
    if (blockedReason(selected, id)) { showTip(id); return; }
    selected = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
    update();
    showTip(id);
  }

  for (const path of paths) {
    const id = path.dataset.section!;
    path.addEventListener('pointerenter', () => showTip(id));
    path.addEventListener('pointerleave', () => hideTip(id));
    path.addEventListener('focus', () => showTip(id));
    path.addEventListener('blur', () => hideTip(id));
    path.addEventListener('click', () => toggle(id));
    path.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(id); }
    });
  }
  go.onclick = () => { if (selected.length) location.hash = regionsHref(regionIds()); };
  clear.onclick = () => { selected = []; hideTip(); update(); };
  update();
}

/** Where each segment's leader line lands on its shape (right side; the left side mirrors across x = 120). */
const previewAnchors: Record<Segment, { x: number; y: number }> = {
  'arm-back': { x: 105, y: 215 }, 'hip-leg': { x: 95, y: 320 }, 'foot-ankle': { x: 96, y: 440 },
};

/** Static, labelled copy of the body map for the landing page: every section named, availability shown. */
export function renderRegionsPreview() {
  const lines: string[] = [], shapesMarkup: string[] = [];
  const labels: Record<Side, string[]> = { right: [], left: [] };
  for (const section of bodySections) {
    const mirror = section.side === 'left';
    const { x, y } = previewAnchors[section.segment];
    const ax = mirror ? 240 - x : x, edge = mirror ? 248 : -8;
    const soon = !section.regionId;
    shapesMarkup.push(`<path class="body-section" d="${shapes[section.segment]}"${mirror ? ' transform="matrix(-1 0 0 1 240 0)"' : ''} data-state="${soon ? 'soon' : 'available'}"${soon ? ' style="fill:url(#intro-soon-hatch)"' : ''}/>`);
    lines.push(`<path d="M${edge} ${y} H${ax}"/><circle cx="${ax}" cy="${y}" r="3.5"/>`);
    labels[section.side].push(`<li style="top:${(y / 516 * 100).toFixed(2)}%"><strong>${segmentTitles[section.segment]}</strong><span class="${soon ? 'soon' : 'ready'}">${soon ? 'Coming soon' : 'Available'}</span></li>`);
  }
  const summary = bodySections.map(section => `${section.title}${section.regionId ? '' : ' (coming soon)'}`).join('; ');
  return `<div class="intro-regions" role="img" aria-label="Body map showing every region. ${summary}.">
    <ul class="intro-regions-side" data-side="right"><li class="side-name">Right</li>${labels.right.join('')}</ul>
    <div class="intro-regions-figure"><svg viewBox="0 0 240 516" aria-hidden="true"><defs><pattern id="intro-soon-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><line x1="3" y1="0" x2="3" y2="6" class="hatch-line"/></pattern></defs>
      ${faceMarkup}${shapesMarkup.join('')}<g class="body-details"><path d="${sideDetails}"/><path d="${sideDetails}" transform="matrix(-1 0 0 1 240 0)"/><ellipse cx="120" cy="200" rx="1.6" ry="2.6"/></g><g class="intro-regions-lines">${lines.join('')}</g></svg></div>
    <ul class="intro-regions-side" data-side="left"><li class="side-name">Left</li>${labels.left.join('')}</ul>
  </div>`;
}

import { regionCatalog, type RegionCatalogEntry } from './regions/catalog';
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
const segmentTitles: Record<Segment, string> = { 'arm-back': 'Arm & Back', 'hip-leg': 'Hip & Upper Leg', 'foot-ankle': 'Foot & Ankle' };
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

// Front view, so the subject's right side is drawn on the viewer's left.
// Left-side shapes mirror these across the midline (x = 120).
const shapes: Record<Segment, string> = {
  'arm-back': 'M119 84 L104 84 C92 86 80 88 72 96 C62 104 58 116 57 130 L50 200 L42 262 C40 274 38 286 42 296 C46 302 54 300 55 290 L58 262 L68 204 L76 150 C78 146 80 146 81 150 L84 200 C84 220 82 236 80 250 L119 250 Z',
  'hip-leg': 'M119 252 L80 252 C76 270 72 290 72 310 L76 380 C84 386 100 386 108 380 L114 300 C115 290 117 286 119 284 Z',
  'foot-ankle': 'M76 384 C84 390 100 390 108 384 L106 440 L103 480 C104 490 104 498 100 504 L70 504 C64 504 64 496 70 492 L80 482 L78 440 C72 420 72 400 76 384 Z',
};

const tissueLabels: Record<string, string> = { bone: 'bones', muscle: 'muscles', ligament: 'ligaments', nerve: 'nerves', artery: 'arteries' };

export function renderBodyMap(lastRegions: readonly string[]) {
  const lastSections = lastRegions.map(sectionForRegion).filter(Boolean).map(section => section!.id);
  const lastValid = lastSections.length > 0 && lastSections.length === lastRegions.length && isValidSelection(lastSections);
  const sectionMarkup = bodySections.map(section => {
    const mirror = section.side === 'left' ? ' transform="matrix(-1 0 0 1 240 0)"' : '';
    return `<path class="body-section" d="${shapes[section.segment]}"${mirror} data-section="${section.id}" data-state="${section.regionId ? 'available' : 'soon'}" role="checkbox" aria-checked="false" aria-label="${section.title}${section.regionId ? '' : ' (coming soon)'}" aria-describedby="body-map-tip" tabindex="0"/>`;
  }).join('');
  return `<section class="body-map" aria-label="Choose a body region">
    <div class="body-map-stage">
      <svg class="body-figure" viewBox="0 0 240 516" role="group" aria-label="Body regions, front view">
        <defs><pattern id="soon-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><line x1="3" y1="0" x2="3" y2="6" class="hatch-line"/></pattern></defs>
        <circle class="body-head" cx="120" cy="46" r="26"/><rect class="body-head" x="110" y="66" width="20" height="20" rx="4"/>
        ${sectionMarkup}
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
      ${lastValid ? `<a class="last-region" href="${regionsHref(lastRegions)}">Resume ${lastSections.map(id => sectionById.get(id)!.title).join(' + ')} <span aria-hidden="true">→</span></a>` : ''}
    </div>
  </section>`;
}

function tipHtml(section: BodySection, reason: string | null, selected: boolean, last: boolean) {
  const region = catalogFor(section);
  const status = !region ? '<span class="tip-badge soon">Coming soon</span>'
    : selected ? '<span class="tip-badge on">Selected</span>'
    : last ? '<span class="tip-badge">Last opened</span>' : '';
  const counts = region ? `<p class="tip-counts"><strong>${region.structureCounts.total}</strong> structures · ${Object.entries(tissueLabels)
    .filter(([tissue]) => region.structureCounts.byTissue[tissue as keyof typeof region.structureCounts.byTissue])
    .map(([tissue, label]) => `${region.structureCounts.byTissue[tissue as keyof typeof region.structureCounts.byTissue]} ${label}`).join(', ')}</p>` : '';
  const action = !region ? '' : reason ? `<p class="tip-action blocked">${reason}</p>` : `<p class="tip-action">${selected ? 'Click to deselect' : 'Click to select'}</p>`;
  return `<div class="tip-head"><strong>${section.title}</strong>${status}</div><p>${region?.description ?? comingSoonCopy[section.segment]}</p>${counts}${action}`;
}

/** Wires a rendered body map. Replacing the page removes these element-bound handlers. */
export function bindBodyMap(root: HTMLElement, lastRegions: readonly string[]) {
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
    tip.innerHTML = tipHtml(section, blockedReason(selected, id), selected.includes(id), !!section.regionId && lastRegions.includes(section.regionId));
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
    hint.textContent = selected.length ? 'Add a highlighted neighbouring section, or press Go.' : 'Click a body region to select it. Hover for details.';
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

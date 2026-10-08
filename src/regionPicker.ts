import { regionsHref } from './router';
import { blockedReason, isValidSelection, sectionForRegion } from './bodyMap';

/** A form owns its controls, so replacing the page also removes these handlers. */
export function bindRegionPicker(form: HTMLFormElement) {
  const inputs = [...form.querySelectorAll<HTMLInputElement>('input[name="region"]')];
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = form.querySelector<HTMLElement>('[data-region-status]');
  const selected = () => inputs.filter(input => input.checked).map(input => input.value);
  function update() {
    const count = selected().length;
    button.disabled = count === 0;
    if (status) status.textContent = count ? `${count} ${count === 1 ? 'region' : 'regions'} selected` : 'Select regions to explore together';
    // Same rule as the home body map: one side, touching sections only.
    const sections = selected().map(id => sectionForRegion(id)?.id ?? id);
    const valid = isValidSelection(sections);
    inputs.forEach(input => {
      const section = sectionForRegion(input.value);
      const reason = section && valid ? blockedReason(sections, section.id) : null;
      input.disabled = !!reason && !input.checked;
      input.closest('.region-picker-row')?.setAttribute('title', input.disabled ? reason! : '');
    });
  }
  inputs.forEach(input => { input.onchange = update; });
  form.onsubmit = event => {
    event.preventDefault();
    if (selected().length) location.hash = regionsHref(selected());
    const details = form.closest('details');
    if (details) details.open = false;
  };
  const clear = form.querySelector<HTMLButtonElement>('[data-clear-regions]');
  if (clear) clear.onclick = () => { inputs.forEach(input => { input.checked = false; }); update(); };
  update();
}

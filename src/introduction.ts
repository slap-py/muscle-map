import { mainNavigation, siteFooter } from "./siteChrome";
import { brandLockup } from './branding';
import { readThemeChoice } from './theme';

const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const icons = {
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  select: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
  connect: '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 10 8-4M8 14l8 4"/>',
  regions: '<rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/><path d="M12 8v8"/>',
};
const features = [
  { id: 'layers', title: 'Peel back the layers', summary: 'Hide tissues or fade muscles to see the structures underneath.', instruction: 'In the viewer, use the switches under Layers to show or hide bones, muscles, tendons, ligaments, and other tissues. Lower the Muscle slider to see through the muscles, or choose Skeleton for a bone view.' },
  { id: 'select', title: 'Click any structure to learn more', summary: 'Select a modeled structure to read its name, description, and available facts.', instruction: 'Click a structure in the 3D model, or find it in the searchable structure list. Its details appear in the panel. Muscles include available attachment and function information. Use Focus to bring the selection closer, or Isolate to show it on its own.' },
  { id: 'connect', title: 'See how things connect', summary: 'Explore modeled attachments and the structures around your selection.', instruction: 'Select a structure and turn on Highlight connections to reveal its modeled connections. Neighbors shows adjacent and attached structures. Where attachment cards are available, select one to focus on its footprint and fade the surrounding anatomy.' },
  { id: 'regions', title: 'Combine regions', summary: 'Open touching regions on the same side in one aligned 3D view.', instruction: 'In the browser, select an available region on the body, then add a touching section on the same side and press Go. For example, combine the left upper leg with the left lower leg and foot. Clear the selection before switching sides. Only the available leg regions can be opened today.' },
] as const;

function header(guide: boolean) {
  const choice = readThemeChoice();
  return `<header class="intro-header">
    <a class="intro-brand" href="#/" aria-label="Fabrica home">${brandLockup}</a>
    ${mainNavigation(guide ? "#/how-it-works" : "#/")}
    <div class="segmented theme-control intro-theme" aria-label="Color theme">${(['system', 'light', 'dark'] as const).map(value => `<button data-theme-choice="${value}" aria-pressed="${choice === value}" class="${choice === value ? 'active' : ''}">${value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dim'}</button>`).join('')}</div>
  </header>`;
}

function footer() {
  return siteFooter;
}

function featureIcon(id: keyof typeof icons) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>`;
}

function modelPreview() {
  return `<figure class="intro-preview">
    <div class="intro-preview-heading"><span>Inside the model</span><div class="intro-preview-controls" role="group" aria-label="Model preview"><button data-preview="anatomy" aria-pressed="true">Anatomy</button><button data-preview="skeleton" aria-pressed="false">Skeleton</button></div></div>
    <div class="intro-preview-stage">${(['anatomy', 'skeleton'] as const).map(mode => `<div data-preview-view="${mode}" ${mode === 'skeleton' ? 'hidden' : ''}><img class="intro-model-light" src="${import.meta.env.BASE_URL}introduction/leg-${mode}.png" alt="${mode === 'anatomy' ? 'Fabrica model of the left upper and lower leg, showing muscles, tendons, and bones with structure labels.' : 'The same left leg model with the muscles hidden to show the bones.'}" width="860" height="1000" ${mode === 'anatomy' ? 'fetchpriority="high"' : 'loading="lazy"'}/><img class="intro-model-dim" src="${import.meta.env.BASE_URL}introduction/leg-${mode}-dim.png" alt="${mode === 'anatomy' ? 'Fabrica model of the left upper and lower leg, showing muscles, tendons, and bones with structure labels.' : 'The same left leg model with the muscles hidden to show the bones.'}" width="860" height="1000" ${mode === 'skeleton' ? 'loading="lazy"' : ''}/></div>`).join('')}</div>
    <figcaption><span>Left upper &amp; lower leg</span><span>Still views from Fabrica</span></figcaption>
  </figure>`;
}

export function introductionPage(guide = false) {
  return `<div class="intro-page">${header(guide)}${guide ? `
    <main id="intro-main" class="intro-main intro-guide">
      <a class="intro-back" href="#/">← Back to Home</a>
      <div class="intro-guide-heading"><p class="intro-eyebrow">A quick guide</p><h1>How it works</h1><p>Choose a region, open the model, and explore it at your own pace.</p><a class="intro-button intro-button-primary" href="#/browser">Start exploring ${arrow}</a></div>
      <ol class="intro-steps">${features.map((feature, index) => `<li id="${feature.id}"><div class="intro-step-number">0${index + 1}</div><div><h2>${feature.title}</h2><p>${feature.instruction}</p></div><div class="intro-step-icon">${featureIcon(feature.id)}</div></li>`).join('')}</ol>
      <section class="intro-controls" aria-labelledby="intro-controls-heading"><div><p class="intro-eyebrow">Move around the model</p><h2 id="intro-controls-heading">A different angle helps.</h2><p>Drag to rotate, scroll or pinch to zoom, and right-drag or Shift-drag to pan. The view buttons give you fixed anatomical angles. The camera Home button restores the starting view. Reset (R) also clears selection, search and filters, restores layers and opacity, and returns labels to your default setting.</p></div><dl><div><dt>Focus selection</dt><dd><kbd>F</kbd></dd></div><div><dt>Toggle labels</dt><dd><kbd>L</kbd></dd></div><div><dt>Reset model</dt><dd><kbd>R</kbd></dd></div></dl></section>
      <p class="intro-scope">Fabrica uses static, simplified study models. Available facts and attachments vary by structure; attachment footprints are illustrative. The <a href="#/credits">sources and credits</a> explain the model origins and adaptations.</p>
    </main>` : `
    <main id="intro-main" class="intro-main">
      <section class="intro-hero" aria-labelledby="intro-headline"><div class="intro-hero-copy"><p class="intro-eyebrow"><span aria-hidden="true"></span> An interactive anatomy browser</p><h1 id="intro-headline">Anatomy you can<br/>take apart.</h1><p class="intro-lead">Explore structures in 3D, layer by layer. A place to study anatomy, or show a patient how things fit together.</p><div class="intro-cta"><a class="intro-button intro-button-primary" href="#/browser">Start exploring ${arrow}</a><a class="intro-button intro-button-secondary" href="#/how-it-works">How it works</a></div><p class="intro-availability">Available now: upper leg, lower leg, foot &amp; ankle.</p></div>${modelPreview()}</section>
      <section class="intro-features" aria-labelledby="intro-features-heading"><div class="intro-section-heading"><p class="intro-eyebrow">What you can do</p><h2 id="intro-features-heading">Explore layer by layer.</h2></div><div class="intro-feature-grid">${features.map(feature => `<article><div class="intro-feature-icon">${featureIcon(feature.id)}</div><h3>${feature.title}</h3><p>${feature.summary}</p></article>`).join('')}</div><a class="intro-text-link" href="#/how-it-works">See how it works ${arrow}</a></section>
    </main>`}${footer()}</div>`;
}

export function bindIntroductionPreview(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button => {
    button.onclick = () => {
      container.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
      container.querySelectorAll<HTMLElement>('[data-preview-view]').forEach(view => { view.hidden = view.dataset.previewView !== button.dataset.preview; });
    };
  });
}

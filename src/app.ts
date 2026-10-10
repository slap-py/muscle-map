import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource-variable/manrope";
import "./style.css";
import "./introduction.css";
import { introductionPage, bindIntroductionPreview } from "./introduction";
import { regionCatalog } from "./regions/catalog";
import { validateRegionPack } from "./regions";
import { parseRoute, LAST_REGION_KEY } from "./router";
import { readThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import "./viewerDiagnostics";
import { loadingScreen } from "./loading";
import { combinedTitleForIds } from "./regions/combinedTitle";
import { renderBodyMap, bindBodyMap } from "./bodyMap";
import { mainNavigation, siteFooter } from "./siteChrome";
import { brandLockup } from "./branding";
import { phoneScreenNotice, phoneScreenQuery } from "./phoneScreen";

const app = document.querySelector<HTMLElement>("#app")!;
const regionIds = regionCatalog.map(region => region.id);
const phoneScreen = matchMedia(phoneScreenQuery);
let routeRevision = 0;
let previousPage = "#/";
let currentPage = location.hash || "#/";
let mounted: ReturnType<typeof import("./main").mountViewer> | undefined;
let mountedRegion: string | undefined;

function renderHub(error?: string) {
  document.title = "Browser · Fabrica";
  document.body.dataset.page = "hub";
  app.innerHTML = `<div id="hub">
    <header class="hub-header"><a class="hub-brand" href="#/" aria-label="Fabrica home">${brandLockup}</a>${mainNavigation(location.hash)}
      <div class="segmented theme-control" aria-label="Color theme">${(["system","light","dark"] as const).map(choice => `<button data-theme-choice="${choice}" aria-pressed="${readThemeChoice() === choice}" class="${readThemeChoice() === choice ? "active" : ""}">${choice === "system" ? "System" : choice === "light" ? "Light" : "Dim"}</button>`).join("")}</div>
    </header>
    <main class="hub-main hub-body-main"><div class="hub-intro"><h1>Explore by region</h1><p>Click a region of the body to select it, add touching sections on the same side, then press Go to explore them together in 3D.</p></div>
    ${error ? '<p class="hub-error" role="alert">The viewer could not start. Please try opening the region again.</p>' : ""}
    ${renderBodyMap()}
    </main>
    ${siteFooter}
  </div>`;
  bindThemeControl();
  bindBodyMap(app.querySelector<HTMLElement>(".body-map")!);
}

function bindThemeControl() {
  app.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach(button => {
    button.onclick = () => {
      const choice = button.dataset.themeChoice as ThemeChoice;
      setThemeChoice(choice);
      app.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach(item => {
        const active = item.dataset.themeChoice === choice;
        item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active));
      });
    };
  });
}

function creditsSections() {
  const entries = [regionCatalog.find(r => r.id === 'left-upper-leg')!, regionCatalog.find(r => r.id === 'left-lower-leg')!, regionCatalog.find(r => r.id === 'lower-leg')!];
  const shared = entries[0].credits.sourcesHtml.match(/<ul class="link-list">.*?<\/ul>/)?.[0] ?? '';
  const attribution = 'Z-Anatomy — The libre 3D atlas of anatomy, Gauthier Kervyn, CC BY-SA 4.0. BodyParts3D — The Database Center for Life Science, original model Kousaku Okubo, CC BY-SA 2.1 Japan.';
  return `<section class="region-credits"><h2>Model sources</h2><p>${attribution}</p>${shared}<p><a href="${import.meta.env.BASE_URL}models/CREDITS.md">Model credits and adaptations</a></p></section>` + entries.map(region => {
    const upper = region.id === 'left-upper-leg';
    const manifests = upper ? ['left-upper-leg/manifest.json', 'right-upper-leg/manifest.json'] : region.id === 'left-lower-leg' ? ['left-lower-leg/manifest.json'] : ['bones.manifest.json', 'muscles.manifest.json', 'neurovascular.manifest.json', 'exterior.manifest.json'];
    const details = region.credits.sourcesHtml.replace(attribution, '').replace(/<h3>(Credits|Models)<\/h3>/, '<h3>Adaptations</h3>').replace(/<p>\s*<\/p>/, '').replace(/<ul class="link-list">.*?<\/ul>/, '');
    return `<section class="region-credits"><h2>${upper ? 'Left &amp; Right Hip &amp; Upper Leg' : region.title}</h2>${details}<h3>Model records</h3><ul class="link-list">${manifests.map(file => `<li><a href="${import.meta.env.BASE_URL}models/${file}">${file.includes('upper-leg') ? (file.startsWith('left') ? 'Left' : 'Right') + ' model manifest' : file}</a></li>`).join('')}</ul></section>`;
  }).join('') + `<p class="about-footer">${entries[0].credits.footer}</p>`;
}

function renderCredits() {
  document.title = "Sources & credits · Fabrica";
  document.body.dataset.page = "hub";
  app.innerHTML = `<div id="hub">
    <header class="hub-header"><a class="hub-brand" href="#/" aria-label="Fabrica home">${brandLockup}</a>${mainNavigation(location.hash)}
      <div class="segmented theme-control" aria-label="Color theme">${(["system", "light", "dark"] as const).map(choice => `<button data-theme-choice="${choice}" aria-pressed="${readThemeChoice() === choice}" class="${readThemeChoice() === choice ? "active" : ""}">${choice === "system" ? "System" : choice === "light" ? "Light" : "Dim"}</button>`).join("")}</div>
    </header>
    <main class="hub-main credits-main"><a class="credits-back" href="${previousPage}">← Back to ${parseRoute(previousPage, regionIds).kind === "landing" ? "Home" : parseRoute(previousPage, regionIds).kind === "how-it-works" ? "How it works" : parseRoute(previousPage, regionIds).kind === "hub" ? "Browser" : "Viewer"}</a><h1>Sources &amp; credits</h1>
      ${creditsSections()}
    </main>${siteFooter}
  </div>`;
  bindThemeControl();
}

async function route() {
  const revision = ++routeRevision;
  const next = parseRoute(location.hash, regionIds);
  if (location.hash !== currentPage) {
    if (next.kind === "credits") previousPage = currentPage;
    currentPage = location.hash;
  }
  // Gate tool routes before importing region packs or creating a viewer.
  if (phoneScreen.matches && (next.kind === "hub" || next.kind === "region" || next.kind === "regions")) {
    mounted?.dispose(); mounted = undefined; mountedRegion = undefined;
    document.title = "Larger screen needed · Fabrica";
    document.body.dataset.page = "phone-screen";
    app.innerHTML = phoneScreenNotice();
    window.scrollTo(0, 0);
    return;
  }
  const selectedRegionIds = next.kind === 'region' ? [next.regionId] : next.kind === 'regions' ? next.regionIds : [];
  const regionKey = selectedRegionIds.join('+');
  if ((next.kind === "region" || next.kind === "regions") && mounted && mountedRegion === regionKey) {
    mounted.select(next.select);
    return;
  }
  const session = selectedRegionIds.length ? mounted?.captureSession() : undefined;
  mounted?.dispose(); mounted = undefined; mountedRegion = undefined;
  if (next.kind === "landing" || next.kind === "how-it-works") {
    document.title = next.kind === "landing" ? "Home · Fabrica" : "How it works · Fabrica";
    document.body.dataset.page = "introduction";
    app.innerHTML = introductionPage(next.kind === "how-it-works");
    bindThemeControl(); bindIntroductionPreview(app);
    window.scrollTo(0, 0);
    return;
  }
  if (next.kind === "hub") { renderHub(); window.scrollTo(0, 0); return; }
  if (next.kind === "credits") { renderCredits(); window.scrollTo(0, 0); return; }
  const entries = selectedRegionIds.map(id => regionCatalog.find(region => region.id === id)!);
  const title = entries.length > 1 ? combinedTitleForIds(selectedRegionIds) : entries[0].title;
  document.title = `${title} · Fabrica`;
  document.body.dataset.page = "viewer";
  app.innerHTML = loadingScreen(title);
  try {
    const [packs, viewer, combine] = await Promise.all([
      Promise.all(entries.map(entry => entry.load())), import("./main"),
      entries.length > 1 ? import("./regions/combine") : Promise.resolve(null),
    ]);
    const pack = combine ? combine.combineRegionPacks(packs) : packs[0];
    if (revision !== routeRevision) return;
    validateRegionPack(pack);
    document.title = `${pack.title} · Fabrica`;
    mounted = viewer.mountViewer(pack, app, next.select, session);
    mountedRegion = regionKey;
    try { localStorage.setItem(LAST_REGION_KEY, selectedRegionIds.length === 1 ? selectedRegionIds[0] : JSON.stringify(selectedRegionIds)); } catch {}
  } catch (error) {
    if (revision !== routeRevision) return;
    console.error(error);
    renderHub(String(error));
  }
}

app.addEventListener("click", event => { if ((event.target as Element).closest("[data-home]")) location.hash = "#/browser"; });
// The viewer is a tool surface: suppress the browser menu everywhere on it (text fields keep theirs).
document.addEventListener("contextmenu", event => {
  if (document.body.dataset.page === "viewer" && !(event.target as Element).closest("input, textarea")) event.preventDefault();
});
window.addEventListener("hashchange", () => { void route(); });
phoneScreen.addEventListener("change", () => { void route(); });
if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/`);
void route();

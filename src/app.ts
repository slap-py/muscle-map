import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./style.css";
import { regionCatalog } from "./regions/catalog";
import { validateRegionPack } from "./regions";
import { parseRoute, LAST_REGION_KEY } from "./router";
import { readThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import "./viewerDiagnostics";
import { loadingScreen } from "./loading";
import { combinedTitleForIds } from "./regions/combinedTitle";
import { renderBodyMap, bindBodyMap } from "./bodyMap";

const app = document.querySelector<HTMLElement>("#app")!;
const regionIds = regionCatalog.map(region => region.id);
let routeRevision = 0;
let mounted: ReturnType<typeof import("./main").mountViewer> | undefined;
let mountedRegion: string | undefined;

function renderHub(error?: string) {
  document.title = "Muscle Map";
  document.body.dataset.page = "hub";
  app.innerHTML = `<div id="hub">
    <header class="hub-header"><a class="hub-brand" href="#/" aria-label="Muscle Map home">Muscle Map</a>
      <div class="segmented theme-control" aria-label="Color theme">${(["system","light","dark"] as const).map(choice => `<button data-theme-choice="${choice}" aria-pressed="${readThemeChoice() === choice}" class="${readThemeChoice() === choice ? "active" : ""}">${choice === "system" ? "System" : choice === "light" ? "Light" : "Dim"}</button>`).join("")}</div>
    </header>
    <main class="hub-main hub-body-main"><div class="hub-intro"><p class="hub-eyebrow">Interactive anatomy</p><h1>Explore by region</h1><p>Click a region of the body to select it, add touching sections on the same side, then press Go to explore them together in 3D.</p></div>
    ${error ? '<p class="hub-error" role="alert">The viewer could not start. Please try opening the region again.</p>' : ""}
    ${renderBodyMap()}
    </main>
    <footer class="hub-footer"><p>Study models from Z-Anatomy and BodyParts3D.</p><p><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Adapted assets · CC BY-SA 4.0</a> · <a href="#/credits">Sources &amp; credits</a></p></footer>
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

function renderCredits() {
  document.title = "Sources & credits · Muscle Map";
  document.body.dataset.page = "hub";
  app.innerHTML = `<div id="hub">
    <header class="hub-header"><a class="hub-brand" href="#/" aria-label="Muscle Map home">Muscle Map</a>
      <div class="segmented theme-control" aria-label="Color theme">${(["system", "light", "dark"] as const).map(choice => `<button data-theme-choice="${choice}" aria-pressed="${readThemeChoice() === choice}" class="${readThemeChoice() === choice ? "active" : ""}">${choice === "system" ? "System" : choice === "light" ? "Light" : "Dim"}</button>`).join("")}</div>
    </header>
    <main class="hub-main credits-main"><a class="credits-back" href="#/">← Back to home</a><h1>Sources &amp; credits</h1>
      ${regionCatalog.map(region => `<section class="region-credits"><h2>${region.title}</h2>${region.credits.sourcesHtml}<footer class="about-footer">${region.credits.footer}</footer></section>`).join("")}
    </main>
  </div>`;
  bindThemeControl();
}

async function route() {
  const revision = ++routeRevision;
  const next = parseRoute(location.hash, regionIds);
  const selectedRegionIds = next.kind === 'region' ? [next.regionId] : next.kind === 'regions' ? next.regionIds : [];
  const regionKey = selectedRegionIds.join('+');
  if ((next.kind === "region" || next.kind === "regions") && mounted && mountedRegion === regionKey) {
    mounted.select(next.select);
    return;
  }
  const session = selectedRegionIds.length ? mounted?.captureSession() : undefined;
  mounted?.dispose(); mounted = undefined; mountedRegion = undefined;
  if (next.kind === "hub") { renderHub(); return; }
  if (next.kind === "credits") { renderCredits(); return; }
  const entries = selectedRegionIds.map(id => regionCatalog.find(region => region.id === id)!);
  const title = entries.length > 1 ? combinedTitleForIds(selectedRegionIds) : entries[0].title;
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
    document.title = pack.title;
    mounted = viewer.mountViewer(pack, app, next.select, session);
    mountedRegion = regionKey;
    try { localStorage.setItem(LAST_REGION_KEY, selectedRegionIds.length === 1 ? selectedRegionIds[0] : JSON.stringify(selectedRegionIds)); } catch {}
  } catch (error) {
    if (revision !== routeRevision) return;
    console.error(error);
    renderHub(String(error));
  }
}

window.addEventListener("hashchange", () => { void route(); });
if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/`);
void route();

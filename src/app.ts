import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./style.css";
import { regionCatalog } from "./regions/catalog";
import { validateRegionPack } from "./regions";
import { parseRoute, regionHref, LAST_REGION_KEY } from "./router";
import { readThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import "./viewerDiagnostics";
import { loadingScreen } from "./loading";

const app = document.querySelector<HTMLElement>("#app")!;
const regionIds = regionCatalog.map(region => region.id);
let routeRevision = 0;
let mounted: ReturnType<typeof import("./main").mountViewer> | undefined;
let mountedRegion: string | undefined;

function renderHub(error?: string) {
  document.title = "Muscle Map";
  document.body.dataset.page = "hub";
  let lastRegion: string | null = null;
  try { lastRegion = localStorage.getItem(LAST_REGION_KEY); } catch {}
  const tissueLabels: Record<string, string> = {
    skin: "Skin", bone: "Bones", muscle: "Muscles", tendon: "Tendons",
    ligament: "Ligaments", fascia: "Fascia", cartilage: "Cartilage",
    artery: "Arteries", vein: "Veins", nerve: "Nerves",
  };
  app.innerHTML = `<div id="hub">
    <header class="hub-header"><a class="hub-brand" href="#/" aria-label="Muscle Map home">Muscle Map</a>
      <div class="segmented theme-control" aria-label="Color theme">${(["system","light","dark"] as const).map(choice => `<button data-theme-choice="${choice}" aria-pressed="${readThemeChoice() === choice}" class="${readThemeChoice() === choice ? "active" : ""}">${choice === "system" ? "System" : choice === "light" ? "Light" : "Dim"}</button>`).join("")}</div>
    </header>
    <main class="hub-main"><div class="hub-intro"><p class="hub-eyebrow">Interactive anatomy</p><h1>Explore by region</h1><p>Choose a region to explore its structures, layers and connections in 3D.</p></div>
    ${error ? '<p class="hub-error" role="alert">The viewer could not start. Please try opening the region again.</p>' : ""}
    <div class="region-grid">${regionCatalog.map(region => `<article class="region-card" data-region-id="${region.id}">
      <a class="region-thumbnail" href="${regionHref(region.id)}" tabindex="-1" aria-hidden="true"><img class="thumbnail-light" src="${region.thumbnail}" alt="" width="720" height="560"/><img class="thumbnail-dim" src="${region.dimThumbnail}" alt="" width="720" height="560"/></a>
      <div class="region-card-content"><div class="region-card-heading"><h2>${region.title}</h2>${lastRegion === region.id ? '<span class="last-region">Last opened</span>' : ""}</div>
      <p class="region-description">${region.description}</p>
      <details class="region-counts"><summary><strong>${region.structureCounts.total}</strong> structures <span>Breakdown</span></summary><dl>${Object.entries(region.structureCounts.byTissue).filter(([tissue]) => tissue !== "skin").map(([tissue,count]) => `<div><dt>${tissueLabels[tissue] ?? tissue}</dt><dd>${count}</dd></div>`).join("")}</dl></details>
      <a class="button primary open-region" href="${regionHref(region.id)}">Open <span aria-hidden="true">→</span></a>
      </div></article>`).join("")}</div>
    </main>
    <footer class="hub-footer"><p>Study models from Z-Anatomy and BodyParts3D.</p><p><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Adapted assets · CC BY-SA 4.0</a> · <a href="#/credits">Sources &amp; credits</a></p></footer>
  </div>`;
  bindThemeControl();
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
  if (next.kind === "region" && mounted && mountedRegion === next.regionId) {
    mounted.select(next.select);
    return;
  }
  mounted?.dispose(); mounted = undefined; mountedRegion = undefined;
  if (next.kind === "hub") { renderHub(); return; }
  if (next.kind === "credits") { renderCredits(); return; }
  const entry = regionCatalog.find(region => region.id === next.regionId)!;
  document.body.dataset.page = "viewer";
  app.innerHTML = loadingScreen(entry.title);
  try {
    const [pack, viewer] = await Promise.all([entry.load(), import("./main")]);
    if (revision !== routeRevision) return;
    validateRegionPack(pack);
    document.title = pack.title;
    mounted = viewer.mountViewer(pack, app, next.select);
    mountedRegion = next.regionId;
    try { localStorage.setItem(LAST_REGION_KEY, next.regionId); } catch {}
  } catch (error) {
    if (revision !== routeRevision) return;
    console.error(error);
    renderHub(String(error));
  }
}

window.addEventListener("hashchange", () => { void route(); });
if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/`);
void route();

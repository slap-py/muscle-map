import { loadingScreen } from "./loading";
import { brandLockup } from "./branding";
import type { RegionPack } from "./regions";
import type { Tissue } from "./data";
import type { Connection } from "./connections";
import type { AssetReport } from "./assets";
import { createViewerScope, disposeObject, viewerDiagnostics } from "./viewerResources";
import { resolveStructureId, restoreViewerSession, selectionAliases, type ViewerSession } from "./viewerSession";
import { createPickingWorker, intersectThinStructures } from "./picking";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { TAARenderPass } from "three/addons/postprocessing/TAARenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { applyCoverage } from "./appearance";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./style.css";
import * as THREE from "three";
import {
  CameraControls,
  createCameraControls,
  lookAtNearest,
  zoomBy,
  updateCamera,
  setInspectorInset,
} from "./camera";
import { createSlowFrameMonitor, graphicsSettings, readAutoOverride, readGraphicsChoice, resolveTier, saveAutoOverride, saveGraphicsChoice, weakDeviceReason, type AutoOverride, type GraphicsChoice, type GraphicsSettings, type GraphicsTier } from "./graphics";

import { applySceneTheme, effectiveTheme, listenForThemeChanges, readThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import { MAX_LABELS, MIN_LABELS, passiveLabelCap, readSettings, saveSettings } from "./settings";

/** The skin exterior is not functional yet. Its loaders, materials and data stay; only its controls are hidden. */
const SKIN_UI_ENABLED = false;

const icon = {
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
  pan: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13M6 3.5l2-2 2 2M6 12.5l2 2 2-2M3.5 6l-2 2 2 2M12.5 6l2 2-2 2"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
  minus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
  home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h8V6.5"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
};
/** One mounted viewer owns all DOM, listeners, rendering and loading work. */
export function mountViewer(pack: RegionPack, app: HTMLElement, initialSelection: string | null = null, session?: ViewerSession) {
const restored = restoreViewerSession(pack, session);
const scope = createViewerScope();
const listen = scope.listen;
let disposed = false;
let frameRequest = 0;
const worker = createPickingWorker(delta => { viewerDiagnostics.activeWorkers += delta; });
const { structures, byId, tissueNames, colors, atlasIds, labelTier, tierForZoom,
  createAnkle, rebuildSoftTissues, cameraPreset, createCompass, attachmentSources,
  connectionsFor, directlyAttachedIds, connectionHighlightIds, footprintDecal,
  connectionCameraPose, connectionOccluders, connectionClinicalPoints,
  relatedIds, neurovascularTissues, isNeurovascular } = pack;
const { loadBoneAssets, loadMuscleAssets, loadExteriorAssets, loadNeurovascularAssets, createAssetSceneLoader } = pack.loaders;
const areaOptions = pack.atlasAreas.filter(area => !area.group).map(area => `<option value="${area.id}">${area.label}</option>`).join('') +
  [...new Set(pack.atlasAreas.map(area => area.group).filter(Boolean))].map(group => `<optgroup label="${group}">${pack.atlasAreas.filter(area => area.group === group).map(area => `<option value="${area.id}">${area.label}</option>`).join('')}</optgroup>`).join('');

const viewerSettings = readSettings();
const presets = pack.presets.filter(preset => SKIN_UI_ENABLED || !preset.tissues.includes("skin"));
const openingLoader = app.querySelector("#loading");
app.innerHTML = `
<header class="topbar">
  <div class="brand"><a class="viewer-home" href="#/" aria-label="Back to home" title="Back to home">${brandLockup}</a><span class="title">${pack.title}</span><span class="brand-subtitle">Interactive anatomy</span></div>
  <div class="segmented modes" aria-label="Tissue presets">${presets.map(preset => `<button data-mode="${preset.id}" class="${preset.id === pack.defaultMode ? 'active' : ''}">${preset.icon ?? ''}${preset.label}</button>`).join('')}</div>
  <nav class="topbar-actions" aria-label="Explorer actions"><details class="actions-menu" open><summary aria-label="More actions" title="More actions">⋯</summary><div class="action-items"><button id="labels" class="tool-button" aria-pressed="true" title="Toggle labels (L)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h9l3 5-3 5H2Z"/><circle cx="10" cy="8" r="1"/></svg>Labels</button><button id="reset" class="tool-button" title="Reset (R)" aria-label="Reset"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6a5 5 0 1 1 0 5M3 2v4h4"/></svg></button><button id="about" class="tool-button" title="About ${pack.title}" aria-label="About"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.2"/></svg></button></div></details></nav>
</header>
<main>
<aside class="panel atlas" aria-label="Structures">
  <div class="atlas-head">
    <label class="search">${icon.search}<input id="search" placeholder="Search ${structures.length} structures" aria-label="Find a structure" type="search"/></label>
    <div id="type-filters" class="type-filters" aria-label="Structure types"></div>
    <label class="area-filter" for="atlas-area">Area<select id="atlas-area">${areaOptions}</select></label>
    <label class="visible-filter"><input id="only-visible" type="checkbox"/>Only visible layers</label>
    <div class="filter-status"><span id="list-count"></span><button id="clear-filters" class="link-button" hidden>Clear filters</button></div>
  </div>
  <div id="structure-list" class="atlas-scroll" aria-label="Structure list"></div>
</aside>
<section id="viewport" aria-label="Interactive 3D anatomy model">
  <div id="label-layer"><svg class="label-leaders" aria-hidden="true"></svg></div>
  <div class="compass-wrap"><div id="compass" role="group" aria-label="Anatomical view compass"></div><span id="view-name">ANTERIOR VIEW</span></div>
  <div class="view-controls segmented" aria-label="Camera views">${pack.viewPresets.map(view => `<button data-view="${view.id}" class="${view.id === pack.defaultView ? 'active' : ''}">${view.label}</button>`).join('')}</div>
  <div class="canvas-tools"><button id="pan" aria-pressed="false" aria-label="Pan mode" title="Pan mode (P). Right-drag or Shift-drag also pans.">${icon.pan}</button><button id="zoom-in" aria-label="Zoom in" title="Zoom in">${icon.plus}</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">${icon.minus}</button><button id="home" aria-label="Reset camera" title="Reset camera">${icon.home}</button></div>
  <div id="fps-meter" class="fps-meter" role="status" aria-label="Frames per second" hidden>-- FPS</div>
  <div id="render-error" hidden></div>
  <div id="graphics-prompt" class="graphics-prompt" role="status" hidden><p>The 3D view is running slowly on this device.</p><button data-graphics-prompt="low" class="tool-button active">Use Low graphics</button><button data-graphics-prompt="keep" class="tool-button">Keep High</button></div>
</section>
<aside class="panel inspector" aria-label="Details and layers">
  <div class="inspector-resize" role="separator" aria-orientation="vertical" aria-label="Resize details panel" tabindex="0" aria-valuemin="280" aria-valuemax="680"></div>
  <button id="expand-inspector" class="icon-button" aria-pressed="false" title="Expand details panel" aria-label="Expand details panel">↔</button>
  <button id="clear" class="icon-button" aria-label="Clear selection" title="Clear selection">${icon.close}</button>
  <div id="details" class="details" aria-live="polite"></div>
  <section class="layer-section">
    <div class="section-heading"><h2>Layers</h2><button id="all-layers" class="link-button">Show all</button></div>
    <div id="layers"></div>
    <button id="highlight-connections" class="toggle-row" aria-pressed="false" aria-describedby="highlight-connections-hint"><span>Highlight connections</span><span class="switch" aria-hidden="true"></span></button>
    <p id="highlight-connections-hint" class="sr-only">Highlight attached tendons and bones with your selection. Hidden connections appear temporarily.</p>
    <div class="slider-row"><label for="opacity">Muscle</label><input id="opacity" type="range" min="10" max="100" value="100"/><output id="opacity-value">100%</output></div>
    <div class="slider-row" ${SKIN_UI_ENABLED ? '' : 'hidden'}><label for="skin-opacity">Skin</label><input id="skin-opacity" type="range" min="0" max="100" value="100"/><output id="skin-opacity-value">100%</output></div>
    <div id="neurovascular-opacity-controls" hidden><div class="slider-row"><label for="neurovascular-opacity">Vessels &amp; nerves</label><input id="neurovascular-opacity" type="range" min="10" max="100" value="100"/><output id="neurovascular-opacity-value">100%</output></div></div>
    <p id="neurovascular-status" role="status" hidden></p>
    <p id="layer-hint" class="layer-hint"></p>
  </section>
</aside>
</main>
<dialog id="about-dialog" aria-labelledby="about-title"><button class="dialog-close icon-button" aria-label="Close model information">${icon.close}</button><h2 id="about-title">${pack.about.title}</h2>
<div class="about-tabs" role="tablist" aria-label="About sections">${[['overview','Overview'],['controls','Controls'],['settings','Settings']].map(([id,name])=>`<button id="about-tab-${id}" role="tab" data-about-tab="${id}" aria-controls="about-panel-${id}" aria-selected="${id==='overview'}" tabindex="${id==='overview'?0:-1}">${name}</button>`).join('')}</div>
<section id="about-panel-overview" role="tabpanel" data-about-panel="overview" aria-labelledby="about-tab-overview">${pack.about.overviewHtml}</section>
<section id="about-panel-controls" role="tabpanel" data-about-panel="controls" aria-labelledby="about-tab-controls" hidden>${pack.about.controlsHtml}</section>
<section id="about-panel-settings" class="settings-panel" role="tabpanel" data-about-panel="settings" aria-labelledby="about-tab-settings" hidden>
  <div class="setting-block"><p class="setting-title" id="graphics-heading">Graphics quality</p><div class="segmented graphics-control" role="group" aria-labelledby="graphics-heading"><button data-graphics-choice="auto">Auto</button><button data-graphics-choice="high">High</button><button data-graphics-choice="low">Low</button></div><p id="graphics-status" class="setting-note" aria-live="polite"></p></div>
  <div class="setting-block"><p class="setting-title" id="theme-heading">Theme</p><div class="segmented theme-control" role="group" aria-labelledby="theme-heading"><button data-theme-choice="system">System</button><button data-theme-choice="light">Light</button><button data-theme-choice="dark">Dim</button></div></div>
  <div class="setting-block"><button id="setting-labels-default" class="toggle-row" aria-pressed="false"><span>Labels on by default</span><span class="switch" aria-hidden="true"></span></button><p class="setting-note">Applies when a region opens or is reset. The Labels button still toggles them while you explore.</p></div>
  <div class="setting-block"><div class="slider-row"><label for="setting-max-labels">Max labels</label><input id="setting-max-labels" type="range" min="${MIN_LABELS}" max="${MAX_LABELS}" step="1"/><output id="setting-max-labels-value"></output></div><p class="setting-note">Most passive labels shown at once when zoomed in. Fewer appear when zoomed out. Selected and hovered structures are always labeled.</p></div>
  <div class="setting-block"><button id="setting-fps" class="toggle-row" aria-pressed="false"><span>Show FPS meter</span><span class="switch" aria-hidden="true"></span></button><p class="setting-version">v1.0</p></div>
</section>
</dialog>${loadingScreen(pack.title)}`;
// Keep the same loading element (and bar animation) through the lazy import.
if (openingLoader) app.querySelector("#loading")!.replaceWith(openingLoader);
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  app.querySelector<T>(s)!;
const compactActions=matchMedia('(max-width:699px)');
function syncActionsMenu(){app.querySelector<HTMLDetailsElement>('.actions-menu')!.open=!compactActions.matches;}
listen(compactActions, 'change',syncActionsMenu);syncActionsMenu();
const tissueKeys: Tissue[] = pack.tissueKeys.filter(tissue => SKIN_UI_ENABLED || tissue !== "skin");
let graphicsTier: GraphicsTier = "high";
let graphics: GraphicsSettings = graphicsSettings.high;
// Model loading state; updateAppearance consults it from the first render onward.
let initialLoad: Promise<unknown> | undefined;
let muscleRequest: Promise<AssetReport> | undefined;
let exteriorRequest: Promise<AssetReport> | undefined;
let muscleReport: AssetReport | undefined;
let exteriorReport: AssetReport | undefined;
const state = {
  selected: null as string | null,
  hovered: null as string | null,
  layers: new Set<Tissue>(pack.presets.find(preset => preset.id === pack.defaultMode)!.tissues),
  atlasRegion: "all",
  atlasTypes: new Set<Tissue>(tissueKeys.filter(t => t !== "cartilage")),
  onlyVisible: false,
  neurovascularOpacity: 1,
  skinOpacity: 1,
  opacity: 1,
  labels: viewerSettings.labelsDefault,
  isolated: false,
  connections: false,
  highlightConnections: false,
  attachmentFade: false,
  focusedConnection: null as string | null,
  pan: false,

  mode: pack.defaultMode,
  view: pack.defaultView,
};

if (restored) {
  state.layers = new Set(restored.layers.filter(tissue => SKIN_UI_ENABLED || tissue !== "skin"));
  state.atlasTypes = new Set(restored.atlasTypes.filter(tissue => SKIN_UI_ENABLED || tissue !== "skin"));
  state.atlasRegion = restored.atlasRegion;
  state.onlyVisible = restored.onlyVisible;
  state.opacity = restored.opacity;
  state.skinOpacity = restored.skinOpacity;
  state.neurovascularOpacity = restored.neurovascularOpacity;
  state.labels = restored.labels;
  state.highlightConnections = restored.highlightConnections;
  state.view = restored.view;
  $<HTMLInputElement>('#search').value = restored.search;
  for (const [id, value] of [['opacity', state.opacity], ['skin-opacity', state.skinOpacity], ['neurovascular-opacity', state.neurovascularOpacity]] as const) {
    $<HTMLInputElement>('#' + id).value = String(Math.round(value * 100));
    $('#' + id + '-value').textContent = Math.round(value * 100) + '%';
  }
}
const atlasOrder: Tissue[] = pack.atlasOrder.filter(tissue => SKIN_UI_ENABLED || tissue !== "skin");
const atlasNames = pack.atlasNames;
const collapsedTissues = new Set<string>();
try { for (const value of JSON.parse(localStorage.getItem('atlas-collapsed') || '[]')) if (atlasOrder.includes(value)) collapsedTissues.add(value); } catch {}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
function marked(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  let start = 0, result = '', index = text.toLowerCase().indexOf(query);
  while (index >= 0) { result += escapeHtml(text.slice(start,index)) + '<mark>' + escapeHtml(text.slice(index,index+query.length)) + '</mark>'; start=index+query.length; index=text.toLowerCase().indexOf(query,start); }
  return result + escapeHtml(text.slice(start));
}
function renderList() {
  const focusedRow=(document.activeElement as HTMLElement)?.closest<HTMLButtonElement>('.structure-row')?.dataset.id;
  const q = $<HTMLInputElement>('#search').value.trim().toLowerCase();
  const ids = atlasIds(state.atlasRegion);
  const items = structures.filter(d => d.id === state.selected || (ids.has(d.id) && state.atlasTypes.has(d.tissue) && (!state.onlyVisible || state.layers.has(d.tissue)) && `${d.name} ${d.group} ${d.description}`.toLowerCase().includes(q)));
  $('#type-filters').innerHTML = atlasOrder.map(t => `<button data-atlas-type="${t}" aria-pressed="${state.atlasTypes.has(t)}"><i style="background:${colors[t]}"></i>${atlasNames[t]} <span>${structures.filter(d=>d.tissue===t).length}</span></button>`).join('');
  app.querySelectorAll<HTMLButtonElement>('[data-atlas-type]').forEach(b=>b.onclick=()=>{const t=b.dataset.atlasType as Tissue;state.atlasTypes.has(t)?state.atlasTypes.delete(t):state.atlasTypes.add(t);renderList();});
  $<HTMLSelectElement>('#atlas-area').value=state.atlasRegion;
  $<HTMLInputElement>('#only-visible').checked=state.onlyVisible;
  $('#list-count').textContent=`Showing ${items.length} of ${structures.length}`;
  $('#clear-filters').hidden=!q && state.atlasRegion==='all' && !state.onlyVisible && atlasOrder.every(t=>state.atlasTypes.has(t)===(t!=='cartilage'));
  const container=$('#structure-list');container.replaceChildren();
  for (const tissue of atlasOrder) {
    const members=items.filter(d=>d.tissue===tissue);if(!members.length)continue;
    const section=document.createElement('details');section.className='tissue-section';section.dataset.tissue=tissue;
    section.open=!!q || !collapsedTissues.has(tissue) || members.some(d=>d.id===state.selected);
    section.innerHTML=`<summary>${atlasNames[tissue]} <span>${members.length}</span></summary>`;
    section.ontoggle=()=>{if(q || disposed)return;section.open?collapsedTissues.delete(tissue):collapsedTissues.add(tissue);try{localStorage.setItem('atlas-collapsed',JSON.stringify([...collapsedTissues]));}catch{}};
    for(const group of [...new Set(members.map(d=>d.group))].sort()) {
      const grouped=members.filter(d=>d.group===group).sort((a,b)=>a.name.localeCompare(b.name));
      const heading=document.createElement('h3');heading.innerHTML=`${marked(group,q)} <span>${grouped.length}</span>`;section.append(heading);
      for(const d of grouped){const row=document.createElement('button');row.className='structure-row';row.dataset.id=d.id;row.innerHTML=`<i style="background:${colors[d.tissue]}"></i><span>${marked(d.name,q)}${q && !d.name.toLowerCase().includes(q) && d.description.toLowerCase().includes(q) ? `<small>${marked(d.description,q)}</small>` : ''}</span>`;row.onclick=()=>select(d.id);section.append(row);}
    }
    container.append(section);
  }
  if(!items.length)container.innerHTML='<p class="empty">No matches. Try “talus” or clear the filters.</p>';
  updateRows();
  if(focusedRow)app.querySelector<HTMLButtonElement>(`.structure-row[data-id="${focusedRow}"]`)?.focus({preventScroll:true});
}
let lastScrolledSelection: string | null = null;
function updateRows() {
  const highlighted=selectedConnectionHighlights();
  app.querySelectorAll<HTMLButtonElement>('.structure-row').forEach(b=>{
    const selected=b.dataset.id===state.selected;
    b.classList.toggle('selected',selected);b.classList.toggle('connected',!selected&&highlighted.has(b.dataset.id!));b.classList.toggle('hovered',b.dataset.id===state.hovered);b.setAttribute('aria-pressed',String(selected));
    if(selected && lastScrolledSelection!==state.selected){b.closest('details')!.open=true;b.scrollIntoView({block:'nearest'});}
  });
  lastScrolledSelection=state.selected;
}
function clearFilters(){state.atlasRegion='all';state.atlasTypes=new Set(tissueKeys.filter(t=>t!=='cartilage'));state.onlyVisible=false;$<HTMLInputElement>('#search').value='';renderList();}
$('#clear-filters').onclick=clearFilters;
$<HTMLSelectElement>('#atlas-area').onchange=e=>{state.atlasRegion=(e.target as HTMLSelectElement).value;renderList();};
$<HTMLInputElement>('#only-visible').onchange=e=>{state.onlyVisible=(e.target as HTMLInputElement).checked;renderList();};
$('#structure-list').onkeydown=e=>{
  if(!['ArrowUp','ArrowDown','Enter'].includes(e.key))return;
  const rows=[...app.querySelectorAll<HTMLButtonElement>('.tissue-section[open] .structure-row')];
  const current=rows.indexOf(document.activeElement as HTMLButtonElement);
  if(e.key==='Enter'){if(current>=0){e.preventDefault();rows[current].click();}return;}
  e.preventDefault();const next=current<0?0:Math.max(0,Math.min(rows.length-1,current+(e.key==='ArrowDown'?1:-1)));rows[next]?.focus();
};
function renderDetails() {
  const d = state.selected ? byId[state.selected] : null;
  $("#clear").style.visibility = d ? "visible" : "hidden";
  $(".inspector").classList.toggle("inspector--empty", !d);
  if (!d) {
    $("#details").innerHTML =
      `<p class="empty-inspector">Select a structure to see details.</p>`;
  } else {
    const coverage = pack.structureRegions?.[d.id];
    const spansRegions = coverage && coverage.length > 1 && isNeurovascular(d.tissue);
    const regionNote = spansRegions
      ? '<p class="structure-coverage">Spans ' + coverage.map(escapeHtml).join(' + ') + '</p>' : '';
    const articulations = d.tissue === 'bone' ? [...relatedIds(d.id)].filter(id=>byId[id].tissue==='bone').map(id=>byId[id].name) : d.articulations;
    const facts = [['Origin',d.origin],['Insertion',d.insertion],['Action',d.action],['Innervation',d.innervation],['Blood supply',d.bloodSupply],['Articulations',articulations?.join(', ')]];
    const quickFacts = facts.filter(([,value])=>value).map(([name,value])=>`<dt>${name}</dt><dd>${escapeHtml(value!)}</dd>`).join('');
    $("#details").innerHTML =
      `<div class="structure-tag"><i style="background:${colors[d.tissue]}"></i>${spansRegions ? 'Across regions' : d.region} · ${d.tissue}</div><h2>${d.name}</h2><p class="group-name">${d.group}</p>${regionNote}<div class="selection-tools"><button id="focus-selected" class="button" title="Frame this structure (F)">Focus</button><button id="isolate" class="button" aria-pressed="${state.isolated}" title="Show only this structure">Isolate</button><button id="show-connections" class="button" aria-pressed="${state.connections}" title="Show only adjacent and attached structures">Neighbors</button></div><div class="inspector-content">${quickFacts ? `<section class="quick-facts"><h3>Quick facts</h3><dl>${quickFacts}</dl></section>` : ''}<section class="structure-description"><h3>Description</h3><p>${escapeHtml(d.description)}</p></section></div>`;
    $("#isolate").onclick = () => {
      state.isolated = !state.isolated;
      state.connections = false;
      state.attachmentFade = false;
      clearConnectionFocus();
      renderDetails();
      updateAppearance();
    };
    $("#focus-selected").onclick = () => focusParts(state.highlightConnections && !state.isolated ? [...selectedConnectionHighlights()] : [d.id]);
    const connections = connectionsFor(leg.parts, d.id);
    if (connections.length) {
      const section = document.createElement('details');
      section.open = false;
      section.className = 'attachment-details';
      section.innerHTML = '<summary>Attachments</summary><p class="footprint-key">Select one to zoom in; select again to return.</p>';
      // Bone insertions first, then junctions and soft-to-soft attachments.
      const ordered = [...connections].sort((a,b) => Number(b.record[b.end].kind === 'surface') - Number(a.record[a.end].kind === 'surface'));
      for (const connection of ordered) {
        const {record, footprint, end} = connection;
        const card = document.createElement('div');
        card.className = 'connection-card';
        const button = document.createElement('button');
        button.className = 'connection-focus';
        button.dataset.connection = connection.key;
        button.setAttribute('aria-pressed', String(state.focusedConnection === connection.key));
        button.textContent = `${byId[record.structureId].name} → ${byId[footprint.structureId].name}`;
        button.onclick = () => toggleConnection(connection);
        card.append(button);
        const landmark = document.createElement('small');
        landmark.textContent = `${record.component.replaceAll('-', ' ')} · ${footprint.landmark} · ${record[end].kind === 'surface' ? 'Bone footprint' : record[end].kind === 'junction' ? 'Muscle–tendon junction' : 'Soft-tissue attachment'}`;
        card.append(landmark);
        const note = document.createElement('p');
        note.className = 'attachment-note';
        note.textContent = record.note;
        card.append(note);
        const sources = document.createElement('details');
        sources.innerHTML = '<summary>Sources</summary>';
        for (const key of record.sourceIds) {
          const source = attachmentSources[key as keyof typeof attachmentSources];
          const link = document.createElement('a');
          link.href = source.url; link.textContent = `${source.title} · ${source.section}`;
          link.target = '_blank'; link.rel = 'noreferrer'; sources.append(link);
        }
        card.append(sources);
        section.append(card);
      }
      $("#details").append(section);
      const active = connections.find(c => c.key === state.focusedConnection);
      const clinical = connectionClinicalPoints[active?.record.structureId ?? d.id];
      if (clinical) {
        const aside = document.createElement('aside'); aside.className = 'clinical-point';
        aside.innerHTML = '<h3>Clinical note</h3>';
        const note = document.createElement('p'); note.textContent = clinical.note; aside.append(note);
        const link = document.createElement('a'); link.href = clinical.url; link.textContent = clinical.title;
        link.target = '_blank'; link.rel = 'noreferrer'; aside.append(link); $('#details').append(aside);
      }
    }
    if(d.clinical){const clinical=document.createElement('section');clinical.innerHTML=`<h3>Clinical note</h3><p>${escapeHtml(d.clinical)}</p>`;$('#details').append(clinical);}
    const related = [...relatedIds(d.id)];
    $<HTMLButtonElement>("#show-connections").disabled = !related.length;
    $("#show-connections").onclick = () => {
      state.connections = !state.connections;
      state.isolated = false;
      state.attachmentFade = false;
      clearConnectionFocus();
      if (state.connections)
        for (const id of related) state.layers.add(byId[id].tissue);
      state.mode = "custom";
      renderDetails();
      updateAppearance();
    };
    if (related.length) {
      const links = document.createElement("details");
      links.open = true;
      links.className = "connection-links";
      links.innerHTML =
        "<summary>Related structures</summary>";
      for (const id of related) {
        const b = document.createElement("button");
        b.textContent = byId[id].name;
        b.onclick = () => {
          $<HTMLInputElement>("#search").value = "";
          if (byId[id].region !== "Foot")
            state.atlasRegion = "all";
          renderList();
          select(id);
        };
        links.append(b);
      }
      $("#details").append(links);
    }
    if(d.facts?.length){const section=document.createElement('section');section.className='neurovascular-facts';section.innerHTML='<h3>Key facts</h3>';for(const fact of d.facts){const p=document.createElement('p');p.textContent=fact.text;section.append(p);}$('#details').append(section);}
    if(d.references?.length){const sources=document.createElement('section');sources.className='structure-references';sources.innerHTML='<h3>References</h3>';for(const reference of d.references){const a=document.createElement('a');a.href=reference.url;a.textContent=reference.title;a.target='_blank';a.rel='noreferrer';sources.append(a);}$('#details').append(sources);}
  }
}
for (const tissue of tissueKeys) {
  const label = document.createElement("label");
  label.className = "layer-row";
  label.innerHTML = `<i style="background:${colors[tissue]}"></i><span>${tissueNames[tissue]}</span><input type="checkbox" data-layer="${tissue}" checked/><span class="switch" aria-hidden="true"></span>`;
  label.querySelector("input")!.onchange = (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.attachmentFade = false;
    clearConnectionFocus();
    checked ? state.layers.add(tissue) : state.layers.delete(tissue);
    if (!checked && state.selected && byId[state.selected].tissue === tissue) {
      select(null);
      renderDetails();
      updateRows();
    }
    state.mode = "custom";
    renderDetails();
    updateAppearance();
  };
  $("#layers").append(label);
}
const viewport = $("#viewport");
let neurovascularRequest: Promise<void> | undefined;
function ensureNeurovascular(): Promise<void> {
  if (neurovascularRequest) return neurovascularRequest;
  viewport.dataset.neurovascularAssets='loading';
  const status=$('#neurovascular-status');status.hidden=false;status.textContent='Loading vessels and nerves…';
  neurovascularRequest=scope.track(loadNeurovascularAssets(leg.parts,pack.assets.neurovascular,createAssetSceneLoader(scope.signal),bvhBuilder())).then(report=>{
    if (disposed) return;
    viewport.dataset.neurovascularAssets=report.fallback.length ? 'fallback' : 'ready';
    viewport.dataset.loadedNeurovascular=String(report.loaded.length);
    for (const tissue of neurovascularTissues) {
      const available=report.loaded.some(id=>byId[id].tissue===tissue);
      const toggle=$<HTMLInputElement>(`[data-layer="${tissue}"]`);
      toggle.disabled=!available;
      if (!available) state.layers.delete(tissue);
    }
    status.hidden=!report.fallback.length;
    status.textContent=report.fallback.length ? 'Some vessels or nerves are unavailable. Missing structures are hidden; reload to retry.' : '';
    for(const warning of report.warnings) console.warn(warning);
    updateAppearance();renderDetails();
  });
  return neurovascularRequest;
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 10, 10000);
let renderer: THREE.WebGLRenderer;
try {
  // The composer renders into its own targets, so canvas MSAA would only add cost; TAA smooths edges at rest.
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
} catch {
  $("#render-error").hidden = false;
  $("#render-error").textContent =
    "3D graphics could not start. Enable WebGL or try another browser.";
  scope.dispose(); worker.dispose();
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// The key light is fixed in world space, so camera motion never changes shadows. Redraw them only on scene changes.
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
viewport.prepend(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute(
  "aria-label",
  `${pack.title}. Drag to rotate, scroll to zoom, or select structures in the atlas.`,
);
camera.position.copy(pack.scene.initialCamera);
const controls = createCameraControls(camera, renderer.domElement);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function applyMotionPreference() {
  controls.smoothTime = reducedMotion.matches ? 0.01 : 0.25;
  controls.draggingSmoothTime = reducedMotion.matches ? 0.01 : 0.125;
}
applyMotionPreference();
listen(reducedMotion, "change", applyMotionPreference);
// Capture applies Shift-pan before camera-controls reads the pointer mapping.
listen(renderer.domElement,
  "pointerdown",
  (e) => {
    controls.mouseButtons.left =
      state.pan || e.shiftKey || e.ctrlKey || e.metaKey
        ? CameraControls.ACTION.TRUCK
        : CameraControls.ACTION.ROTATE;
  },
  { capture: true },
);
listen(renderer.domElement, "keydown", (e) => {
  const step = controls.distance * 0.025;
  const shifts: Record<string, [number, number]> = {
    ArrowLeft: [step, 0],
    ArrowRight: [-step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  if (shifts[e.key]) {
    e.preventDefault();
    void controls.truck(...shifts[e.key], true);
  }
});
const hemisphere = new THREE.HemisphereLight("#fff7e8", "#9d8d7b", 2.3);
scene.add(hemisphere);
const key = new THREE.DirectionalLight("#fff2db", 3.4);
key.position.copy(pack.scene.keyPosition);
key.target.position.copy(pack.scene.keyTarget);
scene.add(key.target);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -700;
key.shadow.camera.right = 700;
key.shadow.camera.top = 1200;
key.shadow.camera.bottom = -600;
key.shadow.camera.near = 50;
key.shadow.camera.far = 50000;
key.shadow.camera.updateProjectionMatrix();
key.shadow.normalBias = 2.5;
scene.add(key);
const fill = new THREE.DirectionalLight("#dcecf3", 1.6);
fill.position.copy(pack.scene.fillPosition);
fill.target.position.copy(pack.scene.fillTarget);
scene.add(fill.target);
scene.add(fill);
controls.minPolarAngle = 0.001;
controls.maxPolarAngle = Math.PI - 0.001;
const updateCompass = createCompass($("#compass"), (view) => setView(view), pack.directions);
const composer = new EffectComposer(renderer);
const taa = new TAARenderPass(scene, camera);
// One scene render per frame: unjittered while moving, then one jittered TAA sample per frame until converged.
taa.sampleLevel=0;
composer.addPass(taa);composer.addPass(new OutputPass());
let taaSamplesLeft=0;
let taaAccumulated=false;
let appearanceDirty=true;
let labelsDirty=true;
/** Request a redraw after anything that changes what the scene or its labels show. */
function invalidate(){appearanceDirty=true;labelsDirty=true;}
const leg = createAnkle();
scene.add(leg.root);
const footprintGroup = new THREE.Group();
footprintGroup.name = 'attachment-footprints';
scene.add(footprintGroup);
let footprintSelection: string | null | undefined;
let cutAwayIds = new Set<string>();
let cutAwayDirty = false;
let lastCutAwayTime = 0;

let preFocusView: { position: THREE.Vector3; target: THREE.Vector3; label: string; view: string | undefined } | null = null;
function clearConnectionFocus() {
  preFocusView = null;
  state.focusedConnection = null;
  cutAwayIds.clear();
  cutAwayDirty = false;
}
function activeConnection() {
  return state.selected ? connectionsFor(leg.parts, state.selected).find(c => c.key === state.focusedConnection) : undefined;
}
function updateFootprints() {
  if (footprintSelection !== state.selected) {
    for (const child of [...footprintGroup.children]) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      mesh.geometry.dispose(); mesh.material.dispose(); footprintGroup.remove(mesh);
    }
    footprintSelection = state.selected;
    if (state.selected) for (const c of connectionsFor(leg.parts, state.selected)) {
      const decal = footprintDecal(leg.parts, c);
      if (decal) footprintGroup.add(decal);
    }
  }
  for (const child of footprintGroup.children) {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    mesh.visible = !!leg.parts.get(mesh.userData.boneId)?.group.visible;
    const active = mesh.userData.connectionKey === state.focusedConnection;
    mesh.material.color.set(active ? '#2b62a0' : '#1d8a7a');
    // Shared origins can overlap (e.g. plantar slips); draw the focused patch last.
    mesh.renderOrder = active ? 6 : 5;
  }
  viewport.dataset.footprints = String(footprintGroup.children.filter(c => c.visible).length);
  viewport.dataset.focusedConnection = state.focusedConnection ?? '';
  viewport.dataset.ghost = String(state.attachmentFade);
  viewport.dataset.cutaway = [...cutAwayIds].sort().join(',');
}
function toggleConnection(connection: Connection) {
  if (state.focusedConnection !== connection.key) return focusConnection(connection);
  const saved = preFocusView;
  clearConnectionFocus();
  state.attachmentFade = false;
  if (saved) {
    applyMotionPreference();
    void lookAtNearest(controls, saved.position, saved.target, !reducedMotion.matches);
    $("#view-name").textContent = saved.label;
    app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === saved.view);
      b.setAttribute("aria-pressed", String(b.dataset.view === saved.view));
    });
  }
  const scroll = $("#details").scrollTop;
  renderDetails();
  $("#details").scrollTop = scroll;
  app.querySelector<HTMLButtonElement>(`[data-connection="${connection.key}"]`)?.focus({ preventScroll: true });
  updateAppearance();
}
function focusConnection(connection: Connection) {
  if (!state.focusedConnection) preFocusView = {
    position: camera.position.clone(),
    target: controls.getTarget(new THREE.Vector3(), false),
    label: $("#view-name").textContent ?? "",
    view: app.querySelector<HTMLButtonElement>("[data-view].active")?.dataset.view,
  };
  const keepKeyboardFocus = document.activeElement instanceof HTMLElement && document.activeElement.dataset.connection === connection.key;
  state.focusedConnection = connection.key;
  state.attachmentFade = true;
  state.isolated = false;
  state.connections = false;
  cutAwayIds.clear();
  cutAwayDirty = true;
  const { target, position } = connectionCameraPose(connection.footprint, camera.fov, camera.aspect);
  cameraTouched = true;
  applyMotionPreference();
  void lookAtNearest(controls, position, target, !reducedMotion.matches);
  $("#view-name").textContent = 'ATTACHMENT CLOSE-UP';
  app.querySelectorAll('[data-view]').forEach(b => {b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');});
  const scroll = $("#details").scrollTop;
  renderDetails();
  $("#details").scrollTop = scroll;
  if (keepKeyboardFocus) app.querySelector<HTMLButtonElement>(`[data-connection="${connection.key}"]`)?.focus({ preventScroll: true });
  updateAppearance();
}

let cameraTouched = false;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20000, 20000),
  new THREE.ShadowMaterial({ color: "#6e583e", opacity: 0.12 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.copy(pack.scene.floorPosition);
floor.receiveShadow = true;
scene.add(floor);
applySceneTheme({ renderer, hemisphere, key, fill, floor }, effectiveTheme());
viewerDiagnostics.activeListeners += 2;
scope.cleanup(listenForThemeChanges((theme) => { applySceneTheme({ renderer, hemisphere, key, fill, floor }, theme); invalidate(); }));
scope.cleanup(() => { viewerDiagnostics.activeListeners -= 2; });

// Graphics quality. Auto resolves to Low on weak devices, or after the user accepts the slow-frame prompt.
let graphicsChoice: GraphicsChoice = readGraphicsChoice();
let autoOverride: AutoOverride = readAutoOverride();
const weakReason = weakDeviceReason({
  gpu: (() => {
    try {
      const gl = renderer.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    } catch { return undefined; }
  })(),
  memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  automated: navigator.webdriver,
});
const slowFrames = createSlowFrameMonitor();
let slowPromptShown = false;
const restingPixelRatio = () => Math.min(devicePixelRatio, graphics.maxPixelRatio);
function setRenderPixelRatio(ratio: number) {
  if (renderer.getPixelRatio() === ratio) return false;
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  return true;
}
/** Sheen and clearcoat make the skin the costliest shader; Low swaps in a standard material. */
function applySkinMaterial(simple: boolean) {
  for (const mesh of [...leg.parts.values()].filter(part => byId[part.id].tissue === "skin").flatMap(part => part.meshes)) {
    const current = mesh.material as THREE.Material;
    if (simple && current instanceof THREE.MeshPhysicalMaterial) {
      const standard = new THREE.MeshStandardMaterial({
        color: current.color, roughness: current.roughness, metalness: current.metalness, side: current.side,
      });
      standard.userData = { ...current.userData };
      mesh.userData.fullMaterial = current;
      mesh.material = standard;
    } else if (!simple && mesh.userData.fullMaterial) {
      current.dispose();
      mesh.material = mesh.userData.fullMaterial;
      delete mesh.userData.fullMaterial;
    }
  }
}
/** Renderer-level settings; appearance and labels are refreshed by the caller. */
function configureGraphics() {
  graphicsTier = resolveTier(graphicsChoice, weakReason, autoOverride);
  graphics = graphicsSettings[graphicsTier];
  viewport.dataset.graphics = graphicsTier;
  viewport.dataset.graphicsChoice = graphicsChoice;
  setRenderPixelRatio(restingPixelRatio());
  key.castShadow = graphics.shadows;
  floor.visible = graphics.shadows;
  renderer.shadowMap.needsUpdate = true;
  applySkinMaterial(graphics.simpleSkin);
  taaSamplesLeft = 0;
  slowFrames.reset();
  syncGraphicsMenu();
}
function applyGraphics() {
  configureGraphics();
  updateAppearance();
  buildLabels();
}
function syncGraphicsMenu() {
  app.querySelectorAll<HTMLButtonElement>("[data-graphics-choice]").forEach((b) => {
    const active = b.dataset.graphicsChoice === graphicsChoice;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  const tier = graphicsTier === "low" ? "Low" : "High";
  $("#graphics-status").textContent = graphicsChoice !== "auto"
    ? graphicsTier === "low"
      ? "No shadows, lower resolution and lighter loading."
      : "Shadows, full resolution and smooth edges."
    : weakReason ? `Auto is using Low: ${weakReason} detected.`
    : autoOverride === "low" ? "Auto is using Low after slow frames on this device."
    : `Auto is using ${tier}.`;
}
function offerLowGraphics() {
  if (slowPromptShown || graphicsChoice !== "auto" || graphicsTier === "low" || autoOverride) return;
  slowPromptShown = true;
  $("#graphics-prompt").hidden = false;
}
app.querySelectorAll<HTMLButtonElement>("[data-graphics-choice]").forEach((button) => {
  button.onclick = () => {
    graphicsChoice = button.dataset.graphicsChoice as GraphicsChoice;
    saveGraphicsChoice(graphicsChoice);
    $("#graphics-prompt").hidden = true;
    applyGraphics();
  };
});
app.querySelectorAll<HTMLButtonElement>("[data-graphics-prompt]").forEach((button) => {
  button.onclick = () => {
    autoOverride = button.dataset.graphicsPrompt === "low" ? "low" : "keep";
    saveAutoOverride(autoOverride);
    $("#graphics-prompt").hidden = true;
    applyGraphics();
  };
});
configureGraphics();
let overviewDistance=1000;
let maxTier: 1 | 2 | 3 = 1;
function setView(view: string, animate = true) {
  clearConnectionFocus();
  updateAppearance();
  renderDetails();
  state.view = view;
  applyMotionPreference();
  const { target, position: p } = cameraPreset(view, camera.aspect);
  // Full source shafts extend beyond the procedural distal-leg overview.
  // Fit the imported overview while keeping the regional view shortcuts intact.
  if ((pack.regionIds || view === pack.defaultView) && [...leg.parts.values()].some(part => part.meshes.some(mesh => mesh.userData.source === "z-anatomy"))) {
    const bounds = new THREE.Box3();
    for (const [id, part] of leg.parts) if (!isNeurovascular(byId[id].tissue)) bounds.union(new THREE.Box3().setFromObject(part.group));
    const direction = p.clone().sub(target).normalize();
    bounds.getCenter(target);
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2),
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const distance = bounds.getSize(new THREE.Vector3()).length() / 2 / Math.sin(halfFov) * 1.2;
    p.copy(target).addScaledVector(direction, distance);
  }
  if(view === pack.defaultView) overviewDistance=p.distanceTo(target);
  void lookAtNearest(controls, p, target, animate && !reducedMotion.matches);
  buildLabels();
  $("#view-name").textContent =
    view === pack.defaultView ? "OBLIQUE OVERVIEW" : `${view.toUpperCase()} VIEW`;
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  });
}
controls.addEventListener("controlstart", () => {
  cameraTouched = true;
  $("#view-name").textContent = "FREE CAMERA";
  app.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
});
function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w,h);
  invalidate();
  camera.aspect = w / h;
  // On wide layouts the inspector floats over the canvas; centre the model in the free area.
  const covered = innerWidth > 900 ? $(".inspector").offsetWidth + parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap") || "12") : 0;
  setInspectorInset(camera, w, h, covered);
  $('.compass-wrap').classList.toggle('compass--raised',innerWidth>900 && w-covered<530);
}
const resizeObserver = new ResizeObserver(() => { if (!disposed) resize(); });
resizeObserver.observe(viewport);
let savedInspectorWidth=300, inspectorExpanded=false;
try {const value=Number(localStorage.getItem('inspector-width'));if(Number.isFinite(value)&&value>=280&&value<=680)savedInspectorWidth=value;}catch{}
function inspectorWidth(width: number, persist=false){
  width=Math.max(280,Math.min(680,width));document.documentElement.style.setProperty('--inspector-w',`${width}px`);
  $('.inspector').classList.toggle('inspector--wide',width>=520);$('.inspector-resize').setAttribute('aria-valuenow',String(width));
  if(persist){savedInspectorWidth=width;inspectorExpanded=false;try{localStorage.setItem('inspector-width',String(width));}catch{}}
  $('#expand-inspector').setAttribute('aria-pressed',String(inspectorExpanded));
  $('#expand-inspector').textContent=inspectorExpanded?'⇥⇤':'↔';
  const title=inspectorExpanded?'Restore details panel width':'Expand details panel';$('#expand-inspector').title=title;$('#expand-inspector').setAttribute('aria-label',title);resize();
}
inspectorWidth(savedInspectorWidth);
$('#expand-inspector').onclick=()=>{inspectorExpanded=!inspectorExpanded;inspectorWidth(inspectorExpanded?640:savedInspectorWidth);};
const resizeHandle=$('.inspector-resize');
resizeHandle.onpointerdown=e=>{e.preventDefault();resizeHandle.setPointerCapture(e.pointerId);const x=e.clientX,w=$('.inspector').offsetWidth;
  resizeHandle.onpointermove=event=>inspectorWidth(w+x-event.clientX,true);
  resizeHandle.onpointerup=()=>{resizeHandle.onpointermove=null;};resizeHandle.onlostpointercapture=()=>{resizeHandle.onpointermove=null;};};
resizeHandle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();inspectorWidth($('.inspector').offsetWidth+(e.key==='ArrowLeft'?24:-24),true);}};

function setPan(pan: boolean) {
  state.pan = pan;
  controls.mouseButtons.left = pan
    ? CameraControls.ACTION.TRUCK
    : CameraControls.ACTION.ROTATE;
  controls.touches.one = pan
    ? CameraControls.ACTION.TOUCH_TRUCK
    : CameraControls.ACTION.TOUCH_ROTATE;
  $("#pan").setAttribute("aria-pressed", String(pan));
  $("#pan").classList.toggle("active", pan);
  renderer.domElement.style.cursor = pan ? "grab" : "default";
}
function focusParts(ids: string[]) {
  clearConnectionFocus();
  updateAppearance();
  renderDetails();
  const bounds = new THREE.Box3();
  for (const id of ids) {
    const part = leg.parts.get(id);
    if (!part) continue;
    for (const mesh of part.meshes) {
      if (mesh.userData.fiber) continue;
      mesh.geometry.computeBoundingBox();
      mesh.updateWorldMatrix(true, false);
      bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    }
  }
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  // Bounding sphere fits both viewport axes, including narrow layouts.
  const halfFov = Math.min(
    THREE.MathUtils.degToRad(camera.fov / 2),
    Math.atan(
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect,
    ),
  );
  const distance = Math.max(
    60,
    (size.length() / 2 / Math.sin(halfFov)) * 1.32,
  );
  const direction = camera.position
        .clone()
        .sub(controls.getTarget(new THREE.Vector3(), false))
        .normalize();
  const destination = center.clone().addScaledVector(direction, distance);
  controls.smoothTime = reducedMotion.matches ? 0.01 : 0.28;
  void lookAtNearest(controls, destination, center, !reducedMotion.matches);
  $("#view-name").textContent = "STRUCTURE CLOSE-UP";
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    const active = false;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  buildLabels();
}
function focusOverview() {
  select(null);
  setView(pack.defaultView);
  state.atlasRegion = "all";
  $<HTMLInputElement>("#search").value = "";
  renderList();
}
$("#pan").onclick = () => setPan(!state.pan);
function select(id: string | null, revealLayer = true) {
  id = resolveStructureId(pack, id);
  clearConnectionFocus();
  state.attachmentFade = false;
  state.selected = id;
  if(id && !atlasIds(state.atlasRegion).has(id)) state.atlasRegion="all";
  renderList();
  state.isolated = false;
  state.connections = false;
  if (id && revealLayer && !state.layers.has(byId[id].tissue)) {
    state.layers.add(byId[id].tissue);
    state.mode = "custom";
  }
  updateRows();
  renderDetails();
  $("#details").scrollTop = 0;
  updateAppearance();
}
function selectedConnectionHighlights() {
  return state.highlightConnections && state.selected && !state.isolated
    ? connectionHighlightIds(state.selected)
    : new Set<string>();
}
function updateAppearance() {
  invalidate();
  if (viewport.dataset.neurovascularAssets === 'fallback') {
    for (const tissue of neurovascularTissues)
      if (![...leg.parts.values()].some(p => byId[p.id].tissue === tissue && p.meshes.length && !p.group.userData.unavailable)) state.layers.delete(tissue);
  }
  if (neurovascularTissues.some(t => state.layers.has(t))) void ensureNeurovascular();
  ensureLayerAssets();
  $("#neurovascular-opacity-controls").hidden = !neurovascularTissues.some(t => state.layers.has(t));
  cutAwayDirty = !!state.focusedConnection;
  const attached = state.attachmentFade && state.selected ? directlyAttachedIds(state.selected) : new Set<string>();
  const highlighted = selectedConnectionHighlights();
  const focused = activeConnection();
  // Keep the focused endpoint and owning band visible even from a muscle/bone inspector.
  if (focused && state.attachmentFade) { attached.add(focused.record.structureId); attached.add(focused.footprint.structureId); }
  const related =
    state.connections && state.selected
      ? relatedIds(state.selected)
      : new Set<string>();
  for (const [id, part] of leg.parts) {
    const d = byId[id],
      selected = id === state.selected;
    part.group.visible =
      part.meshes.length > 0 && !part.group.userData.unavailable &&
      ((state.attachmentFade && d.tissue !== "skin") || highlighted.has(id) || state.layers.has(d.tissue)) &&
      (!state.isolated || selected) &&
      (!state.connections || selected || highlighted.has(id) || related.has(id));
    for (const mesh of part.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.userData.connectionBaseColor ??= mat.color.clone();
      mat.color.copy(mat.userData.connectionBaseColor);
      if (highlighted.has(id) && !selected) mat.color.set("#1d8a7a");
      const tissueOpacity = d.tissue === "muscle" ? state.opacity : d.tissue === "skin" ? state.skinOpacity : isNeurovascular(d.tissue) ? state.neurovascularOpacity : 1;
      let alpha = tissueOpacity;
      if (state.attachmentFade) alpha = attached.has(id) ? 1 : Math.min(alpha, 0.07);
      else if (state.selected && !selected && !state.isolated && !state.connections)
        alpha = Math.min(alpha, state.highlightConnections ? 0.12 : 0.5);
      if (highlighted.has(id) && !selected) alpha = 1;
      if (cutAwayIds.has(id)) alpha = Math.min(alpha, 0.025);
      if (selected) alpha = tissueOpacity;
      if (!mesh.userData.fiber) {
        part.group.userData.alpha = alpha;
        // Joined structures retain a local group for each region's asset loader.
        if (mesh.parent) mesh.parent.userData.alpha = alpha;
      }
      if (mesh.userData.fiber) alpha *= 0.22;
      applyCoverage(mesh, alpha);
      mesh.visible = alpha > 0;
      mat.emissive.set(selected ? "#2b62a0" : highlighted.has(id) ? "#1d8a7a" : "#000000");
      mat.emissiveIntensity = selected ? 0.13 : highlighted.has(id) ? 0.25 : 0;

    }
  }
  if (state.onlyVisible) renderList(); else updateRows();
  $("#highlight-connections").setAttribute("aria-pressed", String(state.highlightConnections));
  viewport.dataset.highlightedStructures = [...highlighted].filter(id => leg.parts.get(id)?.group.visible).sort().join(",");
  updateFootprints();
  $("#layer-hint").textContent = state.attachmentFade
    ? "Attachment close-up shows all layers. Press Esc to restore."
    : "";
  if (state.hovered && (!leg.parts.get(state.hovered)?.group.visible ||
    (state.highlightConnections && !hoverConnectionIds().has(state.hovered))))
    setHovered(null);
  if (hoverPointer) requestHovered(pickStructure(hoverPointer.x, hoverPointer.y, true));
  document
    .querySelectorAll<HTMLInputElement>("[data-layer]")
    .forEach(
      (el) => (el.checked = state.layers.has(el.dataset.layer as Tissue)),
    );
  // Layer toggles that match a preset's criteria switch that preset on.
  const sameLayers = (tissues: Tissue[]) => state.layers.size === tissues.length && tissues.every(t => state.layers.has(t));
  const layerMode = presets.map(preset => preset.id).find(m => sameLayers(presetLayers(m)));
  state.mode = layerMode ?? "custom";
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === state.mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("#labels").classList.toggle("active", state.labels);
  $("#labels").setAttribute("aria-pressed", String(state.labels));
  buildLabels();
}
function presetLayers(mode: string): Tissue[] {
  return [...(pack.presets.find(preset => preset.id === mode)?.tissues ?? [])];
}
function preset(mode: string) {
  clearConnectionFocus();
  state.attachmentFade = false;
  state.mode = mode;
  const settings = pack.presets.find(preset => preset.id === mode);
  if (settings?.skinOpacity !== undefined) {state.skinOpacity=settings.skinOpacity;$<HTMLInputElement>("#skin-opacity").value=String(settings.skinOpacity*100);$("#skin-opacity-value").textContent=`${settings.skinOpacity*100}%`;}
  if (settings?.opacity !== undefined) {state.opacity=settings.opacity;$<HTMLInputElement>("#opacity").value=String(settings.opacity*100);$("#opacity-value").textContent=`${settings.opacity*100}%`;}
  state.selected = null;
  state.isolated = false;
  state.connections = false;
  state.layers = new Set<Tissue>(presetLayers(mode));
  renderList();
  renderDetails();
  $("#details").scrollTop = 0;
  updateAppearance();
}
const themeChoice = readThemeChoice();
app.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((button) => {
  const choice = button.dataset.themeChoice as ThemeChoice;
  button.classList.toggle("active", choice === themeChoice);
  button.setAttribute("aria-pressed", String(choice === themeChoice));
  button.onclick = () => { setThemeChoice(choice); app.querySelectorAll<HTMLButtonElement>("[data-theme-choice]").forEach((b) => { const active = b.dataset.themeChoice === choice; b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active)); }); };
});
document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) => (b.onclick = () => preset(b.dataset.mode!)));
document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
listen($("#search"), "input", renderList);
$("#clear").onclick = () => select(null);
/** Highlighting only recolours the scene around a selection; without one there is nothing to redraw. */
const highlightAffectsScene = () => !!state.selected && !state.isolated;
$("#highlight-connections").onclick = () => {
  state.highlightConnections = !state.highlightConnections;
  if (highlightAffectsScene()) updateAppearance();
  else $("#highlight-connections").setAttribute("aria-pressed", String(state.highlightConnections));
};
$("#labels").onclick = () => {
  state.labels = !state.labels;
  updateAppearance();
};
const fpsMeter = $("#fps-meter");
let fpsFrames = 0, fpsSince = 0;
function syncSettings() {
  $("#setting-labels-default").setAttribute("aria-pressed", String(viewerSettings.labelsDefault));
  $("#setting-fps").setAttribute("aria-pressed", String(viewerSettings.showFps));
  $<HTMLInputElement>("#setting-max-labels").value = String(viewerSettings.maxLabels);
  $("#setting-max-labels-value").textContent = String(viewerSettings.maxLabels);
  fpsMeter.hidden = !viewerSettings.showFps;
  fpsFrames = 0; fpsSince = 0;
}
$("#setting-labels-default").onclick = () => { viewerSettings.labelsDefault = !viewerSettings.labelsDefault; saveSettings(viewerSettings); syncSettings(); };
$("#setting-fps").onclick = () => { viewerSettings.showFps = !viewerSettings.showFps; saveSettings(viewerSettings); syncSettings(); };
$<HTMLInputElement>("#setting-max-labels").oninput = e => {
  viewerSettings.maxLabels = Number((e.target as HTMLInputElement).value);
  saveSettings(viewerSettings); syncSettings(); invalidate();
};
syncSettings();
$("#all-layers").onclick = () => { preset("anatomy");state.layers=new Set(tissueKeys);state.mode="custom";updateAppearance(); };
$<HTMLInputElement>("#opacity").oninput = (e) => {
  state.opacity = Number((e.target as HTMLInputElement).value) / 100;
  $("#opacity-value").textContent = `${Math.round(state.opacity * 100)}%`;
  updateAppearance();
};
$<HTMLInputElement>("#skin-opacity").oninput = e => {
  state.skinOpacity=Number((e.target as HTMLInputElement).value)/100;
  $("#skin-opacity-value").textContent=`${Math.round(state.skinOpacity*100)}%`;
  updateAppearance();
};
$<HTMLInputElement>("#neurovascular-opacity").oninput = e => {state.neurovascularOpacity=Number((e.target as HTMLInputElement).value)/100;$("#neurovascular-opacity-value").textContent=`${Math.round(state.neurovascularOpacity*100)}%`;updateAppearance();};
$("#home").onclick = () => setView(pack.defaultView);
$("#zoom-in").onclick = () => {
  zoomBy(controls, 0.84);
};
$("#zoom-out").onclick = () => {
  zoomBy(controls, 1 / 0.84);
};
function reset() {
  setPan(false);
  state.highlightConnections = false;
  clearFilters();

  state.neurovascularOpacity = 1;
  $<HTMLInputElement>("#neurovascular-opacity").value="100";
  $("#neurovascular-opacity-value").textContent="100%";
  state.skinOpacity = 1;
  $<HTMLInputElement>("#skin-opacity").value="100";
  $("#skin-opacity-value").textContent="100%";
  state.opacity = 1;
  state.labels = viewerSettings.labelsDefault;
  $<HTMLInputElement>("#opacity").value = "100";
  $("#opacity-value").textContent = "100%";
  $<HTMLInputElement>("#search").value = "";
  renderList();
  preset("anatomy");
  setView(pack.defaultView);

}
$("#reset").onclick = reset;
const dialog = $<HTMLDialogElement>("#about-dialog");
$("#about").onclick = () => dialog.showModal();
function showAboutTab(id: string){app.querySelectorAll<HTMLButtonElement>('[data-about-tab]').forEach(tab=>{const active=tab.dataset.aboutTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});app.querySelectorAll<HTMLElement>('[data-about-panel]').forEach(panel=>panel.hidden=panel.dataset.aboutPanel!==id);}
const aboutTabs=[...app.querySelectorAll<HTMLButtonElement>('[data-about-tab]')];
aboutTabs.forEach((tab,index)=>{tab.onclick=()=>showAboutTab(tab.dataset.aboutTab!);tab.onkeydown=e=>{const next=e.key==='ArrowRight'?(index+1)%aboutTabs.length:e.key==='ArrowLeft'?(index+aboutTabs.length-1)%aboutTabs.length:e.key==='Home'?0:e.key==='End'?aboutTabs.length-1:-1;if(next>=0){e.preventDefault();aboutTabs[next].click();aboutTabs[next].focus();}};});
$(".dialog-close").onclick = () => dialog.close();
listen(dialog, "click", (e) => {
  if (e.target === dialog) dialog.close();
});
const raycaster = new THREE.Raycaster(),
  mouse = new THREE.Vector2();
// Closest hit per mesh; every mesh still participates in selection priority.
raycaster.firstHitOnly = true;
function hoverConnectionIds() {
  return new Set([
    ...selectedConnectionHighlights(),
    ...(state.selected ? [state.selected] : []),
  ]);
}
function pickStructure(clientX: number, clientY: number, hoverOnly = false): string | null {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    (-(clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  const hoverIds = hoverOnly && state.highlightConnections ? hoverConnectionIds() : null;
  const targets = [...leg.parts.values()]
    .filter((p) => p.group.visible && (!hoverIds || hoverIds.has(p.id)))
    .flatMap((p) => p.meshes.filter((m) => m.visible && !m.userData.fiber));
  const hits = raycaster.intersectObjects(targets, false);
  // Preserve exact selected-surface priority before assisting neighboring tubes.
  const selectedHit = hits.find(hit => hit.object.userData.id === state.selected);
  if (selectedHit) return selectedHit.object.userData.id;
  const opaque = hits.find(hit => (hit.object.parent?.userData.alpha ?? 1) >= .99);
  const directThin = hits.find(hit => hit.object.userData.thinStructure && (!opaque || hit.distance <= opaque.distance + .05));
  if (directThin) return directThin.object.userData.id;
  // Low graphics keeps the 48-ray assist for clicks, where it matters, and skips it on hover.
  const thinHit = hoverOnly && !graphics.thinHoverAssist ? undefined : intersectThinStructures(raycaster, camera, mouse, rect.width, rect.height, targets);
  return (thinHit ?? hits[0])?.object.userData.id ?? null;
}
let pendingHover: string | null | undefined;
let hoverTimer: number | undefined;
function setHovered(id: string | null) {
  // Selection or mode may have changed during the hover settling delay.
  if (id && state.highlightConnections && !hoverConnectionIds().has(id)) id = null;
  window.clearTimeout(hoverTimer);
  hoverTimer = undefined;
  pendingHover = undefined;
  if (state.hovered === id) return;
  state.hovered = id;
  renderer.domElement.style.cursor = id ? "pointer" : "";
  updateRows();
  buildLabels();
}
function requestHovered(id: string | null) {
  if (id && state.highlightConnections && !hoverConnectionIds().has(id)) id = null;
  if (pendingHover === id) return;
  window.clearTimeout(hoverTimer);
  pendingHover = undefined;
  if (state.hovered === id) return;
  // Briefly settle on a structure to avoid flashing labels at tissue boundaries.
  pendingHover = id;
  hoverTimer = scope.timeout(
    () => setHovered(id),
    reducedMotion.matches ? 0 : id ? 60 : 90,
  );
}
let down = { x: 0, y: 0, picking: false, moved: false };
let hoverPointer: { x: number; y: number } | null = null;
let hoverPickPending = false;
const pointers = new Set<number>();
listen(renderer.domElement, "pointerdown", (e) => {
  hoverPointer = null;
  setHovered(null);
  pointers.add(e.pointerId);
  down = {
    x: e.clientX,
    y: e.clientY,
    picking:
      pointers.size === 1 &&
      e.button === 0 &&
      !state.pan &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey,
    moved: false,
  };
});
listen(renderer.domElement, "pointermove", (e) => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
  if (e.pointerType === "touch" || e.buttons || pointers.size) return;
  hoverPointer = { x: e.clientX, y: e.clientY };
  // Throttled hover picks once in the next frame, however fast the pointer reports.
  if (graphics.throttleHover) hoverPickPending = true;
  else requestHovered(pickStructure(e.clientX, e.clientY, true));
});
listen(renderer.domElement, "pointerleave", () => {
  hoverPointer = null;
  setHovered(null);
});
listen(renderer.domElement, "pointercancel", (e) => {
  pointers.delete(e.pointerId);
  down.picking = false;
  hoverPointer = null;
  setHovered(null);
});
listen(renderer.domElement, "pointerup", (e) => {
  pointers.delete(e.pointerId);
  if (
    !down.picking ||
    down.moved ||
    pointers.size ||
    Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
  )
    return;
  select(pickStructure(e.clientX, e.clientY));
});
type LabelNode = {
  id: string;
  node: HTMLButtonElement;
  x?: number;
  y?: number;
  retiringAt?: number;
  alpha?: number;
};
const labelNodes: LabelNode[] = [];
/** Structures with a visible surface in the viewport, from a coarse ray grid plus each anchor's own ray. */
let seenPoints = new Map<string, THREE.Vector3>();
let seenAt = -Infinity;
const seenRaycaster = new THREE.Raycaster();
seenRaycaster.firstHitOnly = true;
function updateSeenIds(time: number, freeWidth: number, height: number) {
  seenAt = time;
  const targets = [...leg.parts.values()]
    .filter((p) => p.group.visible && (p.group.userData.alpha ?? 1) >= .5)
    .flatMap((p) => p.meshes.filter((m) => m.visible && !m.userData.fiber));
  const hits = new Map<string, { x: number; y: number; point: THREE.Vector3 }[]>();
  const width = viewport.clientWidth, ndc = new THREE.Vector2();
  const firstHit = (px: number, py: number) => {
    ndc.set((px / width) * 2 - 1, -(py / height) * 2 + 1);
    seenRaycaster.setFromCamera(ndc, camera);
    return seenRaycaster.intersectObjects(targets, false)[0];
  };
  const cast = (px: number, py: number) => {
    const hit = firstHit(px, py);
    if (!hit) return;
    const id = hit.object.userData.id as string;
    (hits.get(id) ?? hits.set(id, []).get(id)!).push({ x: px, y: py, point: hit.point.clone() });
  };
  const cols = 40, rows = 24;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) cast(((i + .5) / cols) * freeWidth, ((j + .5) / rows) * height);
  // Thin structures can slip between grid rays, so also test each anchor's pixel.
  for (const { id } of labelNodes) {
    const p = leg.parts.get(id)!.anchor.clone().project(camera);
    const ax = (p.x * .5 + .5) * width, ay = (-p.y * .5 + .5) * height;
    if (p.z >= -1 && p.z <= 1 && ax >= 0 && ax <= freeWidth && ay >= 0 && ay <= height) cast(ax, ay);
  }
  // Labels track a fixed 3D surface point so they move smoothly with the camera. The point is only
  // replaced when it stops being visible, so resampling never makes a label jump.
  const points = new Map<string, THREE.Vector3>();
  for (const [id, pts] of hits) {
    if (pts.length < 2) continue;
    const old = seenPoints.get(id);
    if (old) {
      const p = old.clone().project(camera);
      const px = (p.x * .5 + .5) * width, py = (-p.y * .5 + .5) * height;
      if (p.z >= -1 && p.z <= 1 && px >= 24 && px <= freeWidth - 24 && py >= 24 && py <= height - 24) {
        const hit = firstHit(px, py);
        if (hit && hit.object.userData.id === id && hit.point.distanceTo(old) < 1.5) { points.set(id, old); continue; }
      }
    }
    const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length, cy = pts.reduce((s, q) => s + q.y, 0) / pts.length;
    const best = pts.reduce((b, q) => Math.hypot(q.x - cx, q.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? q : b);
    points.set(id, best.point);
  }
  seenPoints = points;
}
function buildLabels() {
  seenAt = -Infinity;
  labelsDirty = true;
  const existing = new Map(labelNodes.map((label) => [label.id, label]));
  const next: LabelNode[] = [];
  const ids = state.labels ? Object.keys(labelTier).filter(id=>labelTier[id]<=maxTier) : [];
  const visible = new Set([
    ...(state.hovered ? [state.hovered] : []),
    ...ids,
    ...(state.selected ? [state.selected] : []),
  ]);
  for (const id of visible) {
    if (!leg.parts.get(id)!.group.visible || (leg.parts.get(id)!.group.userData.alpha ?? 1) < .5) continue;
    let label = existing.get(id);
    if (!label) {
      const node = document.createElement("button");
      node.className = "model-label";
      node.inert = true;
      node.dataset.id = id;
      node.textContent = byId[id].name;
      node.onclick = () => select(id);
      $("#label-layer").append(node);
      label = { id, node };
    }
    existing.delete(id);
    label.retiringAt = undefined;
    label.node.classList.remove("leaving");
    label.node.classList.toggle("selected", id === state.selected);
    label.node.classList.toggle("hovered", id === state.hovered);
    // A transient label must not intercept the model pointer and flicker.
    label.node.classList.toggle("hover-preview", id === state.hovered);
    next.push(label);
  }
  for (const label of existing.values()) {
    if (reducedMotion.matches) {
      label.node.remove();
      continue;
    }
    label.retiringAt ??= performance.now() + 220;
    label.node.classList.add("leaving");
    label.node.classList.remove("shown");
    label.node.style.opacity = "0";
    label.node.inert = true;
    next.push(label);
  }
  labelNodes.splice(0, labelNodes.length, ...next);
}
listen(document, "keydown", (e) => {
  if (e.key === "Escape" && !dialog.open) {
    if (state.selected || state.attachmentFade || state.isolated || state.connections) select(null);
    else location.hash = "#/";
    return;
  }
  if (
    (e.target as HTMLElement).matches("input,button,select,textarea") ||
    dialog.open
  )
    return;
  const k = e.key.toLowerCase();
  const viewIndex = Number(k) - 1;
  if (/^[1-9]$/.test(k) && pack.viewPresets[viewIndex]) {
    const view = pack.viewPresets[viewIndex].id;
    if (view === pack.defaultView) focusOverview(); else setView(view);
  }
  if (k === "p") setPan(!state.pan);
  if (k === "f" && state.selected) focusParts(state.highlightConnections && !state.isolated ? [...selectedConnectionHighlights()] : [state.selected]);
  if (k === "l") $("#labels").click();
  if (k === "r") reset();

});
renderList();
renderDetails();
updateAppearance();
resize();
setView(state.view, false);
let lastTime = 0;
let labelsAnimating = false;
// Safety net: UI controls may change state without passing through updateAppearance.
// Redrawing restarts temporal anti-aliasing, which shows as a brief flicker on translucent muscles, so the no-op highlight toggle is exempt.
for (const type of ["input", "change", "click"] as const) listen(document, type, event => {
  if (!highlightAffectsScene() && (event.target as Element | null)?.closest?.("#highlight-connections")) return;
  invalidate();
}, { capture: true });
let lastFrameMoved = false;
function frame(time: number) {
  if (disposed) return;
  frameRequest = requestAnimationFrame(frame);
  const elapsed = time - lastTime;
  const dt = Math.min(elapsed / 1000, 0.05);
  lastTime = time;
  if (document.hidden) { lastFrameMoved = false; fpsFrames = 0; fpsSince = 0; return; }
  if (viewerSettings.showFps) {
    fpsFrames++;
    if (!fpsSince) { fpsSince = time; fpsFrames = 0; }
    else if (time - fpsSince >= 500) { fpsMeter.textContent = `${Math.round(fpsFrames * 1000 / (time - fpsSince))} FPS`; fpsFrames = 0; fpsSince = time; }
  }
  const cameraChanged = updateCamera(controls, camera, dt);
  // Back-to-back moving frames measure real render cost for Auto's slow-device prompt.
  if (cameraChanged && lastFrameMoved && slowFrames.add(elapsed)) offerLowGraphics();
  lastFrameMoved = cameraChanged;
  // Low graphics draws motion at a reduced resolution and restores it once the camera rests.
  if (setRenderPixelRatio(cameraChanged && graphics.movingPixelRatio !== null
    ? Math.min(devicePixelRatio, graphics.movingPixelRatio) : restingPixelRatio())) invalidate();
  const nextTier=tierForZoom(controls.distance/overviewDistance);
  if(nextTier!==maxTier){maxTier=nextTier;buildLabels();}
  viewport.dataset.labelTier=String(maxTier);
  if ((cameraChanged || hoverPickPending) && hoverPointer)
    requestHovered(pickStructure(hoverPointer.x, hoverPointer.y, true));
  hoverPickPending = false;
  if (cameraChanged && state.focusedConnection) cutAwayDirty = true;
  if (cutAwayDirty && time - lastCutAwayTime > 100) {
    lastCutAwayTime = time;
    const focused = activeConnection();
    scene.updateMatrixWorld(true);
    const next = focused ? connectionOccluders(leg.parts, camera.position, focused, state.selected) : new Set<string>();
    if (next.size !== cutAwayIds.size || [...next].some(id => !cutAwayIds.has(id))) {
      cutAwayIds = next;
      updateAppearance();
    }
    cutAwayDirty = false;
  }
  const sceneChanged = cameraChanged || appearanceDirty;
  if (sceneChanged || taaSamplesLeft > 0) {
    // Camera-only motion reuses the previous shadow map.
    if (appearanceDirty) renderer.shadowMap.needsUpdate = true;
    taa.accumulate = !sceneChanged && graphics.taaSamples > 0;
    // A still scene change gets a supersampled first image, so translucent muscles do not flash grainy before TAA converges.
    // TAA renders its first held image right after a non-accumulating frame.
    taa.sampleLevel = !cameraChanged && graphics.taaSamples > 0 && (sceneChanged || !taaAccumulated) ? 2 : 0;
    taaAccumulated = taa.accumulate;
    composer.render();
    viewerDiagnostics.geometries = renderer.info.memory.geometries;
    taaSamplesLeft = sceneChanged ? graphics.taaSamples : taaSamplesLeft - 1;
    appearanceDirty = false;
  }
  if (cameraChanged) updateCompass(camera.quaternion);
  if (!cameraChanged && !labelsDirty && !labelsAnimating) return;
  labelsDirty = false;
  labelsAnimating = labelNodes.some(l => l.retiringAt !== undefined);
  const occupied: {x:number;y:number;w:number;h:number}[]=[];
  const labelInset=innerWidth>900?$('.inspector').offsetWidth+12:0;
  const freeWidth=Math.max(100,viewport.clientWidth-labelInset), height=viewport.clientHeight;
  const leaders=$<HTMLElement>('.label-leaders');leaders.setAttribute('viewBox',`0 0 ${viewport.clientWidth} ${height}`);leaders.replaceChildren();
  for(let i=labelNodes.length-1;i>=0;i--){const label=labelNodes[i];if(label.retiringAt!==undefined&&time>=label.retiringAt){label.node.remove();labelNodes.splice(i,1);}}
  scene.updateMatrixWorld(true);
  if(time-seenAt>150)updateSeenIds(time,freeWidth,height);
  // Camera moved since the last visibility sample: run one more pass after it settles.
  else if(cameraChanged)labelsDirty=true;
  const projected=labelNodes.filter(l=>l.retiringAt===undefined).map(label=>{
    const p=(seenPoints.get(label.id)??leg.parts.get(label.id)!.anchor).clone().project(camera);
    return {label,p,ax:(p.x*.5+.5)*viewport.clientWidth,ay:(-p.y*.5+.5)*height};
  }).sort((a,b)=>{
    const priority=(id:string)=>id===state.selected?-2:id===state.hovered?-1:labelTier[id]??3;
    return priority(a.label.id)-priority(b.label.id)||Math.hypot(a.ax-freeWidth/2,a.ay-height/2)-Math.hypot(b.ax-freeWidth/2,b.ay-height/2);
  });
  // Passive labels are capped (Settings → Max labels) so the view stays calm; zooming in allows more.
  const passiveCap=passiveLabelCap(viewerSettings.maxLabels,maxTier);
  let passiveShown=0;
  const hoverOnly=(id:string)=>id===state.hovered&&id!==state.selected;
  const ease=1-Math.exp(-dt*14);
  const clampX=(v:number,w:number)=>THREE.MathUtils.clamp(v,w/2+8,Math.max(w/2+8,freeWidth-w/2-8));
  const clampY=(v:number,h:number)=>THREE.MathUtils.clamp(v,h/2+(innerWidth<=900?60:10),height-h/2-65);
  for(const {label,p,ax,ay} of projected){
    const {id,node}=label,part=leg.parts.get(id)!;
    const important=id===state.selected||id===state.hovered;
    const w=node.offsetWidth,h=node.offsetHeight,side=ax>=freeWidth/2?1:-1;
    const onScreen=p.z>=-1&&p.z<=1&&ax>=24&&ax<=freeWidth-24&&ay>=24&&ay<=height-24;
    let x:number,y:number;
    if(hoverOnly(id)){
      // Stay beside the structure when visible, else slide to the nearest on-screen spot; dodge other labels.
      const cx=THREE.MathUtils.clamp(ax,24,freeWidth-24),cy=THREE.MathUtils.clamp(ay,24,height-70);
      const spots=[[side*(w/2+20),0],[-side*(w/2+20),0],[0,-(h/2+22)],[0,h/2+22]];
      const fits=spots.map(([dx,dy])=>({x:clampX(cx+dx,w),y:clampY(cy+dy,h)}));
      const hit=(c:{x:number;y:number})=>occupied.some(q=>Math.abs(q.x-c.x)<(q.w+w)/2+6&&Math.abs(q.y-c.y)<(q.h+h)/2+4);
      ({x,y}=fits.find(c=>!hit(c))??fits[0]);
    }else{
      x=clampX(ax+side*(w/2+20),w);
      y=THREE.MathUtils.clamp(ay+(ay-height/2)*.08,h/2+10,height-h/2-65);
    }
    const overlap=occupied.some(q=>Math.abs(q.x-x)<(q.w+w)/2+14&&Math.abs(q.y-y)<(q.h+h)/2+10);
    const visibleTissue=part.group.visible&&(part.group.userData.alpha??1)>=.5;
    const inView=seenPoints.has(id);
    const shown=visibleTissue&&(hoverOnly(id)||(onScreen&&(important||(inView&&!overlap&&passiveShown<passiveCap))));
    // Eased opacity fades the label and its leader together.
    const target=shown?1:0;
    label.alpha=reducedMotion.matches?target:(label.alpha??0)+(target-(label.alpha??0))*ease;
    if(Math.abs(target-label.alpha)<.01)label.alpha=target;else labelsAnimating=true;
    node.style.left=`${x}px`;node.style.top=`${y}px`;node.style.opacity=String(label.alpha);node.classList.toggle('shown',shown);node.inert=!shown;
    if(!shown&&label.alpha===0)continue;
    if(shown){if(!important)passiveShown++;occupied.push({x,y,w,h});}
    if(!onScreen)continue;
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('opacity',String(label.alpha));
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String(ax));line.setAttribute('y1',String(ay));line.setAttribute('x2',String(THREE.MathUtils.clamp(ax,x-w/2,x+w/2)));line.setAttribute('y2',String(THREE.MathUtils.clamp(ay,y-h/2,y+h/2)));
    if(important)line.setAttribute('class','active');
    const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx',String(ax));dot.setAttribute('cy',String(ay));dot.setAttribute('r','2.5');if(important)dot.setAttribute('class','active');
    g.append(line,dot);leaders.append(g);
  }
}
frameRequest = requestAnimationFrame(frame);


// Start after controls, state and labels exist, so late loads preserve user interaction.
viewport.dataset.boneAssets = "loading";
viewport.dataset.softTissues = "loading";
function bvhBuilder() { return graphics.workerBvh ? worker.build : undefined; }
// Low graphics defers muscle and exterior models until something can show them.
// Gastrocnemius ships in the exterior model, so muscles need both files.
const muscleShown = () => state.layers.has("muscle") || state.attachmentFade || state.highlightConnections ||
  (!!state.selected && byId[state.selected].tissue === "muscle");
const needsMuscles = () => !graphics.lazyLayers || muscleShown();
const needsExterior = () => needsMuscles() || state.layers.has("skin");
const requestMuscles = (progress?: (loaded: number, total: number) => void) =>
  muscleRequest ??= scope.track(loadMuscleAssets(leg.parts, pack.assets.muscles, createAssetSceneLoader(scope.signal, progress), progress, bvhBuilder())).then(r => { if (!disposed) { r.warnings.forEach(w => console.warn(w)); muscleReport = r; } return r; });
const requestExterior = (progress?: (loaded: number, total: number) => void) =>
  exteriorRequest ??= scope.track(loadExteriorAssets(leg.parts, progress, bvhBuilder(), pack.assets.exterior, createAssetSceneLoader(scope.signal, progress))).then(r => { if (!disposed) { r.warnings.forEach(w => console.warn(w)); exteriorReport = r; } return r; });
/** Called from updateAppearance: fetch deferred layers once something needs them. */
function ensureLayerAssets() {
  if (disposed) return;
  if (!initialLoad) return;
  const pending = [
    ...(needsMuscles() && !muscleRequest ? [requestMuscles()] : []),
    ...(needsExterior() && !exteriorRequest ? [requestExterior()] : []),
  ];
  if (!pending.length) return;
  viewport.dataset.layerAssets = "loading";
  void Promise.all([initialLoad, ...pending]).then(() => {
    if (disposed) return;
    refreshAfterAssets();
    viewport.dataset.layerAssets = "ready";
  });
}
/** Tendons, ligaments and cartilage fit whatever bones and muscles are installed. */
function refreshAfterAssets(beforeAppearance?: () => void) {
  if (disposed) return;
  if (exteriorReport) viewport.dataset.exteriorAssets = exteriorReport.fallback.length ? "fallback" : "ready";
  const soft = rebuildSoftTissues(leg.parts);
  footprintSelection = undefined;
  cutAwayIds.clear();
  viewport.dataset.softTissues = soft.warnings.length ? "partial" : "ready";
  viewport.dataset.loadedMuscles = String((muscleReport?.loaded.filter(id=>byId[id].tissue==='muscle').length ?? 0) + (exteriorReport?.loaded.filter(id => byId[id].tissue === "muscle").length ?? 0));
  viewport.dataset.cartilagePatches = String(soft.cartilagePatches);
  for (const warning of soft.warnings) console.warn(warning);
  applySkinMaterial(graphics.simpleSkin);
  beforeAppearance?.();
  const focused = activeConnection();
  if (focused) focusConnection(focused);
  else renderDetails();
  updateAppearance();
  buildLabels();
  if (hoverPointer) requestHovered(pickStructure(hoverPointer.x, hoverPointer.y, true));
}
const initialLoads: Promise<AssetReport>[] = [];
const loadingBytes: { loaded: number; total: number }[] = [];
const modelProgress=(index:number)=>(loaded:number,total:number)=>{
  if (disposed) return;loadingBytes[index]={loaded,total};const el=app.querySelector<HTMLElement>('#loading');if(!el)return;
  const known=loadingBytes.every(p=>p.total>0);el.classList.toggle('determinate',known);
  if(known){const percent=Math.min(99,Math.round(loadingBytes.reduce((n,p)=>n+p.loaded,0)/loadingBytes.reduce((n,p)=>n+p.total,0)*100));el.style.setProperty('--progress',`${percent}%`);el.querySelector('p')!.textContent=`Loading models… ${percent}%`;}
};
function startLoad(load: (progress: (loaded: number, total: number) => void) => Promise<AssetReport>) {
  const index = loadingBytes.push({ loaded: 0, total: 0 }) - 1;
  initialLoads.push(load(modelProgress(index)));
}
startLoad(progress => scope.track(loadBoneAssets(leg.parts, pack.assets.bones, createAssetSceneLoader(scope.signal, progress), progress, bvhBuilder())));
// Low shows the skeleton first; once it is ready, ensureLayerAssets fetches what the layers need.
if (!graphics.lazyLayers) { startLoad(requestMuscles); startLoad(requestExterior); }
initialLoad = Promise.all(initialLoads).then(([report]) => {
  if (disposed) return;
  refreshAfterAssets(() => {
    viewport.dataset.boneAssets = report.fallback.length ? "fallback" : "ready";
    viewport.dataset.loadedBones = String(report.loaded.filter(id=>byId[id].tissue==='bone').length);
    // Fit the overview after soft tissues are rebuilt, since they extend the bounds.
    if (report.loaded.length && !cameraTouched && (restored || (state.view === pack.defaultView && !state.selected))) setView(state.view, false);
    for (const warning of report.warnings) console.warn(warning);
  });
  hideLoading(!!(report.fallback.length || muscleReport?.fallback.length || exteriorReport?.fallback.length));
}, () => hideLoading(true));
function hideLoading(failed = false) {
  if (disposed) return;
  const el = app.querySelector<HTMLElement>("#loading");
  if (!el) return;
  const finish=()=>{
    if(!failed){el.classList.add('determinate');el.style.setProperty('--progress','100%');el.querySelector('p')!.textContent='Loading models… 100%';}
    scope.timeout(()=>{el.classList.add('done');scope.timeout(()=>el.remove(),400);},failed?0:150);
  };
  if(failed){el.querySelector('p')!.textContent=pack.assetFailureMessage ?? "Some models couldn't load — showing simplified shapes.";el.classList.add('load-failed');scope.timeout(finish,2500);}else finish();
}

viewerDiagnostics.activeViewers++;
const openingSelection = resolveStructureId(pack, initialSelection) ?? restored?.selected;
if (openingSelection) select(openingSelection);
return {
  ready: initialLoad,
  select(id: string | null) { if (!disposed) select(id); },
  captureSession(): ViewerSession {
    return {
      regionIds: pack.regionIds ?? [pack.id], selectedAliases: selectionAliases(pack, state.selected),
      layers: [...state.layers], atlasTypes: [...state.atlasTypes],
      atlasRegion: !pack.regionIds && state.atlasRegion !== 'all' ? pack.id + ':' + state.atlasRegion : state.atlasRegion,
      search: $<HTMLInputElement>('#search').value, onlyVisible: state.onlyVisible,
      opacity: state.opacity, skinOpacity: state.skinOpacity, neurovascularOpacity: state.neurovascularOpacity,
      labels: state.labels, highlightConnections: state.highlightConnections,
      view: state.view, viewDirection: pack.viewPresets.find(view => view.id === state.view)?.direction,
      overview: state.view === pack.defaultView,
    };
  },
  dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameRequest);
    scope.dispose();
    worker.dispose();
    resizeObserver.disconnect();
    slowFrames.reset();
    controls.dispose();
    window.clearTimeout(hoverTimer);
    labelNodes.length = 0;
    seenPoints.clear();
    $("#label-layer").replaceChildren();
    disposeObject(scene);
    key.shadow.dispose();
    for (const pass of composer.passes) pass.dispose();
    composer.dispose();
    renderer.renderLists.dispose();
    viewerDiagnostics.lastDisposedGeometries = renderer.info.memory.geometries;
    renderer.dispose();
    renderer.forceContextLoss();
    viewerDiagnostics.geometries = viewerDiagnostics.lastDisposedGeometries;
    viewerDiagnostics.activeViewers--;
    for (const node of [app, ...app.querySelectorAll<HTMLElement>('*')]) {
      for (const key in node) if (key.startsWith('on') && typeof (node as any)[key] === 'function') (node as any)[key] = null;
    }
    app.replaceChildren();
  },
};
}

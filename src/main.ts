import { version } from '../package.json';
import { labelTier, tierForZoom } from './labels';
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { TAARenderPass } from "three/addons/postprocessing/TAARenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { atlasTabs, atlasIds } from "./atlas";
import { applyCoverage } from "./appearance";
import { attachmentSources } from './attachments';
import { connectionsFor, directlyAttachedIds, connectionHighlightIds, footprintDecal, connectionCameraPose, connectionOccluders, connectionClinicalPoints, type Connection } from './connections';
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
import { structures, byId, tissueNames, colors, type Tissue } from "./data";
import { createAnkle } from "./ankle";
import { loadBoneAssets, loadMuscleAssets, loadExteriorAssets } from "./assets";
import { rebuildSoftTissues } from "./softTissues";
import { createCompass } from "./compass";
import { relatedIds } from "./foot";

import { cameraPreset, legacyPointToMm } from "./coordinates";

const brandMark = '<svg class="brand-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 2c3-1 5 1 4 4l-2 5c-1 2 0 4-2 6-2 2-6 1-6-2 0-2 2-4 3-6s0-6 3-7Z"/><path d="m9 9 5 2"/></svg>';
const icon = {
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
  pan: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13M6 3.5l2-2 2 2M6 12.5l2 2 2-2M3.5 6l-2 2 2 2M12.5 6l2 2-2 2"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
  minus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
  home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h8V6.5"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
};
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar">
  <div class="brand">${brandMark}<span class="title">Foot &amp; Ankle Explorer</span><span class="brand-subtitle">Interactive anatomy</span></div>
  <div class="segmented modes" aria-label="Tissue presets"><button data-mode="exterior">${brandMark}Exterior</button><button data-mode="anatomy" class="active"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13C3 4 13 2 13 3c0 9-9 11-10 10ZM4 12l8-8"/></svg>Anatomy</button><button data-mode="skeleton"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2a2 2 0 0 0-3 3l3 1 5 5 1 3a2 2 0 0 0 3-3l-3-1-5-5Z"/></svg>Skeleton</button></div>
  <nav class="topbar-actions" aria-label="Explorer actions"><details class="actions-menu" open><summary aria-label="More actions" title="More actions">⋯</summary><div class="action-items"><button id="labels" class="tool-button" aria-pressed="true" title="Toggle labels (L)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h9l3 5-3 5H2Z"/><circle cx="10" cy="8" r="1"/></svg>Labels</button><button id="reset" class="tool-button" title="Reset (R)" aria-label="Reset"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6a5 5 0 1 1 0 5M3 2v4h4"/></svg></button><button id="about" class="tool-button" title="About Foot &amp; Ankle Explorer" aria-label="About"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.2"/></svg></button></div></details></nav>
</header>
<main>
<aside class="panel atlas" aria-label="Structures">
  <div class="atlas-head">
    <label class="search">${icon.search}<input id="search" placeholder="Search ${structures.length} structures" aria-label="Find a structure" type="search"/></label>
    <div id="type-filters" class="type-filters" aria-label="Structure types"></div>
    <label class="area-filter" for="atlas-area">Area<select id="atlas-area">${atlasTabs.slice(0,4).map(([id,label]) => `<option value="${id}">${id === 'all' ? 'All areas' : label}</option>`).join('')}<optgroup label="Toes">${atlasTabs.slice(4).map(([id,label]) => `<option value="${id}">${label}</option>`).join('')}</optgroup></select></label>
    <label class="visible-filter"><input id="only-visible" type="checkbox"/>Only visible layers</label>
    <div class="filter-status"><span id="list-count"></span><button id="clear-filters" class="link-button" hidden>Clear filters</button></div>
  </div>
  <div id="structure-list" class="atlas-scroll" aria-label="Structure list"></div>
</aside>
<section id="viewport" aria-label="Interactive 3D anatomy model">
  <div id="label-layer"><svg class="label-leaders" aria-hidden="true"></svg></div>
  <div class="compass-wrap"><div id="compass" role="group" aria-label="Anatomical view compass"></div><span id="view-name">ANTERIOR VIEW</span></div>
  <div class="view-controls segmented" aria-label="Camera views"><button data-view="foot" class="active">Overview</button><button data-view="dorsal">Dorsal</button><button data-view="plantar">Plantar</button><button data-view="medial">Medial</button><button data-view="lateral">Lateral</button></div>
  <div class="canvas-tools"><button id="pan" aria-pressed="false" aria-label="Pan mode" title="Pan mode (P). Right-drag or Shift-drag also pans.">${icon.pan}</button><button id="zoom-in" aria-label="Zoom in" title="Zoom in">${icon.plus}</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">${icon.minus}</button><button id="home" aria-label="Reset camera" title="Reset camera">${icon.home}</button></div>
  <div id="render-error" hidden></div>
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
    <div class="slider-row"><label for="skin-opacity">Skin</label><input id="skin-opacity" type="range" min="0" max="100" value="100"/><output id="skin-opacity-value">100%</output></div>
    <p id="layer-hint" class="layer-hint"></p>
  </section>
</aside>
</main>
<dialog id="about-dialog" aria-labelledby="about-title"><button class="dialog-close icon-button" aria-label="Close model information">${icon.close}</button><h2 id="about-title">Foot &amp; Ankle Explorer</h2>
<div class="about-tabs" role="tablist" aria-label="About sections">${[['overview','Overview'],['controls','Controls'],['sources','Sources & credits']].map(([id,name])=>`<button id="about-tab-${id}" role="tab" data-about-tab="${id}" aria-controls="about-panel-${id}" aria-selected="${id==='overview'}" tabindex="${id==='overview'?0:-1}">${name}</button>`).join('')}</div>
<section id="about-panel-overview" role="tabpanel" data-about-panel="overview" aria-labelledby="about-tab-overview">
<p>Explore the right foot and ankle with selectable Z-Anatomy bones and muscle bellies. Zoom to reveal more labels, filter the grouped structure list by tissue or area, and resize or expand the details panel for a closer look at muscle anatomy and attachments.</p>
<p class="stats">${structures.filter(s=>s.tissue==='bone').length} bones · ${structures.filter(s=>s.tissue==='muscle').length} muscles · ${structures.filter(s=>s.tissue==='tendon'||s.tissue==='ligament').length} tendons &amp; ligaments · ${structures.length} structures</p>
<p>This is a simplified study model, not a clinical reference. Attachment footprint extents are illustrative surface fits. The model is static and makes no biomechanical predictions. Nerves, vessels, bursae and tendon sheaths are omitted; some ligament bundles are grouped.</p>
<p>The exterior currently uses a fitted illustrative surface. The pinned source contains no skin mesh, so a real-skin replacement is pending. In Exterior, lower the skin opacity to see the skeleton.</p>
</section>
<section id="about-panel-controls" role="tabpanel" data-about-panel="controls" aria-labelledby="about-tab-controls" hidden>
<dl class="shortcuts"><dt>Drag</dt><dd>Orbit the model</dd><dt>Right-drag / Shift-drag</dt><dd>Pan; P toggles pan mode</dd><dt>Scroll / pinch</dt><dd>Zoom; closer views reveal more labels</dd><dt>1–5</dt><dd>Overview, dorsal, plantar, medial, lateral</dd><dt>F</dt><dd>Focus selection</dd><dt>L</dt><dd>Toggle labels</dd><dt>R</dt><dd>Reset model, layers and filters</dd><dt>Esc</dt><dd>Restore surroundings and clear selection</dd><dt>Canvas arrows</dt><dd>Pan when the canvas has focus</dd><dt>List ↑ / ↓ / Enter</dt><dd>Move between visible rows and select</dd><dt>Inspector edge</dt><dd>Drag to resize; focus it and use ← / → for 24px steps</dd><dt>Inspector ↔</dt><dd>Expand to 640px or restore your saved width</dd><dt>Attachment card</dt><dd>Zoom to its footprint; select again to return</dd></dl>
</section>
<section id="about-panel-sources" role="tabpanel" data-about-panel="sources" aria-labelledby="about-tab-sources" hidden><h3>Credits</h3><p>Z-Anatomy — The libre 3D atlas of anatomy, Gauthier Kervyn, CC BY-SA 4.0. BodyParts3D — The Database Center for Life Science, original model Kousaku Okubo, CC BY-SA 2.1 Japan. Adaptations: right-side extraction, separated sesamoids, muscle/tendon material separation, capped bellies, local topology repair, surface cleanup/subdivision, decimation, frame registration and GLB export.</p><ul class="link-list"><li><a href="https://github.com/Z-Anatomy/Models-of-human-anatomy/tree/b722f392d2b09d21f0527229fe1338f27a3bc04e" target="_blank" rel="noreferrer">Pinned Z-Anatomy source</a></li><li><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Adapted bone and muscle assets · CC BY-SA 4.0</a></li><li><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">BodyParts3D source</a></li><li><a href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noreferrer">BodyParts3D · CC BY-SA 2.1 Japan</a></li></ul><h3>Reading</h3><ul class="link-list"><li><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb" target="_blank" rel="noreferrer">OpenStax · Bones of the lower limb</a></li><li><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs" target="_blank" rel="noreferrer">OpenStax · Muscles of the lower limb</a></li><li><a href="https://www.ncbi.nlm.nih.gov/books/NBK545158/" target="_blank" rel="noreferrer">NCBI · Ankle joint and ligaments</a></li><li><a href="https://www.ncbi.nlm.nih.gov/books/NBK539705/" target="_blank" rel="noreferrer">NCBI · Foot muscles and tendon paths</a></li></ul></section>
<footer class="about-footer">Version ${version} · Updated October 2026</footer></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const compactActions=matchMedia('(max-width:699px)');
function syncActionsMenu(){document.querySelector<HTMLDetailsElement>('.actions-menu')!.open=!compactActions.matches;}
compactActions.addEventListener('change',syncActionsMenu);syncActionsMenu();
const tissueKeys: Tissue[] = [
  "skin",
  "bone",
  "muscle",
  "tendon",
  "ligament",
  "fascia",
  "cartilage",
];
const state = {
  selected: null as string | null,
  hovered: null as string | null,
  layers: new Set<Tissue>(tissueKeys.filter(t => t !== "skin")),
  atlasRegion: "all",
  atlasTypes: new Set<Tissue>(tissueKeys.filter(t => t !== "cartilage")),
  onlyVisible: false,
  skinOpacity: 1,
  opacity: 1,
  labels: true,
  isolated: false,
  connections: false,
  highlightConnections: false,
  attachmentFade: false,
  focusedConnection: null as string | null,
  pan: false,
  footView: false,

  mode: "anatomy",
  view: "anterior",
};

const atlasOrder: Tissue[] = ['bone','muscle','tendon','ligament','fascia','cartilage','skin'];
const atlasNames = {...tissueNames, skin: 'Skin', fascia: 'Fascia'};
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
  document.querySelectorAll<HTMLButtonElement>('[data-atlas-type]').forEach(b=>b.onclick=()=>{const t=b.dataset.atlasType as Tissue;state.atlasTypes.has(t)?state.atlasTypes.delete(t):state.atlasTypes.add(t);renderList();});
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
    section.addEventListener('toggle',()=>{if(q)return;section.open?collapsedTissues.delete(tissue):collapsedTissues.add(tissue);try{localStorage.setItem('atlas-collapsed',JSON.stringify([...collapsedTissues]));}catch{}});
    for(const group of [...new Set(members.map(d=>d.group))].sort()) {
      const grouped=members.filter(d=>d.group===group).sort((a,b)=>a.name.localeCompare(b.name));
      const heading=document.createElement('h3');heading.innerHTML=`${marked(group,q)} <span>${grouped.length}</span>`;section.append(heading);
      for(const d of grouped){const row=document.createElement('button');row.className='structure-row';row.dataset.id=d.id;row.innerHTML=`<i style="background:${colors[d.tissue]}"></i><span>${marked(d.name,q)}${q && !d.name.toLowerCase().includes(q) && d.description.toLowerCase().includes(q) ? `<small>${marked(d.description,q)}</small>` : ''}</span>`;row.onclick=()=>select(d.id);section.append(row);}
    }
    container.append(section);
  }
  if(!items.length)container.innerHTML='<p class="empty">No matches. Try “talus” or clear the filters.</p>';
  updateRows();
  if(focusedRow)document.querySelector<HTMLButtonElement>(`.structure-row[data-id="${focusedRow}"]`)?.focus({preventScroll:true});
}
let lastScrolledSelection: string | null = null;
function updateRows() {
  const highlighted=selectedConnectionHighlights();
  document.querySelectorAll<HTMLButtonElement>('.structure-row').forEach(b=>{
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
  const rows=[...document.querySelectorAll<HTMLButtonElement>('.tissue-section[open] .structure-row')];
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
    const articulations = d.tissue === 'bone' ? [...relatedIds(d.id)].filter(id=>byId[id].tissue==='bone').map(id=>byId[id].name) : d.articulations;
    const facts = [['Origin',d.origin],['Insertion',d.insertion],['Action',d.action],['Innervation',d.innervation],['Blood supply',d.bloodSupply],['Articulations',articulations?.join(', ')]];
    const quickFacts = facts.filter(([,value])=>value).map(([name,value])=>`<dt>${name}</dt><dd>${escapeHtml(value!)}</dd>`).join('');
    $("#details").innerHTML =
      `<div class="structure-tag"><i style="background:${colors[d.tissue]}"></i>${d.region} · ${d.tissue}</div><h2>${d.name}</h2><p class="group-name">${d.group}</p><div class="selection-tools"><button id="focus-selected" class="button" title="Frame this structure (F)">Focus</button><button id="isolate" class="button" aria-pressed="${state.isolated}" title="Show only this structure">Isolate</button><button id="show-connections" class="button" aria-pressed="${state.connections}" title="Show only adjacent and attached structures">Neighbors</button></div><div class="inspector-content">${quickFacts ? `<section class="quick-facts"><h3>Quick facts</h3><dl>${quickFacts}</dl></section>` : ''}<section class="structure-description"><h3>Description</h3><p>${escapeHtml(d.description)}</p><h3>Function</h3><p>${escapeHtml(d.role)}</p></section></div>`;
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
      section.open = true;
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
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 10, 10000);
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  $("#render-error").hidden = false;
  $("#render-error").textContent =
    "3D graphics could not start. Enable WebGL or try another browser.";
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
viewport.prepend(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute(
  "aria-label",
  "3D foot and ankle model. Drag to rotate, scroll to zoom, or select structures in the atlas.",
);
camera.position.copy(legacyPointToMm(0.25, 6.1, 23));
const controls = createCameraControls(camera, renderer.domElement);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function applyMotionPreference() {
  controls.smoothTime = reducedMotion.matches ? 0.01 : 0.25;
  controls.draggingSmoothTime = reducedMotion.matches ? 0.01 : 0.125;
}
applyMotionPreference();
reducedMotion.addEventListener("change", applyMotionPreference);
// Capture applies Shift-pan before camera-controls reads the pointer mapping.
renderer.domElement.addEventListener(
  "pointerdown",
  (e) => {
    controls.mouseButtons.left =
      state.pan || e.shiftKey || e.ctrlKey || e.metaKey
        ? CameraControls.ACTION.TRUCK
        : CameraControls.ACTION.ROTATE;
  },
  { capture: true },
);
renderer.domElement.addEventListener("keydown", (e) => {
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
scene.add(new THREE.HemisphereLight("#fff7e8", "#9d8d7b", 2.3));
const key = new THREE.DirectionalLight("#fff2db", 3.4);
key.position.copy(legacyPointToMm(-4, 12, 7));
key.target.position.copy(legacyPointToMm(0, 0, 0));
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
fill.position.copy(legacyPointToMm(5, 6, -4));
fill.target.position.copy(legacyPointToMm(0, 0, 0));
scene.add(fill.target);
scene.add(fill);
controls.minPolarAngle = 0.001;
controls.maxPolarAngle = Math.PI - 0.001;
const updateCompass = createCompass($("#compass"), (view) => setView(view));
const composer = new EffectComposer(renderer);
const taa = new TAARenderPass(scene, camera);
taa.sampleLevel=2;
composer.addPass(taa);composer.addPass(new OutputPass());
let appearanceDirty=true;
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
    mesh.material.color.set(active ? '#ffac39' : '#21bda8');
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
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === saved.view);
      b.setAttribute("aria-pressed", String(b.dataset.view === saved.view));
    });
  }
  const scroll = $("#details").scrollTop;
  renderDetails();
  $("#details").scrollTop = scroll;
  document.querySelector<HTMLButtonElement>(`[data-connection="${connection.key}"]`)?.focus({ preventScroll: true });
  updateAppearance();
}
function focusConnection(connection: Connection) {
  if (!state.focusedConnection) preFocusView = {
    position: camera.position.clone(),
    target: controls.getTarget(new THREE.Vector3(), false),
    label: $("#view-name").textContent ?? "",
    view: document.querySelector<HTMLButtonElement>("[data-view].active")?.dataset.view,
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
  document.querySelectorAll('[data-view]').forEach(b => {b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');});
  const scroll = $("#details").scrollTop;
  renderDetails();
  $("#details").scrollTop = scroll;
  if (keepKeyboardFocus) document.querySelector<HTMLButtonElement>(`[data-connection="${connection.key}"]`)?.focus({ preventScroll: true });
  updateAppearance();
}

let cameraTouched = false;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20000, 20000),
  new THREE.ShadowMaterial({ color: "#6e583e", opacity: 0.12 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.copy(legacyPointToMm(0, 0.06, 0));
floor.receiveShadow = true;
scene.add(floor);
let overviewDistance=1000;
let maxTier: 1 | 2 | 3 = 1;
function setView(view: string, animate = true) {
  clearConnectionFocus();
  updateAppearance();
  renderDetails();
  state.footView = true;
  state.view = view;
  applyMotionPreference();
  const { target, position: p } = cameraPreset(view, camera.aspect);
  // Full source shafts extend beyond the procedural distal-leg overview.
  // Fit the imported overview while keeping the regional view shortcuts intact.
  if (view === "foot" && [...leg.parts.values()].some(part => part.meshes.some(mesh => mesh.userData.source === "z-anatomy"))) {
    const bounds = new THREE.Box3().setFromObject(leg.root);
    const direction = p.clone().sub(target).normalize();
    bounds.getCenter(target);
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2),
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const distance = bounds.getSize(new THREE.Vector3()).length() / 2 / Math.sin(halfFov) * 1.2;
    p.copy(target).addScaledVector(direction, distance);
  }
  if(view === "foot") overviewDistance=p.distanceTo(target);
  void lookAtNearest(controls, p, target, animate && !reducedMotion.matches);
  buildLabels();
  $("#view-name").textContent =
    view === "foot" ? "OBLIQUE OVERVIEW" : `${view.toUpperCase()} VIEW`;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  });
}
controls.addEventListener("controlstart", () => {
  cameraTouched = true;
  $("#view-name").textContent = "FREE CAMERA";
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
});
function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w,h);
  appearanceDirty=true;
  camera.aspect = w / h;
  // On wide layouts the inspector floats over the canvas; centre the model in the free area.
  const covered = innerWidth > 900 ? $(".inspector").offsetWidth + parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap") || "12") : 0;
  setInspectorInset(camera, w, h, covered);
  $('.compass-wrap').classList.toggle('compass--raised',innerWidth>900 && w-covered<530);
}
new ResizeObserver(resize).observe(viewport);
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
function focusParts(ids: string[], foot = false) {
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
      bounds.union(mesh.geometry.boundingBox!);
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
  const direction = foot
    ? new THREE.Vector3(1.8, 1.5, 0.8).normalize()
    : camera.position
        .clone()
        .sub(controls.getTarget(new THREE.Vector3(), false))
        .normalize();
  const destination = center.clone().addScaledVector(direction, distance);
  controls.smoothTime = reducedMotion.matches ? 0.01 : 0.28;
  void lookAtNearest(controls, destination, center, !reducedMotion.matches);
  state.footView = foot || ids.every((id) => byId[id]?.region === "Foot");
  $("#view-name").textContent = foot ? "FOOT & ANKLE" : "STRUCTURE CLOSE-UP";
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    const active = foot && b.dataset.view === "foot";
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  buildLabels();
}
function focusFoot() {
  select(null);
  setView("foot");
  state.atlasRegion = "all";
  $<HTMLInputElement>("#search").value = "";
  renderList();
}
$("#pan").onclick = () => setPan(!state.pan);
function select(id: string | null, revealLayer = true) {
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
  appearanceDirty=true;
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
      ((state.attachmentFade && d.tissue !== "skin") || highlighted.has(id) || state.layers.has(d.tissue)) &&
      (!state.isolated || selected) &&
      (!state.connections || selected || highlighted.has(id) || related.has(id));
    for (const mesh of part.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.userData.connectionBaseColor ??= mat.color.clone();
      mat.color.copy(mat.userData.connectionBaseColor);
      if (highlighted.has(id) && !selected) mat.color.set("#64c6b2");
      const tissueOpacity = d.tissue === "muscle" ? state.opacity : d.tissue === "skin" ? state.skinOpacity : 1;
      let alpha = tissueOpacity;
      if (state.attachmentFade) alpha = attached.has(id) ? 1 : Math.min(alpha, 0.07);
      else if (state.selected && !selected && !state.isolated && !state.connections)
        alpha = Math.min(alpha, state.highlightConnections ? 0.12 : 0.5);
      if (highlighted.has(id) && !selected) alpha = 1;
      if (cutAwayIds.has(id)) alpha = Math.min(alpha, 0.025);
      if (selected) alpha = tissueOpacity;
      if (!mesh.userData.fiber) part.group.userData.alpha = alpha;
      if (mesh.userData.fiber) alpha *= 0.22;
      applyCoverage(mesh, alpha);
      mesh.visible = alpha > 0;
      mat.emissive.set(selected ? "#623d17" : highlighted.has(id) ? "#218d7c" : "#000000");
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
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === state.mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("#labels").classList.toggle("active", state.labels);
  $("#labels").setAttribute("aria-pressed", String(state.labels));
  buildLabels();
}
function preset(mode: string) {
  clearConnectionFocus();
  state.attachmentFade = false;
  state.mode = mode;
  if(mode === "exterior"){state.skinOpacity=1;$<HTMLInputElement>("#skin-opacity").value="100";$("#skin-opacity-value").textContent="100%";}
  state.selected = null;
  state.isolated = false;
  state.connections = false;
  state.layers = new Set<Tissue>(
    mode === "exterior" ? ["skin", "bone"] : mode === "skeleton"
      ? ["bone", "cartilage"]
      : tissueKeys.filter(t => t !== "skin"),
  );
  renderList();
  renderDetails();
  $("#details").scrollTop = 0;
  updateAppearance();
}
document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) => (b.onclick = () => preset(b.dataset.mode!)));
document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
$("#search").addEventListener("input", renderList);
$("#clear").onclick = () => select(null);
$("#highlight-connections").onclick = () => {
  state.highlightConnections = !state.highlightConnections;
  updateAppearance();
};
$("#labels").onclick = () => {
  state.labels = !state.labels;
  updateAppearance();
};
$("#all-layers").onclick = () => { preset("anatomy");state.layers.add("skin");state.mode="custom";updateAppearance(); };
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
$("#home").onclick = () => setView("foot");
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

  state.skinOpacity = 1;
  $<HTMLInputElement>("#skin-opacity").value="100";
  $("#skin-opacity-value").textContent="100%";
  state.opacity = 1;
  state.labels = true;
  $<HTMLInputElement>("#opacity").value = "100";
  $("#opacity-value").textContent = "100%";
  $<HTMLInputElement>("#search").value = "";
  renderList();
  preset("anatomy");
  setView("foot");

}
$("#reset").onclick = reset;
const dialog = $<HTMLDialogElement>("#about-dialog");
$("#about").onclick = () => dialog.showModal();
function showAboutTab(id: string){document.querySelectorAll<HTMLButtonElement>('[data-about-tab]').forEach(tab=>{const active=tab.dataset.aboutTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});document.querySelectorAll<HTMLElement>('[data-about-panel]').forEach(panel=>panel.hidden=panel.dataset.aboutPanel!==id);}
const aboutTabs=[...document.querySelectorAll<HTMLButtonElement>('[data-about-tab]')];
aboutTabs.forEach((tab,index)=>{tab.onclick=()=>showAboutTab(tab.dataset.aboutTab!);tab.onkeydown=e=>{const next=e.key==='ArrowRight'?(index+1)%aboutTabs.length:e.key==='ArrowLeft'?(index+aboutTabs.length-1)%aboutTabs.length:e.key==='Home'?0:e.key==='End'?aboutTabs.length-1:-1;if(next>=0){e.preventDefault();aboutTabs[next].click();aboutTabs[next].focus();}};});
$(".dialog-close").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
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
  // Match click selection: the selected solid structure takes priority over ghosted tissue.
  const chosen =
    hits.find((h) => h.object.userData.id === state.selected) ?? hits[0];
  return chosen?.object.userData.id ?? null;
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
  hoverTimer = window.setTimeout(
    () => setHovered(id),
    reducedMotion.matches ? 0 : id ? 60 : 90,
  );
}
let down = { x: 0, y: 0, picking: false, moved: false };
let hoverPointer: { x: number; y: number } | null = null;
const pointers = new Set<number>();
renderer.domElement.addEventListener("pointerdown", (e) => {
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
renderer.domElement.addEventListener("pointermove", (e) => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
  if (e.pointerType === "touch" || e.buttons || pointers.size) return;
  hoverPointer = { x: e.clientX, y: e.clientY };
  requestHovered(pickStructure(e.clientX, e.clientY, true));
});
renderer.domElement.addEventListener("pointerleave", () => {
  hoverPointer = null;
  setHovered(null);
});
renderer.domElement.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  down.picking = false;
  hoverPointer = null;
  setHovered(null);
});
renderer.domElement.addEventListener("pointerup", (e) => {
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
};
const labelNodes: LabelNode[] = [];
function buildLabels() {
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
    label.node.inert = true;
    next.push(label);
  }
  labelNodes.splice(0, labelNodes.length, ...next);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialog.open) {
    select(null);

    return;
  }
  if (
    (e.target as HTMLElement).matches("input,button,select,textarea") ||
    dialog.open
  )
    return;
  const k = e.key.toLowerCase();
  if (k === "1") focusFoot();
  if (k === "2") setView("dorsal");
  if (k === "3") setView("plantar");
  if (k === "4") setView("medial");
  if (k === "5") setView("lateral");
  if (k === "p") setPan(!state.pan);
  if (k === "f" && state.selected) focusParts(state.highlightConnections && !state.isolated ? [...selectedConnectionHighlights()] : [state.selected]);
  if (k === "l") $("#labels").click();
  if (k === "r") reset();

});
renderList();
renderDetails();
updateAppearance();
resize();
setView("foot", false);
let lastTime = 0;
function frame(time: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (document.hidden) return;
  const cameraChanged = updateCamera(controls, camera, dt);
  const nextTier=tierForZoom(controls.distance/overviewDistance);
  if(nextTier!==maxTier){maxTier=nextTier;buildLabels();}
  viewport.dataset.labelTier=String(maxTier);
  if (cameraChanged && hoverPointer)
    requestHovered(pickStructure(hoverPointer.x, hoverPointer.y, true));
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
  taa.accumulate=!cameraChanged && !appearanceDirty;
  composer.render();
  appearanceDirty=false;
  updateCompass(camera.quaternion);
  const occupied: {x:number;y:number;w:number;h:number}[]=[];
  const labelInset=innerWidth>900?$('.inspector').offsetWidth+12:0;
  const freeWidth=Math.max(100,viewport.clientWidth-labelInset), height=viewport.clientHeight;
  const leaders=$<HTMLElement>('.label-leaders');leaders.setAttribute('viewBox',`0 0 ${viewport.clientWidth} ${height}`);leaders.replaceChildren();
  for(let i=labelNodes.length-1;i>=0;i--){const label=labelNodes[i];if(label.retiringAt!==undefined&&time>=label.retiringAt){label.node.remove();labelNodes.splice(i,1);}}
  const projected=labelNodes.filter(l=>l.retiringAt===undefined).map(label=>{
    const p=leg.parts.get(label.id)!.anchor.clone().project(camera);
    return {label,p,ax:(p.x*.5+.5)*viewport.clientWidth,ay:(-p.y*.5+.5)*height};
  }).sort((a,b)=>{
    const priority=(id:string)=>id===state.selected?-2:id===state.hovered?-1:labelTier[id]??3;
    return priority(a.label.id)-priority(b.label.id)||Math.hypot(a.ax-freeWidth/2,a.ay-height/2)-Math.hypot(b.ax-freeWidth/2,b.ay-height/2);
  });
  for(const {label,p,ax,ay} of projected){
    const {id,node}=label,part=leg.parts.get(id)!;
    const important=id===state.selected||id===state.hovered;
    const w=node.offsetWidth,h=node.offsetHeight,side=ax>=freeWidth/2?1:-1;
    const x=THREE.MathUtils.clamp(ax+side*(w/2+20),w/2+8,Math.max(w/2+8,freeWidth-w/2-8));
    const y=THREE.MathUtils.clamp(ay+(ay-height/2)*.08,h/2+10,height-h/2-65);
    const overlap=occupied.some(q=>Math.abs(q.x-x)<(q.w+w)/2+6&&Math.abs(q.y-y)<(q.h+h)/2+5);
    const shown=part.group.visible&&(part.group.userData.alpha??1)>=.5&&p.z>=-1&&p.z<=1&&ax>=0&&ax<=freeWidth&&ay>=0&&ay<=height&&(important||!overlap);
    node.style.left=`${x}px`;node.style.top=`${y}px`;node.classList.toggle('shown',shown);node.inert=!shown;
    if(!shown)continue;
    occupied.push({x,y,w,h});
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String(ax));line.setAttribute('y1',String(ay));line.setAttribute('x2',String(THREE.MathUtils.clamp(ax,x-w/2,x+w/2)));line.setAttribute('y2',String(THREE.MathUtils.clamp(ay,y-h/2,y+h/2)));leaders.append(line);
  }
}
requestAnimationFrame(frame);


// Start after controls, state and labels exist, so late loads preserve user interaction.
viewport.dataset.boneAssets = "loading";
viewport.dataset.softTissues = "loading";
const loadingBytes=Array.from({length:3},()=>({loaded:0,total:0}));
const modelProgress=(index:number)=>(loaded:number,total:number)=>{
  loadingBytes[index]={loaded,total};const el=document.getElementById('loading');if(!el)return;
  const known=loadingBytes.every(p=>p.total>0);el.classList.toggle('determinate',known);
  if(known){const percent=Math.min(100,Math.round(loadingBytes.reduce((n,p)=>n+p.loaded,0)/loadingBytes.reduce((n,p)=>n+p.total,0)*100));el.style.setProperty('--progress',`${percent}%`);el.querySelector('p')!.textContent=`Loading models… ${percent}%`;}
};
void Promise.all([loadBoneAssets(leg.parts,undefined,undefined,modelProgress(0)), loadMuscleAssets(leg.parts,undefined,undefined,modelProgress(1)), loadExteriorAssets(leg.parts,modelProgress(2))]).then(([report, muscles, exterior]) => {
  viewport.dataset.exteriorAssets = exterior.fallback.length ? "fallback" : "ready";
  const soft = rebuildSoftTissues(leg.parts);
  footprintSelection = undefined;
  cutAwayIds.clear();
  viewport.dataset.softTissues = soft.warnings.length ? "partial" : "ready";
  viewport.dataset.loadedMuscles = String(muscles.loaded.length + Number(exterior.loaded.includes("gastrocnemius")));
  viewport.dataset.cartilagePatches = String(soft.cartilagePatches);
  for (const warning of [...muscles.warnings, ...exterior.warnings, ...soft.warnings]) console.warn(warning);
  viewport.dataset.boneAssets = report.fallback.length ? "fallback" : "ready";
  viewport.dataset.loadedBones = String(report.loaded.length);
  if (report.loaded.length && state.view === "foot" && !state.selected && !cameraTouched) setView("foot", false);
  for (const warning of report.warnings) console.warn(warning);
  const focused = activeConnection();
  if (focused) focusConnection(focused);
  else renderDetails();
  updateAppearance();
  buildLabels();
  if (hoverPointer) requestHovered(pickStructure(hoverPointer.x, hoverPointer.y, true));
  hideLoading(!!(report.fallback.length || muscles.fallback.length || exterior.fallback.length));
}, () => hideLoading(true));
function hideLoading(failed = false) {
  const el = document.getElementById("loading");
  if (!el) return;
  const finish=()=>{el.classList.add('done');window.setTimeout(()=>el.remove(),400);};
  if(failed){el.querySelector('p')!.textContent="Some models couldn't load — showing simplified shapes.";el.classList.add('load-failed');window.setTimeout(finish,2500);}else finish();
}

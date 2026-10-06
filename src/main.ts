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
} from "./camera";
import { structures, byId, tissueNames, colors, type Tissue } from "./data";
import { createAnkle } from "./ankle";
import { loadBoneAssets, loadMuscleAssets, loadExteriorAssets } from "./assets";
import { rebuildSoftTissues } from "./softTissues";
import { createCompass } from "./compass";
import { relatedIds } from "./foot";

import { cameraPreset, legacyPointToMm } from "./coordinates";

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
  <span class="title">Foot &amp; Ankle</span>
  <div class="segmented modes" aria-label="Tissue presets"><button data-mode="exterior">Exterior</button><button data-mode="anatomy" class="active">Anatomy</button><button data-mode="skeleton">Skeleton</button><button data-mode="connective">Connective</button></div>
  <nav class="topbar-actions"><button id="labels" class="tool-button" aria-pressed="false">Labels</button><button id="tour" class="tool-button">Tour</button><button id="reset" class="tool-button">Reset</button><button id="about" class="tool-button">About</button></nav>
</header>
<main>
<aside class="panel atlas" aria-label="Structures">
  <div class="atlas-head">
    <label class="search">${icon.search}<input id="search" placeholder="Search ${structures.length} structures" aria-label="Find a structure" type="search"/></label>
    <div id="atlas-tabs" role="tablist" aria-label="Anatomical regions">${atlasTabs.map(([id,label]) => `<button id="tab-${id}" role="tab" aria-controls="structure-list" data-region="${id}" aria-selected="${id === 'all'}">${label}</button>`).join('')}</div>
  </div>
  <div id="structure-list" class="atlas-scroll" role="tabpanel" aria-labelledby="tab-all"></div>
</aside>
<section id="viewport" aria-label="Interactive 3D anatomy model">
  <div id="label-layer"></div>
  <div class="compass-wrap"><div id="compass" role="group" aria-label="Anatomical view compass"></div><span id="view-name">ANTERIOR VIEW</span></div>
  <div class="view-controls segmented" aria-label="Camera views"><button data-view="foot" class="active">Overview</button><button data-view="dorsal">Dorsal</button><button data-view="plantar">Plantar</button><button data-view="medial">Medial</button><button data-view="lateral">Lateral</button></div>
  <div class="canvas-tools"><button id="pan" aria-pressed="false" aria-label="Pan mode" title="Pan mode (P). Right-drag or Shift-drag also pans.">${icon.pan}</button><button id="zoom-in" aria-label="Zoom in" title="Zoom in">${icon.plus}</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">${icon.minus}</button><button id="home" aria-label="Reset camera" title="Reset camera">${icon.home}</button></div>
  <div id="tour-card" hidden><div class="tour-head"><span id="tour-step"></span><button id="tour-close" class="icon-button" aria-label="Exit guided tour">${icon.close}</button></div><h3 id="tour-title"></h3><p id="tour-text"></p><div class="tour-nav"><button id="tour-prev" class="button">Back</button><button id="tour-next" class="button primary">Next</button></div></div>
  <div id="render-error" hidden></div>
</section>
<aside class="panel inspector" aria-label="Details and layers">
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
<dialog id="about-dialog"><button class="dialog-close icon-button" aria-label="Close model information">${icon.close}</button><h2>About this model</h2><p>A regional model of the right foot and ankle for study. Shapes, proportions and attachment sites are simplified, and it covers major structures rather than a complete atlas.</p><p>Bones and muscle bellies are adapted Z-Anatomy / BodyParts3D meshes, with procedural shapes as a fallback. All 26 foot bones, both hallux sesamoids, the tibia and fibula are individually selectable. Tendons follow named pulley guides; ligaments and retinacula are fitted bands; cartilage is a thin offset patch at modeled synovial joints. The skin is an illustrative envelope, not a scan. Nerves, vessels, bursae and tendon sheaths are omitted, and some ligament bundles are grouped.</p><p>Attachment footprint extents and positions are illustrative surface fits, not measured anatomy. Guide points, junction seams, cartilage surface masks and thicknesses, and the skin envelope are likewise illustrative. The model is static and makes no biomechanical predictions.</p><h3>Controls</h3><dl class="shortcuts"><dt>Drag</dt><dd>Orbit</dd><dt>Right-drag, Shift-drag</dt><dd>Pan (or toggle pan mode with P)</dd><dt>Scroll, pinch</dt><dd>Zoom</dd><dt>1 2 3 4 5</dt><dd>Overview, dorsal, plantar, medial, lateral</dd><dt>F L R</dt><dd>Focus selection, labels, reset</dd><dt>Arrows</dt><dd>Pan when the canvas has focus</dd><dt>Esc</dt><dd>Restore surroundings and clear selection</dd></dl><h3>Credits</h3><p>Z-Anatomy — The libre 3D atlas of anatomy, Gauthier Kervyn, CC BY-SA 4.0. BodyParts3D — The Database Center for Life Science, original model Kousaku Okubo, CC BY-SA 2.1 Japan. Adaptations: right-side extraction, separated sesamoids, muscle/tendon material separation, capped bellies, local topology repair, surface cleanup/subdivision, decimation, frame registration and GLB export.</p><ul class="link-list"><li><a href="https://github.com/Z-Anatomy/Models-of-human-anatomy/tree/b722f392d2b09d21f0527229fe1338f27a3bc04e" target="_blank" rel="noreferrer">Pinned Z-Anatomy source</a></li><li><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Adapted bone and muscle assets · CC BY-SA 4.0</a></li><li><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">BodyParts3D source</a></li><li><a href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noreferrer">BodyParts3D · CC BY-SA 2.1 Japan</a></li></ul><h3>Reading</h3><ul class="link-list"><li><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb" target="_blank" rel="noreferrer">OpenStax · Bones of the lower limb</a></li><li><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs" target="_blank" rel="noreferrer">OpenStax · Muscles of the lower limb</a></li><li><a href="https://www.ncbi.nlm.nih.gov/books/NBK545158/" target="_blank" rel="noreferrer">NCBI · Ankle joint and ligaments</a></li><li><a href="https://www.ncbi.nlm.nih.gov/books/NBK539705/" target="_blank" rel="noreferrer">NCBI · Foot muscles and tendon paths</a></li></ul></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
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
  skinOpacity: 1,
  opacity: 1,
  labels: false,
  isolated: false,
  connections: false,
  highlightConnections: false,
  ghost: false,
  focusedConnection: null as string | null,
  pan: false,
  footView: false,

  mode: "anatomy",
  view: "anterior",
};

function renderList() {
  const q = $<HTMLInputElement>("#search").value.trim().toLowerCase();
  const container = $("#structure-list");
  container.replaceChildren();
  let count = 0;
  const ids = atlasIds(state.atlasRegion);
  const items = structures.filter(s => ids.has(s.id) && `${s.name} ${s.group} ${s.region}`.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  for (const d of items) {
    const row = document.createElement('button');
    row.className='structure-row';row.dataset.id=d.id;
    row.innerHTML=`<i style="background:${colors[d.tissue]}"></i><span>${d.name}</span>`;
    row.onclick=()=>select(d.id);container.append(row);count++;
  }
  container.setAttribute('aria-labelledby', `tab-${state.atlasRegion}`);
  document.querySelectorAll<HTMLButtonElement>('[data-region]').forEach(b=>{
    const active=b.dataset.region===state.atlasRegion;
    b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
  });
  if (!count) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent =
      "No matches. Try “talus” or “retinaculum”.";
    container.append(p);
  }
  updateRows();
}
function updateRows() {
  const highlighted = selectedConnectionHighlights();
  document
    .querySelectorAll<HTMLButtonElement>(".structure-row")
    .forEach((b) => {
      const selected = b.dataset.id === state.selected;
      b.classList.toggle("selected", selected);
      b.classList.toggle("connected", !selected && highlighted.has(b.dataset.id!));
      b.classList.toggle("hovered", b.dataset.id === state.hovered);
      b.setAttribute("aria-pressed", String(selected));
    });
}
function renderDetails() {
  const d = state.selected ? byId[state.selected] : null;
  $("#clear").style.visibility = d ? "visible" : "hidden";
  if (!d) {
    $("#details").innerHTML =
      `<h2 class="empty-title">Nothing selected</h2><p>Pick a structure from the list or click the model to see its role and attachments.</p><p class="stats">${structures.filter((s) => s.tissue === "bone").length} bones · ${structures.filter((s) => s.tissue === "muscle").length} muscles · ${structures.filter((s) => s.tissue === "tendon" || s.tissue === "ligament").length} tendons &amp; ligaments</p><ul class="hints"><li><b>Drag</b> to orbit</li><li><b>Right-drag</b> to pan</li><li><b>Scroll</b> to zoom</li><li><b>1–5</b> switch views</li></ul>`;
  } else {
    $("#details").innerHTML =
      `<div class="structure-tag"><i style="background:${colors[d.tissue]}"></i>${d.region} · ${d.tissue}</div><h2>${d.name}</h2><p class="group-name">${d.group}</p><div class="selection-tools"><button id="focus-selected" class="button" title="Frame this structure (F)">Focus</button><button id="isolate" class="button" aria-pressed="${state.isolated}" title="Show only this structure">Isolate</button><button id="show-connections" class="button" aria-pressed="${state.connections}" title="Show only adjacent and attached structures">Neighbors</button><button id="ghost-mode" class="button" aria-pressed="${state.ghost}" title="Fade everything except direct attachments">Ghost</button></div><p>${d.description}</p><h3>Function</h3><p>${d.role}</p><h3>Connections</h3><p>${d.connection}</p><p class="anatomy-tip">${d.hint}</p>`;
    $("#isolate").onclick = () => {
      state.isolated = !state.isolated;
      state.connections = false;
      state.ghost = false;
      clearConnectionFocus();
      renderDetails();
      updateAppearance();
    };
    $("#focus-selected").onclick = () => focusParts(state.highlightConnections && !state.isolated ? [...selectedConnectionHighlights()] : [d.id]);
    $("#ghost-mode").onclick = () => {
      state.ghost = !state.ghost;
      state.isolated = false;
      state.connections = false;
      renderDetails();
      updateAppearance();
    };
    const connections = connectionsFor(leg.parts, d.id);
    if (connections.length) {
      const section = document.createElement('section');
      section.className = 'attachment-details';
      section.innerHTML = '<h3>Attachments</h3><p class="footprint-key">Select one to zoom in; select again to return.</p>';
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
      const active = connections.find(c => c.key === state.focusedConnection);
      const clinical = connectionClinicalPoints[active?.record.structureId ?? d.id];
      if (clinical) {
        const aside = document.createElement('aside'); aside.className = 'clinical-point';
        aside.innerHTML = '<h3>Clinical note</h3>';
        const note = document.createElement('p'); note.textContent = clinical.note; aside.append(note);
        const link = document.createElement('a'); link.href = clinical.url; link.textContent = clinical.title;
        link.target = '_blank'; link.rel = 'noreferrer'; aside.append(link); section.prepend(aside);
      }
      $("#details").append(section);
    }
    const related = [...relatedIds(d.id)];
    $<HTMLButtonElement>("#show-connections").disabled = !related.length;
    $("#show-connections").onclick = () => {
      state.connections = !state.connections;
      state.isolated = false;
      state.ghost = false;
      clearConnectionFocus();
      if (state.connections)
        for (const id of related) state.layers.add(byId[id].tissue);
      state.mode = "custom";
      renderDetails();
      updateAppearance();
    };
    if (related.length) {
      const links = document.createElement("div");
      links.className = "connection-links";
      links.innerHTML =
        "<h3>Related structures</h3>";
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
  }
}
for (const tissue of tissueKeys) {
  const label = document.createElement("label");
  label.className = "layer-row";
  label.innerHTML = `<i style="background:${colors[tissue]}"></i><span>${tissueNames[tissue]}</span><input type="checkbox" data-layer="${tissue}" checked/><span class="switch" aria-hidden="true"></span>`;
  label.querySelector("input")!.onchange = (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.ghost = false;
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
  viewport.dataset.ghost = String(state.ghost);
  viewport.dataset.cutaway = [...cutAwayIds].sort().join(',');
}
function toggleConnection(connection: Connection) {
  if (state.focusedConnection !== connection.key) return focusConnection(connection);
  const saved = preFocusView;
  clearConnectionFocus();
  state.ghost = false;
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
  state.ghost = true;
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
  if (covered) camera.setViewOffset(w, h, covered / 2, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
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
document.querySelectorAll<HTMLButtonElement>('[data-region]').forEach((b,index)=>{
  b.onclick=()=>{state.atlasRegion=b.dataset.region!;renderList();};
  b.onkeydown=e=>{
    const tabs=[...document.querySelectorAll<HTMLButtonElement>('[data-region]')];
    const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
    if(next>=0){e.preventDefault();tabs[next].click();tabs[next].focus();}
  };
});
function select(id: string | null, revealLayer = true) {
  clearConnectionFocus();
  state.ghost = false;
  state.selected = id;
  if(id && !atlasIds(state.atlasRegion).has(id)) {state.atlasRegion="all";renderList();}
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
  const attached = state.ghost && state.selected ? directlyAttachedIds(state.selected) : new Set<string>();
  const highlighted = selectedConnectionHighlights();
  const focused = activeConnection();
  // Keep the focused endpoint and owning band visible even from a muscle/bone inspector.
  if (focused && state.ghost) { attached.add(focused.record.structureId); attached.add(focused.footprint.structureId); }
  const related =
    state.connections && state.selected
      ? relatedIds(state.selected)
      : new Set<string>();
  for (const [id, part] of leg.parts) {
    const d = byId[id],
      selected = id === state.selected;
    part.group.visible =
      ((state.ghost && d.tissue !== "skin") || highlighted.has(id) || state.layers.has(d.tissue)) &&
      (!state.isolated || selected) &&
      (!state.connections || selected || highlighted.has(id) || related.has(id));
    for (const mesh of part.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.userData.connectionBaseColor ??= mat.color.clone();
      mat.color.copy(mat.userData.connectionBaseColor);
      if (highlighted.has(id) && !selected) mat.color.set("#64c6b2");
      const tissueOpacity = d.tissue === "muscle" ? state.opacity : d.tissue === "skin" ? state.skinOpacity : 1;
      let alpha = tissueOpacity;
      if (state.ghost) alpha = attached.has(id) ? 1 : Math.min(alpha, 0.07);
      else if (state.selected && !selected && !state.isolated && !state.connections)
        alpha = Math.min(alpha, state.highlightConnections ? 0.12 : 0.5);
      if (highlighted.has(id) && !selected) alpha = 1;
      if (cutAwayIds.has(id)) alpha = Math.min(alpha, 0.025);
      if (selected) alpha = tissueOpacity;
      if (mesh.userData.fiber) alpha *= 0.22;
      applyCoverage(mesh, alpha);
      mesh.visible = alpha > 0;
      mat.emissive.set(selected ? "#623d17" : highlighted.has(id) ? "#218d7c" : "#000000");
      mat.emissiveIntensity = selected ? 0.13 : highlighted.has(id) ? 0.25 : 0;

    }
  }
  updateRows();
  $("#highlight-connections").setAttribute("aria-pressed", String(state.highlightConnections));
  viewport.dataset.highlightedStructures = [...highlighted].filter(id => leg.parts.get(id)?.group.visible).sort().join(",");
  updateFootprints();
  $("#layer-hint").textContent = state.ghost
    ? "Ghost mode shows all layers. Press Esc to restore."
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
  state.ghost = false;
  state.mode = mode;
  state.selected = null;
  state.isolated = false;
  state.connections = false;
  state.layers = new Set<Tissue>(
    mode === "exterior" ? ["skin"] : mode === "skeleton"
      ? ["bone", "cartilage"]
      : mode === "connective"
        ? ["bone", "tendon", "ligament", "fascia", "cartilage"]
        : tissueKeys.filter(t => t !== "skin"),
  );
  updateRows();
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
  state.atlasRegion = "all";

  state.skinOpacity = 1;
  $<HTMLInputElement>("#skin-opacity").value="100";
  $("#skin-opacity-value").textContent="100%";
  state.opacity = 1;
  state.labels = false;
  $<HTMLInputElement>("#opacity").value = "100";
  $("#opacity-value").textContent = "100%";
  $<HTMLInputElement>("#search").value = "";
  renderList();
  preset("anatomy");
  setView("foot");
  $("#tour-card").hidden = true;
}
$("#reset").onclick = reset;
const dialog = $<HTMLDialogElement>("#about-dialog");
$("#about").onclick = () => dialog.showModal();
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
  const defaultIds =
    state.mode === "skeleton"
      ? [
          "talus",
          "calcaneus",
          "navicular",
          "cuboid",
          "metatarsal-1",
          "phalanx-1-distal",
        ]
      : state.mode === "connective"
        ? [
            "achilles",
            "atfl",
            "superior-extensor",
            "fibularis-brevis-tendon",
            "plantar-fascia",
          ]
        : ["tibia", "anterior", "superior-extensor", "edb", "metatarsal-1"];
  const ids = state.labels ? [...defaultIds, ...selectedConnectionHighlights()] : [];
  const visible = new Set([
    ...(state.hovered ? [state.hovered] : []),
    ...ids,
    ...(state.selected ? [state.selected] : []),
  ]);
  for (const id of visible) {
    if (!leg.parts.get(id)!.group.visible) continue;
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
const tour = [
  ['atfl', 'atfl:anterior-talofibular:to', 'At the outer ankle', 'Inspect the ATFL footprint on the talar neck. Ghost mode preserves the ligament and its two attached bones.'],
  ['achilles', 'achilles:common-calcaneal:to', 'Calf to heel', 'Follow the Achilles tendon to its posterior calcaneal footprint. The amber patch marks the focused insertion.'],
  ['lisfranc', 'lisfranc:interosseous:to', 'Deep in the midfoot', 'Inspect the Lisfranc attachment at the second metatarsal base. Overlying structures fade automatically as you orbit.'],
  ['superior-extensor', 'superior-extensor:transverse:to', 'Tendons held close', 'Explore the tibial attachment of the superior extensor retinaculum, a retaining band across the anterior ankle.'],
  ['fibularis-brevis-tendon', 'fibularis-brevis-tendon:fifth-metatarsal:to', 'Around the outer ankle', 'Trace fibularis brevis to the fifth metatarsal tuberosity. Its muscle and insertion bone remain visible in ghost mode.'],
  ['plantar-fascia', 'plantar-fascia:digital-slip-1:from', 'Under the foot', 'Focus on the calcaneal attachment of the plantar aponeurosis before following its slips toward the toes.'],
];
let tourIndex = 0;
function showTour() {
  const [id, connectionKey, title, text] = tour[tourIndex];
  select(id, false);
  const connection = connectionsFor(leg.parts, id).find(c => c.key === connectionKey);
  if (connection) focusConnection(connection);
  $("#tour-card").hidden = false;
  $("#tour-step").textContent =
    `Tour · ${tourIndex + 1} of ${tour.length}`;
  $("#tour-title").textContent = title;
  $("#tour-text").textContent = text;
  $<HTMLButtonElement>("#tour-prev").disabled = tourIndex === 0;
  $("#tour-next").textContent =
    tourIndex === tour.length - 1 ? "Done" : "Next";
}
$("#tour").onclick = () => {
  tourIndex = 0;
  showTour();
};
$("#tour-close").onclick = () => {
  $("#tour-card").hidden = true;
  select(null);
};
$("#tour-prev").onclick = () => {
  tourIndex = Math.max(0, tourIndex - 1);
  showTour();
};
$("#tour-next").onclick = () => {
  if (tourIndex === tour.length - 1) {
    $("#tour-card").hidden = true;
    select(null);
  } else {
    tourIndex++;
    showTour();
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialog.open) {
    select(null);
    $("#tour-card").hidden = true;
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

  if (k === "escape") {
    select(null);
    $("#tour-card").hidden = true;
  }
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
  const occupied: { x: number; y: number }[] = [];
  const labelInset = innerWidth > 900 ? $(".inspector").offsetWidth + 12 : 0;
  const glide = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 0.1);
  for (let i = labelNodes.length - 1; i >= 0; i--) {
    const label = labelNodes[i];
    if (label.retiringAt !== undefined && time >= label.retiringAt) {
      label.node.remove();
      labelNodes.splice(i, 1);
    }
  }
  for (const label of labelNodes) {
    const { id, node } = label;
    if (label.retiringAt !== undefined) continue;
    const anchor = leg.parts.get(id)!.anchor;
    const p = anchor.clone().project(camera);
    const x =
      (p.x * 0.5 + 0.5) * viewport.clientWidth + (anchor.z < 0 ? 65 : -65);
    let y = (-p.y * 0.5 + 0.5) * viewport.clientHeight;
    while (
      occupied.some((q) => Math.abs(q.x - x) < 145 && Math.abs(q.y - y) < 32)
    )
      y += 34;
    if (id === state.hovered)
      y = THREE.MathUtils.clamp(y, 28, viewport.clientHeight - 70);
    occupied.push({ x, y });
    const targetX = THREE.MathUtils.clamp(x, 80, viewport.clientWidth - 90 - labelInset);
    const positioned = label.x !== undefined;
    label.x = positioned ? label.x! + (targetX - label.x!) * glide : targetX;
    label.y = positioned ? label.y! + (y - label.y!) * glide : y;
    node.style.left = `${label.x}px`;
    node.style.top = `${label.y}px`;
    const shown =
      (positioned || reducedMotion.matches) &&
      p.z <= 1 && y >= 20 && y <= viewport.clientHeight - 60;
    node.classList.toggle("shown", shown);
    node.inert = !shown;
  }
}
requestAnimationFrame(frame);


// Start after controls, state and labels exist, so late loads preserve user interaction.
viewport.dataset.boneAssets = "loading";
viewport.dataset.softTissues = "loading";
void Promise.all([loadBoneAssets(leg.parts), loadMuscleAssets(leg.parts), loadExteriorAssets(leg.parts)]).then(([report, muscles, exterior]) => {
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
  hideLoading();
}, () => hideLoading());
function hideLoading() {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.add("done");
  window.setTimeout(() => el.remove(), 400);
}

import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./style.css";
import * as THREE from "three";
import {
  CameraControls,
  createCameraControls,
  zoomBy,
  updateCamera,
} from "./camera";
import { structures, byId, tissueNames, colors, type Tissue } from "./data";
import { createAnkle } from "./ankle";
import { createCompass } from "./compass";
import { relatedIds } from "./foot";

import { cameraPreset, legacyPointToMm } from "./coordinates";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar"><div class="brand"><span class="brand-icon" aria-hidden="true">⌁</span><div><strong>Foot & Ankle</strong><small>AN ANATOMICAL STUDY</small></div></div>
<div class="segmented modes" aria-label="Tissue presets"><button data-mode="anatomy" class="active">Anatomy</button><button data-mode="skeleton">Skeleton</button><button data-mode="connective">Connective</button></div>
<button id="labels" class="tool-button" aria-pressed="false">⌖ Labels</button><button id="reset" class="tool-button">↺ Reset</button><button id="tour" class="primary">▷ Guided tour</button></header>
<main>
<aside class="panel atlas"><div class="panel-heading"><span class="eyebrow">STRUCTURE ATLAS</span><span class="count">${structures.length}</span></div><div class="atlas-intro"><h2>Inside the foot & ankle</h2><p>Explore the anatomy beneath<br>every step.</p><label class="search"><span aria-hidden="true">⌕</span><input id="search" placeholder="Find a structure…" aria-label="Find a structure" type="search"/></label><select id="region" aria-label="Atlas region"><option value="all">Foot & ankle study</option><option value="foot">Foot structures</option></select></div><div id="structure-list" class="atlas-scroll"></div><div class="atlas-footer"><span class="status-dot"></span> Right foot & ankle <span>•</span> ${structures.length} structures</div></aside>
<section id="viewport" aria-label="Interactive 3D anatomy model"><div class="scene-heading"><span class="eyebrow">HUMAN ANATOMY / FOOT & ANKLE</span><h1>Built for movement.</h1><p>One leg. Layers of possibility.</p></div><div class="view-controls segmented" aria-label="Camera views"><button data-view="foot" class="active">Overview</button><button data-view="dorsal">Dorsal</button><button data-view="plantar">Plantar</button><button data-view="medial">Medial</button><button data-view="lateral">Lateral</button></div><div id="label-layer"></div><div class="compass-wrap"><div id="compass" role="group" aria-label="Anatomical view compass"></div><small>RIGHT FOOT · CLICK TO ORIENT</small></div><div class="orientation"><span id="view-name">ANTERIOR VIEW</span><small>RIGHT FOOT & ANKLE</small></div><button id="pan" class="pan-toggle" aria-pressed="false" title="Pan with left drag. You can also right-drag or Shift-drag in Orbit mode.">✥ Pan</button><div class="canvas-tools"><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button id="home" aria-label="Reset camera" title="Reset camera">⌂</button></div><div class="scene-help">Drag to orbit <i>·</i> Right / Shift-drag to pan <i>·</i> Scroll to zoom</div><div id="render-error" hidden></div></section>
<aside class="panel inspector"><div class="panel-heading"><span class="eyebrow">FIELD NOTES</span><button id="clear" aria-label="Clear selection" title="Clear selection">×</button></div><div id="details" class="details" aria-live="polite"></div><div class="layer-section"><div class="section-heading"><span class="eyebrow">VISIBLE LAYERS</span><button id="all-layers">Show all</button></div><div id="layers"></div><label class="opacity-label" for="opacity">Muscle opacity <output id="opacity-value">100%</output></label><input id="opacity" type="range" min="10" max="100" value="100"/><p class="layer-hint">Lower opacity to see the skeleton beneath.</p></div></aside>
<section class="motion-bar study-bar"><span class="status-dot"></span><div><strong>Foot & ankle study</strong><small>26 primary foot bones + 2 hallux sesamoids · distal tibia & fibula</small></div><span class="study-note">Reference-guided geometry</span></section>
</main><footer class="footer"><span><span class="status-dot"></span> An interactive study in anatomy</span><span>Simplified educational model <i>·</i> <button id="about">Model & sources ↗</button></span></footer>
<dialog id="about-dialog"><button class="dialog-close" aria-label="Close model information">×</button><span class="eyebrow">ABOUT THIS MODEL</span><h2>Anatomy, made explorable.</h2><p>A regional right foot and ankle model, refined against your supplied dorsal and lateral reference illustrations.</p><p>Shapes, proportions, attachment sites, and motion are simplified. This is a selected set of major structures, not a complete anatomical atlas. Only the distal leg and foot are included. Nerves, vessels, bursae, tendon sheaths and several deep muscles remain omitted. The talar cartilage patch is illustrative, not a full cartilage reconstruction. All 26 standard foot bones are individually selectable. Two hallux sesamoids are included. Some ligament bundles are omitted; toe collateral pairs and extensor tendon slips are grouped by joint or muscle.</p><p>The model is a static anatomy study. Screenshots guide the contours and relationships but do not supply hidden 3D surfaces, calibrated dimensions, or validated biomechanics. No scan-derived or externally licensed mesh is used.</p><h3>Reference reading</h3><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb" target="_blank" rel="noreferrer">OpenStax · Bones of the lower limb ↗</a><a href="https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs" target="_blank" rel="noreferrer">OpenStax · Muscles of the lower limb ↗</a><a href="https://www.ncbi.nlm.nih.gov/books/NBK545158/" target="_blank" rel="noreferrer">NCBI · Ankle joint and ligaments ↗</a><a href="https://www.ncbi.nlm.nih.gov/books/NBK539705/" target="_blank" rel="noreferrer">NCBI · Foot muscles and tendon paths ↗</a><h3>Camera controls</h3><p>Drag to orbit. Right-drag or Shift-drag to pan. Pan mode makes left-drag (or one-finger touch) pan. Two fingers pan and pinch to zoom. Focus a structure to orbit around it. Arrow keys pan when the canvas is focused.</p><h3>Keyboard shortcuts</h3><p>1 / 2 / 3 / 4: dorsal, lateral, medial, overview<br>P: pan mode · F: focus selected · L: labels · R: reset<br>Compass: choose an anatomical direction · Escape: clear selection</p></dialog>
<div id="tour-card" hidden><span class="eyebrow" id="tour-step"></span><button id="tour-close" aria-label="Exit guided tour">×</button><h3 id="tour-title"></h3><p id="tour-text"></p><button id="tour-prev">← Back</button><button id="tour-next" class="primary">Next →</button></div>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const tissueKeys: Tissue[] = [
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
  layers: new Set<Tissue>(tissueKeys),
  opacity: 1,
  labels: false,
  isolated: false,
  connections: false,
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
  for (const tissue of tissueKeys) {
    const items = structures.filter(
      (s) =>
        s.tissue === tissue &&
        ($<HTMLSelectElement>("#region").value !== "foot" ||
          s.region === "Foot" ||
          ["achilles", "tibia", "fibula"].includes(s.id)) &&
        `${s.name} ${s.group} ${s.region}`.toLowerCase().includes(q),
    );
    if (!items.length) continue;
    const group = document.createElement("details");
    group.open = true;
    group.innerHTML = `<summary><span>${tissueNames[tissue]}</span><span>${items.length} <b>⌄</b></span></summary>`;
    for (const d of items) {
      const row = document.createElement("button");
      row.className = "structure-row";
      row.dataset.id = d.id;
      row.innerHTML = `<i style="background:${colors[d.tissue]}"></i><span>${d.name}</span><span class="row-arrow">›</span>`;
      row.onclick = () => select(d.id);
      group.append(row);
      count++;
    }
    container.append(group);
  }
  if (!count) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent =
      "No structures found. Try “talus”, “retinaculum”, or a toe name.";
    container.append(p);
  }
  updateRows();
}
function updateRows() {
  document
    .querySelectorAll<HTMLButtonElement>(".structure-row")
    .forEach((b) => {
      const selected = b.dataset.id === state.selected;
      b.classList.toggle("selected", selected);
      b.classList.toggle("hovered", b.dataset.id === state.hovered);
      b.setAttribute("aria-pressed", String(selected));
    });
}
function renderDetails() {
  const d = state.selected ? byId[state.selected] : null;
  $("#clear").style.visibility = d ? "visible" : "hidden";
  if (!d) {
    $("#details").innerHTML =
      `<div class="note-illustration" aria-hidden="true">✳</div><span class="eyebrow">FOOT & ANKLE</span><h2>A closer look<br>at every layer.</h2><p>Trace the heel, arches and toes. Follow the tendons beneath their retaining bands, and inspect the joints from every side.</p><div class="intro-tip"><span>↖</span> Choose a structure in the atlas or click directly on the model.</div><div class="mini-stats"><div><strong>${structures.filter((s) => s.tissue === "muscle").length}</strong><span>muscles</span></div><div><strong>${structures.filter((s) => s.tissue === "bone").length}</strong><span>bones</span></div><div><strong>${structures.filter((s) => s.tissue === "tendon" || s.tissue === "ligament").length}</strong><span>connections</span></div></div>`;
  } else {
    $("#details").innerHTML =
      `<div class="structure-tag"><i style="background:${colors[d.tissue]}"></i>${d.region} <span>/</span> ${d.tissue}</div><h2>${d.name}</h2><span class="group-name">${d.group}</span><p>${d.description}</p><h3>WHAT IT DOES</h3><p>${d.role}</p><h3>CONNECTIONS</h3><p class="connection">${d.connection}</p><div class="anatomy-tip"><span>◎</span><p>${d.hint}</p></div><button id="isolate" class="outline" aria-pressed="${state.isolated}">${state.isolated ? "↗ Show surrounding structures" : "⊙ Isolate structure"}</button>`;
    $("#isolate").onclick = () => {
      state.isolated = !state.isolated;
      state.connections = false;
      renderDetails();
      updateAppearance();
    };
    const tools = document.createElement("div");
    tools.className = "selection-tools";
    tools.innerHTML = `<button id="focus-selected" class="outline">⌖ Focus structure</button><button id="show-connections" class="outline" aria-pressed="${state.connections}">${state.connections ? "Show all surroundings" : "Show connections"}</button>`;
    $("#details").append(tools);
    $("#focus-selected").onclick = () => focusParts([d.id]);
    const related = [...relatedIds(d.id)];
    $<HTMLButtonElement>("#show-connections").disabled = !related.length;
    $("#show-connections").onclick = () => {
      state.connections = !state.connections;
      state.isolated = false;
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
        "<h3>ADJACENT / ATTACHED STRUCTURES</h3><p>Articulating bones and modeled soft-tissue attachments.</p>";
      for (const id of related) {
        const b = document.createElement("button");
        b.textContent = byId[id].name;
        b.onclick = () => {
          $<HTMLInputElement>("#search").value = "";
          if (byId[id].region !== "Foot")
            $<HTMLSelectElement>("#region").value = "all";
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
    checked ? state.layers.add(tissue) : state.layers.delete(tissue);
    if (!checked && state.selected && byId[state.selected].tissue === tissue) {
      state.selected = null;
      state.isolated = false;
      state.connections = false;
      renderDetails();
      updateRows();
    }
    state.mode = "custom";
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
const leg = createAnkle();
scene.add(leg.root);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20000, 20000),
  new THREE.ShadowMaterial({ color: "#6e583e", opacity: 0.12 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.copy(legacyPointToMm(0, 0.06, 0));
floor.receiveShadow = true;
scene.add(floor);
function setView(view: string, animate = true) {
  state.footView = true;
  state.view = view;
  $(".scene-heading").classList.add("close-up");
  $(".scene-heading h1").textContent = "Foot & ankle";
  $(".scene-heading p").textContent = "A closer study of every step.";
  applyMotionPreference();
  const { target, position: p } = cameraPreset(view, camera.aspect);
  void controls.setLookAt(p.x, p.y, p.z, target.x, target.y, target.z, animate);
  buildLabels();
  $("#view-name").textContent =
    view === "foot" ? "OBLIQUE OVERVIEW" : `${view.toUpperCase()} VIEW`;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  });
}
controls.addEventListener("controlstart", () => {
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
  camera.aspect = w / h;
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
  $("#pan").textContent = pan ? "✥ Pan on" : "✥ Pan";
}
function focusParts(ids: string[], foot = false) {
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
  void controls.setLookAt(
    destination.x,
    destination.y,
    destination.z,
    center.x,
    center.y,
    center.z,
    true,
  );
  state.footView = foot || ids.every((id) => byId[id]?.region === "Foot");
  $(".scene-heading").classList.add("close-up");
  $(".scene-heading h1").textContent = foot
    ? "Foot & ankle"
    : "Structure study";
  $(".scene-heading p").textContent = foot
    ? "26 bones. Explore their connections."
    : "Orbit, pan, and zoom to inspect.";
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
  $<HTMLSelectElement>("#region").value = "all";
  $<HTMLInputElement>("#search").value = "";
  renderList();
}
$("#pan").onclick = () => setPan(!state.pan);
$("#region").addEventListener("change", renderList);
function select(id: string | null) {
  state.selected = id;
  state.isolated = false;
  state.connections = false;
  if (id && !state.layers.has(byId[id].tissue)) {
    state.layers.add(byId[id].tissue);
    state.mode = "custom";
  }
  updateRows();
  renderDetails();
  $("#details").scrollTop = 0;
  updateAppearance();
}
function updateAppearance() {
  const related =
    state.connections && state.selected
      ? relatedIds(state.selected)
      : new Set<string>();
  for (const [id, part] of leg.parts) {
    const d = byId[id],
      selected = id === state.selected;
    part.group.visible =
      state.layers.has(d.tissue) &&
      (!state.isolated || selected) &&
      (!state.connections || selected || related.has(id));
    for (const mesh of part.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      let alpha = d.tissue === "muscle" ? state.opacity : 1;
      if (state.selected && !selected && !state.isolated && !state.connections)
        alpha = Math.min(alpha, 0.12);
      if (selected) alpha = 1;
      if (mesh.userData.fiber) alpha *= 0.22;
      mat.opacity = alpha;
      mat.transparent = alpha < 1;
      mat.depthWrite = alpha > 0.8;
      mat.emissive.set(selected ? "#623d17" : "#000000");
      mat.emissiveIntensity = selected ? 0.13 : 0;
      mesh.castShadow = alpha > 0.8;
      mesh.renderOrder = selected ? 3 : 0;
    }
  }
  if (state.hovered && !leg.parts.get(state.hovered)?.group.visible)
    setHovered(null);
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
  state.mode = mode;
  state.selected = null;
  state.isolated = false;
  state.connections = false;
  state.layers = new Set<Tissue>(
    mode === "skeleton"
      ? ["bone", "cartilage"]
      : mode === "connective"
        ? ["bone", "tendon", "ligament", "fascia", "cartilage"]
        : tissueKeys,
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
$("#labels").onclick = () => {
  state.labels = !state.labels;
  updateAppearance();
};
$("#all-layers").onclick = () => preset("anatomy");
$<HTMLInputElement>("#opacity").oninput = (e) => {
  state.opacity = Number((e.target as HTMLInputElement).value) / 100;
  $("#opacity-value").textContent = `${Math.round(state.opacity * 100)}%`;
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
  $<HTMLSelectElement>("#region").value = "all";

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
function pickStructure(clientX: number, clientY: number): string | null {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    (-(clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  const targets = [...leg.parts.values()]
    .filter((p) => p.group.visible)
    .flatMap((p) => p.meshes.filter((m) => !m.userData.fiber));
  const hits = raycaster.intersectObjects(targets, false);
  // Match click selection: the selected solid structure takes priority over ghosted tissue.
  const chosen =
    hits.find((h) => h.object.userData.id === state.selected) ?? hits[0];
  return chosen?.object.userData.id ?? null;
}
let pendingHover: string | null | undefined;
let hoverTimer: number | undefined;
function setHovered(id: string | null) {
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
  requestHovered(pickStructure(e.clientX, e.clientY));
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
  const ids = state.labels ? defaultIds : [];
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
  [
    "talus",
    "Inside the ankle mortise",
    "The talar dome sits between the distal tibia and fibula. Compare the lower lateral malleolus with its medial counterpart.",
    "anterior",
  ],
  [
    "calcaneus",
    "A heel with an arch",
    "The calcaneal tuberosity forms the heel. The medial shelf supports the talus, while the midfoot rises into the arch.",
    "medial",
  ],
  [
    "cuneiform-medial",
    "Wedges in the midfoot",
    "Three differently sized cuneiforms sit between the navicular and metatarsals. The second metatarsal base is recessed.",
    "dorsal",
  ],
  [
    "superior-extensor",
    "Tendons held close",
    "The transverse superior band and Y-shaped inferior retinaculum keep the anterior tendon paths close to the ankle. Toggle Fascia & retinacula to look underneath.",
    "foot",
  ],
  [
    "fibularis-brevis-tendon",
    "Around the outer ankle",
    "Follow the two fibular tendons behind the lateral malleolus. Brevis inserts on the fifth metatarsal; longus turns beneath the cuboid toward the medial foot.",
    "lateral",
  ],
  [
    "plantar-fascia",
    "Under the foot",
    "The plantar aponeurosis fans toward the toes. The two hallux sesamoids lie beneath the first metatarsal head.",
    "plantar",
  ],
];
let tourIndex = 0;
function showTour() {
  const [id, title, text, view] = tour[tourIndex];

  state.layers = new Set(tissueKeys);
  state.mode = "anatomy";
  select(id);
  setView(view);
  $("#tour-card").hidden = false;
  $("#tour-step").textContent =
    `GUIDED TOUR / ${tourIndex + 1} OF ${tour.length}`;
  $("#tour-title").textContent = title;
  $("#tour-text").textContent = text;
  $<HTMLButtonElement>("#tour-prev").disabled = tourIndex === 0;
  $("#tour-next").textContent =
    tourIndex === tour.length - 1 ? "Finish ✓" : "Next →";
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
  if (
    (e.target as HTMLElement).matches("input,button,select,textarea") ||
    dialog.open
  )
    return;
  const k = e.key.toLowerCase();
  if (k === "1") setView("dorsal");
  if (k === "2") setView("lateral");
  if (k === "3") setView("medial");
  if (k === "4") focusFoot();
  if (k === "p") setPan(!state.pan);
  if (k === "f" && state.selected) focusParts([state.selected]);
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
    requestHovered(pickStructure(hoverPointer.x, hoverPointer.y));
  renderer.render(scene, camera);
  updateCompass(camera.quaternion);
  const occupied: { x: number; y: number }[] = [];
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
      y = THREE.MathUtils.clamp(y, 115, viewport.clientHeight - 70);
    occupied.push({ x, y });
    const targetX = THREE.MathUtils.clamp(x, 80, viewport.clientWidth - 90);
    const positioned = label.x !== undefined;
    label.x = positioned ? label.x! + (targetX - label.x!) * glide : targetX;
    label.y = positioned ? label.y! + (y - label.y!) * glide : y;
    node.style.left = `${label.x}px`;
    node.style.top = `${label.y}px`;
    const shown =
      (positioned || reducedMotion.matches) &&
      p.z <= 1 && y >= 105 && y <= viewport.clientHeight - 60;
    node.classList.toggle("shown", shown);
    node.inert = !shown;
  }
}
requestAnimationFrame(frame);


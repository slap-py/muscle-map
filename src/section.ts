import * as THREE from "three";

export type SectionAxis = "off" | "sagittal" | "coronal" | "transverse";
export interface SectionState { axis: SectionAxis; position: number; flipped: boolean }

export const SECTION_AXES = ["sagittal", "coronal", "transverse"] as const;
export const defaultSection = (): SectionState => ({ axis: "off", position: 0.5, flipped: false });

/** Shared by every anatomy material: empty when off, one plane when on. Three clips fragments with distanceToPoint < 0. */
export const sectionPlanes: THREE.Plane[] = [];

/** Axes follow COORDINATES.md: +X anterior, +Y superior, +Z subject-right. `hidden` is the unflipped hidden side. */
const AXES = {
  sagittal: { axis: "z", hidden: "right", flipped: "left" },
  coronal: { axis: "x", hidden: "anterior", flipped: "posterior" },
  transverse: { axis: "y", hidden: "superior", flipped: "inferior" },
} as const;

export function hiddenSide(state: SectionState): string {
  if (state.axis === "off") return "";
  const info = AXES[state.axis];
  return state.flipped ? info.flipped : info.hidden;
}

export function normalizeSection(value: Partial<SectionState> | undefined): SectionState {
  const axis = SECTION_AXES.includes(value?.axis as never) ? value!.axis! : "off";
  const position = Number.isFinite(value?.position) ? THREE.MathUtils.clamp(value!.position!, 0, 1) : 0.5;
  return { axis, position, flipped: value?.flipped === true };
}

/** Where the plane sits along its axis, in world millimeters. */
export function sectionOffset(state: SectionState, bounds: THREE.Box3): number {
  const key = AXES[state.axis as Exclude<SectionAxis, "off">].axis;
  return THREE.MathUtils.lerp(bounds.min[key], bounds.max[key], state.position);
}

/** Re-aims the shared plane. Changing numbers needs no shader recompile; only the plane count does. */
export function updateSectionPlane(state: SectionState, bounds: THREE.Box3) {
  if (state.axis === "off" || bounds.isEmpty()) { sectionPlanes.length = 0; return; }
  if (!sectionPlanes.length) sectionPlanes.push(new THREE.Plane());
  const key = AXES[state.axis].axis;
  // Keep the side with smaller coordinates by default (hide + side), so the kept normal points toward −axis.
  const sign = state.flipped ? 1 : -1;
  const normal = new THREE.Vector3();
  normal[key] = sign;
  // distance(p) = sign * p[key] + constant; zero at the offset.
  sectionPlanes[0].set(normal, -sign * sectionOffset(state, bounds));
}

export function isClipped(point: THREE.Vector3): boolean {
  return sectionPlanes.length > 0 && sectionPlanes[0].distanceToPoint(point) < 0;
}

/** True when every part of the box lies on the hidden side. */
export function isFullyClipped(box: THREE.Box3): boolean {
  if (!sectionPlanes.length || box.isEmpty()) return false;
  const plane = sectionPlanes[0];
  // The corner furthest along the plane normal is the most visible one.
  const corner = new THREE.Vector3(
    plane.normal.x >= 0 ? box.max.x : box.min.x,
    plane.normal.y >= 0 ? box.max.y : box.min.y,
    plane.normal.z >= 0 ? box.max.z : box.min.z,
  );
  return plane.distanceToPoint(corner) < 0;
}

/** Cross-section color: tissue color darkened ~25% so cuts still read by tissue type. */
export function sectionFillColor(color: THREE.ColorRepresentation, override?: THREE.ColorRepresentation): THREE.Color {
  return override === undefined ? new THREE.Color(color).multiplyScalar(0.75) : new THREE.Color(override);
}

/** Inner tissues win ties where cut faces share the plane, so a bone's cut shows inside the muscle around it. */
const CAP_PRIORITY: Record<string, number> = { skin: -1, muscle: 0, fascia: 1, tendon: 1, ligament: 1, cartilage: 2, bone: 3, artery: 4, vein: 4, nerve: 4 };
export const capPriority = (tissue: string) => CAP_PRIORITY[tissue] ?? 0;

/** True when almost every edge is shared by two triangles, so the mesh encloses a volume that can be capped.
 * Vertices are welded by position first, since exported meshes often split them along seams. */
export function isMostlyClosed(geometry: THREE.BufferGeometry): boolean {
  const cached = geometry.userData.sectionClosed as boolean | undefined;
  if (cached !== undefined) return cached;
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const ids = new Uint32Array(position.count);
  const welded = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 100)},${Math.round(position.getY(i) * 100)},${Math.round(position.getZ(i) * 100)}`;
    let id = welded.get(key);
    if (id === undefined) { id = welded.size; welded.set(key, id); }
    ids[i] = id;
  }
  const edges = new Map<number, number>();
  const span = welded.size + 1;
  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? a * span + b : b * span + a;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };
  for (let i = 0; i + 2 < count; i += 3) {
    const a = ids[index ? index.getX(i) : i], b = ids[index ? index.getX(i + 1) : i + 1], c = ids[index ? index.getX(i + 2) : i + 2];
    add(a, b); add(b, c); add(c, a);
  }
  let open = 0;
  for (const uses of edges.values()) if (uses !== 2) open++;
  const closed = edges.size > 0 && open / edges.size <= 0.02;
  geometry.userData.sectionClosed = closed;
  return closed;
}

/** Open sheets (and meshes too faint to cap) show their back faces as a tinted, still-shaded fill. Chains any existing onBeforeCompile. */
export function withSectionFill(material: THREE.Material, color: THREE.Color) {
  const fill = material.userData.sectionFill as { value: THREE.Color } | undefined;
  if (fill) { fill.value.copy(color); return; }
  const uniform = { value: color.clone() };
  material.userData.sectionFill = uniform;
  // Default customProgramCacheKey stringifies onBeforeCompile, so read it before replacing it.
  const previousKey = material.customProgramCacheKey();
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.sectionColor = uniform;
    shader.fragmentShader = 'uniform vec3 sectionColor;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      [
        '#include <dithering_fragment>',
        '#if NUM_CLIPPING_PLANES > 0',
        'if (!gl_FrontFacing) {',
        '  float sectionFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);',
        '  vec3 sectionTint = sectionColor * (0.45 + 0.55 * sectionFacing);',
        '  gl_FragColor.rgb = mix(gl_FragColor.rgb * (0.6 + 0.4 * sectionFacing), sectionTint, 0.4);',
        '}',
        '#endif',
      ].join("\n"),
    );
  };
  material.customProgramCacheKey = () => previousKey + "|section-fill-v4";
  material.needsUpdate = true;
}

/**
 * Stencil cap for one closed mesh. Back faces add and front faces subtract on the kept side of the plane, so a pixel
 * ends non-zero only where the view ray is inside the mesh as it crosses the plane. A plane quad is then drawn there,
 * at true plane depth, and clears the stencil. Each cap needs its own render-order slot so stencil state never mixes.
 */
export interface SectionCap { back: THREE.Mesh; front: THREE.Mesh; quad: THREE.Mesh }
const QUAD_GEOMETRY = new THREE.PlaneGeometry(1, 1);
function stencilMaterial(side: THREE.Side, op: THREE.StencilOp) {
  return new THREE.MeshBasicMaterial({
    side, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: sectionPlanes,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
  });
}
export function createSectionCap(source: THREE.Mesh, order: number, color: THREE.Color): SectionCap {
  const make = (material: THREE.Material, geometry: THREE.BufferGeometry, renderOrder: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder;
    mesh.userData.sectionHelper = true;
    mesh.raycast = () => {};
    return mesh;
  };
  const back = make(stencilMaterial(THREE.BackSide, THREE.IncrementWrapStencilOp), source.geometry, order);
  const front = make(stencilMaterial(THREE.FrontSide, THREE.DecrementWrapStencilOp), source.geometry, order + 1);
  const quad = make(new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  }), QUAD_GEOMETRY, order + 2);
  // Helpers ride along with the source mesh (same geometry, same transform); the quad lives in world space.
  source.add(back, front);
  return { back, front, quad };
}
/** Lay a cap quad onto the plane, large enough to cover the model. */
export function placeCapQuad(quad: THREE.Mesh, plane: THREE.Plane, size: number) {
  plane.coplanarPoint(quad.position);
  quad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
  quad.scale.setScalar(size);
  quad.updateMatrixWorld(true);
}
export function disposeSectionCap(cap: SectionCap) {
  cap.back.removeFromParent(); cap.front.removeFromParent(); cap.quad.removeFromParent();
  (cap.back.material as THREE.Material).dispose();
  (cap.front.material as THREE.Material).dispose();
  (cap.quad.material as THREE.Material).dispose();
}

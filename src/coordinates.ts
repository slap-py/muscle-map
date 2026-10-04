import * as THREE from "three";

/** Runtime coordinates: millimeters, right-handed ISB-aligned anatomical axes. */
export const coordinateConvention = {
  version: 1,
  units: "mm",
  axes: { x: "anterior", y: "superior", z: "subject-right" },
  origin: {
    id: "regional-talus-reference",
    atlasId: "talus",
    legacyPosition: [0, 0.84, 0.05] as const,
    provenance: "src/foot.ts: authored talus center; not a measured anatomical landmark",
  },
  source: {
    title: "Wu & Cavanagh (1995), ISB recommendations for standardization in the reporting of kinematic data",
    url: "https://media.isbweb.org/images/documents/standards/Wu%20and%20Cavanagh%20J%20Biomech%2028%20(1995)%201258-1261.pdf",
    locator: "Parts 1–2, Figure 1",
    scope: "Axis directions and handedness only. Millimeters and the regional origin are project choices.",
  },
} as const;

// Explicit display calibration for the old, unmeasured procedural geometry.
export const LEGACY_UNIT_MM = 100;
export const legacyToAnatomicalMatrix = new THREE.Matrix4().set(
  0, 0, 100, -5,
  0, 100, 0, -84,
  -100, 0, 0, 0,
  0, 0, 0, 1,
);

export function legacyPointToMm(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z).applyMatrix4(legacyToAnatomicalMatrix);
}

export const anatomicalDirections = {
  medial: [0, 0, -1],
  lateral: [0, 0, 1],
  dorsal: [0, 1, 0],
  plantar: [0, -1, 0],
  anterior: [1, 0, 0],
  posterior: [-1, 0, 0],
} satisfies Record<string, [number, number, number]>;

// Preserve the original oblique angles and framing in the new basis.
export const cameraViews: Record<string, [number, number, number]> = {
  foot: [1.5, 0.8, 0.8],
  medial: [0.02, 0.13, -1],
  lateral: [0.02, 0.13, 1],
  dorsal: [0.45, 1, 0],
  plantar: [0.04, -1, 0],
  anterior: [1, 0.08, 0],
  posterior: [-1, 0.08, 0],
};

export function cameraPreset(view: string, aspect: number) {
  const surface = view === "dorsal" || view === "plantar";
  const target = new THREE.Vector3(surface ? 85 : 71, surface ? -34 : 59, 0);
  const distance = (surface ? 590 : 850) * Math.max(1, 0.75 / aspect);
  const direction = new THREE.Vector3(...(cameraViews[view] ?? cameraViews.foot)).normalize();
  return { target, position: target.clone().addScaledVector(direction, distance) };
}



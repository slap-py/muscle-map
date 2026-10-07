import * as THREE from "three";
import { anatomicalDirections } from "./coordinates";
export const directions = [
  {
    id: "medial",
    short: "M",
    label: "Medial · inner side",
    v: anatomicalDirections.medial,
    color: "var(--compass-medial)",
  },
  {
    id: "lateral",
    short: "L",
    label: "Lateral · outer side",
    v: anatomicalDirections.lateral,
    color: "var(--compass-medial)",
  },
  {
    id: "dorsal",
    short: "D",
    label: "Dorsal · top of foot",
    v: anatomicalDirections.dorsal,
    color: "var(--compass-dorsal)",
  },
  {
    id: "plantar",
    short: "Pl",
    label: "Plantar · sole",
    v: anatomicalDirections.plantar,
    color: "var(--compass-dorsal)",
  },
  {
    id: "anterior",
    short: "A",
    label: "Anterior · toward toes",
    v: anatomicalDirections.anterior,
    color: "var(--compass-anterior)",
  },
  {
    id: "posterior",
    short: "P",
    label: "Posterior · toward heel",
    v: anatomicalDirections.posterior,
    color: "var(--compass-anterior)",
  },
];
export function projectDirection(v: readonly number[], q: THREE.Quaternion) {
  return new THREE.Vector3(...v).applyQuaternion(q.clone().invert());
}
export function createCompass(host: HTMLElement, onView: (id: string) => void, regionDirections: readonly { id: string; short: string; label: string; v: readonly number[]; color: string }[] = directions) {
  const svgNS = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 110 110");
  svg.setAttribute("aria-hidden", "true");
  host.append(svg);
  const nodes = regionDirections.map((d) => {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", "55");
    line.setAttribute("y1", "55");
    line.setAttribute("stroke", d.color);
    line.setAttribute("stroke-width", "1.6");
    svg.append(line);
    const b = document.createElement("button");
    b.textContent = d.short;
    b.title = d.label;
    b.setAttribute("aria-label", `View from ${d.label}`);
    b.style.color = d.color;
    b.onclick = () => onView(d.id);
    host.append(b);
    return { d, line, b };
  });
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("cx", "55");
  dot.setAttribute("cy", "55");
  dot.setAttribute("r", "3");
  dot.setAttribute("fill", "var(--faint)");
  svg.append(dot);
  return (q: THREE.Quaternion) => {
    for (const { d, line, b } of nodes) {
      const p = projectDirection(d.v, q);
      const x = 55 + p.x * 37,
        y = 55 - p.y * 37;
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(y));
      line.setAttribute("opacity", p.z < 0 ? ".3" : ".8");
      b.style.left = `${(x / 110) * 100}%`;
      b.style.top = `${(y / 110) * 100}%`;
      b.style.opacity = p.z < 0 ? ".45" : "1";
      b.style.zIndex = String(Math.round((p.z + 1) * 10));
      b.style.background = p.z < 0 ? "var(--compass-back-hidden)" : "var(--compass-back)";
    }
  };
}

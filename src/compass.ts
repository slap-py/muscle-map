import * as THREE from "three";
export const directions = [
  {
    id: "medial",
    short: "M",
    label: "Medial · inner side",
    v: [1, 0, 0],
    color: "#8e694e",
  },
  {
    id: "lateral",
    short: "L",
    label: "Lateral · outer side",
    v: [-1, 0, 0],
    color: "#8e694e",
  },
  {
    id: "dorsal",
    short: "D",
    label: "Dorsal · top of foot",
    v: [0, 1, 0],
    color: "#698168",
  },
  {
    id: "plantar",
    short: "Pl",
    label: "Plantar · sole",
    v: [0, -1, 0],
    color: "#698168",
  },
  {
    id: "anterior",
    short: "A",
    label: "Anterior · toward toes",
    v: [0, 0, 1],
    color: "#547f93",
  },
  {
    id: "posterior",
    short: "P",
    label: "Posterior · toward heel",
    v: [0, 0, -1],
    color: "#547f93",
  },
];
export function projectDirection(v: number[], q: THREE.Quaternion) {
  return new THREE.Vector3(...v).applyQuaternion(q.clone().invert());
}
export function createCompass(host: HTMLElement, onView: (id: string) => void) {
  const svgNS = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 110 110");
  svg.setAttribute("aria-hidden", "true");
  host.append(svg);
  const nodes = directions.map((d) => {
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
  dot.setAttribute("fill", "#948671");
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
      b.style.background = p.z < 0 ? "#f4eddf" : "#fffaf1";
    }
  };
}

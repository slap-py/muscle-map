import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { attachmentsFor, type AttachmentRecord } from './attachments';
import { byId } from './data';
import type { AnatomyParts, ResolvedFootprint } from './softTissues';

export type ConnectionEnd = 'from' | 'to';
export interface Connection {
  key: string;
  record: AttachmentRecord;
  end: ConnectionEnd;
  footprint: ResolvedFootprint;
}

/** Only authored attachment endpoints count: pulley contact is not attachment. */
export function directlyAttachedIds(id: string) {
  const ids = new Set<string>([id]);
  for (const a of attachmentsFor(id)) {
    if (a.structureId === id) {
      ids.add(a.from.structureId);
      ids.add(a.to.structureId);
    } else ids.add(a.structureId);
  }
  return ids;
}

/** Highlight complete authored attachment records without traversing shared
 * bones into unrelated muscles or counting pulley contacts as attachments. */
export function connectionHighlightIds(id: string) {
  const ids = new Set<string>([id]);
  for (const record of attachmentsFor(id)) {
    ids.add(record.structureId);
    ids.add(record.from.structureId);
    ids.add(record.to.structureId);
  }
  return ids;
}

export function connectionsFor(parts: AnatomyParts, id: string): Connection[] {
  return attachmentsFor(id).flatMap(record => {
    const mesh = parts.get(record.structureId)?.meshes.find(m => m.userData.attachmentId === record.id);
    if (!mesh) return [];
    return (['from', 'to'] as const).map(end => ({
      key: `${record.id}:${end}`, record, end,
      footprint: mesh.userData[`${end}Footprint`] as ResolvedFootprint,
    })).filter(c => !!c.footprint);
  });
}

/** A clipped decal follows the actual bone triangles, never the label centroid. */
export function footprintDecal(parts: AnatomyParts, connection: Connection) {
  const { footprint: f, record, end } = connection;
  if (record[end].kind !== 'surface' || byId[f.structureId]?.tissue !== 'bone') return;
  const bone = parts.get(f.structureId)?.meshes[f.meshIndex];
  if (!bone) return;
  bone.updateWorldMatrix(true, false);
  const center = new THREE.Vector3(...f.centerMm);
  const normal = new THREE.Vector3(...f.normal).normalize();
  const orientation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
  );
  const size = new THREE.Vector3(f.radiusMm * 2, f.radiusMm * 2, Math.max(2, f.radiusMm));
  const geometry = new DecalGeometry(bone, center, orientation, size);
  const material = new THREE.MeshBasicMaterial({
    color: '#21bda8', transparent: true, opacity: 0.95,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = shader => {
    shader.defines = { ...shader.defines, USE_UV: '' };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif (length(vUv - vec2(0.5)) > 0.5) discard;',
    );
  };
  const decal = new THREE.Mesh(geometry, material);
  decal.name = `footprint:${connection.key}`;
  decal.userData.connectionKey = connection.key;
  decal.userData.boneId = f.structureId;
  decal.renderOrder = 5;
  return decal;
}

/** Surface normal gives a reproducible outward view; padding retains local context. */
export function connectionCameraPose(f: ResolvedFootprint, fov: number, aspect: number) {
  const target = new THREE.Vector3(...f.centerMm);
  const direction = new THREE.Vector3(...f.normal).normalize();
  if (direction.lengthSq() < 0.1) direction.set(0, 1, 0);
  if (Math.abs(direction.y) > 0.96) direction.add(new THREE.Vector3(0.22, 0, 0.12)).normalize();
  const halfFov = Math.min(THREE.MathUtils.degToRad(fov / 2),
    Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect));
  const radius = Math.max(12, f.radiusMm * 2.8);
  const distance = Math.max(55, radius / Math.sin(halfFov));
  return { target, position: target.clone().addScaledVector(direction, distance), distance };
}

/** Sample center and rim, including the host bone if its near side obscures a
 * far-side footprint. Never fade the structure being studied. */
export function connectionOccluders(parts: AnatomyParts, cameraPosition: THREE.Vector3,
  connection: Connection, selected: string | null) {
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  const candidates = [...parts.entries()].filter(([id, p]) =>
    p.group.visible && id !== selected && id !== connection.record.structureId,
  ).flatMap(([, p]) => p.meshes.filter(m => !m.userData.fiber));
  const f = connection.footprint;
  const samples = [f.centerMm, ...f.boundaryMm.filter((_, i) => i % 3 === 0)];
  const ids = new Set<string>();
  for (const sample of samples) {
    const point = new THREE.Vector3(...sample).addScaledVector(new THREE.Vector3(...f.normal), 0.6);
    const delta = point.sub(cameraPosition);
    ray.set(cameraPosition, delta.clone().normalize());
    ray.far = Math.max(0, delta.length() - 0.8);
    for (const hit of ray.intersectObjects(candidates, false)) ids.add(hit.object.userData.id);
  }
  return ids;
}

export const connectionClinicalPoints: Record<string, { note: string; title: string; url: string }> = {
  atfl: {
    note: 'The ATFL is the most commonly sprained lateral ankle ligament.',
    title: 'NATA position statement · Injury mechanism',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3718356/',
  },
  achilles: {
    note: 'An Achilles rupture can occur at the heel attachment or within the tendon itself.',
    title: 'AAOS · Achilles tendon rupture',
    url: 'https://www.orthoinfo.org/diseases--conditions/achilles-tendon-rupture-tear/',
  },
  lisfranc: {
    note: 'An untreated Lisfranc injury can leave the arch unstable and lead to flattening of the foot.',
    title: 'AAOS · Lisfranc injury',
    url: 'https://www.orthoinfo.org/diseases--conditions/lisfranc-midfoot-injury/',
  },
};

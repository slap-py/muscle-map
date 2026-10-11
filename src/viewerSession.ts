import type { RegionPack } from './regions';
import type { Tissue } from './data';
import type { SectionState } from './section';

export interface ViewerSession {
  regionIds: readonly string[];
  selectedAliases: readonly string[];
  layers: readonly Tissue[];
  atlasTypes: readonly Tissue[];
  atlasRegion: string;
  search: string;
  onlyVisible: boolean;
  opacity: number;
  skinOpacity: number;
  neurovascularOpacity: number;
  labels: boolean;
  highlightConnections: boolean;
  view: string;
  viewDirection?: string;
  overview: boolean;
  /** Absent in sessions saved before section planes existed. */
  section?: SectionState;
}

export function resolveStructureId(pack: RegionPack, id: string | null): string | null {
  if (!id) return null;
  const canonical = pack.structureAliases?.[id] ?? id;
  if (Object.hasOwn(pack.byId, canonical)) return canonical;
  const local = !pack.regionIds && id.startsWith(pack.id + ':') ? id.slice(pack.id.length + 1) : '';
  return local && Object.hasOwn(pack.byId, local) ? local : null;
}

export function selectionAliases(pack: RegionPack, id: string | null): string[] {
  if (!id) return [];
  return pack.regionIds
    ? Object.entries(pack.structureAliases ?? {}).filter(([, target]) => target === id).map(([alias]) => alias)
    : [pack.id + ':' + id];
}

/** Transfer settings only when the new scene retains a region from this session. */
export function restoreViewerSession(pack: RegionPack, session?: ViewerSession) {
  if (!session || !session.regionIds.some(id => (pack.regionIds ?? [pack.id]).includes(id))) return;
  const selected = session.selectedAliases.map(id => resolveStructureId(pack, id)).find(Boolean) ?? null;
  const area = pack.atlasAreas.some(area => area.id === session.atlasRegion) ? session.atlasRegion
    : !pack.regionIds && session.atlasRegion.startsWith(pack.id + ':') ? session.atlasRegion.slice(pack.id.length + 1) : 'all';
  const view = session.overview ? pack.defaultView : pack.viewPresets.find(view => view.id === session.view)?.id
    ?? pack.viewPresets.find(view => view.id !== pack.defaultView && view.direction === session.viewDirection)?.id ?? pack.defaultView;
  return {
    ...session, selected, view,
    atlasRegion: pack.atlasAreas.some(candidate => candidate.id === area) ? area : 'all',
    layers: session.layers.filter(tissue => pack.tissueKeys.includes(tissue)),
    atlasTypes: session.atlasTypes.filter(tissue => pack.tissueKeys.includes(tissue)),
  };
}

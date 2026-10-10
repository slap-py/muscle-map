export type Route = { kind: 'landing' } | { kind: 'how-it-works' } | { kind: 'hub' } | { kind: 'credits' } | { kind: 'region'; regionId: string; select: string | null } | { kind: 'regions'; regionIds: string[]; select: string | null };

/** Hash routing works on a static host without server rewrite rules. */
export function parseRoute(hash: string, regionIds: readonly string[]): Route {
  const [pathname, query = ''] = hash.replace(/^#/, '').split('?');
  let regionId: string;
  try { regionId = decodeURIComponent((pathname || '/').replace(/^\/+|\/+$/g, '')); }
  catch { return { kind: 'hub' }; }
  if (!regionId) return { kind: 'landing' };
  if (regionId === 'browser') return { kind: 'hub' };
  if (regionId === 'how-it-works') return { kind: 'how-it-works' };
  if (regionId === 'credits') return { kind: 'credits' };
  if (regionId === 'regions') {
    const params = new URLSearchParams(query);
    const ids = [...new Set(params.getAll('region'))].sort();
    if (!ids.length || ids.some(id => !regionIds.includes(id))) return { kind: 'hub' };
    if (ids.length === 1) return { kind: 'region', regionId: ids[0], select: params.get('select') || null };
    return { kind: 'regions', regionIds: ids, select: params.get('select') || null };
  }
  if (!regionIds.includes(regionId)) return { kind: 'hub' };
  return { kind: 'region', regionId, select: new URLSearchParams(query).get('select') || null };
}

export function regionHref(regionId: string, select?: string | null) {
  return `#/${encodeURIComponent(regionId)}${select ? `?select=${encodeURIComponent(select)}` : ''}`;
}

export const LAST_REGION_KEY = 'muscle-map-last-region';
export const regionStorageKey = (regionId: string, key: string) => `muscle-map-region:${regionId}:${key}`;

export function regionsHref(regionIds: readonly string[], select?: string | null) {
  const ids = [...new Set(regionIds)].sort();
  if (!ids.length) return '#/browser';
  if (ids.length === 1) return regionHref(ids[0], select);
  const params = new URLSearchParams();
  ids.forEach(id => params.append('region', id));
  if (select) params.set('select', select);
  return `#/regions?${params}`;
}

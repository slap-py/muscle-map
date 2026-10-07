export type Route = { kind: 'hub' } | { kind: 'credits' } | { kind: 'region'; regionId: string; select: string | null };

/** Hash routing works on a static host without server rewrite rules. */
export function parseRoute(hash: string, regionIds: readonly string[]): Route {
  const [pathname, query = ''] = hash.replace(/^#/, '').split('?');
  let regionId: string;
  try { regionId = decodeURIComponent((pathname || '/').replace(/^\/+|\/+$/g, '')); }
  catch { return { kind: 'hub' }; }
  if (regionId === 'credits') return { kind: 'credits' };
  if (!regionIds.includes(regionId)) return { kind: 'hub' };
  return { kind: 'region', regionId, select: new URLSearchParams(query).get('select') || null };
}

export function regionHref(regionId: string, select?: string | null) {
  return `#/${encodeURIComponent(regionId)}${select ? `?select=${encodeURIComponent(select)}` : ''}`;
}

export const LAST_REGION_KEY = 'muscle-map-last-region';
export const regionStorageKey = (regionId: string, key: string) => `muscle-map-region:${regionId}:${key}`;

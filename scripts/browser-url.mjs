/**
 * Return a viewer route URL while preserving a caller supplied host and port.
 * VIEWER_URL is intentionally treated as an origin/base URL; any old hash is
 * replaced so checks cannot accidentally exercise the hub.
 */
export function viewerUrl(defaultUrl = 'http://127.0.0.1:5176/', route = '/lower-leg') {
  const value = process.env.VIEWER_URL ?? defaultUrl;
  const url = new URL(value);
  url.hash = route.startsWith('#') ? route.slice(1) : route;
  return url.toString();
}

export function appUrl(defaultUrl = 'http://127.0.0.1:5176/', route = '/browser') {
  const value = process.env.VIEWER_URL ?? defaultUrl;
  const url = new URL(value);
  url.hash = route;
  return url.toString();
}

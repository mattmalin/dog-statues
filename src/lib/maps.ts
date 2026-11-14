export function googleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname === 'maps.app.goo.gl' && /^\/[\w-]+\/?$/.test(url.pathname)) return url;
    if (url.hostname === 'goo.gl' && /^\/maps\/[\w-]+\/?$/.test(url.pathname)) return url;
    if (
      [
        'google.com',
        'www.google.com',
        'maps.google.com',
        'google.co.uk',
        'www.google.co.uk',
        'maps.google.co.uk',
      ].includes(url.hostname) &&
      (/^\/maps(?:\/|$)/.test(url.pathname) ||
        (url.hostname.startsWith('maps.') && url.pathname === '/'))
    )
      return url;
    return null;
  } catch {
    return null;
  }
}

const pair = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export function pinDetails(url: URL) {
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // An invalid escape elsewhere in the path should not prevent query-based imports.
  }
  const pin = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)(?=!|$)/);
  const query = url.searchParams.get('query') ?? url.searchParams.get('q');
  const label = path.match(/^\/maps\/(?:place|search)\/([^/]+)/)?.[1].replaceAll('+', ' ');
  const coordinates = pin ?? query?.match(pair) ?? label?.match(pair);
  const latitude = Number(coordinates?.[1]);
  const longitude = Number(coordinates?.[2]);
  // A named place and the viewport centre are not reliable address or pin data.
  const address = [query, label]
    .find((value) => value && !pair.test(value) && /^\s*\d+[a-z]?\s+[^,]+,/i.test(value))
    ?.trim()
    .slice(0, 320);
  return {
    coordinates:
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null,
    address,
  };
}

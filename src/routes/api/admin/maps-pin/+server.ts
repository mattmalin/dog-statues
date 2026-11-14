import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { googleMapsUrl, pinDetails } from '$lib/maps';
import { body } from '$lib/server/input';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const input = await body(request, z.object({ url: z.string().trim().max(2048) }));
  const parsed = googleMapsUrl(input.url);
  if (!parsed) error(422, 'Paste a Google Maps share link.');
  let url: URL = parsed;
  const timeout = AbortSignal.timeout(8000);
  for (
    let hop = 0;
    hop < 4 && (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl');
    hop++
  ) {
    let response: Response;
    try {
      response = await fetch(url, { redirect: 'manual', signal: timeout });
    } catch {
      error(502, 'Could not open the short link. Try the full URL from Google Maps.');
    }
    await response.body?.cancel();
    const target = response.headers.get('location');
    const next =
      target && response.status >= 300 && response.status < 400
        ? googleMapsUrl(URL.parse(target, url)?.href ?? '')
        : null;
    if (!next) error(422, 'Could not open the short link. Try the full URL from Google Maps.');
    url = next;
  }
  if (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl')
    error(422, 'Could not open the short link. Try the full URL from Google Maps.');
  const details = pinDetails(url);
  if (!details.address && details.coordinates && env.ATLAS_REVERSE_GEOCODER_URL) {
    try {
      const lookup = new URL(env.ATLAS_REVERSE_GEOCODER_URL);
      lookup.searchParams.set('lat', String(details.coordinates.latitude));
      lookup.searchParams.set('lon', String(details.coordinates.longitude));
      lookup.searchParams.set('format', 'jsonv2');
      const response = await fetch(lookup, {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const result = await response.json();
        if (typeof result.display_name === 'string' && result.display_name.trim()) {
          return json({ ...details, address: result.display_name.trim().slice(0, 320) });
        }
      }
    } catch {
      // Keep usable pin coordinates when the optional address lookup is unavailable.
    }
  }
  return json(details);
};

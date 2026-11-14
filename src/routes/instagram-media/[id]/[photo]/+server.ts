import type { RequestHandler } from '@sveltejs/kit';
import { uuid } from '$lib/server/input';
import { instagramImage } from '$lib/server/instagram';

export const GET: RequestHandler = ({ params, url }) =>
  instagramImage(uuid(params.id), uuid(params.photo), url);

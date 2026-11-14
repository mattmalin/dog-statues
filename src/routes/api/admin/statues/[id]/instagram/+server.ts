import { json, type RequestHandler } from '@sveltejs/kit';
import { instagramRequest } from '$lib/instagram';
import { body, uuid } from '$lib/server/input';
import { checkInstagram, publishInstagram } from '$lib/server/instagram';

export const GET: RequestHandler = async ({ params }) =>
  json(await checkInstagram(uuid(params.id)));

export const POST: RequestHandler = async ({ params, request }) =>
  json(await publishInstagram(uuid(params.id), await body(request, instagramRequest)));

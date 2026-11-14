import { json, type RequestHandler } from '@sveltejs/kit';
import { instagramDraftSchema, instagramRequest } from '$lib/instagram';
import { body, uuid } from '$lib/server/input';
import { checkInstagram, publishInstagram, saveInstagramDraft } from '$lib/server/instagram';

export const GET: RequestHandler = async ({ params }) =>
  json(await checkInstagram(uuid(params.id)));

export const POST: RequestHandler = async ({ params, request }) =>
  json(await publishInstagram(uuid(params.id), await body(request, instagramRequest)));

export const PUT: RequestHandler = async ({ params, request }) =>
  json(await saveInstagramDraft(uuid(params.id), await body(request, instagramDraftSchema)));

import { json, type RequestHandler } from '@sveltejs/kit';
import { saveSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { getDraft, saveDraft } from '$lib/server/statues';

export const GET: RequestHandler = async ({ params }) => json(await getDraft(uuid(params.id)));

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { revision, fields } = await body(request, saveSchema);
  return json(await saveDraft(uuid(params.id), revision, fields));
};

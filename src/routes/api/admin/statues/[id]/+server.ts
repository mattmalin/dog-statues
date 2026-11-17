import { json, type RequestHandler } from '@sveltejs/kit';
import { saveSchema, deleteRecordSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { getDraft, saveDraft, deleteStatue } from '$lib/server/statues';

export const GET: RequestHandler = async ({ params }) => json(await getDraft(uuid(params.id)));

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { revision, fields } = await body(request, saveSchema);
  return json(await saveDraft(uuid(params.id), revision, fields));
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const { revision } = await body(request, deleteRecordSchema);
  await deleteStatue(uuid(params.id), revision);
  return json({ deleted: true });
};

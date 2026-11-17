import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteRecordSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { deletePotential } from '$lib/server/potential';

export const DELETE: RequestHandler = async ({ params, request }) => {
  const { revision } = await body(request, deleteRecordSchema);
  await deletePotential(uuid(params.id), revision);
  return json({ deleted: true });
};

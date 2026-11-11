import { json, type RequestHandler } from '@sveltejs/kit';
import { publishSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { publish } from '$lib/server/statues';

export const POST: RequestHandler = async ({ params, request }) => {
  const { revision, action, waivePhoto, allowMissingAlt } = await body(request, publishSchema);
  return json(await publish(uuid(params.id), revision, action, waivePhoto, allowMissingAlt));
};

import { json, type RequestHandler } from '@sveltejs/kit';
import { bulkPhotoEditSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { editAllPhotos } from '$lib/server/statues';

export const PATCH: RequestHandler = async ({ params, request }) =>
  json(await editAllPhotos(uuid(params.id), await body(request, bulkPhotoEditSchema)));

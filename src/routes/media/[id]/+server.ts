import type { RequestHandler } from '@sveltejs/kit';
import { uuid } from '$lib/server/input';
import { publicPhoto } from '$lib/server/statues';
import { photoResponse } from '$lib/server/storage';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = uuid(params.id);
  const photo = await publicPhoto(id);
  return photoResponse(
    photo.statue_id,
    id,
    url.searchParams.get('size') === 'thumb' ? 'thumb' : 'web',
  );
};

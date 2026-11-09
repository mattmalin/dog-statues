import { error, json, type RequestHandler } from '@sveltejs/kit';
import { maxUpload, photoEditSchema } from '$lib/model';
import { body, uuid } from '$lib/server/input';
import { addPhoto, editPhoto, existingPhoto } from '$lib/server/statues';
import { photoResponse, preparePhoto } from '$lib/server/storage';

export const GET: RequestHandler = async ({ params, url }) => {
  const statue = uuid(params.id);
  const id = uuid(params.photo);
  const photo = await existingPhoto(statue, id);
  if (!photo) error(404, 'Photo not found.');
  const variant = url.searchParams.get('size');
  return photoResponse(
    statue,
    id,
    variant === 'original' || variant === 'web' ? variant : 'thumb',
    variant === 'original' ? photo.mime_type : 'image/jpeg',
  );
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const statue = uuid(params.id);
  const id = uuid(params.photo);
  if (Number(request.headers.get('content-length')) > maxUpload)
    error(413, 'Choose a photo under 25 MB.');
  if (!request.body) error(422, 'Choose a photo first.');
  const prior = await existingPhoto(statue, id);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxUpload) {
        await reader.cancel();
        error(413, 'Choose a photo under 25 MB.');
      }
      if (!prior) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // Consume the bounded body before acknowledging a retry to keep the socket usable.
  if (prior) return json(prior);
  const image = await preparePhoto(statue, id, Buffer.concat(chunks, length));
  const name = (request.headers.get('x-photo-name') ?? '').slice(0, 3000);
  let original_filename = 'Photo';
  try {
    original_filename =
      decodeURIComponent(name)
        .replace(/[\u0000-\u001f\u007f/\\]/g, '')
        .slice(0, 220) || 'Photo';
  } catch {
    /* A malformed display name doesn't affect the image. */
  }
  const photo = await addPhoto(
    statue,
    {
      id,
      original_filename,
      mime_type: image.mime,
      size_bytes: length,
      width: image.width,
      height: image.height,
    },
    image.store,
  );
  return json(photo);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  return json(
    await editPhoto(uuid(params.id), uuid(params.photo), await body(request, photoEditSchema)),
  );
};

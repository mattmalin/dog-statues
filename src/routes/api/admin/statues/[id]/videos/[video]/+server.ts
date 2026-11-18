import { error, json, type RequestHandler } from '@sveltejs/kit';
import { uuid, body } from '$lib/server/input';
import { getDraft } from '$lib/server/statues';
import { existingVideo, addVideo, editVideo } from '$lib/server/videos';
import { prepareVideo, videoKey } from '$lib/server/video-storage';
import { streamMedia } from '$lib/server/storage';
import { maxVideoUpload, maxVideos, videoEditSchema } from '$lib/video';

export const GET: RequestHandler = async ({ params, request, url }) => {
  const statue = uuid(params.id),
    id = uuid(params.video);
  const video = await existingVideo(statue, id);
  if (!video) error(404, 'Video not found.');
  if (url.searchParams.has('captions'))
    return new Response(video.captions || 'WEBVTT\n\n', {
      headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'private, no-store' },
    });
  const variant = url.searchParams.get('size');
  return streamMedia(
    videoKey(statue, id, variant === 'poster' || variant === 'original' ? variant : 'web'),
    request,
    variant === 'poster' ? 'image/jpeg' : variant === 'original' ? video.mime_type : 'video/mp4',
    variant === 'original',
  );
};
export const PUT: RequestHandler = async ({ params, request }) => {
  const statue = uuid(params.id),
    id = uuid(params.video);
  if (Number(request.headers.get('content-length')) > maxVideoUpload)
    error(413, 'Choose a video under 100 MB.');
  const draft = await getDraft(statue);
  const prior = await existingVideo(statue, id);
  if (prior) {
    const reader = request.body?.getReader();
    let size = 0;
    if (reader)
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxVideoUpload) {
            await reader.cancel();
            error(413, 'Choose a video under 100 MB.');
          }
        }
      } finally {
        reader.releaseLock();
      }
    return json(prior);
  }
  if (draft.videos.length >= maxVideos)
    error(422, `A statue can have up to ${maxVideos} video clips.`);
  let name = 'Video';
  try {
    name =
      decodeURIComponent((request.headers.get('x-video-name') || '').slice(0, 3000))
        .replace(/[\u0000-\u001f\u007f/\\]/g, '')
        .slice(0, 220) || name;
  } catch {
    /* Keep the fallback filename. */
  }
  return json(
    await prepareVideo(request, (video) =>
      addVideo(
        statue,
        {
          id,
          original_filename: name,
          mime_type: video.mime,
          size_bytes: video.size,
          width: video.width,
          height: video.height,
          duration_seconds: video.duration,
        },
        () => video.store(statue, id),
      ),
    ),
  );
};
export const PATCH: RequestHandler = async ({ params, request }) =>
  json(await editVideo(uuid(params.id), uuid(params.video), await body(request, videoEditSchema)));

import { type RequestHandler } from '@sveltejs/kit';
import { uuid } from '$lib/server/input';
import { publicVideo } from '$lib/server/statues';
import { videoKey } from '$lib/server/video-storage';
import { streamMedia } from '$lib/server/storage';

export const GET: RequestHandler = async ({ params, request, url }) => {
  const id = uuid(params.id);
  const { statue_id, video } = await publicVideo(id);
  if (url.searchParams.has('captions'))
    return new Response(video.captions || 'WEBVTT\n\n', {
      headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'private, no-store' },
    });
  const poster = url.searchParams.get('size') === 'poster';
  return streamMedia(
    videoKey(statue_id, id, poster ? 'poster' : 'web'),
    request,
    poster ? 'image/jpeg' : 'video/mp4',
  );
};

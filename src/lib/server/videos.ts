import { error } from '@sveltejs/kit';
import { database, writeLock } from './db';
import { maxVideos, type Video, type videoEditSchema } from '$lib/video';
import type { z } from 'zod';

export const videoColumns =
  'id, statue_id, original_filename, mime_type, size_bytes, width, height, duration_seconds, position, description, credit, captions, rights_status';
type Store = Parameters<Parameters<ReturnType<typeof database>['write']>[0]>[0];
export function getVideos(statue: string, db: Store = database()) {
  return db.all<Video>(
    `SELECT ${videoColumns} FROM video_assets WHERE statue_id=@statue ORDER BY position,id`,
    { statue },
  );
}
export async function existingVideo(statue: string, id: string) {
  const [row] = await database().all<Video>(
    `SELECT ${videoColumns} FROM video_assets WHERE statue_id=@statue AND id=@id`,
    { statue, id },
  );
  return row;
}
async function lock(db: Store, statue: string) {
  const [row] = await db.all<{ id: string }>(
    `SELECT id FROM statues ${writeLock} WHERE id=@statue`,
    { statue },
  );
  if (!row) error(404, 'Statue not found.');
}
export async function addVideo(
  statue: string,
  video: Pick<
    Video,
    | 'id'
    | 'original_filename'
    | 'mime_type'
    | 'size_bytes'
    | 'width'
    | 'height'
    | 'duration_seconds'
  >,
  storeFile: () => Promise<void>,
) {
  return database().write(async (db) => {
    await lock(db, statue);
    const videos = await getVideos(statue, db);
    const prior = videos.find((row) => row.id === video.id);
    if (prior) return prior;
    if (videos.length >= maxVideos) error(422, `A statue can have up to ${maxVideos} video clips.`);
    if ((await db.all('SELECT id FROM video_assets WHERE id=@id', { id: video.id })).length)
      error(409, 'This upload ID is already in use.');
    await storeFile();
    const position = (videos.at(-1)?.position ?? -1) + 1;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO video_assets (id,statue_id,original_filename,mime_type,size_bytes,width,height,duration_seconds,position,created_at)
      VALUES (@id,@statue,@original_filename,@mime_type,@size_bytes,@width,@height,@duration_seconds,@position,@now)`,
      { ...video, statue, position, now },
    );
    await db.run('UPDATE statues SET updated_at=@now WHERE id=@statue', { statue, now });
    return {
      ...video,
      statue_id: statue,
      position,
      description: '',
      credit: '',
      captions: '',
      rights_status: 'private' as const,
    };
  });
}
export async function editVideo(statue: string, id: string, edit: z.infer<typeof videoEditSchema>) {
  return database().write(async (db) => {
    await lock(db, statue);
    const videos = await getVideos(statue, db);
    const index = videos.findIndex((row) => row.id === id);
    const video = videos[index];
    if (!video) error(404, 'Video not found.');
    if (edit.action === 'delete') await db.run('DELETE FROM video_assets WHERE id=@id', { id });
    else if (edit.action === 'details')
      await db.run(
        'UPDATE video_assets SET description=@description, credit=@credit, captions=@captions, rights_status=@rights WHERE id=@id',
        {
          id,
          description: edit.description?.trim() ?? video.description,
          credit: edit.credit?.trim() ?? video.credit,
          captions: edit.captions?.trim() ?? video.captions,
          rights: edit.rights_status ?? video.rights_status,
        },
      );
    else {
      const neighbour = videos[index + (edit.action === 'earlier' ? -1 : 1)];
      if (neighbour) {
        await db.run('UPDATE video_assets SET position=@position WHERE id=@id', {
          id,
          position: neighbour.position,
        });
        await db.run('UPDATE video_assets SET position=@position WHERE id=@id', {
          id: neighbour.id,
          position: video.position,
        });
      }
    }
    await db.run('UPDATE statues SET updated_at=@now WHERE id=@statue', {
      statue,
      now: new Date().toISOString(),
    });
    return { videos: await getVideos(statue, db) };
  });
}

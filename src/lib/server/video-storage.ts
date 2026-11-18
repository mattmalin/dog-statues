import { mkdtemp, open, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { error, isHttpError } from '@sveltejs/kit';
import { maxVideoSeconds, maxVideoUpload } from '$lib/video';
import { putMediaFile } from './storage';
import { videoTool } from './video-tools';

const exec = promisify(execFile);
let processing = false;
const key = (statue: string, id: string, variant: string) => `${statue}/videos/${id}/${variant}`;
export const videoKey = key;

// Disk-backed uploads avoid buffering a phone video in the app's memory.
export async function prepareVideo(
  request: Request,
  work: (video: {
    size: number;
    width: number;
    height: number;
    duration: number;
    mime: string;
    store: (statue: string, id: string) => Promise<void>;
  }) => Promise<unknown>,
) {
  if (Number(request.headers.get('content-length')) > maxVideoUpload)
    error(413, 'Choose a video under 100 MB.');
  if (!request.body) error(422, 'Choose a video first.');
  if (processing) error(429, 'Another video is processing. Retry this clip shortly.');
  processing = true;
  let folder: string | undefined;
  let prepared = false;
  try {
    folder = await mkdtemp(join(tmpdir(), 'atlas-video-'));
    const input = join(folder, 'upload');
    const file = await open(input, 'wx');
    const reader = request.body.getReader();
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxVideoUpload) {
          await reader.cancel();
          error(413, 'Choose a video under 100 MB.');
        }
        await file.writeFile(value);
      }
    } finally {
      reader.releaseLock();
      await file.close();
    }
    // Restrict both protocols and demuxers: an uploaded playlist must never fetch URLs/files.
    const restrictions = ['-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm'];
    const { stdout } = await exec(
      videoTool('ffprobe'),
      ['-v', 'error', ...restrictions, '-show_format', '-show_streams', '-of', 'json', input],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const info = JSON.parse(stdout);
    const stream = info.streams?.find(
      (item: { codec_type: string; disposition?: { attached_pic?: number } }) =>
        item.codec_type === 'video' && !item.disposition?.attached_pic,
    );
    const duration = Number(info.format?.duration ?? stream?.duration);
    if (!stream || !Number.isFinite(duration) || duration <= 0 || !stream.width || !stream.height)
      error(415, 'Choose a valid MP4, MOV or WebM video.');
    if (duration > maxVideoSeconds)
      error(422, `Choose a clip up to ${maxVideoSeconds} seconds long.`);
    if (stream.width > 4096 || stream.height > 4096 || stream.width * stream.height > 9_000_000)
      error(422, 'Choose a video up to 4K resolution.');
    const web = join(folder, 'web.mp4');
    await exec(
      videoTool('ffmpeg'),
      [
        '-nostdin',
        '-v',
        'error',
        '-xerror',
        '-threads',
        '1',
        ...restrictions,
        '-i',
        input,
        '-map',
        `0:${stream.index}`,
        '-map',
        '0:a:0?',
        '-t',
        String(maxVideoSeconds),
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
        '-vf',
        "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-filter_threads',
        '1',
        '-preset',
        'veryfast',
        '-crf',
        '26',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        web,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const poster = join(folder, 'poster.jpg');
    await exec(
      videoTool('ffmpeg'),
      [
        '-nostdin',
        '-v',
        'error',
        '-threads',
        '1',
        '-i',
        web,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        poster,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const image = await sharp(await readFile(poster)).metadata();
    const format = String(info.format.format_name);
    const mime =
      format.includes('webm') || format.includes('matroska')
        ? 'video/webm'
        : String(info.format.tags?.major_brand).trim() === 'qt'
          ? 'video/quicktime'
          : 'video/mp4';
    prepared = true;
    return await work({
      size,
      width: image.width!,
      height: image.height!,
      duration,
      mime,
      async store(statue, id) {
        await putMediaFile(key(statue, id, 'original'), input);
        await putMediaFile(key(statue, id, 'web'), web);
        await putMediaFile(key(statue, id, 'poster'), poster);
      },
    });
  } catch (cause) {
    if (prepared) throw cause;
    if (isHttpError(cause)) throw cause;
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT')
      error(503, 'Video tools are unavailable. Install FFmpeg and ffprobe, then retry.');
    error(415, 'This video could not be processed. Try a shorter MP4, MOV or WebM clip.');
  } finally {
    if (
      folder &&
      dirname(resolve(folder)) === resolve(tmpdir()) &&
      basename(folder).startsWith('atlas-video-')
    )
      await rm(folder, { recursive: true, force: true }).catch(() => {});
    processing = false;
  }
}

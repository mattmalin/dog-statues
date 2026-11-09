import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import { config } from './config';

const service = config.blobConnection
  ? BlobServiceClient.fromConnectionString(config.blobConnection)
  : config.blobAccount
    ? new BlobServiceClient(config.blobAccount, new DefaultAzureCredential())
    : null;
const container = service?.getContainerClient(config.blobContainer);
const filePath = (key: string) => join(config.dataDir, 'media', key);
export type Variant = 'web' | 'thumb' | 'original';
export const photoKey = (statue: string, id: string, variant: Variant) =>
  `${statue}/${id}/${variant}`;

async function put(key: string, contents: Buffer) {
  if (container) {
    await container.getBlockBlobClient(key).uploadData(contents);
    return;
  }
  const target = filePath(key);
  const temporary = target + '.' + randomUUID() + '.tmp';
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readPhoto(statue: string, id: string, variant: Variant) {
  const key = photoKey(statue, id, variant);
  try {
    return container
      ? await container.getBlockBlobClient(key).downloadToBuffer()
      : await readFile(filePath(key));
  } catch (cause) {
    if (
      (cause as { code?: string; statusCode?: number }).code === 'ENOENT' ||
      (cause as { statusCode?: number }).statusCode === 404
    )
      error(404, 'Photo file not found.');
    throw cause;
  }
}

export async function photoResponse(
  statue: string,
  id: string,
  variant: Variant,
  mime = 'image/jpeg',
) {
  const contents = await readPhoto(statue, id, variant);
  return new Response(new Uint8Array(contents), {
    headers: {
      'content-type': mime,
      'cache-control': 'private, no-store',
      ...(variant === 'original' ? { 'content-disposition': 'attachment' } : {}),
    },
  });
}

let processing = 0;
const supported = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/avif',
} as const;

export async function preparePhoto(statue: string, id: string, original: Buffer) {
  if (processing >= 2) error(429, 'The photo processor is busy. Retry this photo shortly.');
  processing++;
  try {
    const image = sharp(original, { limitInputPixels: 65_000_000, failOn: 'warning' });
    const info = await image.metadata();
    const mime = supported[info.format as keyof typeof supported];
    if (!mime || (info.pages ?? 1) > 1 || (info.format === 'heif' && info.compression !== 'av1')) {
      error(415, 'Choose a still JPEG, PNG, WebP or AVIF photo.');
    }
    // Sharp verifies the decoded image and strips metadata on both public derivatives.
    const { data: web, info: size } = await image
      .autoOrient()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 83, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(web)
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 77 })
      .toBuffer();
    return {
      mime,
      width: size.width,
      height: size.height,
      async store() {
        // Publish the database row only once all three files are durable.
        await put(photoKey(statue, id, 'original'), original);
        await put(photoKey(statue, id, 'web'), web);
        await put(photoKey(statue, id, 'thumb'), thumb);
      },
    };
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
    error(
      415,
      'This image could not be decoded. Try a JPEG, PNG, WebP or AVIF under 65 megapixels.',
    );
  } finally {
    processing--;
  }
}

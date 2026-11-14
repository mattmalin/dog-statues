import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
  instagramCaption,
  instagramDraftSchema,
  cropBounds,
  defaultCrop,
  squareCropSchema,
  type InstagramDraft,
  type SquareCrop,
  instagramHandle,
  type InstagramPublication,
  type instagramRequest,
} from '$lib/instagram';
import { database } from './db';
import { existingPhoto, getDraft } from './statues';

const accountId = '17841453331510910';
const version = 'v27.0';
const graphOrigin = 'https://graph.facebook.com';
const publicOrigin = 'https://www.dogstatues.co.uk';
const preparationWindow = 5 * 60_000;
type Publication = InstagramPublication & {
  attempt_id: string;
  container_id: string | null;
  updated_at: string;
};
type Store = Parameters<Parameters<ReturnType<typeof database>['write']>[0]>[0];

export function instagramEnabled() {
  return Boolean(env.INSTAGRAM_ACCESS_TOKEN?.trim());
}

async function publication(db: Store, id: string) {
  const [row] = await db.all<Publication>(
    'SELECT attempt_id, status, container_id, updated_at, permalink FROM instagram_publications WHERE statue_id=@id',
    { id },
  );
  return row;
}

export async function instagramStatus(id: string): Promise<InstagramPublication | null> {
  const row = await publication(database(), id);
  if (!row) return null;
  return {
    status:
      row.status === 'preparing' && Date.now() - Date.parse(row.updated_at) > preparationWindow
        ? 'failed'
        : row.status,
    permalink: row.permalink,
  };
}

export async function readInstagramDraft(id: string) {
  const [row] = await database().all<{ instagram_draft: string | null }>(
    'SELECT instagram_draft FROM statues WHERE id=@id',
    { id },
  );
  return row?.instagram_draft ? instagramDraftSchema.parse(JSON.parse(row.instagram_draft)) : null;
}

export async function saveInstagramDraft(id: string, draft: InstagramDraft) {
  return database().write(async (tx) => {
    const { photos } = await getDraft(id, tx, true);
    const approved = new Set(
      photos.filter((photo) => photo.rights_status === 'approved').map((photo) => photo.id),
    );
    const saved = {
      photoIds: [...new Set(draft.photoIds)].filter((photo) => approved.has(photo)),
      crops: Object.fromEntries(
        Object.entries(draft.crops).filter(([photo]) => approved.has(photo)),
      ),
    };
    await tx.run('UPDATE statues SET instagram_draft=@draft WHERE id=@id', {
      id,
      draft: JSON.stringify(saved),
    });
    return saved;
  });
}

function signature(statueId: string, photoId: string, expires: number, crop: string) {
  return createHmac('sha256', env.INSTAGRAM_ACCESS_TOKEN!)
    .update(`instagram-image:${statueId}:${photoId}:${expires}${crop ? ':' + crop : ''}`)
    .digest('hex');
}

function imageUrl(statueId: string, photoId: string, expires: number, crop: SquareCrop) {
  const value = [crop.x, crop.y, crop.zoom].join(',');
  const query = new URLSearchParams({
    expires: String(expires),
    crop: value,
    signature: signature(statueId, photoId, expires, value),
  });
  return `${publicOrigin}/instagram-media/${statueId}/${photoId}?${query}`;
}

export async function instagramImage(statueId: string, photoId: string, url: URL) {
  const expires = Number(url.searchParams.get('expires'));
  const supplied = url.searchParams.get('signature') ?? '';
  const value = url.searchParams.get('crop') ?? '';
  if (
    !instagramEnabled() ||
    !Number.isSafeInteger(expires) ||
    expires <= Date.now() ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(
      Buffer.from(supplied),
      Buffer.from(signature(statueId, photoId, expires, value)),
    )
  ) {
    error(404, 'Photo not found.');
  }
  if ((await existingPhoto(statueId, photoId))?.rights_status !== 'approved')
    error(404, 'Photo not found.');
  const { readPhoto } = await import('./storage');
  const { default: sharp } = await import('sharp');
  const image = sharp(await readPhoto(statueId, photoId, 'web'));
  const [x, y, zoom] = value.split(',').map(Number);
  const crop = value ? squareCropSchema.parse({ x, y, zoom }) : null;
  const { width, height } = await image.metadata();
  const jpeg = await (
    crop
      ? image.extract(cropBounds(width, height, crop)).resize(1080, 1080)
      : image.resize(1080, 1080, { fit: 'contain', background: '#ffffff' })
  )
    .jpeg({ quality: 88 })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

async function graph(path: string, fetcher: typeof fetch, fields?: Record<string, string>) {
  const operation = path.endsWith('/media_publish')
    ? 'publish'
    : path.endsWith('/media')
      ? 'create container'
      : path.includes('status_code')
        ? 'check container'
        : path.includes('permalink')
          ? 'read permalink'
          : 'verify account';
  let response: Response;
  try {
    response = await fetcher(`${graphOrigin}/${version}/${path}`, {
      method: fields ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN!.trim()}` },
      body: fields ? new URLSearchParams(fields) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    console.error('Instagram network request failed', {
      operation,
      type: cause instanceof Error ? cause.name : 'Unknown',
    });
    error(502, `Could not reach Instagram to ${operation}. Try again in a moment.`);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    console.error('Instagram returned an unreadable response', {
      operation,
      status: response.status,
    });
    error(502, `Instagram returned an unreadable response while trying to ${operation}.`);
  }
  if (!response.ok || data.error) {
    console.error('Instagram rejected a request', {
      operation,
      status: response.status,
      code: Number(data.error?.code) || undefined,
      subcode: Number(data.error?.error_subcode) || undefined,
    });
    if (data.error?.code === 190)
      error(502, 'Instagram rejected the token. Update the Atlas Instagram secret.');
    if (data.error?.code === 10 || data.error?.code === 200)
      error(
        502,
        'Check the token’s Instagram publishing permission and Dog Statues account access.',
      );
    error(502, 'Instagram could not process the request. Check the account and photos.');
  }
  return data;
}

const metaId = z.string().regex(/^\d{1,32}$/);

async function waitForContainer(id: string, fetcher: typeof fetch) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { status_code } = await graph(`${id}?fields=status_code`, fetcher);
    if (status_code === 'FINISHED') return;
    if (status_code !== 'IN_PROGRESS') error(502, 'Instagram rejected a photo or carousel.');
    await delay(2000);
  }
  error(502, 'Instagram is still processing the photos. Try again later.');
}

export async function publishInstagram(
  id: string,
  input: z.infer<typeof instagramRequest>,
  fetcher: typeof fetch = fetch,
) {
  if (!instagramEnabled()) error(503, 'Instagram publishing needs an Atlas server access token.');
  const db = database();
  const attempt = randomUUID();
  const timestamp = () => new Date().toISOString();
  const chosen = await db.write(async (tx) => {
    const { statue, photos } = await getDraft(id, tx, true);
    const prior = await publication(tx, id);
    if (
      prior &&
      (prior.status === 'published' ||
        prior.status === 'unknown' ||
        (prior.status === 'preparing' &&
          Date.now() - Date.parse(prior.updated_at) <= preparationWindow))
    ) {
      error(409, 'Check the existing Instagram publishing status before trying again.');
    }
    const selected = photos.filter(
      (photo) => photo.rights_status === 'approved' && input.photoIds.includes(photo.id),
    );
    if (
      instagramCaption(statue.web_description, statue.city, statue.country) !== input.caption ||
      selected.map((photo) => photo.id).join(',') !== input.photoIds.join(',')
    ) {
      error(409, 'The caption or photos changed. Save and review the post again.');
    }
    if (prior) await tx.run('DELETE FROM instagram_publications WHERE statue_id=@id', { id });
    await tx.run(
      "INSERT INTO instagram_publications (statue_id, attempt_id, status, payload, updated_at) VALUES (@id,@attempt,'preparing',@payload,@now)",
      { id, attempt, payload: JSON.stringify({ accountId, ...input }), now: timestamp() },
    );
    return selected;
  });

  let sending = false;
  let stage = 'account verification';
  try {
    const account = await graph(`${accountId}?fields=id,username`, fetcher);
    if (account.id !== accountId || `@${account.username}` !== instagramHandle) {
      error(502, 'Instagram did not confirm the configured Dog Statues account.');
    }
    const expires = Date.now() + preparationWindow;
    const media = `${accountId}/media`;
    const create = async (fields: Record<string, string>) => {
      const result = metaId.safeParse((await graph(media, fetcher, fields)).id);
      if (!result.success) {
        console.error('Instagram response omitted a valid container ID', { stage });
        error(502, 'Instagram did not return a valid photo or carousel ID.');
      }
      return result.data;
    };
    stage = 'photo container creation';
    const children = await Promise.all(
      chosen.map((photo) =>
        create({
          image_url: imageUrl(id, photo.id, expires, input.crops?.[photo.id] ?? defaultCrop),
          ...(chosen.length > 1 ? { is_carousel_item: 'true' } : { caption: input.caption }),
          ...(photo.alt_text ? { alt_text: photo.alt_text } : {}),
        }),
      ),
    );
    stage = 'photo processing';
    await Promise.all(children.map((child) => waitForContainer(child, fetcher)));
    stage = 'carousel preparation';
    const container =
      children.length === 1
        ? children[0]
        : await create({
            media_type: 'CAROUSEL',
            children: children.join(','),
            caption: input.caption,
          });
    if (children.length > 1) await waitForContainer(container, fetcher);
    stage = 'recording publishing attempt';
    await db.write(async (tx) => {
      await getDraft(id, tx, true);
      if ((await publication(tx, id))?.attempt_id !== attempt)
        error(409, 'A newer attempt replaced this one.');
      // Persist uncertainty before the irreversible request, including across process restarts.
      await tx.run(
        "UPDATE instagram_publications SET status='unknown', container_id=@container, updated_at=@now WHERE statue_id=@id AND attempt_id=@attempt",
        { id, attempt, container, now: timestamp() },
      );
    });
    sending = true;
    const post = metaId.parse(
      (await graph(`${accountId}/media_publish`, fetcher, { creation_id: container })).id,
    );
    await db.run(
      "UPDATE instagram_publications SET status='published', post_id=@post, updated_at=@now WHERE statue_id=@id AND attempt_id=@attempt",
      { id, attempt, post, now: timestamp() },
    );
    const result = await graph(`${post}?fields=permalink`, fetcher).catch(() => null);
    const permalink =
      typeof result?.permalink === 'string' &&
      /^https:\/\/www\.instagram\.com\/p\/[\w-]+\/?$/.test(result.permalink)
        ? result.permalink
        : null;
    if (permalink)
      await db.run(
        'UPDATE instagram_publications SET permalink=@permalink WHERE statue_id=@id AND attempt_id=@attempt',
        { id, attempt, permalink },
      );
    return { status: 'published', permalink } satisfies InstagramPublication;
  } catch (cause) {
    if (sending)
      error(
        502,
        'Instagram’s result could not be confirmed. Check the publishing status before trying again.',
      );
    await db.run(
      "UPDATE instagram_publications SET status='failed', updated_at=@now WHERE statue_id=@id AND attempt_id=@attempt AND status='preparing'",
      { id, attempt, now: timestamp() },
    );
    if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
    console.error('Instagram preparation failed', {
      stage,
      type: cause instanceof Error ? cause.name : 'Unknown',
    });
    error(502, `Instagram preparation failed during ${stage}. Try again.`);
  }
}

export async function checkInstagram(id: string) {
  const db = database();
  const row = await publication(db, id);
  if (instagramEnabled() && row?.status === 'unknown' && row.container_id) {
    const { status_code } = await graph(`${row.container_id}?fields=status_code`, fetch);
    if (status_code === 'PUBLISHED') {
      await db.run(
        "UPDATE instagram_publications SET status='published' WHERE statue_id=@id AND attempt_id=@attempt AND status='unknown'",
        { id, attempt: row.attempt_id },
      );
    }
  }
  return instagramStatus(id);
}

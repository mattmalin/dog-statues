import copy from '$lib/public-copy.json';
import { error } from '@sveltejs/kit';
import {
  initialFields,
  maxPhotos,
  type Fields,
  type Statue,
  type Photo,
  type PublicStatue,
  type PublicPhoto,
} from '$lib/model';
import { database, writeLock } from './db';
import { searchText, type DraftListRow } from '$lib/record-lists';

const fieldNames = Object.keys(initialFields) as (keyof Fields)[];
const adminColumns = `id, ${fieldNames.join(', ')}, slug, web_status, web_published_at,
  updated_at, created_at, revision, cover_media_id, photo_waiver`;
const photoColumns = `id, statue_id, original_filename, mime_type, size_bytes, width, height, position,
  alt_text, credit, rights_status`;

const slugFor = (title: string, id: string) => {
  const prefix = title
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 100)
    .replace(/^-+|-+$/g, '');
  return (prefix || 'statue') + '-' + id;
};

type Database = ReturnType<typeof database>;
type Transaction = Parameters<Parameters<Database['write']>[0]>[0];
type StoredStatue = Omit<Statue, 'sources'> & { sources: string };

function decodeStatue(row: StoredStatue): Statue {
  return { ...row, sources: JSON.parse(row.sources), photo_waiver: Boolean(row.photo_waiver) };
}

async function lock(db: Transaction, id: string) {
  const [row] = await db.all<StoredStatue>(
    `SELECT ${adminColumns} FROM statues ${writeLock} WHERE id=@id`,
    { id },
  );
  return row ? decodeStatue(row) : undefined;
}

function checkRevision(row: Statue | undefined, revision: number): asserts row is Statue {
  if (!row) error(404, 'Statue not found.');
  if (row.revision !== revision)
    error(409, 'A newer version was saved. Review it before replacing your edits.');
}

export async function createDraft(id: string) {
  await database().write(async (db) => {
    if (await lock(db, id)) return;
    const now = new Date().toISOString();
    await db.run('INSERT INTO statues (id, created_at, updated_at) VALUES (@id, @now, @now)', {
      id,
      now,
    });
  });
}

export async function listDrafts(inbox: boolean) {
  const rows = await database().all<
    StoredStatue & { instagram_draft: string | null; thumbnail_media_id: string | null }
  >(
    `WITH ranked_photos AS (
      SELECT p.id, p.statue_id, ROW_NUMBER() OVER (
        PARTITION BY p.statue_id ORDER BY CASE WHEN p.id=s.cover_media_id THEN 0 ELSE 1 END, p.position, p.id
      ) AS photo_rank FROM media_assets p JOIN statues s ON s.id=p.statue_id
    )
    SELECT ${adminColumns
      .split(',')
      .map((column) => 's.' + column.trim())
      .join(', ')},
      s.instagram_draft, p.id AS thumbnail_media_id
    FROM statues s LEFT JOIN ranked_photos p ON p.statue_id=s.id AND p.photo_rank=1
      ${inbox ? "WHERE s.web_status <> 'published' AND s.editorial_status <> 'ready'" : ''}
      ORDER BY s.updated_at DESC`,
  );
  const photos = await database().all<Photo>(`SELECT ${photoColumns} FROM media_assets
    WHERE statue_id IN (SELECT id FROM statues ${inbox ? "WHERE web_status <> 'published' AND editorial_status <> 'ready'" : ''})`);
  const byStatue = new Map<string, Photo[]>();
  for (const photo of photos) {
    const key = photo.statue_id.toLowerCase();
    const group = byStatue.get(key) ?? [];
    group.push(photo);
    byStatue.set(key, group);
  }
  return rows.map((stored): DraftListRow => {
    const row = decodeStatue(stored);
    const images = byStatue.get(row.id.toLowerCase()) ?? [];
    let instagramDraft: unknown = stored.instagram_draft;
    try {
      instagramDraft = JSON.parse(stored.instagram_draft || 'null');
    } catch {
      /* Search legacy text as stored. */
    }
    return {
      ...row,
      instagram_draft: stored.instagram_draft,
      thumbnail_media_id: stored.thumbnail_media_id,
      photo_count: images.length,
      missing_alt: images.some(
        (image) => image.rights_status === 'approved' && !image.alt_text.trim(),
      ),
      search_text: searchText({ ...row, photos: images, instagram_draft: instagramDraft }),
    };
  });
}

export async function getDraft(id: string, db: Transaction = database(), lockRow = false) {
  const [statue] = await db.all<StoredStatue>(
    `SELECT ${adminColumns} FROM statues ${lockRow ? writeLock : ''} WHERE id=@id`,
    { id },
  );
  if (!statue) error(404, 'Statue not found.');
  return {
    statue: decodeStatue(statue),
    photos: await getPhotos(db, id),
  };
}

function getPhotos(db: Transaction, id: string) {
  return db.all<Photo>(
    `SELECT ${photoColumns} FROM media_assets WHERE statue_id=@id ORDER BY position, id`,
    { id },
  );
}

export async function saveDraft(id: string, revision: number, fields: Fields) {
  return database().write(async (db) => {
    const row = await lock(db, id);
    checkRevision(row, revision);
    await db.run(
      `UPDATE statues SET ${fieldNames.map((name) => `${name}=@${name}`).join(', ')},
        revision=revision+1, updated_at=@now WHERE id=@id`,
      { ...fields, sources: JSON.stringify(fields.sources), id, now: new Date().toISOString() },
    );
    return { revision: revision + 1 };
  });
}

export async function deleteStatue(id: string, revision: number) {
  await database().write(async (db) => {
    const row = await lock(db, id);
    if (!row) error(404, 'Statue not found.');
    if (row.revision !== revision) error(409, 'This statue changed. Reload it before deleting.');
    const [instagram] = await db.all<{ status: string }>(
      `SELECT status FROM instagram_publications ${writeLock} WHERE statue_id=@id`,
      { id },
    );
    if (instagram && ['preparing', 'unknown'].includes(instagram.status))
      error(
        409,
        'Check the Instagram publishing status before deleting this statue. A post may still be in progress.',
      );
    await db.run('DELETE FROM instagram_publications WHERE statue_id=@id', { id });
    await db.run('DELETE FROM media_assets WHERE statue_id=@id', { id });
    await db.run('DELETE FROM statues WHERE id=@id', { id });
  });
}

function validatePublication(fields: Fields, photosReady: boolean) {
  if (!fields.title.trim()) error(422, 'Add a name before publishing.');
  if (!fields.web_description.trim()) error(422, 'Write the public description before publishing.');
  if (
    !(fields.city.trim() && fields.country.trim()) &&
    (fields.latitude === null || fields.longitude === null)
  ) {
    error(422, 'Add a city and country, or both coordinates.');
  }
  if (!photosReady) error(422, 'Approve a photo, or explicitly publish without photos.');
}

export async function publish(
  id: string,
  revision: number,
  action: 'publish' | 'unpublish',
  waivePhoto: boolean,
  allowMissingAlt = false,
) {
  return database().write(async (db) => {
    const row = await lock(db, id);
    checkRevision(row, revision);
    const now = new Date().toISOString();
    if (action === 'publish') {
      const photos = await getPhotos(db, id);
      validatePublication(row, waivePhoto || photos.some(isPublicPhoto));
      if (
        !allowMissingAlt &&
        photos.some((photo) => isPublicPhoto(photo) && !photo.alt_text.trim())
      ) {
        error(
          422,
          'Some approved photos need alt text. Review the photos or confirm publication without alt text.',
        );
      }
      const slug = row.slug ?? slugFor(row.title, id);
      const snapshot = publicVersion({ ...row, slug }, photos);
      await db.run(
        `UPDATE statues SET slug=@slug, web_status='published', web_published_at=COALESCE(web_published_at,@now),
         published_snapshot=@snapshot, photo_waiver=@waiver, updated_at=@now, revision=revision+1 WHERE id=@id`,
        { slug, now, id, snapshot: JSON.stringify(snapshot), waiver: Number(waivePhoto) },
      );
      return { slug, revision: revision + 1, web_status: 'published' as const };
    }
    await db.run(
      "UPDATE statues SET web_status='hidden', updated_at=@now, revision=revision+1 WHERE id=@id",
      { id, now },
    );
    return { slug: row.slug, revision: revision + 1, web_status: 'hidden' as const };
  });
}

const isPublicPhoto = (photo: Photo) => photo.rights_status === 'approved';

export async function existingPhoto(statue: string, id: string) {
  const [row] = await database().all<Photo>(
    `SELECT ${photoColumns} FROM media_assets WHERE id=@id AND statue_id=@statue`,
    { id, statue },
  );
  return row;
}

type NewPhoto = Omit<Photo, 'statue_id' | 'position' | 'alt_text' | 'credit' | 'rights_status'>;

export async function addPhoto(statue: string, photo: NewPhoto, storeFile: () => Promise<void>) {
  return database().write(async (db) => {
    if (!(await lock(db, statue))) error(404, 'Statue not found.');
    const photos = await getPhotos(db, statue);
    const existing = photos.find((item) => item.id === photo.id);
    if (existing) return existing;
    if (photos.length >= maxPhotos) error(422, `A statue can have up to ${maxPhotos} photos.`);
    const [collision] = await db.all<{ id: string }>(
      `SELECT id FROM media_assets ${writeLock} WHERE id=@id`,
      { id: photo.id },
    );
    if (collision) error(409, 'This upload ID is already in use.');
    await storeFile();
    const position = (photos.at(-1)?.position ?? -1) + 1;
    await db.run(
      `INSERT INTO media_assets (id, statue_id, original_filename, mime_type, size_bytes, width, height, position, created_at)
        VALUES (@id,@statue,@original_filename,@mime_type,@size_bytes,@width,@height,@position,@now)`,
      { ...photo, statue, position, now: new Date().toISOString() },
    );
    return {
      ...photo,
      statue_id: statue,
      position,
      alt_text: '',
      credit: '',
      rights_status: 'private' as const,
    };
  });
}

export async function editPhoto(
  statue: string,
  id: string,
  edit: {
    action: 'details' | 'cover' | 'earlier' | 'later' | 'delete';
    alt_text?: string;
    credit?: string;
    rights_status?: 'private' | 'approved';
  },
) {
  return database().write(async (db) => {
    const row = await lock(db, statue);
    if (!row) error(404, 'Statue not found.');
    const photos = await getPhotos(db, statue);
    const index = photos.findIndex((item) => item.id === id);
    const photo = photos[index];
    if (!photo) error(404, 'Photo not found.');
    let cover = row.cover_media_id;
    if (edit.action === 'details' || edit.action === 'delete') {
      const next = {
        ...photo,
        alt_text: edit.alt_text?.trim() ?? photo.alt_text,
        credit: edit.credit?.trim() ?? photo.credit,
        rights_status: edit.rights_status ?? photo.rights_status,
      };
      if (edit.action === 'delete') {
        if (cover === id) cover = null;
        await db.run('DELETE FROM media_assets WHERE id=@id', { id });
      } else {
        await db.run(
          'UPDATE media_assets SET alt_text=@alt, credit=@credit, rights_status=@rights WHERE id=@id',
          { id, alt: next.alt_text, credit: next.credit, rights: next.rights_status },
        );
      }
    } else if (edit.action === 'cover') {
      cover = id;
    } else {
      const neighbour = photos[index + (edit.action === 'earlier' ? -1 : 1)];
      if (neighbour) {
        await db.run('UPDATE media_assets SET position=@position WHERE id=@id', {
          id,
          position: neighbour.position,
        });
        await db.run('UPDATE media_assets SET position=@position WHERE id=@id', {
          id: neighbour.id,
          position: photo.position,
        });
      }
    }
    await db.run('UPDATE statues SET cover_media_id=@cover, updated_at=@now WHERE id=@statue', {
      cover,
      statue,
      now: new Date().toISOString(),
    });
    return { cover, photos: await getPhotos(db, statue) };
  });
}

export async function editAllPhotos(
  statue: string,
  edit: { action: 'approve' } | { action: 'credit'; credit: string },
) {
  return database().write(async (db) => {
    const row = await lock(db, statue);
    if (!row) error(404, 'Statue not found.');
    if (edit.action === 'approve') {
      await db.run("UPDATE media_assets SET rights_status='approved' WHERE statue_id=@statue", {
        statue,
      });
    } else {
      await db.run('UPDATE media_assets SET credit=@credit WHERE statue_id=@statue', {
        statue,
        credit: edit.credit,
      });
    }
    await db.run('UPDATE statues SET updated_at=@now WHERE id=@statue', {
      statue,
      now: new Date().toISOString(),
    });
    return { cover: row.cover_media_id, photos: await getPhotos(db, statue) };
  });
}

type PublicVersion = { statue: PublicStatue; photos: PublicPhoto[] };

function publicVersion(row: Statue & { slug: string }, photos: Photo[]): PublicVersion {
  const {
    title,
    short_summary,
    web_description,
    address,
    city,
    region,
    country,
    postal_code,
    google_maps_url,
    latitude,
    longitude,
    cover_media_id,
    slug,
  } = row;
  return {
    statue: {
      title,
      short_summary,
      web_description,
      address,
      city,
      region,
      country,
      postal_code,
      google_maps_url,
      latitude,
      longitude,
      cover_media_id,
      slug,
    },
    photos: photos.filter(isPublicPhoto).map(({ id, alt_text, credit, width, height }) => ({
      id,
      alt_text,
      credit,
      width,
      height,
    })),
  };
}

function withCover(version: PublicVersion, preview = false, id?: string) {
  const { statue, photos } = version;
  const cover =
    photos.find((photo) => photo.id === statue.cover_media_id?.toLowerCase()) ?? photos[0];
  return { statue: { ...statue, cover_media_id: cover?.id ?? null }, cover, photos, preview, id };
}

async function publishedVersions() {
  const rows = await database().all<{
    id: string;
    web_published_at: string;
    published_snapshot: string;
  }>(
    "SELECT id, web_published_at, published_snapshot FROM statues WHERE web_status='published' AND published_snapshot IS NOT NULL ORDER BY web_published_at DESC, slug",
  );
  return rows.map((row) => ({
    ...withCover(JSON.parse(row.published_snapshot)),
    id: row.id,
    web_published_at: row.web_published_at,
  }));
}

export async function listFeedEntries() {
  return (await publishedVersions()).map(({ id, web_published_at, statue }) => ({
    id,
    web_published_at,
    slug: statue.slug,
    title: statue.title,
    short_summary: statue.short_summary,
  }));
}

export async function listPublicStatues() {
  return (await publishedVersions()).map(({ statue, cover }) => ({
    slug: statue.slug,
    title: statue.title,
    short_summary: statue.short_summary,
    city: statue.city,
    region: statue.region,
    country: statue.country,
    photo_id: cover?.id ?? null,
    alt_text: cover?.alt_text ?? null,
    credit: cover?.credit ?? null,
  }));
}

export async function getPublicStatue(slug: string) {
  const [row] = await database().all<{ published_snapshot: string }>(
    "SELECT published_snapshot FROM statues WHERE slug=@slug AND web_status='published' AND published_snapshot IS NOT NULL",
    { slug },
  );
  if (!row) error(404, copy.statue.unavailable);
  return withCover(JSON.parse(row.published_snapshot));
}

export async function getPreview(id: string) {
  const { statue, photos } = await getDraft(id);
  return withCover(
    publicVersion({ ...statue, slug: statue.slug ?? slugFor(statue.title, id) }, photos),
    true,
    id,
  );
}

export async function publicPhoto(id: string) {
  const version = (await publishedVersions()).find((item) =>
    item.photos.some((photo) => photo.id === id),
  );
  if (!version) error(404, 'Photo not found.');
  return { statue_id: version.id };
}

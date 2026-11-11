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

async function lock(db: Transaction, id: string) {
  const [row] = await db.all<Statue>(
    `SELECT ${adminColumns} FROM statues ${writeLock} WHERE id=@id`,
    { id },
  );
  return row;
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
  return database().all<
    Pick<
      Statue,
      'id' | 'title' | 'city' | 'country' | 'web_status' | 'editorial_status' | 'updated_at'
    >
  >(
    `SELECT id, title, city, country, web_status, editorial_status, updated_at FROM statues
      ${inbox ? "WHERE web_status <> 'published' AND editorial_status <> 'ready'" : ''}
      ORDER BY updated_at DESC`,
  );
}

export async function getDraft(id: string) {
  const db = database();
  const [statue] = await db.all<Statue>(`SELECT ${adminColumns} FROM statues WHERE id=@id`, { id });
  if (!statue) error(404, 'Statue not found.');
  return {
    statue: { ...statue, photo_waiver: Boolean(statue.photo_waiver) },
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
    if (row.web_status === 'published') validatePublication(fields, true);
    await db.run(
      `UPDATE statues SET ${fieldNames.map((name) => `${name}=@${name}`).join(', ')},
        revision=revision+1, updated_at=@now WHERE id=@id`,
      { ...fields, id, now: new Date().toISOString() },
    );
    return { revision: revision + 1 };
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
      await db.run(
        `UPDATE statues SET slug=@slug, web_status='published', web_published_at=COALESCE(web_published_at,@now),
         photo_waiver=@waiver, updated_at=@now, revision=revision+1 WHERE id=@id`,
        { slug, now, id, waiver: Number(waivePhoto) },
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
      if (
        row.web_status === 'published' &&
        !row.photo_waiver &&
        !photos.some((item) =>
          item.id === id ? edit.action === 'details' && isPublicPhoto(next) : isPublicPhoto(item),
        )
      ) {
        error(422, 'Approve another photo or unpublish before removing the last public photo.');
      }
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

export async function getPublicStatue(slug: string) {
  const db = database();
  const [statue] = await db.all<PublicStatue>(
    `SELECT slug,title,short_summary,web_description,address,city,region,country,postal_code,
      latitude,longitude,cover_media_id FROM statues WHERE slug=@slug AND web_status='published'`,
    { slug },
  );
  if (!statue) error(404, 'Statue not found.');
  const photos = await db.all<PublicPhoto>(
    `SELECT m.id,m.alt_text,m.credit,m.width,m.height FROM media_assets m JOIN statues s ON s.id=m.statue_id
      WHERE s.slug=@slug AND s.web_status='published' AND m.rights_status='approved'
      ORDER BY m.position,m.id`,
    { slug },
  );
  const cover = photos.find((item) => item.id === statue.cover_media_id) ?? photos[0];
  return { statue: { ...statue, cover_media_id: cover?.id ?? null }, cover, photos };
}

export async function publicPhoto(id: string) {
  const [row] = await database().all<{ statue_id: string }>(
    `SELECT m.statue_id FROM media_assets m JOIN statues s ON s.id=m.statue_id WHERE m.id=@id
      AND s.web_status='published' AND m.rights_status='approved'`,
    { id },
  );
  if (!row) error(404, 'Photo not found.');
  return row;
}

import { error } from '@sveltejs/kit';
import type { z } from 'zod';
import {
  initialPotential,
  potentialSaveSchema,
  potentialImageSchema,
  type PotentialImage,
  type PotentialStatue,
} from '$lib/potential';
import { database, writeLock } from './db';
import suggestions from './potential-suggestions.json';
import imageSuggestions from './potential-image-suggestions.json';
import mapLocations from './potential-map-locations.json';
import type { PotentialMapRow } from '$lib/potential-map';

export function mapLocation(row: PotentialStatue): PotentialMapRow['map_location'] {
  if (row.latitude !== null && row.longitude !== null) {
    return {
      latitude: row.latitude,
      longitude: row.longitude,
      approximate: false,
      description: row.pin_checked
        ? 'Saved coordinates · pin checked'
        : 'Saved coordinates · pin to check',
    };
  }
  const hint = (mapLocations as Record<string, (typeof mapLocations)[keyof typeof mapLocations]>)[
    row.id
  ];
  if (
    !hint ||
    hint.location !== row.location ||
    hint.city !== row.city ||
    hint.country !== row.country
  )
    return null;
  return { ...hint, approximate: true };
}

export const suggestionCount = suggestions.length;
const researchedImages = imageSuggestions as { statue_id: string; images: PotentialImage[] }[];
export const researchedImageCount = researchedImages.reduce(
  (sum, row) => sum + row.images.length,
  0,
);

export async function addResearchedImages() {
  const entries = researchedImages.map((entry) => ({
    ...entry,
    images: entry.images.map((image) => potentialImageSchema.parse(image)),
  }));
  return database().write(async (db) => {
    let added = 0;
    let updated = 0;
    for (const entry of entries) {
      const row = await find(db, entry.statue_id);
      if (!row) continue;
      const urls = new Set(row.images.map((image) => image.image_url));
      const extra = entry.images
        .filter((image) => !urls.has(image.image_url))
        .slice(0, 24 - row.images.length);
      if (!extra.length) continue;
      await db.run(
        'UPDATE potential_statues SET images=@images, revision=revision+1, updated_at=@now WHERE id=@id',
        {
          id: row.id,
          images: JSON.stringify([...row.images, ...extra]),
          now: new Date().toISOString(),
        },
      );
      added += extra.length;
      updated++;
    }
    return { added, updated };
  });
}

const fieldNames = Object.keys(initialPotential);
const columns = `id, ${fieldNames.join(', ')}, revision, created_at, updated_at`;
type Store = Parameters<Parameters<ReturnType<typeof database>['write']>[0]>[0];
type StoredPotential = Omit<PotentialStatue, 'images'> & { images: string };
function decode(row: StoredPotential): PotentialStatue {
  return { ...row, images: JSON.parse(row.images), pin_checked: Boolean(row.pin_checked) };
}

async function find(db: Store, id: string) {
  const [row] = await db.all<StoredPotential>(
    `SELECT ${columns} FROM potential_statues ${writeLock} WHERE id=@id`,
    { id },
  );
  return row ? decode(row) : undefined;
}

export async function listPotential() {
  return (
    await database().all<StoredPotential>(
      `SELECT ${columns} FROM potential_statues ORDER BY CASE WHEN city='London' THEN 0 ELSE 1 END, country, city, name`,
    )
  ).map(decode);
}

export async function getPotential(id: string) {
  const [row] = await database().all<StoredPotential>(
    `SELECT ${columns} FROM potential_statues WHERE id=@id`,
    { id },
  );
  if (!row) error(404, 'Potential statue not found.');
  return decode(row);
}

async function insert(db: Store, input: z.infer<typeof potentialSaveSchema>) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO potential_statues (id, ${fieldNames.join(', ')}, created_at, updated_at)
      VALUES (@id, ${fieldNames.map((name) => '@' + name).join(', ')}, @now, @now)`,
    {
      id: input.id,
      ...input.fields,
      images: JSON.stringify(input.fields.images),
      pin_checked: Number(input.fields.pin_checked),
      now,
    },
  );
}

export async function savePotential(input: z.infer<typeof potentialSaveSchema>) {
  await database().write(async (db) => {
    const row = await find(db, input.id);
    if (!row && input.revision === null) {
      await insert(db, input);
      return;
    }
    if (!row || row.revision !== input.revision)
      error(409, 'This potential statue changed. Reload it before saving.');
    await db.run(
      `UPDATE potential_statues SET ${fieldNames.map((name) => name + '=@' + name).join(', ')},
        revision=revision+1, updated_at=@now WHERE id=@id`,
      {
        ...input.fields,
        images: JSON.stringify(input.fields.images),
        pin_checked: Number(input.fields.pin_checked),
        id: input.id,
        now: new Date().toISOString(),
      },
    );
  });
}

export async function deletePotential(id: string, revision: number) {
  await database().write(async (db) => {
    const row = await find(db, id);
    if (!row) error(404, 'Potential statue not found.');
    if (row.revision !== revision)
      error(409, 'This potential statue changed. Reload it before deleting.');
    await db.run('DELETE FROM potential_statues WHERE id=@id', { id });
  });
}

export async function addSuggestions() {
  return database().write(async (db) => {
    let added = 0;
    for (const suggestion of suggestions) {
      const { id, ...fields } = suggestion;
      if (await find(db, id)) continue;
      const maps = new URL('https://www.google.com/maps/search/');
      maps.searchParams.set('api', '1');
      maps.searchParams.set(
        'query',
        suggestion.name +
          ', ' +
          suggestion.location +
          ', ' +
          suggestion.city +
          ', ' +
          suggestion.country,
      );
      await insert(
        db,
        potentialSaveSchema.parse({
          id,
          revision: null,
          fields: {
            ...initialPotential,
            ...fields,
            images: (researchedImages.find((entry) => entry.statue_id === id)?.images ?? []).map(
              (image) => potentialImageSchema.parse(image),
            ),
            maps_url: 'maps_url' in suggestion ? suggestion.maps_url : maps.href,
            notes:
              suggestion.notes +
              '\n\nSource checked 17 November 2026. Confirm the exact pin, current installation and access before visiting.',
          },
        }),
      );
      added++;
    }
    return added;
  });
}

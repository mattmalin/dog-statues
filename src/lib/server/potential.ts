import { error } from '@sveltejs/kit';
import type { z } from 'zod';
import { initialPotential, potentialSaveSchema, type PotentialStatue } from '$lib/potential';
import { database, writeLock } from './db';
import suggestions from './potential-suggestions.json';

export const suggestionCount = suggestions.length;

const fieldNames = Object.keys(initialPotential);
const columns = `id, ${fieldNames.join(', ')}, revision, created_at, updated_at`;
type Store = Parameters<Parameters<ReturnType<typeof database>['write']>[0]>[0];

async function find(db: Store, id: string) {
  const [row] = await db.all<PotentialStatue>(
    `SELECT ${columns} FROM potential_statues ${writeLock} WHERE id=@id`,
    { id },
  );
  return row;
}

export async function listPotential() {
  return (
    await database().all<PotentialStatue>(
      `SELECT ${columns} FROM potential_statues ORDER BY CASE WHEN city='London' THEN 0 ELSE 1 END, country, city, name`,
    )
  ).map((row) => ({ ...row, pin_checked: Boolean(row.pin_checked) }));
}

export async function getPotential(id: string) {
  const [row] = await database().all<PotentialStatue>(
    `SELECT ${columns} FROM potential_statues WHERE id=@id`,
    { id },
  );
  if (!row) error(404, 'Potential statue not found.');
  return { ...row, pin_checked: Boolean(row.pin_checked) };
}

async function insert(db: Store, input: z.infer<typeof potentialSaveSchema>) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO potential_statues (id, ${fieldNames.join(', ')}, created_at, updated_at)
      VALUES (@id, ${fieldNames.map((name) => '@' + name).join(', ')}, @now, @now)`,
    { id: input.id, ...input.fields, pin_checked: Number(input.fields.pin_checked), now },
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
        pin_checked: Number(input.fields.pin_checked),
        id: input.id,
        now: new Date().toISOString(),
      },
    );
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

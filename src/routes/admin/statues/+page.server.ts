import { randomUUID } from 'node:crypto';
import { listDrafts } from '$lib/server/statues';
export const load = async () => ({ rows: await listDrafts(false), newId: randomUUID() });

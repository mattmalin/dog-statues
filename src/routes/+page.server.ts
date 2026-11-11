import { listPublicStatues } from '$lib/server/statues';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  return { statues: await listPublicStatues() };
};

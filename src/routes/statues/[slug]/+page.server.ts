import { error } from '@sveltejs/kit';
import { getPublicStatue } from '$lib/server/statues';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params, setHeaders }) => {
  if (!/^[a-z0-9-]{1,200}$/.test(params.slug)) error(404, 'Statue not found.');
  setHeaders({ 'cache-control': 'no-store' });
  return getPublicStatue(params.slug);
};

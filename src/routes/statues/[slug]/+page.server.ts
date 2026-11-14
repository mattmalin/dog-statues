import copy from '$lib/public-copy.json';
import { error } from '@sveltejs/kit';
import { getPublicStatue } from '$lib/server/statues';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params, setHeaders }) => {
  if (!/^[a-z0-9-]{1,200}$/.test(params.slug)) error(404, copy.statue.unavailable);
  setHeaders({ 'cache-control': 'no-store' });
  return getPublicStatue(params.slug);
};

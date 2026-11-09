import { getDraft } from '$lib/server/statues';
import { uuid } from '$lib/server/input';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params, url }) => ({
  ...(await getDraft(uuid(params.id))),
  capture: url.searchParams.get('capture') === '1',
});

import { getDraft } from '$lib/server/statues';
import { uuid } from '$lib/server/input';
import { instagramEnabled, instagramStatus, readInstagramDraft } from '$lib/server/instagram';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params, url }) => {
  const id = uuid(params.id);
  const enabled = instagramEnabled();
  return {
    ...(await getDraft(id)),
    capture: url.searchParams.get('capture') === '1',
    instagramEnabled: enabled,
    instagramPublication: enabled ? await instagramStatus(id) : null,
    instagramDraft: await readInstagramDraft(id),
  };
};

import { getPreview } from '$lib/server/statues';
import { uuid } from '$lib/server/input';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => getPreview(uuid(params.id));

import { redirect } from '@sveltejs/kit';
import { addSuggestions, listPotential, suggestionCount } from '$lib/server/potential';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ rows: await listPotential(), suggestionCount });
export const actions: Actions = {
  suggestions: async () => {
    const added = await addSuggestions();
    redirect(303, '/admin/potential?added=' + added);
  },
};

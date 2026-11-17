import { redirect } from '@sveltejs/kit';
import {
  addSuggestions,
  addResearchedImages,
  listPotential,
  mapLocation,
  suggestionCount,
  researchedImageCount,
} from '$lib/server/potential';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
  rows: (await listPotential()).map((row) => ({ ...row, map_location: mapLocation(row) })),
  suggestionCount,
  researchedImageCount,
});
export const actions: Actions = {
  images: async () => {
    const result = await addResearchedImages();
    redirect(
      303,
      `/admin/potential?images_added=${result.added}&records_updated=${result.updated}`,
    );
  },
  suggestions: async () => {
    const added = await addSuggestions();
    redirect(303, '/admin/potential?added=' + added);
  },
};

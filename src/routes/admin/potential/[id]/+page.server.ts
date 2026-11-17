import { randomUUID } from 'node:crypto';
import { fail, isHttpError, redirect } from '@sveltejs/kit';
import { initialPotential, potentialSaveSchema } from '$lib/potential';
import { uuid } from '$lib/server/input';
import { getPotential, savePotential } from '$lib/server/potential';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({
  row:
    params.id === 'new'
      ? { ...initialPotential, id: randomUUID(), revision: null }
      : await getPotential(uuid(params.id)),
});

export const actions: Actions = {
  default: async ({ request, params }) => {
    const data = await request.formData();
    const text = (name: string) => String(data.get(name) ?? '');
    const number = (name: string) => (text(name).trim() ? Number(text(name)) : null);
    let images: unknown;
    try {
      images = JSON.parse(text('images') || '[]');
    } catch {
      return fail(422, { error: 'The image list could not be read. Reload and try again.' });
    }
    const fields = {
      name: text('name'),
      city: text('city'),
      country: text('country'),
      location: text('location'),
      maps_url: text('maps_url'),
      latitude: number('latitude'),
      longitude: number('longitude'),
      pin_checked: data.get('pin_checked') === 'on',
      source_url: text('source_url'),
      notes: text('notes'),
      images,
      status: text('status'),
    };
    const input = potentialSaveSchema.safeParse({
      id: params.id === 'new' ? text('id') : uuid(params.id),
      revision: number('revision'),
      fields,
    });
    if (!input.success) return fail(422, { error: input.error.issues[0].message });
    try {
      await savePotential(input.data);
    } catch (cause) {
      if (isHttpError(cause)) return fail(cause.status, { error: cause.body.message });
      throw cause;
    }
    redirect(303, '/admin/potential/' + input.data.id + '?saved=1');
  },
};

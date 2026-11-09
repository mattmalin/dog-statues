import { redirect, type RequestHandler } from '@sveltejs/kit';
import { uuid } from '$lib/server/input';
import { createDraft } from '$lib/server/statues';

export const GET: RequestHandler = () => redirect(303, '/admin');
export const POST: RequestHandler = async ({ request }) => {
  const id = uuid((await request.formData()).get('id'));
  await createDraft(id);
  redirect(303, '/admin/statues/' + id + '?capture=1');
};

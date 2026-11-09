import { fail, redirect } from '@sveltejs/kit';
import { cookieName, isAdmin, localSession } from '$lib/server/auth';
import { config } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';

let failed = 0;
let resetAt = 0;

export const load: PageServerLoad = ({ request, cookies }) => {
  if (isAdmin(request.headers, cookies.get(cookieName))) redirect(303, '/admin');
  return { local: config.localAuth && config.localPassword.length >= 24, entra: config.entraAuth };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const now = Date.now();
    if (now >= resetAt) {
      failed = 0;
      resetAt = now + 60_000;
    }
    if (failed >= 10) return fail(429, { message: 'Too many attempts. Try again in a minute.' });
    const password = (await request.formData()).get('password');
    const session =
      typeof password === 'string' && password.length <= 512 ? localSession(password) : null;
    if (!session) {
      failed++;
      return fail(403, { message: 'That passphrase did not match.' });
    }
    failed = 0;
    cookies.set(cookieName, session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      maxAge: session.lifetime,
    });
    redirect(303, '/admin');
  },
};

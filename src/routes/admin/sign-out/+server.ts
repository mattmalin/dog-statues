import { redirect, type RequestHandler } from '@sveltejs/kit';
import { cookieName } from '$lib/server/auth';
import { config } from '$lib/server/config';

export const POST: RequestHandler = ({ cookies }) => {
  cookies.delete(cookieName, { path: '/' });
  redirect(303, config.entraAuth ? '/.auth/logout?post_logout_redirect_uri=%2F' : '/');
};

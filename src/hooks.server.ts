import { error, redirect, type Handle } from '@sveltejs/kit';
import { cookieName, isAdmin } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const method = event.request.method;
  const host = event.request.headers.get('host') ?? '';
  const azureHost = /\.azurecontainerapps\.io(?::443)?$/i;
  // The Node adapter derives event.url from the configured public ORIGIN.
  if (
    (method === 'GET' || method === 'HEAD') &&
    azureHost.test(host) &&
    !azureHost.test(event.url.hostname)
  ) {
    redirect(308, event.url.href);
  }

  const path = event.route.id ?? event.url.pathname;
  const privateApi = path === '/api/admin' || path.startsWith('/api/admin/');
  const privatePage = path === '/admin' || path.startsWith('/admin/');
  const signIn = path === '/admin/sign-in';
  const protectedRoute = privateApi || privatePage;

  if (protectedRoute) {
    if (
      method !== 'GET' &&
      method !== 'HEAD' &&
      event.request.headers.get('origin') !== event.url.origin
    ) {
      error(403, 'This request must come from the Atlas.');
    }

    if (!signIn && !isAdmin(event.request.headers, event.cookies.get(cookieName))) {
      if (privateApi) error(401, 'Sign in again to continue.');
      redirect(303, '/admin/sign-in');
    }
  }

  const response = await resolve(event);
  if (protectedRoute) {
    response.headers.set('cache-control', 'private, no-store');
    response.headers.set('x-robots-tag', 'noindex, nofollow');
  }
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return response;
};

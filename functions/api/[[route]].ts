import { handleApi } from '../../server/router';
import type { Env } from '../../server/env';

export const onRequest: PagesFunction<Env> = async (context) => {
  const segments = Array.isArray(context.params.route)
    ? context.params.route
    : context.params.route ? [context.params.route] : [];
  const response = await handleApi(context.env, context.request, segments);
  // Baseline security headers for API responses
  const headers = new Headers(response.headers);
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return new Response(response.body, { status: response.status, headers });
};

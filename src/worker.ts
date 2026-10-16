import type { Env } from '../server/env';
import { handleApi } from '../server/router';

/**
 * Single Cloudflare Worker entry point.
 *  - /api/*  -> server API (products, orders, admin) in server/
 *  - anything else -> the React build in dist/, served through the ASSETS binding
 * wrangler.toml sets run_worker_first = true so every response passes through here
 * and receives the security headers below.
 */
export interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function withSecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    headers.set('x-robots-tag', 'noindex, nofollow');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      // "/api/admin/products" -> ["admin", "products"]
      const segments = url.pathname.split('/').filter(Boolean).slice(1);
      const response = await handleApi(env, request, segments);
      return withSecurityHeaders(response, url.pathname);
    }
    const asset = await env.ASSETS.fetch(request);
    return withSecurityHeaders(asset, url.pathname);
  },
} satisfies ExportedHandler<WorkerEnv>;

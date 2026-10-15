import type { Env } from './env';
import { errorResponse } from './http';
import { handleAdmin, handlePublic } from './admin';

/** Entry for every /api/* request. Errors become safe JSON responses. */
export async function handleApi(env: Env, request: Request, pathSegments: string[]): Promise<Response> {
  try {
    if (pathSegments[0] === 'admin') return await handleAdmin(env, request, pathSegments.slice(1));
    return await handlePublic(env, request, pathSegments);
  } catch (err) {
    return errorResponse(err);
  }
}

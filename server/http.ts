export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: err.message, details: err.details ?? undefined }, err.status);
  }
  // Log the real error server-side; never leak internals to the client.
  console.error(err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

/** Reads JSON bodies with a size cap to protect the Worker from oversized requests. */
export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new HttpError(413, 'Request is too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request is too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

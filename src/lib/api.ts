export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, body, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Network problem. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong.', (data as { details?: Record<string, string> }).details);
  }
  return data as T;
}

export interface PublicProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: { id: number; name: string; slug: string };
  price_paise: number;
  unit: string;
  image_url: string | null;
  in_stock: boolean;
  is_featured: boolean;
  is_on_offer: boolean;
}

export interface Category { id: number; name: string; slug: string }

import type { Env } from './env';
import { HttpError } from './http';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
};

/** Detects the real file type from magic bytes. The browser-supplied type is NOT trusted. */
export function sniffImage(bytes: Uint8Array): keyof typeof ALLOWED | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  return null;
}

export async function uploadProductImage(env: Env, productId: number, request: Request): Promise<string> {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(422, 'Choose an image file to upload.');
  if (file.size === 0) throw new HttpError(422, 'The selected file is empty.');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'Image must be 2 MB or smaller.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(422, 'Only JPG, PNG or WebP images are allowed.');

  const { ext, mime } = ALLOWED[kind];
  const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: 'public, max-age=86400' },
    customMetadata: { productId: String(productId) },
  });
  return key;
}

export async function serveImage(env: Env, key: string): Promise<Response> {
  // Only product images are public, and keys must stay inside the products/ prefix
  if (!/^products\/\d+\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new HttpError(404, 'Image not found.');
  const obj = await env.IMAGES.get(key);
  if (!obj) throw new HttpError(404, 'Image not found.');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
}

export async function deleteImage(env: Env, key: string | null) {
  if (key) await env.IMAGES.delete(key);
}

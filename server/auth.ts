import type { Env } from './env';
import { HttpError } from './http';

export const SESSION_COOKIE = 'nb_admin';
const SESSION_SECONDS = 8 * 60 * 60; // 8 hours
const enc = new TextEncoder();

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns an ArrayBuffer-backed array so it is accepted by crypto.subtle (TypeScript 5.7+ typing). */
function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Cloudflare Workers' Web Crypto supports at most 100,000 PBKDF2 iterations.
// scripts/hash-password.mjs uses the same value.
const PBKDF2_ITERATIONS = 100_000;

/** Verifies a password against a `pbkdf2$iterations$saltB64$hashB64` string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (iterations !== PBKDF2_ITERATIONS) {
    // Logs only the problem, never the hash or the password.
    console.error(`ADMIN_PASSWORD_HASH must use ${PBKDF2_ITERATIONS} PBKDF2 iterations (Workers limit); regenerate it with npm run hash-password.`);
    return false;
  }
  try {
    const salt = b64urlDecode(parts[2].replace(/\+/g, '-').replace(/\//g, '_'));
    const expected = b64urlDecode(parts[3]);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
    return constantTimeEqual(new Uint8Array(bits), expected);
  } catch {
    console.error('ADMIN_PASSWORD_HASH is malformed; regenerate it with npm run hash-password.');
    return false;
  }
}

export async function createSessionToken(env: Env, username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = b64urlEncode(enc.encode(JSON.stringify({ u: username, exp })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), enc.encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function readSession(env: Env, request: Request): Promise<{ username: string } | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const [payload, sig] = match[1].split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), b64urlDecode(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { u: string; exp: number };
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    if (data.u !== env.ADMIN_USERNAME) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Every admin endpoint calls this. Throws 401 if the signed session is missing/invalid. */
export async function requireAdmin(env: Env, request: Request): Promise<{ username: string }> {
  const session = await readSession(env, request);
  if (!session) throw new HttpError(401, 'Please log in as an administrator.');
  return session;
}

/** CSRF defence for state-changing admin requests: Origin must match this site. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) throw new HttpError(403, 'Request blocked: origin mismatch.');
}

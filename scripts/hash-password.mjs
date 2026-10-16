// Usage: npm run hash-password -- "your-strong-password"
// Prints a PBKDF2-SHA256 hash to store in ADMIN_PASSWORD_HASH (never store the plain password).
import { webcrypto } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run hash-password -- "<password of at least 12 characters>"');
  process.exit(1);
}
const iterations = 210000;
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
console.log(`pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`);

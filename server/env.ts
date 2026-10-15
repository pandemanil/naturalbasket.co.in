export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string; // pbkdf2$iterations$salt$hash — set as a secret in Cloudflare
  SESSION_SECRET: string;      // set as a secret in Cloudflare
  WHATSAPP_NUMBER: string;     // digits only, international format
}

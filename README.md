# Natural Basket

Farm-to-home e-commerce for Natural Basket (Hyderabad).
React + Vite + TypeScript storefront, Cloudflare Pages Functions API, Cloudflare D1 database, Cloudflare R2 image storage.

- Storefront: `/` (shop), `/basket` (basket + order request)
- Admin: `/admin/login` → `/admin` (dashboard, products, orders, settings)

## 1. Run it on your computer (beginner steps)

1. Install **Node.js 20 or newer** from https://nodejs.org.
2. Open a terminal in this folder and run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and fill in the values (see section 3).
4. Create the local database and seed it: `npm run db:migrate:local`
5. Build the site once: `npm run build`
6. Start the full app (storefront + API): `npx wrangler pages dev dist --d1=DB --r2=IMAGES --compatibility-date=2024-10-22`
   Then open http://localhost:8788.

For UI-only development with hot reload, run `npm run dev` (http://localhost:5173). The API proxy expects the Wrangler server on port 8788.

## 2. Cloudflare resources (one time, in the dashboard or with Wrangler)

Log in once: `npx wrangler login`

| Resource | Command | Free-plan note |
|---|---|---|
| D1 database | `npx wrangler d1 create natural-basket-db` | Included in the free plan (limits apply, see Cloudflare docs). |
| R2 bucket | `npx wrangler r2 bucket create natural-basket-images` | R2 requires enabling it on your account. Check current free-tier limits before launch. |

After `d1 create`, copy the printed `database_id` into `wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

Apply the schema and seed catalogue to the live database:

```bash
npm run db:migrate:remote
```

This runs `migrations/0001_init.sql`, `0002_seed.sql` (starter catalogue, editable later from /admin) and `0003_login_attempts.sql`.

## 3. Secrets and settings (never commit these)

Create an admin password hash (use a password of at least 12 characters):

```bash
npm run hash-password -- "your-long-admin-password"
```

Set production values in **Cloudflare Pages → your project → Settings → Environment variables** (Production and Preview):

| Name | Type | Value |
|---|---|---|
| `ADMIN_USERNAME` | Plain text | Your admin username |
| `ADMIN_PASSWORD_HASH` | **Encrypted** | Output of `npm run hash-password` |
| `SESSION_SECRET` | **Encrypted** | Output of `openssl rand -base64 48` |
| `WHATSAPP_NUMBER` | Plain text | Business number, digits only, with country code, e.g. `917993251579` |

Locally, the same names go in `.dev.vars` (already git-ignored).

Store settings (delivery charge, minimum order, accepting orders) are changed in **/admin → Settings**. They start at ₹0 (delivery confirmed on chat, no minimum).

## 4. Deploy from GitHub (automatic)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** and choose this repository, branch `main`.
2. Build settings:
   - Framework preset: **None** (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Under **Settings → Functions → D1 database bindings**, add binding name `DB` → `natural-basket-db`.
4. Under **Settings → Functions → R2 bucket bindings**, add binding name `IMAGES` → `natural-basket-images`.
5. Add the environment variables from section 3.
6. Save and deploy. Every push to `main` now redeploys automatically.

Product price and image changes made in /admin do **not** trigger a deploy: they are stored in D1 and R2 and appear on the storefront immediately.

## 5. Connect your custom domain

1. Pages project → **Custom domains → Set up a custom domain**, enter your domain (e.g. `naturalbasket.live`).
2. If the domain's DNS is already on Cloudflare, accept the suggested CNAME record. If it is elsewhere, add the CNAME record Cloudflare shows at your DNS provider.
3. Wait for the certificate to become active (usually minutes), then open https://your-domain.
4. Update `public/sitemap.xml` and `public/robots.txt` if you use a different domain, then push.

## 6. Security model

- **Admin authentication is enforced on the server.** Every `/api/admin/*` route calls `requireAdmin`. Hiding the page is not relied upon.
- Passwords are stored only as a PBKDF2-SHA256 hash (210,000 iterations). The plain password is never in code or the repository.
- Sessions are HMAC-signed, HttpOnly, Secure, SameSite=Strict cookies, valid for 8 hours. Changing `SESSION_SECRET` logs everyone out.
- Login failures are throttled: 5 failed attempts per client IP in 15 minutes.
- State-changing admin requests must come from the same origin (CSRF protection).
- Prices are stored as integer paise. **Order totals are always recomputed on the server from D1**, never from browser data.
- Stock is decremented in the same atomic database batch as the order. If stock runs out, nothing is written.
- Duplicate submissions are blocked with a per-checkout idempotency key (a double tap returns the same order).
- Image uploads are checked by their real file signature (JPEG/PNG/WebP only, 2 MB maximum), not the browser-supplied type. Uploaded files are stored under random names.
- Only product images are publicly readable from R2; the admin area is marked `noindex`.
- Security headers (CSP, frame denial, HSTS, Permissions-Policy) are in `public/_headers`.

## 7. Order and payment status (important)

- A customer submitting the basket creates an **order request** with status `pending`. It is not a confirmed order.
- Status moves through `pending → confirmed → out_for_delivery → delivered` (or `cancelled`). Only an admin changes it.
- **No payment is collected or recorded by this app.** The database has no "paid" status. Do not describe orders as paid until a payment provider is connected and confirms payment server-side.
- The WhatsApp message is a convenience to notify the shop; it does not confirm payment.

## 8. Security checklist before launch

- [ ] `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` set as **Encrypted** variables, not in code.
- [ ] A strong, unique admin password (12+ characters); you know it, it is not written in any file.
- [ ] Cloudflare **Rate Limiting** rule on `/api/orders` and `/api/admin/login` (e.g. 20 requests/minute per IP). The app throttles logins itself, but edge rules add protection.
- [ ] Cloudflare **Bot Fight Mode** or WAF managed rules enabled.
- [ ] HTTPS enforced (on by default for Pages).
- [ ] Only the business WhatsApp number is in `WHATSAPP_NUMBER`.
- [ ] Logged out of /admin on shared computers.
- [ ] Database backups: export regularly with `npx wrangler d1 export natural-basket-db --remote --output backup.sql` (keep the file out of Git).

## 9. Production test checklist

- [ ] Home page loads; products show prices in ₹; placeholders show where no photo exists.
- [ ] Search, category filter, sort and "in stock only" work on phone and desktop.
- [ ] Add to basket, change quantity, remove, empty basket; totals update; basket survives a page reload.
- [ ] Checkout with invalid mobile/pincode shows field errors; nothing is sent.
- [ ] Valid checkout creates an order number; double-tapping "Send order request" creates only one order.
- [ ] WhatsApp button opens chat to the business number with the correct items and total.
- [ ] Log in at /admin/login with the right password; wrong password shows a generic error; 5 wrong attempts are throttled.
- [ ] Visiting /admin while logged out redirects to login; `/api/admin/products` returns 401 without a session.
- [ ] Change a price in admin → refresh storefront → new price shows (no redeploy).
- [ ] Upload a JPG/PNG/WebP photo → shows on storefront; upload a .txt or >2 MB file → rejected.
- [ ] Hide a product → disappears from storefront; restore → returns.
- [ ] Delete a product never ordered → removed after confirmation; a product in past orders → refused with a clear message.
- [ ] Order status moves forward only; cancelling returns stock.
- [ ] Turn off "Accepting orders" → checkout is blocked with a message.

## 10. Known limits / next steps

- No online payment yet. Adding one (for example Razorpay) needs a server-side webhook that confirms payment before an order is marked paid.
- Product photos must be uploaded in /admin; the starter catalogue has no photos yet.
- The 3D hero uses lightweight CSS 3D decorations (no WebGL), so it works on low-end phones. Respects "reduce motion" settings.
- Customer accounts are not included; ordering is guest checkout.

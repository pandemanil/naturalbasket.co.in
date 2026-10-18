# Natural Basket

Farm-to-home e-commerce for Natural Basket (Hyderabad).
React + Vite + TypeScript storefront and API, deployed as one Cloudflare Worker, with a Cloudflare D1 database and R2 image storage.

- Storefront: `/` (shop), `/basket` (basket + order request)
- Admin: `/admin/login` → `/admin` (dashboard, products, orders, settings)

## 1. Run it on your computer (beginner steps)

1. Install **Node.js 20 or newer** from https://nodejs.org.
2. Open a terminal in this folder and run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and fill in the values (see section 3).
4. Create the local database and seed it: `npm run db:migrate:local`
5. Build the site once: `npm run build`
6. Start the full app (storefront + API, using local D1 and R2): `npm run dev:worker`
   Then open http://localhost:8787.

For UI-only development with hot reload, run `npm run dev` (http://localhost:5173). The API proxy expects the Wrangler server on port 8787.

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

Set production values on the Worker: **Cloudflare → Workers & Pages → naturalbasket-co-in → Settings → Variables and Secrets**. Use **Encrypted** for the two secrets:

| Name | Type | Value |
|---|---|---|
| `ADMIN_USERNAME` | Plain text | Already set to `admin` in `wrangler.toml`. Change it there if you want a different username. |
| `ADMIN_PASSWORD_HASH` | **Encrypted** | Output of `npm run hash-password` |
| `SESSION_SECRET` | **Encrypted** | Output of `openssl rand -base64 48` |
| `WHATSAPP_NUMBER` | Plain text | Business number, digits only, with country code, e.g. `917993251579` |

Locally, the same names go in `.dev.vars` (already git-ignored).

Store settings (delivery charge, minimum order, accepting orders) are changed in **/admin → Settings**. They start at ₹0 (delivery confirmed on chat, no minimum).

## 4. Deploy from GitHub (Cloudflare Workers Builds)

This project deploys as **one Cloudflare Worker** (`src/worker.ts`). The Worker serves the API under `/api/*` and the React build from `dist/`. It is not a Pages project.

Dashboard settings (Workers & Pages → naturalbasket-co-in → Settings → Builds):

1. Connect the repository and set the production branch to `main`. Root directory: `/`.
2. **Build command:** `npm run build`
3. **Deploy command:** `npx wrangler deploy`
4. **Non-production branch deploy command** (only if this field is shown): `npx wrangler versions upload`. Never use `wrangler preview`; it is deprecated and causes the build error.
5. **Build variables:** `NODE_VERSION` = `20`.

Bindings come from `wrangler.toml`, so you do not add them in the dashboard. The D1 `database_id` in `wrangler.toml` must be the real ID first.

Before the first deploy, run once from your computer:

```bash
npx wrangler login
npx wrangler d1 create natural-basket-db        # copy database_id into wrangler.toml
npx wrangler r2 bucket create natural-basket-images
npm run db:migrate:remote                       # schema + starter catalogue
npx wrangler secret put ADMIN_PASSWORD_HASH     # paste output of npm run hash-password
npx wrangler secret put SESSION_SECRET          # paste output of openssl rand -base64 48
```

Deploys do **not** run migrations. Run `db:migrate:remote` yourself whenever a new migration file is added.

Push to `main` to deploy production. Pushes to other branches get preview versions.

Product price and image changes made in /admin do **not** trigger a deploy: they are stored in D1 and R2 and appear on the storefront immediately.

### How to check a deployment

1. The build log ends by deploying the `naturalbasket-co-in` Worker and printing its URL, usually `https://naturalbasket-co-in.<your-subdomain>.workers.dev`. If it stops at a D1 or binding error, fix the `wrangler.toml` value named in the error.
2. `https://<worker-url>/` shows the shop with products.
3. `https://<worker-url>/api/products` returns JSON with a `products` list.
4. `https://<worker-url>/api/admin/products` returns `401` when logged out.
5. `https://<worker-url>/admin/login` shows the admin sign-in page.

## 5. Connect your custom domain

1. Worker → **Settings → Domains & Routes → Add → Custom domain**, enter your domain (here: `naturalbasket.co.in`).
2. If the domain's DNS is already on Cloudflare, accept the suggested CNAME record. If it is elsewhere, add the CNAME record Cloudflare shows at your DNS provider.
3. Wait for the certificate to become active (usually minutes), then open https://your-domain.
4. Update `public/sitemap.xml` and `public/robots.txt` if you use a different domain, then push.

## 6. Security model

- **Admin authentication is enforced on the server.** Every `/api/admin/*` route calls `requireAdmin`. Hiding the page is not relied upon.
- Passwords are stored only as a PBKDF2-SHA256 hash (100,000 iterations, the maximum Cloudflare Workers allows). The plain password is never in code or the repository.
- Sessions are HMAC-signed, HttpOnly, Secure, SameSite=Strict cookies, valid for 8 hours. Changing `SESSION_SECRET` logs everyone out.
- Login failures are throttled: 5 failed attempts per client IP in 15 minutes.
- State-changing admin requests must come from the same origin (CSRF protection).
- Prices are stored as integer paise. **Order totals are always recomputed on the server from D1**, never from browser data.
- Stock is decremented in the same atomic database batch as the order. If stock runs out, nothing is written.
- Duplicate submissions are blocked with a per-checkout idempotency key (a double tap returns the same order).
- Image uploads are checked by their real file signature (JPEG/PNG/WebP only, 2 MB maximum), not the browser-supplied type. Uploaded files are stored under random names.
- Only product images are publicly readable from R2; the admin area is marked `noindex`.
- Security headers (CSP, frame denial, HSTS, Permissions-Policy) are set in `src/worker.ts` on every response.

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
- [ ] HTTPS enforced (on by default for Workers custom domains).
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

## 11. The 3D farm experience

The home page has an interactive 3D village farm (Three.js with React Three Fiber, drei and GSAP) between the hero and the shop.

- **Where:** `src/farm/`. `FarmSection.tsx` is the page section, `FarmScene.tsx` holds the canvas, lights and camera transitions, `Farm.tsx` builds the farm, and `MilkGlass.tsx` is the milk pour.
- **Buttons:** Explore Farm, Explore Vegetables and Explore Fresh Milk move the camera smoothly. Drag to look around and scroll or pinch to zoom.
- **No external 3D files are needed.** Every model is built in code, so there is nothing to download or license. Optional upgrade: replace the procedural cows with a real Gir cow `.glb` from a licensed source (for example Sketchfab, filtered to CC0) and load it with drei's `useGLTF`, placing it under `public/models/`.
- **Lazy loading:** three.js is in its own chunk and loads only on the home page. The static `farm-poster.webp` and `milk-poster.webp` are shown if WebGL is unavailable or the scene fails.
- **Reduced motion:** when the OS asks for reduced motion, the animations stop and the camera jumps instead of gliding.
- **Mobile:** lower pixel ratio, fewer birds, chickens and trees, and no shadows.
- **Preview:** run `npm run dev` and open http://localhost:5173. The farm appears just below the hero.

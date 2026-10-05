# HTC (Hammer Trading) — Build Report

Date: 2026-10-02 · Next.js 14.2.35 · React 18 · TypeScript strict · ESLint (next/core-web-vitals + next/typescript)

## 1. Build result — ✅ PASSES CLEANLY

Final `npm run build` (exit code **0**):

```
> htc-website@0.1.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/37) ...
 ✓ Generating static pages (37/37)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    6.17 kB         408 kB
├ ○ /_not-found                          143 B          87.7 kB
├ ○ /about                               3.69 kB         401 kB
├ ○ /admin                               128 kB          478 kB
├ ○ /admin/about                         2.02 kB         417 kB
├ ○ /admin/categories                    3.15 kB         418 kB
├ ○ /admin/customers                     5.83 kB         359 kB
├ ○ /admin/gallery                       4.24 kB         422 kB
├ ○ /admin/hero                          3.05 kB         418 kB
├ ○ /admin/messages                      4.57 kB         356 kB
├ ○ /admin/notifications                 2.33 kB         390 kB
├ ○ /admin/orders                        4.78 kB         369 kB
├ ƒ /admin/orders/[id]                   6.31 kB         380 kB
├ ○ /admin/products                      7.51 kB         382 kB
├ ƒ /admin/products/[id]                 586 B           421 kB
├ ○ /admin/products/new                  428 B           421 kB
├ ○ /admin/projects                      3.58 kB         418 kB
├ ○ /admin/services                      4.03 kB         422 kB
├ ○ /admin/settings                      5.16 kB         423 kB
├ ƒ /api/auth/session                    0 B                0 B
├ ○ /cart                                4.92 kB         403 kB
├ ○ /checkout                            6.37 kB         443 kB
├ ○ /checkout/success                    3.35 kB         401 kB
├ ○ /contact                             3.96 kB         441 kB
├ ○ /faq                                 6.05 kB         404 kB
├ ○ /gallery                             6.13 kB         404 kB
├ ○ /login                               4.4 kB          289 kB
├ ○ /orders                              4.09 kB         402 kB
├ ○ /privacy                             1.32 kB         399 kB
├ ƒ /product/[id]                        6.75 kB         408 kB
├ ○ /profile                             5.37 kB         442 kB
├ ○ /projects                            3.35 kB         401 kB
├ ƒ /projects/[id]                       5.1 kB          403 kB
├ ○ /refunds                             1.33 kB         399 kB
├ ○ /services                            3.38 kB         401 kB
├ ƒ /services/[id]                       4.91 kB         442 kB
├ ○ /shop                                6.7 kB          415 kB
├ ○ /terms                               1.32 kB         399 kB
└ ○ /wishlist                            912 B           402 kB
+ First Load JS shared by all            87.5 kB
ƒ Middleware                             25 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

`npx tsc --noEmit` also passes with zero errors.

### Errors fixed to get there
- **9 ESLint errors** (all `no-unused-vars` / `no-unused-expressions`): removed unused
  imports (`StatusBadge` in admin products, `SelectField` in admin services, `query` in
  cart, `motion` + `primaryImage` in product page, index param in `ProductForm`), rewrote a
  ternary-as-statement in `chat-widget.tsx` as if/else, and made the `compact` prop in
  `search-bar.tsx` actually affect the input padding (it was passed by the navbar but ignored).
- **1 TypeScript error** in the new seed script: Admin-SDK `Timestamp` vs client-SDK
  `Timestamp` type mismatch — fixed with a documented boundary cast.
- **1 real bug fixed**: the public newsletter signup writes to a `newsletters`
  collection, but `firestore.rules` had a catch-all deny for unlisted collections, so every
  signup would have failed. Added a `newsletters` rule (public create; admin read/update/delete).

## 2. What was built (module list)

| Module | Path | Files | Notes |
|---|---|---|---|
| Customer storefront pages | `app/` (excl. admin) | 23 `.tsx` | home, shop, product detail, cart, checkout (+success), orders, wishlist, services (+detail), projects (+detail), gallery, about, contact, faq, terms, privacy, refunds, login, profile |
| Admin panel | `app/admin/` | 17 `.tsx` | dashboard, products (+new/+edit), categories, orders (+detail), customers, services, projects, gallery, hero, about, settings, messages, notifications |
| API routes | `app/api/` | 1 | `auth/session` — Admin-SDK token verification + `htc_admin` httpOnly cookie |
| Middleware | `middleware.ts` | 1 | guards `/admin/*` + `/api/admin/*` |
| Customer components | `components/customer/` | 17 | navbar, hero slider, product card/utils, cart drawer, chat widget, search bar, footer, WhatsApp button, skeletons, reveal, data hooks |
| Admin components | `components/admin/` | 6 | page UI, form fields, image upload, product form, SetupWarning, firebase helpers |
| UI primitives | `components/ui/` | 21 | shadcn/ui set |
| Shared lib | `lib/` | 11 | `types.ts` (data contract), auth, format (PKR), stores (zustand), firebase client/admin/collections |
| Scripts | `scripts/` | 2 | `set-admin-claim.js`, `seed.ts` (**new**) |
| Security rules | root | 2 | `firestore.rules`, `storage.rules` |

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values (see §5)
npm run dev                  # → http://localhost:3000
```

Without Firebase keys the app still builds and runs (Firebase modules are null-safe);
the login page shows a warning banner.

## 4. Seed the database

```bash
npm run seed
```

Seeds (all field names per `lib/types.ts`): 5 categories (incl. 2 subcategories),
8 products (3 with `variantTypes` + `combinations` incl. a wooden door with Size/Finish
variants and per-combination price/stock/SKU), 4 services, 3 projects (one per status),
3 hero slides, `siteSettings/main`, `aboutContent/main`, 2 coupons. Placeholder images
via `picsum.photos`. Requires `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` /
`FIREBASE_ADMIN_PRIVATE_KEY` (auto-loads `.env.local`); **refuses to run without them**
(exit 1). Idempotent: fixed doc ids + `set(..., { merge: true })`.

## 5. Vercel deployment — env var checklist

Add **all** of these in Vercel → Settings → Environment Variables
(`FIREBASE_ADMIN_PRIVATE_KEY` must keep its `\n` newlines):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_ADMIN_EMAILS` — comma-separated admin Gmail(s)
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_SITE_URL` — production URL (e.g. `https://htc.vercel.app`)
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Then: deploy rules (`firebase deploy --only firestore:rules,storage`), grant the admin
custom claim (`node scripts/set-admin-claim.js you@gmail.com`), and run `npm run seed`
once against the production project. Full step-by-step is in `README.md`.

## 6. Deploy-readiness checks performed

- **(a) No hardcoded Firebase credentials**: grepped for `AIza*` keys, hardcoded
  `authDomain`, and non-env `apiKey` — none found. All Firebase access flows through the
  env vars listed above.
- **(b) `.env.example` completeness**: cross-checked against every `process.env.*`
  read in `app/`, `components/`, `lib/`, `middleware.ts`, `scripts/` — all covered
  (`NODE_ENV` excepted as standard).
- **(c) README**: verified and completed — now documents Firebase project creation,
  Google Auth enablement, Firestore + Storage setup, rules deployment, the admin custom
  claim script, `NEXT_PUBLIC_ADMIN_EMAILS`, `npm run seed`, local dev, and Vercel
  deployment. (Seed docs + current project structure were added during this integration.)

## 7. Known limitations

1. **Needs real Firebase keys**: nothing is seeded or connected until `FIREBASE_ADMIN_*`
   and `NEXT_PUBLIC_FIREBASE_*` are set; the seed script was verified only for its
   credential-refusal path (exit 1), not against a live project.
2. **Admin claim bootstrap**: a user must be added to `NEXT_PUBLIC_ADMIN_EMAILS` AND
   granted the `admin: true` custom claim via `scripts/set-admin-claim.js`, then sign out
   and back in.
3. **Seed images are placeholders** (`picsum.photos`) — replace with real product photos
   via the admin panel or Storage.
4. **Seed WhatsApp number is a placeholder** (`+923001234567`) — update in
   `siteSettings` / `NEXT_PUBLIC_WHATSAPP_NUMBER`.
5. Chat, notifications, orders, and reviews collections are empty by design (user-generated).

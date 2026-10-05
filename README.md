# HTC — Hammer Trading (Next.js 14 foundation)

E-commerce + interior-design website for **HTC (Hammer Trading)**. This repo is
the **foundation**: Next.js 14 (App Router), TypeScript strict, Tailwind,
shadcn/ui, Firebase (null-safe), theme + auth providers, PKR helpers, and the
full Firestore data contract. Customer pages and the admin panel are built on
top by follow-up work.

## Tech stack

- Next.js 14 App Router · React 18 · TypeScript (strict) · ESLint
- Tailwind CSS + shadcn/ui (new-york) · next-themes (class dark mode)
- Firebase Auth / Firestore / Storage (client) + firebase-admin (server)
- framer-motion · recharts · react-hook-form + zod · zustand · sonner

## 1. Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) → **Add project**
   (e.g. `htc-hammer-trading`). Analytics optional.
2. **Authentication → Sign-in method → Google → Enable.** Add your support email.
   Under *Authorized domains* add your production domain (Vercel URL).
3. **Firestore Database → Create database** → *Start in production mode* → pick a
   region (e.g. `asia-south1` for Pakistan).
4. **Storage → SKIP.** Firebase Cloud Storage requires the Blaze (paid) plan.
   File uploads in this app go through **Vercel Blob** instead — no setup
   needed (see "File uploads (Vercel Blob)" below).
5. **Project settings → General → Your apps → Web app (`</>`)** → register the app
   and copy the `firebaseConfig` values into `.env.local` (see `.env.example`).

## 1b. File uploads (Vercel Blob) — no setup needed

All image/video uploads (admin product images, gallery, chat attachments) go
through `lib/uploads.ts` → `POST /api/upload` → **Vercel Blob** (public).

The `htc-products` Blob store is already connected to this project with the
`BLOB_READ_WRITE_TOKEN` env var (production, preview, development), so uploads
work out of the box:

- **Admins** (signed in with the admin session cookie) can upload images and
  videos to any folder.
- **Signed-in customers** can attach images in chat (sandboxed to `chat/`).
- Server-side validation: images (JPEG/PNG/WebP/GIF) and videos
  (MP4/WebM/MOV), max 10 MB per file.

No Cloudinary account, upload preset, or client-side keys are required.

## 2. Service account for the Admin SDK

1. **Project settings → Service accounts → Generate new private key** (Node.js).
2. From the downloaded JSON set in `.env.local`:
   - `FIREBASE_ADMIN_PROJECT_ID` ← `project_id`
   - `FIREBASE_ADMIN_CLIENT_EMAIL` ← `client_email`
   - `FIREBASE_ADMIN_PRIVATE_KEY` ← `private_key` (keep the `\n` newlines as-is)

## 3. Grant yourself admin access

Admins are recognised in two places (keep them in sync):

1. `NEXT_PUBLIC_ADMIN_EMAILS` in `.env.local` — comma-separated Gmail addresses.
   Used by the client `AuthProvider` (`isAdmin`) and the `/api/auth/session`
   cookie flow.
2. The Firebase Auth custom claim `admin: true` — the **authoritative** signal
   inside `firestore.rules` / `storage.rules`.

Set the claim with the bundled script (after `npm install`):

```bash
FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." \
node scripts/set-admin-claim.js you@gmail.com
# remove again: node scripts/set-admin-claim.js you@gmail.com --remove
```

The user must **sign out and sign back in** for the new claim to take effect.

## 4. Seed the database

`scripts/seed.ts` populates Firestore with starter content so the storefront
isn't empty: 5 categories (incl. 2 subcategories), 8 products (3 with
size/color variants + per-combination price/stock/SKU), 4 services,
3 projects, 3 hero slides, `siteSettings/main`, `aboutContent/main`,
and 2 coupons. All field names follow `lib/types.ts`.

It uses the **Admin SDK**, so the `FIREBASE_ADMIN_*` vars from step 2 must be
set — the script refuses to run without them (exit 1). Writes use fixed doc
ids with `set(..., { merge: true })`, so re-running is safe.

```bash
npm run seed
```

No service-account key handy? Export the same seed content as JSON (no
credentials needed) for review or archival:

```bash
npm run seed:export   # → scripts/seed-data.json (timestamps as ISO strings)
```

## 5. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # → http://localhost:3000
```

Without Firebase keys the app still builds and runs: `lib/firebase/client.ts`
and `lib/firebase/admin.ts` export `undefined` for `auth`/`db`/`storage` and
`isFirebaseConfigured()` returns `false`; the login page shows a warning banner.

## 6. Admin session flow

Firebase client auth can't be verified in Edge middleware, so admin routes use
an `httpOnly` session cookie:

1. Admin signs in with Google on `/login`.
2. `AuthProvider` POSTs the ID token to `/api/auth/session`.
3. The route verifies the token with the Admin SDK **and** checks the email
   against `NEXT_PUBLIC_ADMIN_EMAILS`; on success it sets `htc_admin=1`
   (httpOnly, 7 days). `DELETE /api/auth/session` clears it on sign-out.
4. `middleware.ts` (matcher `/admin/:path*`, `/api/admin/:path*`) redirects to
   `/login` (or 401 for API) when the cookie is missing.

## 7. Deploy to Vercel

1. Push the repo to GitHub, import into Vercel.
2. **Settings → Environment Variables**: add every key from `.env.example`
   (both `NEXT_PUBLIC_*` and `FIREBASE_ADMIN_*`). `FIREBASE_ADMIN_PRIVATE_KEY`
   must keep its `\n` newlines.
3. Deploy. `npm run build` runs type-check + lint as part of the build.

## 8. Deploy the security rules

```bash
npm i -g firebase-tools
firebase login
firebase init firestore   # or: firebase use --add, then link the project
firebase deploy --only firestore:rules
firebase deploy --only storage
```

`firestore.rules` / `storage.rules` at the repo root are the source of truth —
public reads for catalog content; per-user docs restricted to their owner;
all writes admin-only via the `admin: true` custom claim.

## Project structure

```
app/                          App Router routes
  (customer)                  page, shop, product/[id], cart, checkout, orders,
                              wishlist, services, services/[id], projects,
                              projects/[id], gallery, about, contact, faq,
                              terms, privacy, refunds, login, profile
  admin/                      Dashboard + products, categories, orders,
                              customers, services, projects, gallery, hero,
                              about, settings, messages, notifications
  api/auth/session/           Admin session-cookie route (httpOnly)
components/
  providers.tsx               ThemeProvider + AuthProvider (useAuth)
  ui/                         shadcn/ui primitives (button, dialog, table, …)
  customer/                   Navbar, hero slider, product card, cart drawer,
                              chat widget, search bar, footer, WhatsApp button
  admin/                      PageHeader, data-table UI, form fields,
                              image upload, product form
lib/
  auth.ts                     getAdminEmails(), isAdminEmail()
  format.ts                   CURRENCY = 'PKR', formatPKR()
  types.ts                    Full data contract (source of truth)
  utils.ts                    cn()
  store/                      zustand stores (cart, wishlist, chat UI)
  firebase/
    client.ts                 Null-safe client SDK (auth, db, storage)
    admin.ts                  Null-safe Admin SDK (adminAuth, adminDb)
    collections.ts            COLLECTIONS constants
middleware.ts                 Protects /admin/* and /api/admin/* via htc_admin cookie
firestore.rules / storage.rules
scripts/
  set-admin-claim.js          Grant/revoke the admin:true custom claim
  seed.ts                     Seed Firestore (npm run seed)
```

## Key exports for follow-up agents

| Export | From | Purpose |
|---|---|---|
| `useAuth()` | `@/components/providers` | `{ user, isAdmin, loading, signInWithGoogle, signOut }` |
| `COLLECTIONS` | `@/lib/firebase/collections` | Firestore collection name constants |
| `CURRENCY`, `formatPKR()` | `@/lib/format` | PKR currency + formatting |
| `isFirebaseConfigured()` | `@/lib/firebase/client` | Guard for unconfigured env |
| `isAdminEmail()`, `getAdminEmails()` | `@/lib/auth` | Admin allow-list |
| Types | `@/lib/types` | `Product`, `Order`, `Category`, `Project`, `Service`, `HeroSlide`, `SiteSettings`, `Review`, `Coupon`, `ChatMessage`, `ServiceInquiry`, `Notification`, `ContactMessage`, … |

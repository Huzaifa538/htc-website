# Checkout smoke test (manual)

Automated browser coverage for checkout isn't in place yet (it needs a
signed-in user, live Firestore data, and Cloudinary — none of which exist in
CI). Run these steps by hand after any change to the cart, checkout, order
API route, or validation schemas.

## Setup

- `npm run dev`, open http://localhost:3000
- Sign in with a Google account (any account works for a customer order)
- Firebase client config + Admin SDK env vars must be set (see `.env.example`)

## Steps

1. **Shop → product → cart**
   - Open `/shop`, add a product with variants (pick a size/color) to the cart
   - Open `/cart`: quantities clamp to stock, coupon field accepts a known
     code (percent and flat), totals update (subtotal, discount, shipping,
     grand total)

2. **Checkout form validation**
   - Open `/checkout` signed out → redirects to `/login?next=/checkout`
   - Signed in with an empty cart → "Your cart is empty" empty state
   - Submit with a 2-letter name / short phone / short address → inline
     field errors, no request sent

3. **Place an order**
   - Fill a valid address (name ≥ 3 chars, phone like `0321 2345678`,
     address ≥ 10 chars, city), choose COD, place the order
   - Lands on `/checkout/success?orderId=…`; cart is cleared
   - In Firestore `orders/{id}`: `status` is `Pending`, `brand` is `mtr`,
     `subtotal`/`discount`/`shipping`/`total` match the catalog prices
     (not whatever the client displayed), `userId` matches the signed-in user

4. **Server-side validation (the new behavior)**
   - `POST /api/orders` with an empty `items` array → 400
     `{ error: "Validation failed", details: […] }`
   - Same request with a bogus `idToken` → 401
   - With a `productId` that doesn't exist → 400 `Product not found`
   - Tamper the request (drop the coupon, change quantities): the stored
     order still reflects server-side pricing

5. **Admin order flow**
   - `/admin/orders/{id}` → status dropdown: `Pending → Confirmed → Shipped
     → Delivered` works; jumping `Pending → Delivered` is rejected with a
     toast; `Cancelled` orders can't change status

6. **Other validated writes**
   - `/book-consultation`: bad date/phone → 400, no doc written
   - Chat widget: send text + image messages; they appear in
     `/admin/mtr/messages` (shop context) or `/admin/htc/messages`
   - `/admin/expenses`: zero amount / bad category → 400
   - `/admin/products/new`: no images / negative price → 400

## Error boundaries

- With devtools open, throw in the shop client (temporarily) → the shop
  section shows "Something went wrong" + Try again; the navbar/footer stay
  up. Same check on `/product/{id}`, `/checkout`, and any `/admin/*` page.

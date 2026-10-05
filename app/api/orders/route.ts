/**
 * POST /api/orders — place a storefront order (checkout).
 *
 * Body: { idToken, items: [{ productId, combinationId?, variant, qty }],
 *         address: { name, phone, address, city },
 *         paymentMethod, couponCode?, notes? }
 *
 * The client is never trusted for money: items are re-priced from the
 * catalog, the coupon is re-validated, and shipping is recomputed
 * server-side. Validation failures return 400 with error details.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  checkoutOrderSchema,
  parseOr400,
  readJsonBody,
} from "@/lib/validation";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  cartDiscount,
  cartShipping,
  cartSubtotal,
} from "@/lib/cart-totals";
import { getProductPrice } from "@/components/customer/product-utils";
import type {
  Coupon,
  OrderAddress,
  OrderItem,
  Product,
  SiteSettings,
} from "@/lib/types";

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminAuth || !adminDb) {
    return err(503, "Order service is not configured");
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(checkoutOrderSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Caller must be the signed-in customer placing the order.
  const decoded = await adminAuth.verifyIdToken(input.idToken).catch(() => null);
  if (!decoded) return err(401, "Invalid ID token");
  const uid = decoded.uid;

  try {
    // Re-price every line from the catalog — client prices are ignored.
    const priced: { item: OrderItem; stock: number }[] = [];
    for (const line of input.items) {
      const snap = await adminDb
        .collection(COLLECTIONS.products)
        .doc(line.productId)
        .get();
      if (!snap.exists) {
        return err(400, `Product not found: ${line.productId}`);
      }
      const product = snap.data() as Product;
      const combo = line.combinationId
        ? (product.combinations ?? []).find((c) => c.id === line.combinationId)
        : undefined;
      if (line.combinationId && !combo) {
        return err(400, `Variant not found for product: ${line.productId}`);
      }
      const unitPrice = combo
        ? combo.price
        : getProductPrice(product).price;
      if (!(unitPrice > 0)) {
        return err(400, `Price is not set for product: ${product.name}`);
      }
      const stock = combo ? combo.stock : product.baseStock;
      const qty = Math.min(line.qty, Math.max(stock ?? 1, 1));
      priced.push({
        item: {
          productId: line.productId,
          name: product.name,
          variant: line.variant,
          price: unitPrice,
          qty,
          image: combo?.image ?? product.images?.[0] ?? "/logo.png",
        },
        stock: stock ?? 0,
      });
    }

    const lines = priced.map((p) => ({
      unitPrice: p.item.price,
      qty: p.item.qty,
    }));
    const subtotal = cartSubtotal(lines);

    // Re-validate the coupon against the live coupons collection.
    let coupon: Pick<Coupon, "type" | "value"> | null = null;
    let couponCode: string | undefined;
    if (input.couponCode) {
      const code = input.couponCode.trim().toUpperCase();
      const qsnap = await adminDb
        .collection(COLLECTIONS.coupons)
        .where("code", "==", code)
        .limit(1)
        .get();
      const doc = qsnap.docs[0];
      const data = doc?.data() as Coupon | undefined;
      const now = Date.now();
      const expired =
        data?.expiresAt != null &&
        typeof (data.expiresAt as { toMillis?: () => number }).toMillis ===
          "function" &&
        (data.expiresAt as { toMillis: () => number }).toMillis() < now;
      if (
        data &&
        data.enabled &&
        !expired &&
        (data.minOrder ?? 0) <= subtotal
      ) {
        coupon = { type: data.type, value: data.value };
        couponCode = data.code;
      }
      // An invalid/expired coupon is silently dropped (same as the old
      // client flow) rather than failing the whole order.
    }
    const discount = cartDiscount(subtotal, coupon);

    // Shipping from live site settings.
    let threshold = DEFAULT_FREE_SHIPPING_THRESHOLD;
    try {
      const settingsSnap = await adminDb
        .collection(COLLECTIONS.siteSettings)
        .doc("main")
        .get();
      const settings = settingsSnap.data() as SiteSettings | undefined;
      if (typeof settings?.freeShippingThreshold === "number") {
        threshold = settings.freeShippingThreshold;
      }
    } catch {
      /* fall back to the default threshold */
    }
    const shipping = cartShipping(lines.length, subtotal, discount, threshold);
    const total = Math.max(0, subtotal - discount + shipping);

    const address: OrderAddress = {
      name: input.address.name,
      phone: input.address.phone,
      address: input.address.address,
      city: input.address.city,
    };

    const ref = await adminDb.collection(COLLECTIONS.orders).add({
      userId: uid,
      brand: "mtr", // all storefront orders belong to the MTR Store
      items: priced.map((p) => p.item),
      subtotal,
      discount,
      shipping,
      tax: 0,
      total,
      paymentMethod: input.paymentMethod,
      status: "Pending",
      address,
      ...(couponCode ? { coupon: couponCode } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: ref.id, total });
  } catch (e) {
    Sentry.captureException(e);
    return err(500, "Could not place your order");
  }
}

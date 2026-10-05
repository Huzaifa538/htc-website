/**
 * POST /api/admin/quotations/convert
 *
 * Converts an admin quotation into a real order.
 *
 * Body: { idToken, quotationId }
 *
 * The caller's Firebase ID token is verified with the Admin SDK and must
 * carry claims admin == true with a sales role (owner/manager/staff —
 * viewers are read-only). Writes use the Admin SDK, bypassing client-side
 * security rules (which don't allow admins to create orders for other
 * customers). Sets the quotation's status to "converted".
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { buildOrderFromQuotation } from "@/lib/quotations";
import type { Quotation, StaffRole } from "@/lib/types";

const ALLOWED_ROLES: (StaffRole | null)[] = [null, "owner", "manager", "staff"];

interface TokenClaims {
  admin?: boolean;
  role?: StaffRole | null;
}

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: { idToken?: string; quotationId?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, "Invalid JSON body");
  }

  if (!isAdminConfigured() || !adminAuth || !adminDb) {
    return err(503, "Firebase Admin SDK is not configured");
  }

  /* ---- verify caller ---- */
  if (!body.idToken) return err(401, "Missing idToken");
  const decoded = await adminAuth.verifyIdToken(body.idToken).catch(() => null);
  if (!decoded) return err(401, "Invalid ID token");
  const claims = decoded as typeof decoded & TokenClaims;
  const role = claims.role ?? null;
  if (claims.admin !== true || !ALLOWED_ROLES.includes(role)) {
    return err(403, "Sales-staff access required");
  }

  /* ---- load quotation ---- */
  if (!body.quotationId || typeof body.quotationId !== "string") {
    return err(400, "Missing quotationId");
  }
  const qRef = adminDb.collection(COLLECTIONS.quotations).doc(body.quotationId);
  const qSnap = await qRef.get();
  if (!qSnap.exists) return err(404, "Quotation not found");
  const quotation = { ...(qSnap.data() as Quotation), id: qSnap.id };

  if (quotation.status === "converted" && quotation.convertedOrderId) {
    return NextResponse.json({ orderId: quotation.convertedOrderId });
  }
  if (quotation.status === "converted") {
    return err(409, "Quotation is already converted");
  }

  /* ---- create the order + mark converted (atomic batch) ---- */
  const orderRef = adminDb.collection(COLLECTIONS.orders).doc();
  const batch = adminDb.batch();
  batch.set(orderRef, {
    ...buildOrderFromQuotation(quotation),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(qRef, {
    status: "converted",
    convertedOrderId: orderRef.id,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ orderId: orderRef.id });
}

/**
 * POST /api/referral/apply — dost ka referral code lagao.
 *
 * Body: { code: string }
 * Sirf tab kaam karta hai jab:
 * - code kisi aur user ka ho (khud ka nahi),
 * - tumne pehle kabhi referredBy set na kiya ho,
 * - tumhara abhi tak koi order na ho (naya customer).
 * Bonus dono ko pehle order par milta hai (orders route mein).
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { normalizeReferralCode } from "@/lib/referral";

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminAuth || !adminDb) {
    return NextResponse.json({ ok: false, error: "server-not-configured" }, { status: 500 });
  }
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { code } = (await req.json()) as { code?: string };
    const normalized = normalizeReferralCode(code ?? "");
    if (!normalized || normalized.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid-code" }, { status: 400 });
    }

    // Code kis ka hai?
    const referrerSnap = await adminDb
      .collection(COLLECTIONS.users)
      .where("referralCode", "==", normalized)
      .limit(1)
      .get();
    if (referrerSnap.empty) {
      return NextResponse.json({ ok: false, error: "code-not-found" }, { status: 404 });
    }
    const referrerId = referrerSnap.docs[0].id;
    if (referrerId === uid) {
      return NextResponse.json({ ok: false, error: "own-code" }, { status: 400 });
    }

    const userRef = adminDb.collection(COLLECTIONS.users).doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() as { referredBy?: string } | undefined;
    if (userData?.referredBy) {
      return NextResponse.json({ ok: false, error: "already-referred" }, { status: 400 });
    }

    // Pehle se order hai to referral nahi lagega (sirf naye customers)
    const ordersSnap = await adminDb
      .collection(COLLECTIONS.orders)
      .where("userId", "==", uid)
      .count()
      .get();
    if (ordersSnap.data().count > 0) {
      return NextResponse.json({ ok: false, error: "already-ordered" }, { status: 400 });
    }

    await userRef.set(
      { referredBy: referrerId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

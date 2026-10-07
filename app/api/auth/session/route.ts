/**
 * POST /api/auth/session — mint the admin session cookie.
 *
 * Body: { idToken: string }
 * 1. Verifies the Firebase ID token with the Admin SDK.
 * 2. Checks the token's email against NEXT_PUBLIC_ADMIN_EMAILS, and —
 *    failing that — against the `staff` collection roster (doc id = email,
 *    must be active).
 * 3. On success sets httpOnly cookie `htc_admin=1` (7 days) and merges the
 *    custom claims { admin: true, role } onto the user. Emails with no role
 *    claim are treated as "owner" (backward compat for the bootstrap owner).
 *
 * DELETE /api/auth/session — clears the cookie (called on sign-out).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { isAdminEmail } from "@/lib/auth";
import { ADMIN_SESSION_COOKIE } from "@/middleware";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(req: NextRequest) {
  // Brute-force guard: max 5 session attempts per IP per 15 minutes.
  const ip = getClientIp(req);
  const limit = checkRateLimit(`auth:${ip}`, { windowMs: 15 * 60_000, max: 5 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  if (!isAdminConfigured() || !adminAuth) {
    return NextResponse.json(
      { error: "Firebase Admin SDK is not configured" },
      { status: 503 }
    );
  }

  let idToken: string | undefined;
  try {
    const body = await req.json();
    idToken = body?.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Not an admin" }, { status: 403 });
    }

    const emailAdmin = isAdminEmail(email);

    // Staff roster lookup: doc id is the lowercased email.
    let staffRole: string | null = null;
    if (adminDb) {
      try {
        const snap = await adminDb.doc(`${COLLECTIONS.staff}/${email}`).get();
        const data = snap.data();
        if (
          snap.exists &&
          data?.active === true &&
          typeof data?.role === "string" &&
          data.role.length > 0
        ) {
          staffRole = data.role;
        }
      } catch {
        // Non-fatal: fall through to the allow-list decision.
      }
    }

    if (!emailAdmin && !staffRole) {
      return NextResponse.json({ error: "Not an admin" }, { status: 403 });
    }

    // Ensure the `admin: true` custom claim exists (and the staff `role`
    // claim when this user is on the roster) — the Firestore rules treat
    // these as the authoritative admin signal.
    try {
      const user = await adminAuth.getUser(decoded.uid);
      const claims: Record<string, unknown> = {
        ...(user.customClaims ?? {}),
        admin: true,
      };
      if (staffRole) {
        claims.role = staffRole;
      }
      // The bootstrap owner keeps working as before: no role claim = owner.
      await adminAuth.setCustomUserClaims(decoded.uid, claims);
    } catch {
      // Non-fatal: the cookie session still gates the admin UI.
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, "1", {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}

/**
 * GET /api/auth/session — report whether the request carries a valid
 * admin session cookie. Used by the client to decide if redirecting to
 * /admin is safe (avoids the /login <-> /admin redirect loop when the
 * cookie was never minted).
 */
export async function GET(req: NextRequest) {
  const has = req.cookies.get(ADMIN_SESSION_COOKIE)?.value === "1";
  return NextResponse.json({ admin: has });
}

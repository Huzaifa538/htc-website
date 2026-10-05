/**
 * /api/admin/staff — owner-only staff roster management.
 *
 * POST   body { idToken, email, role, name? } — add a staff member.
 *        Writes doc `staff/<email-lowercased>`:
 *        { email, name, role, active: true, addedBy, createdAt }.
 * DELETE body { idToken, email } — remove a staff member.
 *
 * The caller's Firebase ID token is verified with the Admin SDK; the
 * caller must carry claims admin == true with no role (or role == "owner").
 * (Edge middleware already requires the htc_admin session cookie, which
 * only admins/staff can mint — this is a second, role-level check.)
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { STAFF_ROLE_LABELS, type StaffRole } from "@/lib/types";
import { parseOr400, readJsonBody } from "@/lib/validation";

const staffBodySchema = z.object({
  idToken: z.string().min(1).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email is required"),
  role: z.enum(
    Object.keys(STAFF_ROLE_LABELS) as [StaffRole, ...StaffRole[]],
    { message: "A valid role is required" }
  ),
  name: z.string().trim().min(1).max(100).optional(),
});

const staffDeleteSchema = z.object({
  idToken: z.string().min(1).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email is required"),
});

interface TokenClaims {
  admin?: boolean;
  role?: unknown;
}

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Verify the caller's ID token and require the owner role. */
async function requireOwner(idToken: string | undefined) {
  if (!isAdminConfigured() || !adminAuth || !adminDb) {
    throw err(503, "Firebase Admin SDK is not configured");
  }
  if (!idToken) throw err(401, "Missing idToken");
  const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
  if (!decoded) throw err(401, "Invalid ID token");
  const claims = decoded as typeof decoded & TokenClaims;
  const isOwner =
    claims.admin === true && (claims.role == null || claims.role === "owner");
  if (!isOwner) throw err(403, "Owner access required");
  return decoded;
}

export async function POST(req: NextRequest) {
  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(staffBodySchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const decoded = await requireOwner(body.idToken);
    if (!adminDb) return err(503, "Firebase Admin SDK is not configured");

    const email = body.email;
    const role = body.role;
    const name = body.name && body.name.length > 0 ? body.name : null;

    const ref = adminDb.doc(`${COLLECTIONS.staff}/${email}`);
    const existing = await ref.get();
    if (existing.exists) {
      return err(409, "This email is already on the staff roster");
    }

    await ref.set({
      email,
      name,
      role,
      active: true,
      addedBy: decoded.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, email, role });
  } catch (e) {
    // requireOwner throws NextResponse errors directly.
    if (e instanceof NextResponse) return e;
    return err(500, "Could not add staff member");
  }
}

export async function DELETE(req: NextRequest) {
  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(staffDeleteSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    await requireOwner(body.idToken);
    if (!adminDb) return err(503, "Firebase Admin SDK is not configured");

    const email = body.email;

    const ref = adminDb.doc(`${COLLECTIONS.staff}/${email}`);
    const existing = await ref.get();
    if (!existing.exists) {
      return err(404, "Staff member not found");
    }
    await ref.delete();
    return NextResponse.json({ ok: true, email });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return err(500, "Could not remove staff member");
  }
}

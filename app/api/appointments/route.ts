/**
 * POST /api/appointments — book a consultation (public booking form).
 *
 * Body: { name, phone, email?, date (YYYY-MM-DD), timeSlot, serviceType,
 *         notes? }
 *
 * Validated with zod; rejects with 400 + error details. Writes via the
 * Admin SDK so the client never touches the collection directly.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  appointmentSchema,
  parseOr400,
  readJsonBody,
} from "@/lib/validation";

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminDb) {
    return NextResponse.json(
      { error: "Booking service is not configured" },
      { status: 503 }
    );
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(appointmentSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  try {
    const ref = await adminDb.collection(COLLECTIONS.appointments).add({
      name: input.name,
      phone: input.phone,
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      date: input.date,
      timeSlot: input.timeSlot,
      serviceType: input.serviceType,
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      status: "Pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Could not save your booking" },
      { status: 500 }
    );
  }
}

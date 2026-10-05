/**
 * /api/admin/expenses — expense create/update via the Admin SDK.
 *
 * Auth: edge middleware requires the htc_admin session cookie (admins only).
 *
 * POST  body { date (YYYY-MM-DD), category, amount, note?, receiptUrl?, addedBy? }
 * PATCH body { id, ...same fields }
 *
 * Validated with zod; rejects with 400 + error details. The date string is
 * converted to a Firestore Timestamp server-side (mirrors the admin form's
 * dateInputToTimestamp helper).
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  expenseSchema,
  expenseUpdateSchema,
  parseOr400,
  readJsonBody,
} from "@/lib/validation";
import type { ExpenseInput } from "@/lib/validation";

function notConfigured() {
  return NextResponse.json(
    { error: "Firebase Admin SDK is not configured" },
    { status: 503 }
  );
}

/** YYYY-MM-DD (validated) -> Firestore Timestamp at local midnight. */
function dateInputToTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`));
}

function expensePayload(input: ExpenseInput) {
  return {
    date: dateInputToTimestamp(input.date),
    category: input.category,
    amount: Number(input.amount),
    note: input.note?.trim() || null,
    receiptUrl: input.receiptUrl?.trim() || null,
  };
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminDb) return notConfigured();

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(expenseSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  try {
    const ref = await adminDb.collection(COLLECTIONS.expenses).add({
      ...expensePayload(input),
      addedBy: input.addedBy ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Could not save expense" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminConfigured() || !adminDb) return notConfigured();

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(expenseUpdateSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const { id, ...input } = parsed.data;
  // Note: addedBy is create-only; updates keep the original author, so it
  // is intentionally left out of the update payload below.

  try {
    const ref = adminDb.collection(COLLECTIONS.expenses).doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }
    await ref.update(expensePayload(input));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Could not update expense" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/messages — send a customer chat message.
 *
 * Body: { idToken, userId, text?, imageUrl?, brand, refCard? }
 *
 * The caller's ID token must belong to `userId` (403 otherwise) — a
 * customer can only write to their own chat thread. The message and the
 * parent chat-doc merge both happen server-side via the Admin SDK.
 * Validation failures return 400 with error details.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  chatMessageSchema,
  parseOr400,
  readJsonBody,
} from "@/lib/validation";

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Chat service is not configured" },
      { status: 503 }
    );
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(chatMessageSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const decoded = await adminAuth.verifyIdToken(input.idToken).catch(() => null);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }
  if (decoded.uid !== input.userId) {
    return NextResponse.json(
      { error: "You can only send messages as yourself" },
      { status: 403 }
    );
  }

  try {
    const messagesRef = adminDb.collection(
      `${COLLECTIONS.chats}/${input.userId}/messages`
    );
    const msgRef = await messagesRef.add({
      chatId: input.userId,
      sender: "user",
      text: input.text,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...(input.refCard ? { refCard: input.refCard } : {}),
      brand: input.brand,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    // Merge brand + recency onto the parent chat doc (mirrors the old
    // client-side write).
    await adminDb
      .collection(COLLECTIONS.chats)
      .doc(input.userId)
      .set(
        {
          userId: input.userId,
          brand: input.brand,
          updatedAt: FieldValue.serverTimestamp(),
          typing: null,
        },
        { merge: true }
      );
    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Message failed to send" },
      { status: 500 }
    );
  }
}

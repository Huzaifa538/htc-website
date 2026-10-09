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
import { tooManyRequests } from "@/lib/rate-limit";
import { findBotAnswer, botFallback } from "@/lib/bot-answers";

/** 2 min se purana lastSeen = admin offline. */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** siteSettings/chat se bot is waqt active hai ya nahi. */
async function botIsActive(): Promise<boolean> {
  try {
    const snap = await adminDb!
      .collection(COLLECTIONS.siteSettings)
      .doc("chat")
      .get();
    const d = snap.exists ? (snap.data() as Record<string, unknown>) : {};
    if (d.botEnabled === false) return false;
    if (d.botAutoMode === false) return true; // manual mode → bot on
    // auto mode: admin online ho to bot off
    const lastSeen = d.adminLastSeen as
      | { toMillis?: () => number; toDate?: () => Date }
      | undefined;
    let ms = 0;
    if (lastSeen) {
      if (typeof lastSeen.toMillis === "function") ms = lastSeen.toMillis();
      else if (typeof lastSeen.toDate === "function")
        ms = lastSeen.toDate().getTime();
    }
    const adminOnline = ms > 0 && Date.now() - ms < ONLINE_WINDOW_MS;
    return !adminOnline;
  } catch {
    return false; // settings parh na saken to bot chup rahe
  }
}

export async function POST(req: NextRequest) {
  // Anti-spam: max 60 messages per IP per hour.
  const limited = tooManyRequests(req, "chat");
  if (limited) return limited;

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

    // Bot auto-reply: admin offline ho (ya manual bot-on) to foran jawab do.
    if (input.text && (await botIsActive())) {
      const answer =
        findBotAnswer(input.text) ??
        botFallback(/[\u0600-\u06FF]/.test(input.text));
      await messagesRef.add({
        chatId: input.userId,
        sender: "bot",
        text: answer,
        brand: input.brand,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      await adminDb
        .collection(COLLECTIONS.chats)
        .doc(input.userId)
        .set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Message failed to send" },
      { status: 500 }
    );
  }
}

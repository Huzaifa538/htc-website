/**
 * POST /api/notify/whatsapp — send a WhatsApp message via the official
 * Meta WhatsApp Cloud API (no unofficial APIs).
 *
 * Body: { to?: string; message: string; title?: string; type?: string }
 * Reads whatsappPhoneNumberId + whatsappAccessToken + whatsappOwnerNumber
 * from the siteSettings/main doc via the Admin SDK. If credentials are
 * missing (or the send fails), a fallback admin notification is written to
 * `notifications` (userId "admin") so nothing is lost, and
 * { sent: false, reason } is returned. Tokens are never logged.
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { IntegrationSettings, NewDoc, Notification } from "@/lib/types";
import { readJsonBody } from "@/lib/validation";
import { tooManyRequests } from "@/lib/rate-limit";

const whatsappBodySchema = z.object({
  to: z.string().trim().max(30).optional(),
  message: z.string().trim().min(1).max(4000),
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(["order", "promo", "chat", "system"]).optional(),
});

const GRAPH_VERSION = "v22.0";

/**
 * Convention (mirrors ADMIN_USER_ID in app/admin/layout.tsx):
 * admin-targeted notifications are written with userId === "admin".
 * The layout file is a client component, so the value is inlined here
 * rather than imported.
 */
const ADMIN_USER_ID = "admin";

/** Server-side fallback: store the alert as an admin notification. */
async function storeAdminFallback(
  title: string,
  body: string,
  type: Notification["type"] = "order"
): Promise<void> {
  if (!adminDb) return;
  const payload: NewDoc<Notification> = {
    userId: ADMIN_USER_ID,
    title,
    body,
    type,
    read: false,
  };
  await adminDb.collection(COLLECTIONS.notifications).add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function POST(req: NextRequest) {
  // Anti-abuse: max 10 WhatsApp sends per IP per hour — every send costs
  // money on the Meta API and a spammer could burn the account.
  const limited = tooManyRequests(req, "whatsapp");
  if (limited) return limited;

  if (!isAdminConfigured() || !adminDb) {
    return NextResponse.json(
      { sent: false, reason: "not-configured" },
      { status: 503 }
    );
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) {
    return NextResponse.json(
      { sent: false, reason: "invalid-body" },
      { status: 400 }
    );
  }
  const parsed = whatsappBodySchema.safeParse(raw.body);
  if (!parsed.success) {
    return NextResponse.json(
      { sent: false, reason: "invalid-body" },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const to = body.to && body.to.length > 0 ? body.to : undefined;
  const message = body.message;
  let title = "MTR Store: New order — WhatsApp not configured";
  let type: Notification["type"] = "order";
  if (body.title) {
    title = body.title;
  }
  if (body.type) {
    type = body.type;
  }

  // Load WhatsApp credentials from site settings.
  let settings: IntegrationSettings | null = null;
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.siteSettings)
      .doc("main")
      .get();
    settings = snap.exists ? (snap.data() as IntegrationSettings) : null;
  } catch {
    settings = null;
  }

  const phoneNumberId = settings?.whatsappPhoneNumberId?.trim() || "";
  const accessToken = settings?.whatsappAccessToken?.trim() || "";
  const ownerNumber = settings?.whatsappOwnerNumber?.replace(/\D/g, "") || "";
  const recipient = to?.replace(/\D/g, "") || ownerNumber;

  if (!phoneNumberId || !accessToken || !recipient) {
    await storeAdminFallback(title, message, type);
    return NextResponse.json({ sent: false, reason: "not-configured" });
  }

  const trimmed = message.slice(0, 4000);
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: trimmed },
        }),
      }
    );
    if (!res.ok) {
      let errText = "";
      try {
        errText = await res.text();
      } catch {
        errText = "";
      }
      console.error(
        `[whatsapp] graph error: status=${res.status} body=${errText.slice(0, 300)}`
      );
      await storeAdminFallback("New order — WhatsApp send failed", message);
      return NextResponse.json({ sent: false, reason: "graph-error" });
    }
    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error("[whatsapp] network error:", e instanceof Error ? e.message : "unknown");
    await storeAdminFallback("New order — WhatsApp send failed", message);
    return NextResponse.json({ sent: false, reason: "network-error" });
  }
}

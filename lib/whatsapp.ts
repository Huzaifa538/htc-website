/**
 * WhatsApp alert helper (client-safe): builds the new-order message and
 * POSTs it to the /api/notify/whatsapp route.
 *
 * Note on fallback: when WhatsApp is not configured (or the send fails),
 * the API route itself writes a fallback entry to the `notifications`
 * collection with userId "admin" via the Admin SDK — the client cannot do
 * that directly because Firestore rules only allow admins to create
 * notifications. So nothing is lost even on { sent: false }.
 */

export interface OrderAlertItem {
  name: string;
  qty: number;
}

export interface OrderAlertInput {
  id: string;
  items: OrderAlertItem[];
  total: number; // PKR
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
}

export interface NotifyResult {
  sent: boolean;
  reason?: string;
}

/** "🛒 MTR Store — New order #ABC12345: 3 items, Rs 15,000, COD, Ahmed 03001234567" */
export function buildOrderMessage(order: OrderAlertInput): string {
  const itemCount = order.items.reduce((s, i) => s + (i.qty ?? 0), 0);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const total = Math.round(order.total).toLocaleString("en-PK");
  return (
    `🛒 MTR Store — New order #${shortId}: ${itemCount} item${itemCount === 1 ? "" : "s"}, ` +
    `Rs ${total}, ${order.paymentMethod}, ${order.customerName} ${order.customerPhone}`
  );
}

/**
 * POST the order alert to the WhatsApp notify route. Never throws — any
 * failure resolves to { sent: false }, so callers can fire-and-forget and
 * never block checkout.
 */
export async function notifyOwnerOrder(
  order: OrderAlertInput
): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: buildOrderMessage(order),
        title: "MTR Store: New order — WhatsApp not configured",
        type: "order",
      }),
    });
    const data = (await res.json()) as { sent?: boolean; reason?: string };
    return { sent: data.sent === true, reason: data.reason };
  } catch {
    return { sent: false, reason: "network-error" };
  }
}

/* ---------------- HTC appointment alerts ---------------- */
export interface AppointmentAlertInput {
  name: string;
  phone: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  serviceType: string;
}

/** "📅 HTC — New appointment: Ahmed, Kitchen Renovation, 2026-10-05 10:00 AM – 12:00 PM, 03001234567" */
export function buildAppointmentMessage(a: AppointmentAlertInput): string {
  return (
    `📅 HTC — New appointment: ${a.name}, ${a.serviceType}, ` +
    `${a.date} ${a.timeSlot}, ${a.phone}`
  );
}

/**
 * POST the appointment alert to the WhatsApp notify route. Never throws —
 * same fire-and-forget pattern as order alerts.
 */
export async function notifyOwnerAppointment(
  a: AppointmentAlertInput
): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: buildAppointmentMessage(a),
        title: "HTC: New appointment — WhatsApp not configured",
        type: "system",
      }),
    });
    const data = (await res.json()) as { sent?: boolean; reason?: string };
    return { sent: data.sent === true, reason: data.reason };
  } catch {
    return { sent: false, reason: "network-error" };
  }
}

/* ---------------- Installation booking alerts ---------------- */

export interface InstallationAlertInput {
  productName: string;
  name: string;
  phone: string;
  city: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
}

/** "🔧 Installation booking: Door Lock X, Ahmed 03001234567, Lahore, 2026-10-12 10:00 AM – 12:00 PM" */
export function buildInstallationMessage(i: InstallationAlertInput): string {
  return (
    `🔧 Installation booking: ${i.productName}, ${i.name} ${i.phone}, ` +
    `${i.city}, ${i.date} ${i.timeSlot}`
  );
}

/**
 * POST the installation alert to the WhatsApp notify route. Never throws —
 * same fire-and-forget pattern as order alerts.
 */
export async function notifyOwnerInstallation(
  i: InstallationAlertInput
): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: buildInstallationMessage(i),
        title: "MTR Store: New installation booking — WhatsApp not configured",
        type: "system",
      }),
    });
    const data = (await res.json()) as { sent?: boolean; reason?: string };
    return { sent: data.sent === true, reason: data.reason };
  } catch {
    return { sent: false, reason: "network-error" };
  }
}

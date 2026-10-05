/**
 * Admin allow-list helpers.
 *
 * Admins are identified two ways:
 * 1. Client/cookie flow — the user's Google email is in NEXT_PUBLIC_ADMIN_EMAILS
 *    (comma-separated). Used by the AuthProvider and /api/auth/session.
 * 2. Firestore/Storage rules — the Firebase Auth custom claim `admin: true`,
 *    set on whitelisted users via scripts/set-admin-claim.js.
 *
 * Both lists should contain the same emails; the custom claim is the
 * authoritative one inside security rules.
 */

export function getAdminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

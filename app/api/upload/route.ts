/**
 * POST /api/upload — file uploads via Vercel Blob (public).
 *
 * FormData: file (required), folder? (optional subfolder), idToken? (for
 * signed-in customers; admins are identified by the htc_admin cookie).
 *
 * Auth:
 * - Admins (htc_admin=1 httpOnly cookie, minted by POST /api/auth/session)
 *   may upload to any folder.
 * - Signed-in customers (valid Firebase ID token) may upload images to the
 *   `chat/` folder (chat image attachments) or the `reviews/` folder
 *   (customer review photos — validated client-side as images only).
 *
 * Validation: images (jpeg/png/webp/gif) and videos (mp4/webm/quicktime),
 * max 10 MB. Returns { url } with the public Blob URL.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { put } from "@vercel/blob";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import { ADMIN_SESSION_COOKIE } from "@/middleware";
import { tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function isAdmin(req: NextRequest): boolean {
  return req.cookies.get(ADMIN_SESSION_COOKIE)?.value === "1";
}

/** Strip path tricks and unsafe chars from the original filename. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 100) || "file"
  );
}

export async function POST(req: NextRequest) {
  // Anti-abuse: max 30 uploads per IP per hour (blob storage costs money).
  const limited = tooManyRequests(req, "upload");
  if (limited) return limited;

  const admin = isAdmin(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  let customerUid: string | null = null;
  if (!admin) {
    // Customer path: verify the Firebase ID token from the form.
    if (!isAdminConfigured() || !adminAuth) {
      return NextResponse.json(
        { error: "Upload service is not configured" },
        { status: 503 }
      );
    }
    const idToken = form.get("idToken");
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
    }
    customerUid = decoded.uid;
  }

  return handleUpload(form, { admin, customerUid });
}

async function handleUpload(
  form: FormData,
  auth: { admin: boolean; customerUid: string | null }
) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be under 10 MB" },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only images (JPEG/PNG/WebP/GIF) and videos (MP4/WebM/MOV) are allowed" },
      { status: 400 }
    );
  }

  // Customers are sandboxed to the chat + reviews folders; admins may choose.
  let folder = "uploads";
  if (auth.admin) {
    const requested = form.get("folder");
    if (typeof requested === "string" && requested) {
      folder = sanitizeFilename(requested).replace(/^\.+/, "") || "uploads";
    }
  } else {
    const requested = form.get("folder");
    folder =
      typeof requested === "string" && requested === "reviews"
        ? "reviews"
        : "chat";
  }

  const pathname = `${folder}/${Date.now()}-${sanitizeFilename(file.name)}`;

  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

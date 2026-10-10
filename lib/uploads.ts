"use client";

/**
 * Upload abstraction — Vercel Blob via the server-side POST /api/upload route.
 *
 * Firebase Cloud Storage is NOT available on the free Spark plan (the
 * console requires Blaze billing), so every file upload in the app goes
 * through this module instead of `firebase/storage`.
 *
 * No client setup is needed: the Blob store is connected to the project and
 * the server route handles auth (admin cookie) and validation.
 */

const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads are always available — the Blob store is connected server-side. */
export function isUploadsConfigured(): boolean {
  return true;
}

/** Kept for compatibility; uploads work without any client configuration. */
export const UPLOADS_NOT_CONFIGURED_MESSAGE =
  "File uploads are temporarily unavailable — please try again later.";

interface UploadResponse {
  url?: string;
  error?: string;
}

export interface UploadOptions {
  resourceType?: "image" | "video" | "auto";
  folder?: string;
  onProgress?: (percent: number) => void;
  /** Firebase ID token — required for signed-in customer uploads. */
  idToken?: string;
}

/**
 * Upload one file to POST /api/upload (Vercel Blob, public).
 * onProgress receives 0–100 during the upload (XHR progress events).
 */
export function uploadFile(
  file: File,
  opts: UploadOptions = {}
): Promise<string> {
  const { folder, onProgress, idToken } = opts;

  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error("File must be under 10 MB."));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    if (folder) form.append("folder", folder);
    if (idToken) form.append("idToken", idToken);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as UploadResponse;
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onProgress?.(100);
          resolve(data.url);
        } else {
          reject(
            new Error(data.error ?? `Upload failed (HTTP ${xhr.status}).`)
          );
        }
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(form);
  });
}

/** Upload an image file; resolves with the public URL. */
export function uploadImage(file: File, opts?: { idToken?: string }): Promise<string> {
  return uploadFile(file, { resourceType: "image", folder: "images", idToken: opts?.idToken });
}

/** Upload a video file; resolves with the public URL. */
export function uploadVideo(file: File, opts?: { idToken?: string }): Promise<string> {
  return uploadFile(file, { resourceType: "video", folder: "videos", idToken: opts?.idToken });
}

/** Upload a voice message audio file; resolves with the public URL. */
export function uploadAudio(file: File, opts?: { idToken?: string }): Promise<string> {
  return uploadFile(file, { resourceType: "auto", folder: "voice", idToken: opts?.idToken });
}

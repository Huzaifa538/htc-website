/**
 * Upload pipeline test for the HTC website.
 *
 * Uploads go through lib/uploads.ts → POST /api/upload → Vercel Blob
 * (public). No client-side configuration is needed.
 *
 * Usage: npx tsx scripts/test-uploads.ts
 *
 * Steps:
 *   1. Verifies isUploadsConfigured() is always true (no setup needed).
 *   2. Verifies uploadFile() rejects files over 10 MB client-side.
 *   3. Verifies the compat export UPLOADS_NOT_CONFIGURED_MESSAGE exists.
 *
 * Live server-route testing (auth, type validation, Blob round-trip) is done
 * against the deployed site: POST /api/upload without credentials must 401.
 */

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\n1. Client upload module (lib/uploads.ts)");
  const up = await import("../lib/uploads");

  check(
    "isUploadsConfigured() is true (no client setup needed)",
    up.isUploadsConfigured() === true
  );
  check(
    "UPLOADS_NOT_CONFIGURED_MESSAGE still exported (compat)",
    typeof up.UPLOADS_NOT_CONFIGURED_MESSAGE === "string" &&
      up.UPLOADS_NOT_CONFIGURED_MESSAGE.length > 0
  );
  check("uploadImage exported", typeof up.uploadImage === "function");
  check("uploadVideo exported", typeof up.uploadVideo === "function");

  console.log("\n2. Client-side size guard");
  // 11 MB fake file — must reject before any XHR is created.
  const big = new Blob([Buffer.alloc(11 * 1024 * 1024)]) as unknown as File;
  Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
  Object.defineProperty(big, "name", { value: "big.png" });
  const err = await up.uploadFile(big).then(
    () => "RESOLVED (bad)",
    (e: Error) => e.message
  );
  check(
    "uploadFile rejects files over 10 MB",
    typeof err === "string" && err.includes("10 MB"),
    String(err).slice(0, 80)
  );

  console.log("");
  if (failures > 0) {
    console.error(`❌ ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("🎉 Upload tests passed.");
  console.log("   (Live /api/upload round-trip: test on the deployed site —");
  console.log("    unauthenticated POST must return 401.)");
}

void main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

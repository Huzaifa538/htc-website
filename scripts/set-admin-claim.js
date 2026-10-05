/**
 * Set (or remove) the `admin: true` custom claim on a Firebase Auth user.
 *
 * The Firestore/Storage rules treat `request.auth.token.admin == true` as
 * the authoritative admin signal.
 *
 * Usage:
 *   node scripts/set-admin-claim.js <uid-or-email>
 *   node scripts/set-admin-claim.js <uid-or-email> --remove
 *
 * Env required (or pass via .env file loaded manually):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (use \n for newlines)
 *
 * Accepts either the Firebase Auth UID or the user's email address.
 */
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

const target = process.argv[2];
const remove = process.argv.includes("--remove");

if (!target) {
  console.error("Usage: node scripts/set-admin-claim.js <uid-or-email> [--remove]");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  projectId,
});

async function resolveUid() {
  if (target.includes("@")) {
    const user = await admin.auth().getUserByEmail(target);
    return user.uid;
  }
  return target;
}

(async () => {
  try {
    const uid = await resolveUid();
    const user = await admin.auth().getUser(uid);
    const claims = { ...(user.customClaims || {}) };
    if (remove) {
      delete claims.admin;
      console.log(`Removing admin claim from ${user.email || uid} ...`);
    } else {
      claims.admin = true;
      console.log(`Setting admin:true claim on ${user.email || uid} ...`);
    }
    await admin.auth().setCustomUserClaims(uid, claims);
    console.log("Done. The user must sign out and sign back in for the claim to take effect.");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message || err);
    process.exit(1);
  }
})();

/**
 * Referral program helpers (client-safe).
 *
 * Har user ka apna unique referral code hota hai (profile mein nazar aata
 * hai). Naya customer jab kisi ka code use karke pehla order karta hai to
 * DONO ko 200 loyalty points (Rs 200) bonus milte hain.
 */

/** Dono taraf ka bonus — points mein (1 point = Rs 1). */
export const REFERRAL_BONUS_POINTS = 200;

/**
 * uid se deterministic referral code banao: "HTC-" + 6 characters.
 * Har user ka code unique hota hai kyunke uid unique hai.
 */
export function referralCodeFor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // confusing chars (0/O, 1/I) nikaal diye
  let code = "";
  let n = hash;
  for (let i = 0; i < 6; i++) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + 7;
  }
  return `HTC-${code}`;
}

/** User ke type kiye hue code ko saaf karo (spaces/dashes/case fix). */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "").replace(/^HTC/, "HTC-");
}

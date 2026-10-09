/**
 * Review sentiment — reviews ko positive / negative / neutral mein banto.
 *
 * Koi bahari AI API nahi — Roman Urdu + English keywords ki buniyad
 * par simple scoring. 5-star walon ko zyada tar positive mana jata
 * hai lekin text negative ho to text jeetta hai.
 */

export type Sentiment = "positive" | "negative" | "neutral";

export interface SentimentSummary {
  positive: number;
  negative: number;
  neutral: number;
  /** score -100 (sab negative) se +100 (sab positive) */
  score: number;
}

const POSITIVE = [
  "acha", "achha", "achcha", "bhtreen", "behtreen", "zabardast", "shandar",
  "kamaal", "best", "good", "great", "excellent", "perfect", "love", "loved",
  "awesome", "amazing", "satisfied", "khush", "recommend", "fast", "quick",
  "original", "genuine", "quality", "mazboot", "solid", "value", "shukriya",
  "thanks", "thank", "nice", "superb", "outstanding", "brilliant", "fit",
];

const NEGATIVE = [
  "kharab", "bekar", "bakwas", "ghatiya", "fazool", "bad", "worst", "poor",
  "tuta", "toota", "tooti", "broken", "damage", "damaged", "defect", "defective",
  "late", "slow", "der", "disappoint", "gussa", "naraz", "naraaz", "return",
  "refund", "wapas", "duplicate", "nakli", "fake", "scam", "fraud", "dhoka",
  "terrible", "awful", "horrible", "useless", "waste", "complaint", "shikayat",
  "nahi aya", "nahi aaya", "gum", "missing", "ghalat", "wrong",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Ek review text ka sentiment nikalo. */
export function classifySentiment(text: string, rating?: number): Sentiment {
  const words = tokenize(text);
  let score = 0;
  for (const w of words) {
    if (POSITIVE.includes(w)) score += 1;
    if (NEGATIVE.includes(w)) score -= 1.5; // negative ka wazan zyada
  }
  // rating ka halka asar — lekin text zyada bolta hai
  if (rating != null) {
    if (rating >= 4) score += 0.5;
    else if (rating <= 2) score -= 0.5;
  }
  if (score > 0.5) return "positive";
  if (score < -0.5) return "negative";
  return "neutral";
}

export function summarizeSentiment(
  reviews: { comment: string; title?: string; rating: number }[]
): SentimentSummary {
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const r of reviews) {
    const s = classifySentiment(`${r.title ?? ""} ${r.comment}`, r.rating);
    if (s === "positive") positive++;
    else if (s === "negative") negative++;
    else neutral++;
  }
  const total = positive + negative + neutral;
  const score =
    total === 0 ? 0 : Math.round(((positive - negative) / total) * 100);
  return { positive, negative, neutral, score };
}

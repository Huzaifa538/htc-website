/**
 * Fuzzy product search — Levenshtein distance based.
 *
 * Handles typos ("talla" -> "tala"), transliteration variants
 * ("qabza" -> "kabza") and searches both English + Urdu names.
 */

// common typo/transliteration swaps people actually type
const NORMALIZE_MAP: Record<string, string> = {
  q: "k",
  c: "k",
  ph: "f",
  z: "j",
};

function normalize(s: string): string {
  let out = s.toLowerCase().trim();
  for (const [from, to] of Object.entries(NORMALIZE_MAP)) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Score how well `query` matches `text` (0..1, higher = better).
 * Exact substring hits score highest; then close typos.
 */
export function matchScore(query: string, text: string): number {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;

  if (t.includes(q)) {
    // earlier + longer relative match = better
    const pos = t.indexOf(q);
    return 1 - pos / (t.length + 10) + q.length / (t.length + 10) * 0.3;
  }

  // word-by-word: query words vs text words
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const tw of tWords) {
      const dist = levenshtein(qw, tw);
      const allowed = Math.max(1, Math.floor(tw.length / 3));
      if (dist <= allowed) {
        best = Math.max(best, 1 - dist / (tw.length + 2));
      }
    }
    total += best;
  }
  return (total / qWords.length) * 0.8;
}

export interface SearchableProduct {
  id: string;
  name: string;
  urduName?: string;
  tags: string[];
  categoryName?: string;
}

/**
 * Rank products by fuzzy relevance to the query.
 * Searches name, Urdu name, tags and category name.
 */
export function fuzzySearch<T extends SearchableProduct>(
  query: string,
  products: T[],
  limit = 8
): T[] {
  const q = query.trim();
  if (q.length < 2) return [];

  return products
    .map((p) => {
      const scores = [
        matchScore(q, p.name) * 1.2, // english name matters most
        p.urduName ? matchScore(q, p.urduName) : 0,
        ...p.tags.map((tag) => matchScore(q, tag) * 0.7),
        p.categoryName ? matchScore(q, p.categoryName) * 0.5 : 0,
      ];
      return { p, score: Math.max(...scores) };
    })
    .filter((r) => r.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.p);
}

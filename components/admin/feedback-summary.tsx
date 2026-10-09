/**
 * Feedback summary — reviews ka quick analysis.
 *
 * - Average rating, positive/neutral/negative counts
 * - Sab se common alfaaz (simple word frequency, stopwords nikaal kar)
 *
 * Ye rule-based hai (koi external API nahi) — chhoti dukan ke liye kaafi.
 */
"use client";

import { useMemo } from "react";
import { BarChart3, Smile, Meh, Frown } from "lucide-react";

import type { Review } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Aam alfaaz jo meaning nahi rakhte — inko count nahi karte
const STOPWORDS = new Set(
  "the a an and or but is are was were be been to of in on at for with from by as it its this that these those i you he she we they me him her us them my your his our their bahut bohot bohat bohat ye woh yeh wo hai hain tha thi ke ki ka ko ne se mein mai par bhi nahi nahin kya jo jis jin kaafi acha achaa achi zabardast shukriya".split(" ")
);

function topWords(reviews: Review[], limit = 8): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const r of reviews) {
    const text = `${r.title ?? ""} ${r.comment ?? ""}`.toLowerCase();
    for (const raw of text.split(/[^a-z\u0600-\u06FF]+/)) {
      const w = raw.trim();
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function FeedbackSummary({ reviews }: { reviews: Review[] }) {
  const s = useMemo(() => {
    const rated = reviews.filter((r) => typeof r.rating === "number" && r.rating > 0);
    const avg = rated.length
      ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
      : 0;
    return {
      total: reviews.length,
      avg: Math.round(avg * 10) / 10,
      positive: rated.filter((r) => (r.rating ?? 0) >= 4).length,
      neutral: rated.filter((r) => (r.rating ?? 0) === 3).length,
      negative: rated.filter((r) => (r.rating ?? 0) <= 2).length,
      words: topWords(reviews),
    };
  }, [reviews]);

  if (s.total === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 size={17} className="text-[#D21F26]" />
          Feedback summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-muted/60 p-4 text-center">
            <p className="font-display text-2xl font-extrabold">⭐ {s.avg || "—"}</p>
            <p className="text-xs text-muted-foreground">{s.total} reviews</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-4 text-center">
            <p className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold text-emerald-600">
              <Smile size={18} /> {s.positive}
            </p>
            <p className="text-xs text-muted-foreground">Positive (4–5★)</p>
          </div>
          <div className="rounded-2xl bg-amber-500/10 p-4 text-center">
            <p className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold text-amber-600">
              <Meh size={18} /> {s.neutral}
            </p>
            <p className="text-xs text-muted-foreground">Neutral (3★)</p>
          </div>
          <div className="rounded-2xl bg-red-500/10 p-4 text-center">
            <p className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold text-red-600">
              <Frown size={18} /> {s.negative}
            </p>
            <p className="text-xs text-muted-foreground">Negative (1–2★)</p>
          </div>
        </div>
        {s.words.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customers sab se zyada ye kehte hain
            </p>
            <div className="flex flex-wrap gap-2">
              {s.words.map((w) => (
                <Badge key={w.word} variant="secondary" className="rounded-full px-3 py-1">
                  {w.word} <span className="ml-1 text-muted-foreground">×{w.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

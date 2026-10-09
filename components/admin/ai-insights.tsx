/**
 * AI Insights — admin dashboard ke liye 8 smart cards.
 *
 * Sales forecast, reorder alerts, churn, fraud, price mashware,
 * review sentiment, sale timing aur dead stock — sab ek jaga.
 * Data Firestore se ata hai, hisaab browser mein hota hai
 * (koi bahari API nahi).
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  PackageX,
  UserX,
  ShieldAlert,
  Tag,
  MessageSquareHeart,
  Clock3,
  Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection } from "@/components/admin/firebase";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AppUser, Order, Product, Review } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import {
  forecastSales,
  reorderAlerts,
  churnedCustomers,
  fraudFlags,
  priceSuggestions,
  summarizeSentiment,
  classifySentiment,
  bestSaleTiming,
  weekdayName,
  deadStock,
  grouped,
} from "@/lib/admin-ml";

function CardShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          {icon}
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-extrabold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function AiInsights() {
  const { lang } = useLanguage();
  const ur = lang === "ur";
  const { data: products } = useCollection<Product>(COLLECTIONS.products);
  const { data: orders } = useCollection<Order>(COLLECTIONS.orders);
  const { data: users } = useCollection<AppUser>(COLLECTIONS.users);
  const { data: reviews } = useCollection<Review>(COLLECTIONS.reviews);

  const nameOf = (id: string) =>
    products.find((p) => p.id === id)?.name ?? `#${id.slice(0, 6)}`;

  const sales = useMemo(() => forecastSales(orders), [orders]);
  const reorders = useMemo(
    () => reorderAlerts(products, orders).slice(0, 3),
    [products, orders]
  );
  const churns = useMemo(
    () => churnedCustomers(users, orders).slice(0, 3),
    [users, orders]
  );
  const frauds = useMemo(() => fraudFlags(orders, users).slice(0, 3), [orders, users]);
  const prices = useMemo(
    () => priceSuggestions(products, orders).slice(0, 3),
    [products, orders]
  );
  const sentiment = useMemo(
    () =>
      summarizeSentiment(
        reviews.map((r) => ({ comment: r.comment, title: r.title, rating: r.rating }))
      ),
    [reviews]
  );
  const negatives = useMemo(
    () =>
      reviews
        .filter(
          (r) =>
            classifySentiment(`${r.title ?? ""} ${r.comment}`, r.rating) === "negative"
        )
        .slice(0, 3),
    [reviews]
  );
  const timing = useMemo(() => bestSaleTiming(orders), [orders]);
  const dead = useMemo(() => deadStock(products, orders).slice(0, 3), [products, orders]);

  const deadValue = useMemo(
    () => dead.reduce((s, d) => s + d.stockValue, 0),
    [dead]
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </span>
        <div>
          <h2 className="font-display text-lg font-extrabold">
            {ur ? "اے آئی تجاویز" : "AI Insights"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {ur
              ? "آپ کے اسٹور کے ڈیٹا سے اسمارٹ مشورے"
              : "Smart suggestions from your store data"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1 — sales forecast */}
        <CardShell
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          title={ur ? "سیلز پیش گوئی" : "Sales forecast"}
        >
          <Stat
            value={formatPKR(sales.predicted30d)}
            label={ur ? "اگلے 30 دن (اندازاً)" : "Next 30 days (est.)"}
          />
          <p className="text-xs text-muted-foreground">
            {sales.trend === "up" ? (
              <span className="font-semibold text-emerald-600">
                ▲ {ur ? "بڑھ رہی ہے" : "Trending up"} (+{sales.trendPct}%)
              </span>
            ) : sales.trend === "down" ? (
              <span className="font-semibold text-red-600">
                ▼ {ur ? "گر رہی ہے" : "Trending down"} ({sales.trendPct}%)
              </span>
            ) : (
              <span>{ur ? "مستحکم" : "Stable"}</span>
            )}{" "}
            · {ur ? "روزانہ اوسط" : "daily avg"} {formatPKR(sales.avgDaily)}
          </p>
        </CardShell>

        {/* 2 — reorder alerts */}
        <CardShell
          icon={<PackageX className="h-4 w-4 text-amber-600" />}
          title={ur ? "اسٹاک ختم ہونے والا" : "Reorder alerts"}
        >
          <Stat
            value={String(reorders.length)}
            label={ur ? "پراڈکٹس کو اسٹاک چاہیے" : "products need restock"}
          />
          <div className="space-y-1">
            {reorders.map((r) => (
              <Link
                key={r.productId}
                href={`/admin/products/${r.productId}`}
                className="block truncate text-xs hover:text-primary hover:underline"
              >
                {nameOf(r.productId)} · ~
                {r.daysOfStock < 1 ? "<1" : Math.round(r.daysOfStock)}{" "}
                {ur ? "دن باقی" : "days left"}
              </Link>
            ))}
          </div>
        </CardShell>

        {/* 3 — churn */}
        <CardShell
          icon={<UserX className="h-4 w-4 text-orange-600" />}
          title={ur ? "غائب گاہک" : "Churn risk"}
        >
          <Stat
            value={String(churns.length)}
            label={ur ? "60+ دن سے آرڈر نہیں" : "no order in 60+ days"}
          />
          <div className="space-y-1">
            {churns.map((c) => (
              <Link
                key={c.userId}
                href="/admin/customers"
                className="block truncate text-xs hover:text-primary hover:underline"
              >
                {c.name} · {c.daysInactive} {ur ? "دن" : "days"} ·{" "}
                {formatPKR(c.totalSpent)} {ur ? "خرچ کیا" : "spent"}
              </Link>
            ))}
          </div>
        </CardShell>

        {/* 4 — fraud */}
        <CardShell
          icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
          title={ur ? "مشکوک آرڈرز" : "Fraud watch"}
        >
          <Stat
            value={String(frauds.length)}
            label={ur ? "جائزہ درکار" : "need review"}
          />
          <div className="space-y-1">
            {frauds.map((f) => (
              <Link
                key={f.orderId}
                href={`/admin/orders/${f.orderId}`}
                className="block truncate text-xs hover:text-primary hover:underline"
              >
                #{f.orderId.slice(0, 6)} · {formatPKR(f.total)} ·{" "}
                {ur ? "رسک" : "risk"} {f.riskScore}%
              </Link>
            ))}
          </div>
        </CardShell>

        {/* 5 — price suggestions */}
        <CardShell
          icon={<Tag className="h-4 w-4 text-blue-600" />}
          title={ur ? "قیمت کے مشورے" : "Price tips"}
        >
          <Stat
            value={String(prices.length)}
            label={ur ? "پراڈکٹس پر نظرثانی کریں" : "products to review"}
          />
          <div className="space-y-1">
            {prices.map((p) => (
              <Link
                key={p.productId}
                href={`/admin/products/${p.productId}`}
                className="block truncate text-xs hover:text-primary hover:underline"
              >
                {p.kind === "raise" ? "▲" : "▼"} {nameOf(p.productId)} ·{" "}
                {formatPKR(p.currentPrice)} → {formatPKR(p.suggestedPrice)}
              </Link>
            ))}
          </div>
        </CardShell>

        {/* 6 — review sentiment */}
        <CardShell
          icon={<MessageSquareHeart className="h-4 w-4 text-pink-600" />}
          title={ur ? "ریویو کا مزاج" : "Review mood"}
        >
          <Stat
            value={`${sentiment.score >= 0 ? "+" : ""}${sentiment.score}`}
            label={ur ? "مجموعی اسکور (-100 سے +100)" : "overall score (-100 to +100)"}
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-600">
              {sentiment.positive} {ur ? "مثبت" : "positive"}
            </span>{" "}
            ·{" "}
            <span className="font-semibold text-red-600">
              {sentiment.negative} {ur ? "منفی" : "negative"}
            </span>{" "}
            · {sentiment.neutral} {ur ? "عام" : "neutral"}
          </p>
          {negatives.length > 0 && (
            <Link
              href="/admin/reviews"
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              {negatives.length} {ur ? "منفی ریویو دیکھیں →" : "negative reviews →"}
            </Link>
          )}
        </CardShell>

        {/* 7 — sale timing */}
        <CardShell
          icon={<Clock3 className="h-4 w-4 text-indigo-600" />}
          title={ur ? "سیل کا بہترین وقت" : "Best sale time"}
        >
          {timing ? (
            <>
              <Stat
                value={weekdayName(timing.bestWeekday, lang)}
                label={ur ? "بہترین دن" : "best day"}
              />
              <p className="text-xs text-muted-foreground">
                {ur ? "بہترین وقت" : "best time"}:{" "}
                <span className="font-semibold capitalize">{timing.bestSlot}</span>{" "}
                · {formatPKR(timing.bestSlotRevenue)} {ur ? "اس حصے میں" : "in this slot"}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {ur ? "ابھی اتنا ڈیٹا نہیں" : "Not enough data yet"}
            </p>
          )}
        </CardShell>

        {/* 8 — dead stock */}
        <CardShell
          icon={<Boxes className="h-4 w-4 text-slate-500" />}
          title={ur ? "اٹکا ہوا اسٹاک" : "Dead stock"}
        >
          <Stat
            value={formatPKR(deadValue)}
            label={ur ? "پھنسا ہوا سرمایہ" : "capital stuck"}
          />
          <div className="space-y-1">
            {dead.map((d) => (
              <Link
                key={d.productId}
                href={`/admin/products/${d.productId}`}
                className="block truncate text-xs hover:text-primary hover:underline"
              >
                {nameOf(d.productId)} · {grouped(d.stock)} {ur ? "یونٹ" : "units"}
              </Link>
            ))}
          </div>
        </CardShell>
      </div>
    </section>
  );
}

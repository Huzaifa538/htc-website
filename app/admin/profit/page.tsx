"use client";

/**
 * Profit dashboard (Kharcha vs Income): revenue from orders against
 * business expenses, with daily/monthly views, a revenue-vs-expense
 * trend chart, expense category breakdown and top products by revenue.
 *
 * Cancelled orders are excluded from revenue.
 */
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp, Wallet, Percent } from "lucide-react";

import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Expense, Order } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatCard,
} from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewKey = "daily" | "monthly";

const EXPENSE_COLORS = ["#D21F26", "#2563EB", "#7C3AED", "#059669", "#D97706", "#64748B", "#0EA5E9"];

const counted = (o: Order) => o.status !== "Cancelled";

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default function ProfitPage() {
  const [view, setView] = useState<ViewKey>("monthly");

  const { data: orders, loading: ordersLoading } = useCollection<Order>(COLLECTIONS.orders);
  const { data: expenses, loading: expLoading } = useCollection<Expense>(COLLECTIONS.expenses);

  const series = useMemo(() => {
    const buckets = new Map<string, { label: string; ts: number; revenue: number; expenses: number }>();
    const now = new Date();
    const span = view === "daily" ? 14 : 6;
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now);
      let key: string;
      let label: string;
      if (view === "daily") {
        d.setDate(d.getDate() - i);
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
      } else {
        d.setMonth(d.getMonth() - i);
        key = `${d.getFullYear()}-${d.getMonth()}`;
        label = d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
      }
      buckets.set(key, { label, ts: d.getTime(), revenue: 0, expenses: 0 });
    }
    for (const o of orders) {
      if (!counted(o)) continue;
      const d = new Date(tsMillis(o.createdAt));
      const key =
        view === "daily"
          ? d.toISOString().slice(0, 10)
          : `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (b) b.revenue += o.total ?? 0;
    }
    for (const e of expenses) {
      const ms = tsMillis(e.date);
      if (!ms) continue;
      const d = new Date(ms);
      const key =
        view === "daily"
          ? d.toISOString().slice(0, 10)
          : `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (b) b.expenses += e.amount ?? 0;
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.ts - b.ts)
      .map((b) => ({ ...b, profit: b.revenue - b.expenses }));
  }, [orders, expenses, view]);

  const totals = useMemo(() => {
    const revenue = series.reduce((s, b) => s + b.revenue, 0);
    const exp = series.reduce((s, b) => s + b.expenses, 0);
    const profit = revenue - exp;
    return { revenue, expenses: exp, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }, [series]);

  // expenses grouped by category inside the visible window
  const expensesByCategory = useMemo(() => {
    const cutoff = startOfDay(new Date());
    if (view === "daily") cutoff.setDate(cutoff.getDate() - 13);
    else cutoff.setMonth(cutoff.getMonth() - 5, 1);
    const cutoffMs = cutoff.getTime();
    const map = new Map<string, number>();
    for (const e of expenses) {
      const ms = tsMillis(e.date);
      if (!ms || ms < cutoffMs) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + (e.amount ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, view]);

  // top products by revenue inside the visible window
  const topProducts = useMemo(() => {
    const cutoff = startOfDay(new Date());
    if (view === "daily") cutoff.setDate(cutoff.getDate() - 13);
    else cutoff.setMonth(cutoff.getMonth() - 5, 1);
    const cutoffMs = cutoff.getTime();
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      if (!counted(o)) continue;
      if (tsMillis(o.createdAt) < cutoffMs) continue;
      for (const item of o.items ?? []) {
        const cur = map.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
        cur.qty += item.qty ?? 0;
        cur.revenue += (item.price ?? 0) * (item.qty ?? 0);
        map.set(item.productId, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [orders, view]);


  if (!isFirebaseConfigured()) return <SetupWarning feature="Profit dashboard" />;
  if (ordersLoading || expLoading)
    return (
      <>
        <PageHeader title="Profit" subtitle="Kharcha vs income" />
        <LoadingState rows={8} />
      </>
    );

  const windowLabel = view === "daily" ? "Last 14 days" : "Last 6 months";

  return (
    <>
      <PageHeader
        title="Profit"
        subtitle={`Kharcha vs income · ${windowLabel}`}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={`Revenue (${windowLabel.toLowerCase()})`} value={totals.revenue} format={formatPKR} icon={TrendingUp} />
        <StatCard
          title="Expenses"
          value={totals.expenses}
          format={formatPKR}
          icon={Wallet}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <StatCard
          title="Net profit"
          value={totals.profit}
          format={formatPKR}
          icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
          accent={
            totals.profit >= 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          }
          subtitle={totals.profit >= 0 ? "You're in the green" : "Spending more than earning"}
        />
        <StatCard
          title="Profit margin"
          value={totals.margin}
          format={(v) => `${v.toFixed(1)}%`}
          icon={Percent}
        />
      </div>

      {/* revenue vs expenses trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs expenses ({view === "daily" ? "daily" : "monthly"})</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v, name) => [
                  formatPKR(Number(v)),
                  name === "revenue" ? "Revenue" : name === "expenses" ? "Expenses" : "Net profit",
                ]}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#D21F26" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="profit" name="Net profit" stroke="#2563EB" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* expense categories */}
        <Card>
          <CardHeader>
            <CardTitle>Where the kharcha goes</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <EmptyState title="No expenses in this window" />
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map((r, i) => (
                  <div key={r.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="font-semibold">{formatPKR(r.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${totals.expenses > 0 ? (r.total / totals.expenses) * 100 : 0}%`,
                          backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* top products by revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Top products by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <EmptyState title="No sales in this window" />
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                    </div>
                    <span className="text-sm font-semibold">{formatPKR(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

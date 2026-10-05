"use client";

/**
 * Sales reports: date-range KPIs (sales, orders, AOV, profit), a
 * sales-by-day chart, top-5 products by revenue, and net profit after
 * business expenses.
 *
 * Profit per order line = (price − costPrice) × qty. costPrice comes from
 * the product doc; when missing, 70% of the selling price is used as an
 * estimated cost and the UI labels the figure as estimated. Cancelled
 * orders are excluded from sales and profit.
 */
import { useMemo, useState } from "react";
import { Download, Banknote, ShoppingCart, Receipt, TrendingUp, CircleDollarSign, PiggyBank } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Expense, Order, Product } from "@/lib/types";
import { formatPKR, formatPKRCompact } from "@/lib/format";
import {
  useCollection,
  tsMillis,
  downloadCsv,
} from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatCard,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

const DAY_MS = 86_400_000;

function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const now = new Date();
  const to = toDateInput(now);
  if (preset === "today") return { from: to, to };
  if (preset === "7d") return { from: toDateInput(new Date(now.getTime() - 6 * DAY_MS)), to };
  if (preset === "30d") return { from: toDateInput(new Date(now.getTime() - 29 * DAY_MS)), to };
  return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

/** [startMs, endMs] inclusive for the selected from/to date inputs. */
function rangeBounds(from: string, to: string): { start: number; end: number } {
  const start = from
    ? new Date(`${from}T00:00:00`).getTime()
    : new Date().setHours(0, 0, 0, 0);
  const end = to ? new Date(`${to}T23:59:59`).getTime() : Date.now();
  return { start, end };
}

const shortDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-PK", { day: "numeric", month: "short" });

const tooltipPkr = (
  value: number | string | ReadonlyArray<number | string> | undefined
): string => formatPKR(Number(Array.isArray(value) ? value[0] : value ?? 0));

const axisPkr = (v: number): string => formatPKRCompact(v);

interface DayBucket {
  key: string;
  label: string;
  ms: number;
  orders: number;
  sales: number;
  profit: number;
}

export default function ReportsPage() {
  const { data: orders, loading: ordersLoading } = useCollection<Order>(COLLECTIONS.orders);
  const { data: products, loading: productsLoading } = useCollection<Product>(COLLECTIONS.products);
  const { data: expenses, loading: expensesLoading } = useCollection<Expense>(COLLECTIONS.expenses);

  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(() => presetRange("30d").from);
  const [to, setTo] = useState(() => presetRange("30d").to);
  // Brand filter: all storefront orders are MTR (HTC has no product sales).
  const [brandFilter, setBrandFilter] = useState<"all" | "mtr">("all");

  const brandOrders = useMemo(
    () =>
      brandFilter === "all"
        ? orders
        : orders.filter((o) => o.brand === "mtr"),
    [orders, brandFilter]
  );

  const pickPreset = (p: Exclude<Preset, "custom">) => {
    const r = presetRange(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const stats = useMemo(() => {
    const { start, end } = rangeBounds(from, to);
    const costOf = new Map<string, number>();
    for (const p of products) {
      if (p.costPrice != null && Number.isFinite(p.costPrice)) costOf.set(p.id, p.costPrice);
    }

    const active = brandOrders.filter((o) => {
      if (o.status === "Cancelled") return false;
      const ms = tsMillis(o.createdAt);
      return ms >= start && ms <= end;
    });

    let sales = 0;
    let profit = 0;
    let estimatedLines = 0;
    const daily = new Map<string, DayBucket>();
    const byProduct = new Map<string, number>();

    for (const o of active) {
      const ms = tsMillis(o.createdAt);
      const dayKey = toDateInput(new Date(ms));
      sales += o.total ?? 0;

      let bucket = daily.get(dayKey);
      if (!bucket) {
        bucket = { key: dayKey, label: shortDay(ms), ms, orders: 0, sales: 0, profit: 0 };
        daily.set(dayKey, bucket);
      }
      bucket.orders += 1;
      bucket.sales += o.total ?? 0;

      for (const item of o.items ?? []) {
        const price = item.price ?? 0;
        const qty = item.qty ?? 0;
        const cost = costOf.get(item.productId);
        const unitCost = cost ?? price * 0.7;
        if (cost == null) estimatedLines += 1;
        const lineProfit = (price - unitCost) * qty;
        profit += lineProfit;
        bucket.profit += lineProfit;
        byProduct.set(item.name, (byProduct.get(item.name) ?? 0) + price * qty);
      }
    }

    const days = Array.from(daily.values()).sort((a, b) => a.ms - b.ms);
    const topProducts = Array.from(byProduct.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const expenseTotal = expenses
      .filter((e) => {
        const ms = tsMillis(e.date);
        return ms >= start && ms <= end;
      })
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const count = active.length;
    return {
      sales,
      count,
      aov: count > 0 ? sales / count : 0,
      profit,
      estimatedLines,
      days,
      topProducts,
      expenseTotal,
      netProfit: profit - expenseTotal,
    };
  }, [brandOrders, products, expenses, from, to]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["HTC Sales Report", `${from} to ${to}`],
      [],
      ["Date", "Orders", "Sales (PKR)", "Profit (PKR)"],
    ];
    for (const d of stats.days) {
      rows.push([d.key, d.orders, Math.round(d.sales), Math.round(d.profit)]);
    }
    rows.push(["TOTAL", stats.count, Math.round(stats.sales), Math.round(stats.profit)]);
    rows.push([]);
    rows.push(["Expenses (PKR)", Math.round(stats.expenseTotal)]);
    rows.push(["Net profit (PKR)", Math.round(stats.netProfit)]);
    downloadCsv(`htc-sales-report-${from}-to-${to}.csv`, rows);
  };

  const loading = ordersLoading || productsLoading || expensesLoading;
  if (!isFirebaseConfigured()) return <SetupWarning feature="Sales reports" />;
  if (loading)
    return (
      <>
        <PageHeader title="Sales Reports" />
        <LoadingState rows={8} />
      </>
    );

  const rangeLabel = `${new Date(rangeBounds(from, to).start).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} – ${new Date(rangeBounds(from, to).end).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <>
      <PageHeader
        title="Sales Reports"
        subtitle={rangeLabel}
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* date range + brand filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Brand
          </span>
          {(
            [
              { id: "all", label: "All" },
              { id: "mtr", label: "MTR Store" },
            ] as const
          ).map((b) => (
            <Button
              key={b.id}
              variant={brandFilter === b.id ? "default" : "outline"}
              size="sm"
              onClick={() => setBrandFilter(b.id)}
            >
              {b.label}
            </Button>
          ))}
        </div>
        <p className="w-full text-xs text-muted-foreground">
          All storefront orders are MTR Store sales — HTC (the company) has no
          product sales; its appointments and projects are tracked separately.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              variant={preset === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => pickPreset(p.id)}
              className={cn(preset === p.id && "pointer-events-none")}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="rep-from" className="text-xs">From</Label>
            <Input
              id="rep-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-to" className="text-xs">To</Label>
            <Input
              id="rep-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total sales" value={stats.sales} format={formatPKR} icon={Banknote} subtitle={`${stats.count} orders · cancelled excluded`} />
        <StatCard title="Orders" value={stats.count} icon={ShoppingCart} subtitle="Non-cancelled orders" />
        <StatCard title="Avg order value" value={stats.aov} format={formatPKR} icon={Receipt} subtitle="Sales ÷ orders" />
        <StatCard
          title="Gross profit"
          value={stats.profit}
          format={formatPKR}
          icon={TrendingUp}
          subtitle={
            stats.estimatedLines > 0
              ? `Estimated: ${stats.estimatedLines} line(s) used 70% of price as cost`
              : "From product cost prices"
          }
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* net profit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Expenses in range"
          value={stats.expenseTotal}
          format={formatPKR}
          icon={CircleDollarSign}
          subtitle="From the expenses ledger"
          accent="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        />
        <StatCard
          title="Net profit"
          value={stats.netProfit}
          format={formatPKR}
          icon={PiggyBank}
          subtitle="Gross profit − expenses"
          accent={
            stats.netProfit >= 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }
        />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by day</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.days.length === 0 ? (
              <EmptyState title="No sales in this range" description="Try a wider date range." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={axisPkr} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                    <Tooltip formatter={tooltipPkr} />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#D21F26" fill="#D21F26" fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 products by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <EmptyState title="No product sales in this range" description="Try a wider date range." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topProducts} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d4" horizontal={false} />
                    <XAxis type="number" tickFormatter={axisPkr} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
                    <Tooltip formatter={tooltipPkr} />
                    <Bar dataKey="revenue" name="Revenue" fill="#D21F26" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Profit = Σ (selling price − cost price) × qty per order line. Where a product has no
        cost price saved, 70% of its selling price is used as an estimated cost.
      </p>
    </>
  );
}

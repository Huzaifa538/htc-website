"use client";

/**
 * Admin dashboard: KPI cards with animated counters, revenue charts with
 * date-range filter, orders-by-status donut, sales-by-category bar, top
 * products, new-customer trend, recent orders, low-stock alerts and recent
 * messages/inquiries.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Hourglass,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type {
  AppUser,
  Category,
  ContactMessage,
  Order,
  OrderStatus,
  Product,
  ServiceInquiry,
} from "@/lib/types";
import { formatPKR } from "@/lib/format";
import {
  useCollection,
  fmtDate,
  shortId,
  tsMillis,
} from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  StatCard,
  StatusBadge,
  PageHeader,
  EmptyState,
  LoadingState,
} from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CHART_COLORS = ["#D21F26", "#2563EB", "#7C3AED", "#059669", "#D97706", "#64748B"];
const STATUS_LIST: OrderStatus[] = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

type RangeKey = "daily" | "weekly" | "monthly";

const isCounted = (o: Order) => o.status !== "Cancelled";

function bucketRevenue(orders: Order[], range: RangeKey) {
  const buckets = new Map<string, { label: string; total: number; ts: number }>();
  const now = new Date();
  const spans: Record<RangeKey, number> = { daily: 14, weekly: 8, monthly: 6 };
  const span = spans[range];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now);
    let key = "";
    let label = "";
    if (range === "daily") {
      d.setDate(d.getDate() - i);
      key = d.toISOString().slice(0, 10);
      label = d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
    } else if (range === "weekly") {
      d.setDate(d.getDate() - i * 7);
      const monday = new Date(d);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
      label = `Wk ${monday.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}`;
    } else {
      d.setMonth(d.getMonth() - i);
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
    }
    buckets.set(key, { label, total: 0, ts: d.getTime() });
  }
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const d = new Date(tsMillis(o.createdAt));
    let key = "";
    if (range === "daily") key = d.toISOString().slice(0, 10);
    else if (range === "weekly") {
      const monday = new Date(d);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
    } else key = `${d.getFullYear()}-${d.getMonth()}`;
    const b = buckets.get(key);
    if (b) b.total += o.total ?? 0;
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

export default function AdminDashboard() {
  const [range, setRange] = useState<RangeKey>("daily");

  const { data: orders, loading: ordersLoading } = useCollection<Order>(COLLECTIONS.orders);
  const { data: products } = useCollection<Product>(COLLECTIONS.products);
  const { data: users } = useCollection<AppUser>(COLLECTIONS.users);
  const { data: categories } = useCollection<Category>(COLLECTIONS.categories);
  const { data: contactMsgs } = useCollection<ContactMessage>(COLLECTIONS.contactMessages);
  const { data: inquiries } = useCollection<ServiceInquiry>(COLLECTIONS.serviceInquiries);

  const stats = useMemo(() => {
    const counted = orders.filter(isCounted);
    const totalRevenue = counted.reduce((s, o) => s + (o.total ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const monthKey = new Date().toISOString().slice(0, 7);
    const revenueToday = counted
      .filter((o) => new Date(tsMillis(o.createdAt)).toISOString().slice(0, 10) === today)
      .reduce((s, o) => s + (o.total ?? 0), 0);
    const revenueMonth = counted
      .filter((o) => new Date(tsMillis(o.createdAt)).toISOString().slice(0, 7) === monthKey)
      .reduce((s, o) => s + (o.total ?? 0), 0);
    const pendingOrders = orders.filter((o) => o.status === "Pending").length;
    return {
      totalRevenue,
      orders: orders.length,
      customers: users.length,
      products: products.length,
      pendingOrders,
      revenueToday,
      revenueMonth,
    };
  }, [orders, users, products]);

  const revenueSeries = useMemo(() => bucketRevenue(orders, range), [orders, range]);

  const ordersByStatus = useMemo(
    () =>
      STATUS_LIST.map((s) => ({
        name: s,
        value: orders.filter((o) => o.status === s).length,
      })).filter((x) => x.value > 0),
    [orders]
  );

  const salesByCategory = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const totals = new Map<string, number>();
    for (const o of orders) {
      if (!isCounted(o)) continue;
      for (const item of o.items ?? []) {
        const p = productMap.get(item.productId);
        const cat = p ? catMap.get(p.categoryId) ?? "Uncategorized" : "Uncategorized";
        totals.set(cat, (totals.get(cat) ?? 0) + (item.price ?? 0) * (item.qty ?? 0));
      }
    }
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [orders, products, categories]);

  const topProducts = useMemo(
    () => products.slice().sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0)).slice(0, 5),
    [products]
  );

  const newCustomersTrend = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
        count: 0,
      });
    }
    for (const u of users) {
      const key = new Date(tsMillis(u.createdAt)).toISOString().slice(0, 10);
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        if (d.toISOString().slice(0, 10) === key) {
          days[i]!.count += 1;
          break;
        }
      }
    }
    return days;
  }, [users]);

  const recentOrders = useMemo(
    () => orders.slice().sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)).slice(0, 8),
    [orders]
  );

  const lowStock = useMemo(() => {
    const threshold = 10;
    const out: { id: string; name: string; stock: number; detail: string }[] = [];
    for (const p of products) {
      if ((p.combinations?.length ?? 0) > 0) {
        for (const c of p.combinations) {
          if (c.stock < threshold) {
            out.push({
              id: `${p.id}-${c.id}`,
              name: p.name,
              stock: c.stock,
              detail: Object.values(c.options).join(" / "),
            });
          }
        }
      } else if ((p.baseStock ?? 0) < threshold) {
        out.push({ id: p.id, name: p.name, stock: p.baseStock ?? 0, detail: "Base stock" });
      }
    }
    return out.sort((a, b) => a.stock - b.stock).slice(0, 8);
  }, [products]);

  const recentMessages = useMemo(() => {
    const msgs = (contactMsgs ?? []).map((m) => ({
      id: m.id,
      title: m.name,
      body: m.message,
      time: tsMillis(m.createdAt),
      tag: "Contact",
    }));
    const inqs = (inquiries ?? []).map((i) => ({
      id: i.id,
      title: i.name,
      body: `${i.serviceName}: ${i.message}`,
      time: tsMillis(i.createdAt),
      tag: "Inquiry",
    }));
    return [...msgs, ...inqs].sort((a, b) => b.time - a.time).slice(0, 6);
  }, [contactMsgs, inquiries]);

  if (!isFirebaseConfigured()) return <SetupWarning feature="The dashboard" />;
  if (ordersLoading)
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Store overview" />
        <LoadingState rows={8} />
      </>
    );

  // en-PK locale renders 6895 as "6.895" — use plain integer grouping.
  const count = (v: number) =>
    Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back — here's what's happening at HTC."
      />

      {/* Brand sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D21F26]/10 text-2xl">
              🏪
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">MTR Store</p>
              <p className="text-xs text-muted-foreground">
                Hardware retail — products, orders, coupons, courier
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/products">Products</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/orders">Orders</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/mtr/messages">Messages</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-2xl">
              🏢
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">HTC Company</p>
              <p className="text-xs text-muted-foreground">
                Projects, services, appointments & company content
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/projects">Projects</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/appointments">Appointments</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/htc/messages">Messages</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total revenue" value={stats.totalRevenue} format={formatPKR} icon={DollarSign} subtitle={`${stats.orders} orders`} />
        <StatCard title="Revenue today" value={stats.revenueToday} format={formatPKR} icon={TrendingUp} subtitle={`This month: ${formatPKR(stats.revenueMonth)}`} />
        <StatCard title="Orders" value={stats.orders} format={count} icon={ShoppingCart} subtitle={`${stats.pendingOrders} pending`} />
        <StatCard title="Customers" value={stats.customers} format={count} icon={Users} subtitle={`${stats.orders} orders placed`} />
        <StatCard title="Pending orders" value={stats.pendingOrders} format={count} icon={Hourglass} accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
        <StatCard title="Products" value={stats.products} format={count} icon={Package} />
        <StatCard title="Revenue this month" value={stats.revenueMonth} format={formatPKR} icon={TrendingUp} />
        <StatCard title="Low stock alerts" value={lowStock.length} format={count} icon={AlertTriangle} accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
      </div>

      {/* revenue chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Revenue</CardTitle>
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D21F26" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#D21F26" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatPKR(Number(v)), "Revenue"]} />
              <Area type="monotone" dataKey="total" stroke="#D21F26" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* orders donut */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {ordersByStatus.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* sales by category */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {salesByCategory.length === 0 ? (
              <EmptyState title="No sales data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByCategory} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `Rs ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatPKR(Number(v)), "Sales"]} />
                  <Bar dataKey="total" fill="#D21F26" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* top products */}
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <EmptyState title="No products yet" />
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPKR(p.basePrice)}</p>
                    </div>
                    <span className="text-sm font-semibold">{p.soldCount ?? 0} sold</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* new customers */}
        <Card>
          <CardHeader>
            <CardTitle>New customers (14 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newCustomersTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent orders</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/orders">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="New orders will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">
                          #{shortId(o.id)}
                        </Link>
                      </TableCell>
                      <TableCell>{o.address?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                      <TableCell className="font-semibold">{formatPKR(o.total)}</TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* low stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Low stock
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/products">
                Manage <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <EmptyState title="Stock is healthy" description="Nothing below the alert threshold." />
            ) : (
              <div className="space-y-2">
                {lowStock.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/products/${s.id.split("-")[0]}`}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                    </div>
                    <span className={`font-bold ${s.stock <= 0 ? "text-destructive" : "text-amber-600"}`}>
                      {s.stock} left
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* recent messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Messages & inquiries
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/mtr/messages">MTR</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/htc/messages">
                  HTC <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              <div className="space-y-2">
                {recentMessages.map((m) => (
                  <div key={`${m.tag}-${m.id}`} className="flex items-start gap-3 rounded-lg border p-2.5">
                    <div className="rounded-full bg-muted p-2">
                      {m.tag === "Contact" ? (
                        <ClipboardList className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {m.title} <span className="ml-1 text-xs font-normal text-muted-foreground">· {m.tag}</span>
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{m.body}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.time).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    </span>
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

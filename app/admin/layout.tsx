"use client";

/**
 * Admin shell: collapsible sidebar, topbar (notifications bell, theme
 * toggle, profile dropdown). Guards non-admins with an "Access denied"
 * state (edge middleware already redirects unauthenticated users).
 */
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Package,
  Tags,
  Images,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  Wallet,
  Users,
  MessageSquare,
  Star,
  CalendarCheck,
  Wrench,
  Building2,
  Film,
  Info,
  Settings,
  KeyRound,
  Bell,
  Moon,
  Sun,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  LogOut,
  ShieldAlert,
  Truck,
  Store,
  Ticket,
  Zap,
  Gift,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Notification, StaffRole, WithId } from "@/lib/types";
import { STAFF_ROLE_LABELS } from "@/lib/types";
import { fmtDateTime } from "@/components/admin/firebase";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ------------------------- brand-grouped nav ------------------------- */
/**
 * The admin panel mirrors the business split:
 * - 🏪 MTR Store — hardware retail (products, orders, coupons, courier)
 * - 🏢 HTC Company — services, projects, appointments, content
 *
 * Pages are only regrouped here; no files were moved. Dashboard stays /admin.
 */
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Optional brand logo shown in the group header (e.g. the MTR badge). */
  logo?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "MTR Store",
    icon: Store,
    logo: "/mtr-logo.png",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/image-fixer", label: "Image Fixer", icon: Images },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket },
      { href: "/admin/flash-sales", label: "Flash Sales", icon: Zap },
      { href: "/admin/combos", label: "Combo Deals", icon: Gift },
      { href: "/admin/courier", label: "Courier", icon: Truck },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/mtr/messages", label: "MTR Messages", icon: MessageSquare },
    ],
  },
  {
    label: "HTC Company",
    icon: Building2,
    items: [
      { href: "/admin/projects", label: "Projects", icon: Building2 },
      { href: "/admin/services", label: "Services", icon: Wrench },
      { href: "/admin/appointments", label: "Appointments", icon: CalendarCheck },
      { href: "/admin/htc/messages", label: "HTC Messages", icon: MessageSquare },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/profit", label: "Profit", icon: TrendingUp },
      { href: "/admin/expenses", label: "Expenses", icon: Wallet },
      { href: "/admin/staff", label: "Staff", icon: KeyRound },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/gallery", label: "Gallery", icon: Film },
      { href: "/admin/hero", label: "Hero Slides", icon: Images },
      { href: "/admin/about", label: "About", icon: Info },
      { href: "/admin/settings", label: "Site Settings", icon: Settings },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

/* ------------------------- role-based nav gating ------------------------- */
/**
 * UI gating only — Firestore rules enforce the real access control.
 * - viewer: read-only ops pages (hide Site Settings, Staff, Hero Slides,
 *   Categories, About, Services, Projects).
 * - staff / manager: everything except Site Settings + Staff.
 * - owner / unknown (loading): everything (fail open for the owner during
 *   the role-claim transition).
 */
const VIEWER_HIDDEN = new Set([
  "/admin/settings",
  "/admin/staff",
  "/admin/hero",
  "/admin/categories",
  "/admin/about",
  "/admin/services",
  "/admin/projects",
  "/admin/quotations",
]);
const NON_OWNER_HIDDEN = new Set(["/admin/settings", "/admin/staff"]);

function navGroupsForRole(role: StaffRole | null): NavGroup[] {
  if (role === null || role === "owner") return NAV_GROUPS;
  const hidden = role === "viewer" ? VIEWER_HIDDEN : NON_OWNER_HIDDEN;
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !hidden.has(item.href)),
  })).filter((g) => g.items.length > 0);
}

/**
 * Convention: admin-targeted notifications are written to the
 * `notifications` collection with userId === "admin".
 */
export const ADMIN_USER_ID = "admin";

function useAdminNotifications() {
  const [items, setItems] = useState<WithId<Notification>[]>([]);
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    const q = query(
      collection(db, COLLECTIONS.notifications),
      where("userId", "==", ADMIN_USER_ID),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    return onSnapshot(q, (snap) =>
      setItems(snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id })))
    );
  }, []);
  const unread = items.filter((n) => !n.read).length;
  return { items, unread };
}

function NotificationsBell() {
  const { items, unread } = useAdminNotifications();
  const [open, setOpen] = useState(false);

  const markRead = async (id: string) => {
    if (!db) return;
    await updateDoc(doc(db, COLLECTIONS.notifications, id), { read: true });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notifications</p>
          <Link
            href="/admin/notifications"
            className="text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              className={cn(
                "flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                !n.read && "bg-primary/5"
              )}
              onClick={() => void markRead(n.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {n.body}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {fmtDateTime(n.createdAt)}
                </p>
              </div>
              {!n.read && (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Skeleton className="h-9 w-9 rounded-md" />;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link href={item.href} onClick={onNavigate}>
      <motion.span
        whileTap={{ scale: 0.98 }}
        className={cn(
          "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </motion.span>
    </Link>
  );
}

function SidebarContent({
  collapsed,
  groups,
  onNavigate,
}: {
  collapsed: boolean;
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  // Groups start expanded; the active route's group always opens on change.
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))) {
          next[g.label] = true;
        }
      }
      return next;
    });
  }, [pathname, groups]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 py-5"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-black text-primary-foreground">
          H
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">Hammer Trading</p>
            <p className="text-xs text-muted-foreground">Admin panel</p>
          </div>
        )}
      </Link>
      <Separator />
      <nav className="flex-1 overflow-y-auto p-2">
        {collapsed
          ? // Icon-only mode: flat list of every item.
            groups.flatMap((g) => g.items).map((item) => (
              <NavRow key={item.href} item={item} collapsed onNavigate={onNavigate} />
            ))
          : groups.map((g) => {
              const open = openGroups[g.label] ?? true;
              return (
                <div key={g.label} className="mb-1">
                  <button
                    onClick={() => toggleGroup(g.label)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-expanded={open}
                  >
                    {g.logo ? (
                      <Image
                        src={g.logo}
                        alt={`${g.label} logo`}
                        width={22}
                        height={22}
                        className="shrink-0 rounded-md"
                      />
                    ) : (
                      <g.icon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1 text-left">{g.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        !open && "-rotate-90"
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-1 pt-0.5">
                          {g.items.map((item) => (
                            <NavRow
                              key={item.href}
                              item={item}
                              collapsed={false}
                              onNavigate={onNavigate}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
      </nav>
    </div>
  );
}

function Topbar({
  onMenu,
  onToggleCollapse,
  collapsed,
}: {
  onMenu: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}) {
  const { user, role, signOut } = useAuth();
  const router = useRouter();
  const initials = (user?.displayName ?? user?.email ?? "A")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>
      <div className="flex-1" />
      <NotificationsBell />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 pl-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
              {user?.displayName ?? user?.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate text-sm">{user?.displayName ?? "Admin"}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {user?.email}
            </p>
            {role && (
              <Badge variant="secondary" className="mt-1.5">
                {STAFF_ROLE_LABELS[role]}
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/">View store</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, role } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = useMemo(() => navGroupsForRole(role), [role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-3 p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-destructive/10 p-5">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is restricted to HTC administrators. Please sign in with an
          admin account.
        </p>
        <Button asChild>
          <Link href="/login?next=/admin">Go to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r bg-background transition-all duration-300 lg:block",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} groups={groups} />
      </aside>

      {/* mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent collapsed={false} groups={groups} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
        />
        <main className="flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-7xl space-y-6"
            >
              {/* Per-section boundary: a crashing admin page keeps the
                  sidebar/topbar shell alive and offers a retry. */}
              <ErrorBoundary section={`Admin:${pathname}`}>
                {children}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

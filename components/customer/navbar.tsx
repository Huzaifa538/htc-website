/**
 * Premium sticky navbar: hide-on-scroll-down / show-on-scroll-up,
 * brand-split logo (MTR Store on shop routes, HTC elsewhere), refined
 * desktop links with an animated underline, live search, cart + wishlist
 * badges, theme toggle, profile dropdown, mobile drawer + mobile search.
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Gift,
  Heart,
  Home,
  Images,
  Info,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Moon,
  Package,
  Phone,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/customer/language-toggle";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { isShopRoute } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/customer/search-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS = [
  { href: "/", key: "home", icon: Home },
  { href: "/shop", key: "shop", icon: LayoutGrid },
  { href: "/combos", key: "combos", icon: Gift },
  { href: "/services", key: "services", icon: Sparkles },
  { href: "/projects", key: "projects", icon: Package },
  { href: "/portfolio", key: "portfolio", icon: Images },
  { href: "/gallery", key: "gallery", icon: Search },
  { href: "/about", key: "about", icon: Info },
  { href: "/contact", key: "contact", icon: Mail },
] as const;

const ACCENT = "#D21F26";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-10 w-10" />;
  const dark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={t.header.toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 ring-1 ring-black/5 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground active:scale-95 dark:text-foreground/70 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-foreground"
    >
      {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
    </button>
  );
}

function BadgeCount({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D21F26] px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white dark:ring-stone-950"
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function Navbar({ announcement }: { announcement?: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isAdmin, loading, signOut } = useAuth();
  const cartCount = useCartStore((s) =>
    s.lines.reduce((sum, l) => sum + l.qty, 0)
  );
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Storefront routes are branded as the MTR Store; company pages stay HTC.
  const shopBrand = isShopRoute(pathname);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  const brandName = shopBrand ? "MTR" : "Hammer Trading";
  const brandSub = shopBrand ? "STORE" : "COMPANY";

  return (
    <>
      <motion.header
        initial={false}
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:bg-stone-950/80"
            : "bg-white/60 backdrop-blur-md dark:bg-stone-950/60"
        }`}
      >
        {announcement && (
          <div className="flex h-8 items-center justify-center bg-gradient-to-r from-[#8f1419] via-[#D21F26] to-[#8f1419] px-4">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              {announcement}
            </p>
          </div>
        )}
        <div className="border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="container flex h-[72px] items-center gap-4">
            {/* Mobile hamburger */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 ring-1 ring-black/5 transition-all hover:bg-black/[0.04] active:scale-95 lg:hidden dark:ring-white/10 dark:hover:bg-white/10"
              onClick={() => setDrawerOpen(true)}
              aria-label={t.header.openMenu}
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>

            {/* Logo — MTR Store identity on shop routes, HTC elsewhere */}
            <Link
              href={shopBrand ? "/shop" : "/"}
              className="group flex shrink-0 items-center gap-3"
              aria-label={shopBrand ? "MTR Store" : "Hammer Trading Company"}
            >
              <span className={`relative block overflow-hidden transition-transform duration-300 group-hover:scale-[1.04] ${shopBrand ? "rounded-2xl ring-1 ring-black/10 dark:ring-white/15" : ""}`}>
                <Image
                  src={shopBrand ? "/mtr-logo.png" : "/logo.png"}
                  alt={shopBrand ? "MTR Store" : "HTC — Hammer Trading"}
                  width={shopBrand ? 44 : 120}
                  height={44}
                  className={shopBrand ? "h-11 w-11 object-cover" : "h-11 w-auto object-contain"}
                  priority
                />
              </span>
              <span className="hidden flex-col leading-none sm:flex">
                <span className="font-display text-[17px] font-extrabold tracking-tight">
                  {brandName}
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.32em] text-muted-foreground">
                  {brandSub}
                </span>
              </span>
            </Link>

            <span className="hidden h-8 w-px bg-black/10 lg:block dark:bg-white/10" />

            {/* Desktop links — animated underline */}
            <nav className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "relative rounded-full px-4 py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200",
                      active
                        ? "text-foreground"
                        : "text-foreground/60 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.07]"
                    )}
                  >
                    {t.nav[l.key]}
                    {active && (
                      <motion.span
                        layoutId="nav-active-underline"
                        className="absolute inset-x-4 -bottom-[1px] h-[2px] rounded-full"
                        style={{ backgroundColor: ACCENT }}
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* Desktop search */}
              <div className="hidden w-52 md:block xl:w-72">
                <SearchBar compact />
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 ring-1 ring-black/5 transition-all hover:bg-black/[0.04] hover:text-foreground active:scale-95 md:hidden dark:ring-white/10 dark:hover:bg-white/10"
                onClick={() => setMobileSearch((v) => !v)}
                aria-label={t.header.search}
              >
                {mobileSearch ? <X size={18} strokeWidth={1.8} /> : <Search size={18} strokeWidth={1.8} />}
              </button>

              <ThemeToggle />

              <LanguageToggle />

              {/* Wishlist — hidden on very small screens (it's in the drawer) */}
              <Link
                href="/wishlist"
                aria-label={t.header.wishlist}
                className="relative hidden h-10 w-10 items-center justify-center rounded-full text-foreground/70 ring-1 ring-black/5 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground active:scale-95 min-[420px]:flex dark:text-foreground/70 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-foreground"
              >
                <Heart size={18} strokeWidth={1.8} />
                <BadgeCount count={wishlistCount} />
              </Link>

              {/* Cart */}
              <Link
                href="/cart"
                aria-label={t.header.cart}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 ring-1 ring-black/5 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground active:scale-95 dark:text-foreground/70 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-foreground"
              >
                <ShoppingCart size={18} strokeWidth={1.8} />
                <BadgeCount count={cartCount} />
              </Link>

              {/* Profile */}
              {loading ? (
                <span className="h-10 w-10 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t.header.account}
                      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full font-bold text-[#D21F26] ring-1 ring-[#D21F26]/25 transition-transform hover:scale-105 active:scale-95"
                    >
                      {user.photoURL ? (
                        <Image
                          src={user.photoURL}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-[#D21F26]/10">
                          <User size={18} strokeWidth={1.8} />
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-bold">
                        {user.displayName ?? t.header.customer}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/profile">{t.header.myProfile}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/orders">{t.header.myOrders}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link href="/wishlist">{t.header.wishlist}</Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild className="rounded-xl">
                        <Link href="/admin">{t.header.adminDashboard}</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="rounded-xl text-red-600"
                    >
                      <LogOut size={14} className="mr-2" /> {t.header.signOut}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/login"
                  className="hidden rounded-full bg-[#D21F26] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(210,31,38,0.6)] transition-all hover:bg-[#a8161c] hover:shadow-[0_10px_28px_-8px_rgba(210,31,38,0.7)] active:scale-95 sm:block"
                >
                  {t.header.signIn}
                </Link>
              )}
            </div>
          </div>

          {/* Mobile search row */}
          <AnimatePresence>
            {mobileSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden border-t border-black/[0.06] md:hidden dark:border-white/[0.08]"
              >
                <div className="container py-3">
                  <SearchBar />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Mobile drawer — improved with staggered animations */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-80 flex-col p-0">
          <SheetHeader className="border-b border-black/[0.06] p-5 text-left dark:border-white/[0.08]">
            <SheetTitle className="flex items-center gap-3">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`overflow-hidden ${shopBrand ? "rounded-xl ring-1 ring-black/10 dark:ring-white/15" : ""}`}
              >
                <Image
                  src={shopBrand ? "/mtr-logo.png" : "/logo.png"}
                  alt={shopBrand ? "MTR Store logo" : "Hammer Trading Company logo"}
                  width={shopBrand ? 40 : 110}
                  height={40}
                  className={shopBrand ? "h-10 w-10 object-cover" : "h-10 w-auto object-contain"}
                />
              </motion.span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-base font-extrabold tracking-tight">
                  {brandName}
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.32em] text-muted-foreground">
                  {brandSub}
                </span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto p-4">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05 } },
              }}
              className="flex flex-col gap-1"
            >
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <motion.div
                    key={l.href}
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <Link
                      href={l.href}
                      className={cn(
                        "group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-medium transition-all duration-200",
                        active
                          ? "bg-[#D21F26]/[0.08] font-bold text-[#D21F26]"
                          : "text-foreground/75 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all group-active:scale-90",
                          active
                            ? "bg-[#D21F26]/10 ring-[#D21F26]/20"
                            : "bg-black/[0.03] ring-black/5 group-hover:bg-black/[0.06] dark:bg-white/[0.06] dark:ring-white/10"
                        )}
                      >
                        <l.icon size={17} strokeWidth={1.8} />
                      </span>
                      {t.nav[l.key]}
                      {active && (
                        <motion.span
                          layoutId="mobile-nav-dot"
                          className="ml-auto h-2 w-2 rounded-full bg-[#D21F26]"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Quick categories */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="mt-6"
            >
              <p className="mb-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {t.header.quickLinks}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  className="flex items-center gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm font-semibold transition hover:bg-black/[0.06] active:scale-[0.98] dark:bg-white/[0.06]"
                >
                  <ShoppingCart size={15} /> {t.header.cart}
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm font-semibold transition hover:bg-black/[0.06] active:scale-[0.98] dark:bg-white/[0.06]"
                >
                  <Heart size={15} /> {t.header.wishlist}
                </Link>
              </div>
            </motion.div>
          </nav>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="space-y-2.5 border-t border-black/[0.06] p-4 dark:border-white/[0.08]"
          >
            {!user && !loading && (
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 rounded-full bg-[#D21F26] py-3 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(210,31,38,0.6)] transition active:scale-[0.98]"
              >
                <User size={16} /> {t.header.signIn}
              </Link>
            )}
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-3 text-[15px] font-semibold transition hover:bg-black/[0.03] active:scale-[0.98] dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              <Phone size={16} /> {t.header.whatsAppUs}
            </a>
          </motion.div>
        </SheetContent>
      </Sheet>

      {/* Spacer for fixed header (+ announcement bar when present) */}
      <div className={announcement ? "h-[104px]" : "h-[72px]"} />
    </>
  );
}

/**
 * SiteShell — wraps every customer page: announcement bar, glass navbar,
 * page content, footer, cart drawer, chat widget, floating WhatsApp
 * button, and Firestore sync for cart + wishlist on sign-in.
 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useUiStore } from "@/lib/store/ui";
import { Navbar } from "@/components/customer/navbar";
import { Footer } from "@/components/customer/footer";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { ChatWidget } from "@/components/customer/chat-widget";
import { ChatBot } from "@/components/customer/chat-bot";
import { WhatsAppButton } from "@/components/customer/whatsapp-button";
import { useSiteSettings } from "@/components/customer/data-hooks";

function SyncOnAuth() {
  const { user } = useAuth();
  const loadedFor = useRef<string | null>(null);

  const loadCart = useCartStore((s) => s.loadFromFirestore);
  const syncCart = useCartStore((s) => s.syncToFirestore);
  const cartLines = useCartStore((s) => s.lines);

  const loadWishlist = useWishlistStore((s) => s.loadFromFirestore);
  const syncWishlist = useWishlistStore((s) => s.syncToFirestore);
  const wishlistIds = useWishlistStore((s) => s.productIds);

  // Load remote state once per sign-in.
  useEffect(() => {
    if (user && loadedFor.current !== user.uid) {
      loadedFor.current = user.uid;
      void loadCart(user.uid);
      void loadWishlist(user.uid);
    }
    if (!user) loadedFor.current = null;
  }, [user, loadCart, loadWishlist]);

  // Debounced write-back while signed in.
  useEffect(() => {
    if (!user || loadedFor.current !== user.uid) return;
    const t = setTimeout(() => {
      void syncCart(user.uid);
      void syncWishlist(user.uid);
    }, 900);
    return () => clearTimeout(t);
  }, [cartLines, wishlistIds, user, syncCart, syncWishlist]);

  return null;
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { settings } = useSiteSettings();
  const drawerOpen = useUiStore((s) => s.cartDrawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setCartDrawerOpen);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar announcement={settings?.announcementBar} />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <Footer />
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ChatWidget />
      <ChatBot />
      <WhatsAppButton />
      <SyncOnAuth />
    </div>
  );
}

/**
 * Slide-over cart drawer shared by every page (opened from toasts or the
 * cart badge; the full cart page lives at /cart).
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatPKR } from "@/lib/format";
import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const lines = useCartStore((s) => s.lines);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const subtotal = useCartStore((s) => s.subtotal)();
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  function goCheckout() {
    setClosing(true);
    onClose();
    router.push("/checkout");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                <ShoppingCart size={20} className="text-[#D21F26]" />
                Your Cart
                <span className="rounded-full bg-[#D21F26]/10 px-2.5 py-0.5 text-xs font-bold text-[#D21F26]">
                  {lines.length}
                </span>
              </h2>
              <button
                onClick={onClose}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingCart size={44} className="text-muted-foreground/40" />
                  <p className="mt-4 font-display font-bold">Your cart is empty</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Beautiful furniture is waiting for you.
                  </p>
                  <Button
                    asChild
                    className="mt-5 rounded-full bg-[#D21F26] hover:bg-[#a8161c]"
                    onClick={onClose}
                  >
                    <Link href="/shop">Start Shopping</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {lines.map((l) => (
                    <motion.li
                      key={l.key}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 rounded-2xl border p-3"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                        <Image
                          src={l.image || "/logo.png"}
                          alt={l.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                        {Object.keys(l.variant).length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {Object.entries(l.variant)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-full border px-1 py-0.5">
                            <button
                              onClick={() => updateQty(l.key, l.qty - 1)}
                              aria-label="Decrease quantity"
                              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="min-w-6 text-center text-sm font-bold">
                              {l.qty}
                            </span>
                            <button
                              onClick={() => updateQty(l.key, l.qty + 1)}
                              aria-label="Increase quantity"
                              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <p className="text-sm font-extrabold text-[#D21F26]">
                            {formatPKR(l.unitPrice * l.qty)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeLine(l.key)}
                        aria-label="Remove item"
                        className="self-start rounded-full p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t px-5 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-display text-xl font-extrabold">
                    {formatPKR(subtotal)}
                  </span>
                </div>
                <Button
                  onClick={goCheckout}
                  disabled={closing}
                  className="w-full rounded-full bg-[#D21F26] py-6 text-base font-bold hover:bg-[#a8161c]"
                >
                  Checkout <ArrowRight size={18} />
                </Button>
                <button
                  onClick={onClose}
                  className="mt-2 w-full py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Continue shopping
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

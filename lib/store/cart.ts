/**
 * Cart store (zustand) — persisted to localStorage and synced to
 * Firestore `carts/{uid}` when the user is signed in.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { doc, getDoc, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { CartItem } from "@/lib/types";

export interface CartLine {
  key: string;
  productId: string;
  combinationId?: string;
  variant: Record<string, string>;
  name: string;
  image: string;
  unitPrice: number;
  qty: number;
  stock: number;
}

export interface CouponState {
  code: string;
  type: "percent" | "flat";
  value: number;
}

interface CartState {
  lines: CartLine[];
  coupon: CouponState | null;
  addLine: (line: Omit<CartLine, "key" | "qty"> & { qty?: number }) => void;
  removeLine: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  updateLine: (key: string, patch: Partial<CartLine>) => void;
  clearCart: () => void;
  setCoupon: (coupon: CouponState | null) => void;
  lineCount: () => number;
  subtotal: () => number;
  syncToFirestore: (uid: string) => Promise<void>;
  loadFromFirestore: (uid: string) => Promise<void>;
}

function lineKey(productId: string, combinationId?: string): string {
  return `${productId}::${combinationId ?? "base"}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      coupon: null,

      addLine: (line) => {
        const key = lineKey(line.productId, line.combinationId);
        const qty = Math.max(1, Math.min(line.qty ?? 1, Math.max(line.stock, 1)));
        set((state) => {
          const existing = state.lines.find((l) => l.key === key);
          if (existing) {
            const nextQty = Math.min(existing.qty + qty, Math.max(existing.stock, 1));
            return {
              lines: state.lines.map((l) =>
                l.key === key ? { ...l, qty: nextQty } : l
              ),
            };
          }
          return { lines: [...state.lines, { ...line, key, qty }] };
        });
      },

      removeLine: (key) =>
        set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

      updateQty: (key, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.key === key
              ? { ...l, qty: Math.max(1, Math.min(qty, Math.max(l.stock, 1))) }
              : l
          ),
        })),

      updateLine: (key, patch) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
        })),

      clearCart: () => set({ lines: [], coupon: null }),

      setCoupon: (coupon) => set({ coupon }),

      lineCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),

      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),

      syncToFirestore: async (uid) => {
        if (!db || !isFirebaseConfigured() || !uid) return;
        const items: CartItem[] = get().lines.map((l) => ({
          productId: l.productId,
          combinationId: l.combinationId,
          variant: l.variant,
          qty: l.qty,
          // Firestore rejects undefined fields, so stamp it server-side.
          addedAt: serverTimestamp() as unknown as Timestamp,
        }));
        try {
          await setDoc(
            doc(db, COLLECTIONS.carts, uid),
            { userId: uid, items, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch {
          /* best-effort sync */
        }
      },

      loadFromFirestore: async (uid) => {
        if (!db || !isFirebaseConfigured() || !uid) return;
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.carts, uid));
          if (!snap.exists()) return;
          const data = snap.data() as { items?: CartItem[] };
          const items = (data.items ?? []).filter((i) => i && i.productId);
          if (items.length === 0) return;
          // Merge remote cart with the local one (keep the higher qty).
          // Name/image/price fields are re-hydrated by the cart page from
          // the products catalog.
          const local = get().lines;
          const merged = new Map<string, CartLine>();
          for (const l of local) merged.set(l.key, l);
          for (const i of items) {
            const key = lineKey(i.productId, i.combinationId);
            const existing = merged.get(key);
            const qty = Math.max(1, i.qty ?? 1);
            if (existing) {
              merged.set(key, { ...existing, qty: Math.max(existing.qty, qty) });
            } else {
              merged.set(key, {
                key,
                productId: i.productId,
                combinationId: i.combinationId,
                variant: i.variant ?? {},
                name: i.productId,
                image: "",
                unitPrice: 0,
                qty,
                stock: 99,
              });
            }
          }
          set({ lines: Array.from(merged.values()) });
        } catch {
          /* keep local cart */
        }
      },
    }),
    {
      name: "htc-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines, coupon: state.coupon }),
    }
  )
);

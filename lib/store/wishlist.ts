/**
 * Wishlist store (zustand) — product ids persisted to localStorage and
 * synced to Firestore `wishlists/{uid}` when the user is signed in.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";

interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
  syncToFirestore: (uid: string) => Promise<void>;
  loadFromFirestore: (uid: string) => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],

      toggle: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((id) => id !== productId)
            : [...state.productIds, productId],
        })),

      has: (productId) => get().productIds.includes(productId),

      clear: () => set({ productIds: [] }),

      syncToFirestore: async (uid) => {
        if (!db || !isFirebaseConfigured() || !uid) return;
        try {
          await setDoc(
            doc(db, COLLECTIONS.wishlists, uid),
            {
              userId: uid,
              productIds: get().productIds,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          /* best-effort sync */
        }
      },

      loadFromFirestore: async (uid) => {
        if (!db || !isFirebaseConfigured() || !uid) return;
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.wishlists, uid));
          if (!snap.exists()) return;
          const data = snap.data() as { productIds?: string[] };
          const remote = (data.productIds ?? []).filter(Boolean);
          const merged = Array.from(new Set([...get().productIds, ...remote]));
          set({ productIds: merged });
        } catch {
          /* keep local wishlist */
        }
      },
    }),
    {
      name: "htc-wishlist",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ productIds: state.productIds }),
    }
  )
);

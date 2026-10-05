/**
 * Tiny global UI store: cart drawer visibility.
 */
import { create } from "zustand";

interface UiState {
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  cartDrawerOpen: false,
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
}));

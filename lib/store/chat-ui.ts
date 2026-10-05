/**
 * Chat-widget UI state (zustand, not persisted): open/closed, an optional
 * item reference (product / service / project) to show in the composer,
 * and the unread message count.
 */
import { create } from "zustand";
import type { ChatRefCard } from "@/lib/types";

interface ChatUiState {
  open: boolean;
  /** Item attached to the next message the customer sends (shown as a card above the composer). */
  refCard: ChatRefCard | null;
  unread: number;
  openChat: (refCard?: ChatRefCard | null) => void;
  closeChat: () => void;
  clearRefCard: () => void;
  setUnread: (n: number) => void;
}

export const useChatUiStore = create<ChatUiState>()((set) => ({
  open: false,
  refCard: null,
  unread: 0,
  openChat: (refCard = null) => set({ open: true, refCard }),
  closeChat: () => set({ open: false }),
  clearRefCard: () => set({ refCard: null }),
  setUnread: (n) => set({ unread: n }),
}));

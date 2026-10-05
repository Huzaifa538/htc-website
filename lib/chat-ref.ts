/**
 * Helpers for chat reference cards (product / service / project refs
 * attached to chat messages).
 */
import { formatPKR } from "./format";
import type { ChatMessage, ChatRefCard } from "./types";

/**
 * Resolve the ref card for a message, falling back to the legacy
 * `productRef` shape stored before the brand split.
 */
export function normalizeRefCard(m: {
  refCard?: ChatRefCard;
  productRef?: ChatMessage["productRef"];
}): ChatRefCard | null {
  if (m.refCard) return m.refCard;
  const p = m.productRef;
  if (!p) return null;
  return {
    kind: "product",
    id: p.id,
    name: p.name,
    image: p.image,
    detail: formatPKR(p.price),
    href: `/product/${p.id}`,
  };
}

/** Brand routing for a new user message: product refs go to MTR, service/project refs to HTC. */
export function brandForRefCard(card: ChatRefCard | null): "mtr" | "htc" | null {
  if (!card) return null;
  return card.kind === "product" ? "mtr" : "htc";
}

/**
 * Order status state machine.
 *
 * The storefront order lifecycle is linear: an order moves forward one
 * step at a time and can be cancelled from any non-terminal state.
 * Delivered and Cancelled are terminal — nothing leaves them.
 *
 * The admin order-detail page validates status changes with
 * canTransition() before writing; the tests guard the allowed moves.
 */
import type { OrderStatus } from "./types";

/** Forward lifecycle steps (Cancelled is a side exit, not a step). */
export const ORDER_FLOW: readonly OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
];

/** Statuses an order may move to from `from` (excluding staying put). */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  switch (from) {
    case "Pending":
      return ["Confirmed", "Cancelled"];
    case "Confirmed":
      return ["Shipped", "Cancelled"];
    case "Shipped":
      return ["Delivered", "Cancelled"];
    case "Delivered":
    case "Cancelled":
      return [];
  }
}

/**
 * True when moving from `from` to `to` is legal. Staying on the same
 * status is always a no-op success.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return allowedTransitions(from).includes(to);
}

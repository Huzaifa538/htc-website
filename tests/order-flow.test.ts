/**
 * Tests for the order status state machine (lib/order-flow.ts).
 *
 * The lifecycle is linear — forward one step at a time — with Cancelled as
 * a side exit from any non-terminal state. Delivered and Cancelled are
 * terminal.
 */
import { describe, expect, it } from "vitest";
import {
  ORDER_FLOW,
  allowedTransitions,
  canTransition,
} from "@/lib/order-flow";

describe("ORDER_FLOW", () => {
  it("is the linear forward lifecycle", () => {
    expect(ORDER_FLOW).toEqual([
      "Pending",
      "Confirmed",
      "Shipped",
      "Delivered",
    ]);
  });
});

describe("allowedTransitions", () => {
  it("moves Pending forward or to Cancelled", () => {
    expect(allowedTransitions("Pending")).toEqual(["Confirmed", "Cancelled"]);
  });

  it("moves Confirmed forward or to Cancelled", () => {
    expect(allowedTransitions("Confirmed")).toEqual(["Shipped", "Cancelled"]);
  });

  it("moves Shipped forward or to Cancelled", () => {
    expect(allowedTransitions("Shipped")).toEqual(["Delivered", "Cancelled"]);
  });

  it("treats Delivered and Cancelled as terminal", () => {
    expect(allowedTransitions("Delivered")).toEqual([]);
    expect(allowedTransitions("Cancelled")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("allows every legal forward move", () => {
    expect(canTransition("Pending", "Confirmed")).toBe(true);
    expect(canTransition("Confirmed", "Shipped")).toBe(true);
    expect(canTransition("Shipped", "Delivered")).toBe(true);
  });

  it("allows cancelling from any non-terminal state", () => {
    expect(canTransition("Pending", "Cancelled")).toBe(true);
    expect(canTransition("Confirmed", "Cancelled")).toBe(true);
    expect(canTransition("Shipped", "Cancelled")).toBe(true);
  });

  it("treats staying on the same status as a no-op success", () => {
    expect(canTransition("Pending", "Pending")).toBe(true);
    expect(canTransition("Delivered", "Delivered")).toBe(true);
  });

  it("rejects skipping steps", () => {
    expect(canTransition("Pending", "Shipped")).toBe(false);
    expect(canTransition("Pending", "Delivered")).toBe(false);
    expect(canTransition("Confirmed", "Delivered")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("Shipped", "Pending")).toBe(false);
    expect(canTransition("Delivered", "Shipped")).toBe(false);
  });

  it("rejects leaving terminal states", () => {
    expect(canTransition("Delivered", "Cancelled")).toBe(false);
    expect(canTransition("Cancelled", "Pending")).toBe(false);
    expect(canTransition("Cancelled", "Confirmed")).toBe(false);
  });
});

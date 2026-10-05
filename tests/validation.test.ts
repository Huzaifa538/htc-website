/**
 * Tests for the server-side zod schemas (lib/validation.ts).
 *
 * Every schema must accept its happy path and reject malformed input —
 * these are the same checks the API routes enforce with 400 responses.
 */
import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  chatMessageSchema,
  checkoutOrderSchema,
  expenseSchema,
  productSchema,
  validationErrorResponse,
} from "@/lib/validation";

/** Convenience: parse and return the first issue's path, if any. */
function firstIssuePath(schema: { safeParse: (v: unknown) => unknown }, value: unknown) {
  const result = schema.safeParse(value) as
    | { success: true }
    | { success: false; error: { issues: { path: (string | number)[] }[] } };
  if (result.success) return null;
  return result.error.issues[0]?.path.join(".") ?? "(no path)";
}

const validAddress = {
  name: "Muhammad Ali",
  phone: "0321 2345678",
  address: "House 12, Street 4, Gulberg Greens",
  city: "Lahore",
};

const validOrder = {
  idToken: "tok",
  items: [{ productId: "p1", variant: {}, qty: 2 }],
  address: validAddress,
  paymentMethod: "COD",
};

describe("checkoutOrderSchema", () => {
  it("accepts a complete valid order", () => {
    expect(checkoutOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects an empty cart", () => {
    const r = checkoutOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(r.success).toBe(false);
    expect(firstIssuePath(checkoutOrderSchema, { ...validOrder, items: [] })).toBe(
      "items"
    );
  });

  it("rejects a bad phone number", () => {
    const bad = {
      ...validOrder,
      address: { ...validAddress, phone: "abc" },
    };
    expect(checkoutOrderSchema.safeParse(bad).success).toBe(false);
    expect(firstIssuePath(checkoutOrderSchema, bad)).toBe("address.phone");
  });

  it("rejects an unknown payment method", () => {
    expect(
      checkoutOrderSchema.safeParse({ ...validOrder, paymentMethod: "Crypto" })
        .success
    ).toBe(false);
  });

  it("rejects zero/negative quantities", () => {
    const bad = {
      ...validOrder,
      items: [{ productId: "p1", variant: {}, qty: 0 }],
    };
    expect(checkoutOrderSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a missing sign-in token", () => {
    const { idToken: _t, ...noToken } = validOrder;
    void _t;
    expect(checkoutOrderSchema.safeParse(noToken).success).toBe(false);
  });
});

const validProduct = {
  name: "Brass Door Lock",
  description: "A solid brass mortise lock for main doors.",
  categoryId: "cat-locks",
  images: ["https://res.cloudinary.com/x/lock.jpg"],
  variantTypes: [],
  combinations: [],
  basePrice: 2500,
  baseStock: 40,
  sku: "HTC-LOCK-01",
  tags: ["lock", "brass"],
  featured: false,
  published: true,
};

describe("productSchema", () => {
  it("accepts a complete valid product", () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects a product with no images", () => {
    expect(
      productSchema.safeParse({ ...validProduct, images: [] }).success
    ).toBe(false);
  });

  it("rejects negative prices and stock", () => {
    expect(
      productSchema.safeParse({ ...validProduct, basePrice: -5 }).success
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...validProduct, baseStock: -1 }).success
    ).toBe(false);
  });

  it("rejects a too-short description", () => {
    expect(
      productSchema.safeParse({ ...validProduct, description: "lock" })
        .success
    ).toBe(false);
  });

  it("rejects a bad variant kind", () => {
    const bad = {
      ...validProduct,
      variantTypes: [
        { id: "v1", name: "Size", kind: "weight", values: ["S"] },
      ],
    };
    expect(productSchema.safeParse(bad).success).toBe(false);
  });
});

const validMessage = {
  idToken: "tok",
  userId: "uid123",
  text: "Assalam-o-Alaikum, is this lock in stock?",
  brand: "mtr",
};

describe("chatMessageSchema", () => {
  it("accepts a text message", () => {
    expect(chatMessageSchema.safeParse(validMessage).success).toBe(true);
  });

  it("accepts an image-only message", () => {
    expect(
      chatMessageSchema.safeParse({
        ...validMessage,
        text: "",
        imageUrl: "https://res.cloudinary.com/x/photo.jpg",
      }).success
    ).toBe(true);
  });

  it("rejects a message with neither text nor image", () => {
    expect(
      chatMessageSchema.safeParse({ ...validMessage, text: "   " }).success
    ).toBe(false);
  });

  it("rejects an over-long message", () => {
    expect(
      chatMessageSchema.safeParse({ ...validMessage, text: "x".repeat(2001) })
        .success
    ).toBe(false);
  });

  it("rejects an unknown brand", () => {
    expect(
      chatMessageSchema.safeParse({ ...validMessage, brand: "xyz" }).success
    ).toBe(false);
  });
});

const validAppointment = {
  name: "Muhammad Ali",
  phone: "+92 321 2345678",
  date: "2026-10-10",
  timeSlot: "10:00 AM – 12:00 PM",
  serviceType: "General consultation",
};

describe("appointmentSchema", () => {
  it("accepts a complete valid booking", () => {
    expect(appointmentSchema.safeParse(validAppointment).success).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      appointmentSchema.safeParse({ ...validAppointment, date: "10-10-2026" })
        .success
    ).toBe(false);
    expect(
      appointmentSchema.safeParse({ ...validAppointment, date: "2026-13-99" })
        .success
    ).toBe(false);
  });

  it("rejects a bad phone number", () => {
    expect(
      appointmentSchema.safeParse({ ...validAppointment, phone: "123" })
        .success
    ).toBe(false);
  });

  it("rejects notes over 500 characters", () => {
    expect(
      appointmentSchema.safeParse({
        ...validAppointment,
        notes: "x".repeat(501),
      }).success
    ).toBe(false);
  });
});

const validExpense = {
  date: "2026-10-01",
  category: "Rent",
  amount: 50000,
};

describe("expenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(expenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("rejects zero or negative amounts", () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, amount: 0 }).success
    ).toBe(false);
    expect(
      expenseSchema.safeParse({ ...validExpense, amount: -100 }).success
    ).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, category: "Yacht" }).success
    ).toBe(false);
  });

  it("rejects a bad receipt URL", () => {
    expect(
      expenseSchema.safeParse({
        ...validExpense,
        receiptUrl: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("accepts an empty receipt URL (clears the receipt)", () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, receiptUrl: "" }).success
    ).toBe(true);
  });
});

describe("validationErrorResponse", () => {
  it("produces a 400 JSON response with field-level details", async () => {
    const parsed = checkoutOrderSchema.safeParse({
      ...validOrder,
      items: [],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const res = validationErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      details: { path: string; message: string }[];
    };
    expect(body.error).toBe("Validation failed");
    expect(body.details.length).toBeGreaterThan(0);
    expect(typeof body.details[0].path).toBe("string");
    expect(typeof body.details[0].message).toBe("string");
  });
});

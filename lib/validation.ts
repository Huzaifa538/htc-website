/**
 * Server-side input validation (zod).
 *
 * Single source of truth for the shapes the API routes accept. Every route
 * validates with these schemas and rejects with 400 + error details —
 * client-side checks are UX only, never trust.
 *
 * Domains: checkout orders, admin products, chat messages, consultation
 * appointments, admin expenses.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** Pakistani phone numbers as entered on the storefront (+92… / 03…). */
const phoneSchema = z
  .string()
  .trim()
  .min(10, "Enter a valid phone number")
  .regex(/^[+0-9][0-9\s-]{9,15}$/, "Enter a valid phone number");

/** Calendar date as YYYY-MM-DD. */
const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00`);
    return !Number.isNaN(d.getTime());
  }, "Enter a real calendar date");

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal(""));

/* ------------------------------------------------------------------ */
/* Orders (checkout)                                                   */
/* ------------------------------------------------------------------ */

export const orderAddressSchema = z.object({
  name: z.string().trim().min(3, "Please enter your full name").max(100),
  phone: phoneSchema,
  address: z
    .string()
    .trim()
    .min(10, "Please enter your complete street address")
    .max(500),
  city: z.string().trim().min(2, "Please enter your city").max(60),
});

/** One line the customer wants to buy — prices are re-priced server-side. */
export const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1, "productId is required").max(100),
  combinationId: z.string().trim().min(1).max(100).optional(),
  variant: z.record(z.string(), z.string()),
  qty: z.number().int().min(1).max(99),
});

export const checkoutOrderSchema = z.object({
  idToken: z.string().min(1, "Sign-in is required"),
  items: z
    .array(checkoutItemSchema)
    .min(1, "The cart is empty")
    .max(200, "Too many items in one order"),
  address: orderAddressSchema,
  paymentMethod: z.enum(["COD", "BankTransfer", "Card"]),
  couponCode: z.string().trim().min(1).max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  // Loyalty points the customer wants to redeem (validated against their
  // balance server-side; silently clamped, never fails the order).
  pointsToUse: z.number().int().min(0).max(1000000).optional(),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;

/* ------------------------------------------------------------------ */
/* Products (admin form)                                               */
/* ------------------------------------------------------------------ */

const variantTypeSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1, "Variant name is required").max(60),
  kind: z.enum(["size", "color", "custom"]),
  values: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one variant value")
    .max(50),
  colors: z.record(z.string(), z.string()).optional(),
});

const combinationSchema = z.object({
  id: z.string().trim().min(1).max(60),
  options: z.record(z.string(), z.string().trim()),
  price: z.number().min(0, "Price must be ≥ 0").max(1e9),
  compareAtPrice: z.number().min(0).max(1e9).nullable().optional(),
  stock: z.number().int().min(0, "Stock must be ≥ 0").max(1e9),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  image: z.string().trim().min(1).max(2000).optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  description: z
    .string()
    .trim()
    .min(10, "Description should be at least 10 characters")
    .max(20000),
  shortDescription: z.string().trim().max(300).optional(),
  categoryId: z.string().trim().min(1, "Category is required").max(100),
  images: z
    .array(z.string().trim().min(1).max(2000))
    .min(1, "Add at least one product image")
    .max(20),
  variantTypes: z.array(variantTypeSchema).max(10),
  combinations: z.array(combinationSchema).max(200),
  basePrice: z.number().min(0, "Price must be ≥ 0").max(1e9),
  baseCompareAtPrice: z.number().min(0).max(1e9).nullable().optional(),
  costPrice: z.number().min(0).max(1e9).nullable().optional(),
  baseStock: z.number().int().min(0, "Stock must be ≥ 0").max(1e9),
  lowStockThreshold: z.number().int().min(0).max(1e9).optional(),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
  /** Demo video URL (YouTube or direct mp4). Optional — empty hides the video section. */
  videoUrl: z.string().trim().max(2000).nullish(),
  featured: z.boolean(),
  published: z.boolean(),
});

export const productUpdateSchema = productSchema.extend({
  id: z.string().trim().min(1, "Product id is required").max(100),
});

export type ProductInput = z.infer<typeof productSchema>;

/* ------------------------------------------------------------------ */
/* Chat messages                                                       */
/* ------------------------------------------------------------------ */

const chatRefCardSchema = z.object({
  kind: z.enum(["product", "service", "project"]),
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  image: z.string().trim().min(1).max(2000),
  detail: z.string().trim().max(300),
  href: z.string().trim().min(1).max(500),
});

export const chatMessageSchema = z
  .object({
    idToken: z.string().min(1, "Sign-in is required"),
    userId: z.string().trim().min(1, "userId is required").max(100),
    text: z.string().trim().max(2000, "Message is too long"),
    imageUrl: z.string().trim().url("Invalid image URL").max(2000).optional(),
    brand: z.enum(["mtr", "htc"]),
    refCard: chatRefCardSchema.optional(),
  })
  .superRefine((v, ctx) => {
    // A message needs either text or an image — never a completely empty doc.
    if (!v.text && !v.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Message text or an image is required",
      });
    }
  });

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/* ------------------------------------------------------------------ */
/* Appointments (book consultation)                                    */
/* ------------------------------------------------------------------ */

export const appointmentSchema = z.object({
  name: z.string().trim().min(3, "Please enter your name").max(100),
  phone: phoneSchema,
  email: optionalEmailSchema,
  date: dateStringSchema,
  timeSlot: z.string().trim().min(1, "Please pick a time slot").max(80),
  serviceType: z.string().trim().min(1, "Please choose a service").max(120),
  notes: z
    .string()
    .trim()
    .max(500, "Keep notes under 500 characters")
    .optional(),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

/* ------------------------------------------------------------------ */
/* Expenses (admin)                                                    */
/* ------------------------------------------------------------------ */

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salary",
  "Utilities",
  "Stock",
  "Marketing",
  "Transport",
  "Other",
] as const;

export const expenseSchema = z.object({
  date: dateStringSchema,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1e9),
  note: z.string().trim().max(500).optional(),
  receiptUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
  addedBy: z.string().trim().email().optional(),
});

export const expenseUpdateSchema = expenseSchema.extend({
  id: z.string().trim().min(1, "Expense id is required").max(100),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/* ------------------------------------------------------------------ */
/* Route helpers                                                       */
/* ------------------------------------------------------------------ */

export interface FieldError {
  path: string;
  message: string;
}

/** 400 JSON body for a failed zod parse — machine-readable details. */
export function validationErrorResponse(error: z.ZodError): NextResponse {
  const details: FieldError[] = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return NextResponse.json(
    { error: "Validation failed", details },
    { status: 400 }
  );
}

/**
 * Parse a JSON request body. Returns `{ ok: true, body }`, or
 * `{ ok: false, response }` with a ready-made 400 response for bad JSON.
 */
export async function readJsonBody(
  req: NextRequest
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate `body` against `schema`. Returns the parsed data, or a
 * ready-made 400 response when validation fails.
 */
export function parseOr400<T>(
  schema: z.ZodType<T>,
  body: unknown
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

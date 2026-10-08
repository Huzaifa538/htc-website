/**
 * /api/admin/products — product create/update via the Admin SDK.
 *
 * Auth: edge middleware requires the htc_admin session cookie (admins only).
 *
 * POST  body { ...product fields }        — create, slug generated server-side.
 * PATCH body { id, ...product fields }    — update (rating/review/sold counts preserved).
 *
 * Validated with zod; rejects with 400 + error details.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  parseOr400,
  productSchema,
  productUpdateSchema,
  readJsonBody,
} from "@/lib/validation";

/** Same slug rules as the admin form's slugify helper. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function notConfigured() {
  return NextResponse.json(
    { error: "Firebase Admin SDK is not configured" },
    { status: 503 }
  );
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured() || !adminDb) return notConfigured();

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(productSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  try {
    const ref = await adminDb.collection(COLLECTIONS.products).add({
      name: input.name,
      slug: slugify(input.name),
      description: input.description,
      shortDescription: input.shortDescription?.trim() || "",
      categoryId: input.categoryId,
      images: input.images,
      variantTypes: input.variantTypes,
      combinations: input.combinations,
      basePrice: input.basePrice,
      baseCompareAtPrice: input.baseCompareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      baseStock: input.baseStock,
      lowStockThreshold: input.lowStockThreshold ?? null,
      sku: input.sku,
      tags: input.tags,
      videoUrl: input.videoUrl ?? null,
      featured: input.featured,
      published: input.published,
      rating: 0,
      reviewCount: 0,
      soldCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Could not create product" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminConfigured() || !adminDb) return notConfigured();

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = parseOr400(productUpdateSchema, raw.body);
  if (!parsed.ok) return parsed.response;
  const { id, ...input } = parsed.data;

  try {
    const ref = adminDb.collection(COLLECTIONS.products).doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    await ref.update({
      name: input.name,
      slug: slugify(input.name),
      description: input.description,
      shortDescription: input.shortDescription?.trim() || "",
      categoryId: input.categoryId,
      images: input.images,
      variantTypes: input.variantTypes,
      combinations: input.combinations,
      basePrice: input.basePrice,
      baseCompareAtPrice: input.baseCompareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      baseStock: input.baseStock,
      lowStockThreshold: input.lowStockThreshold ?? null,
      sku: input.sku,
      tags: input.tags,
      videoUrl: input.videoUrl ?? null,
      featured: input.featured,
      published: input.published,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json(
      { error: "Could not update product" },
      { status: 500 }
    );
  }
}

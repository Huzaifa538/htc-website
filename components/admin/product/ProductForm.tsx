"use client";

/**
 * Product add/edit form with a full variant builder.
 *
 * Follows lib/types.ts: Product { name, slug, description, shortDescription,
 * categoryId, images, variantTypes, combinations, basePrice,
 * baseCompareAtPrice, baseStock, sku, tags, featured, published,
 * rating, reviewCount, soldCount }.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Wand2,
  GripVertical,
} from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type {
  Category,
  Product,
  VariantCombination,
  VariantType,
  WithId,
} from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, slugify } from "../firebase";
import ImageUpload from "../ImageUpload";
import { TextField, TextAreaField, SelectField } from "../FormFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_TEMPLATES } from "@/lib/three/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* --------------------------------- schema --------------------------------- */

const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(10, "Description should be at least 10 characters"),
  shortDescription: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.coerce.number().min(0, "Price must be ≥ 0"),
  baseCompareAtPrice: z.coerce.number().min(0).optional().or(z.literal("")),
  costPrice: z.coerce.number().min(0, "Cost price must be ≥ 0").optional().or(z.literal("")),
  baseStock: z.coerce.number().int().min(0, "Stock must be ≥ 0"),
  lowStockThreshold: z.coerce.number().int().min(0, "Threshold must be ≥ 0").optional().or(z.literal("")),
  sku: z.string().min(1, "SKU is required"),
  tags: z.string().optional(),
  videoUrl: z.string().optional(),
});

type FormValues = z.input<typeof productSchema>;

/* ------------------------------- id helpers ------------------------------- */

const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const comboKey = (options: Record<string, string>) =>
  Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join("|");

/* ------------------------------ variant builder ---------------------------- */

function VariantBuilder({
  variantTypes,
  onTypesChange,
  combinations,
  onCombinationsChange,
  basePrice,
  baseCompareAtPrice,
  baseSku,
}: {
  variantTypes: VariantType[];
  onTypesChange: (t: VariantType[]) => void;
  combinations: VariantCombination[];
  onCombinationsChange: (c: VariantCombination[]) => void;
  basePrice: number;
  baseCompareAtPrice?: number;
  baseSku: string;
}) {
  const [typeName, setTypeName] = useState("");
  const [typeKind, setTypeKind] = useState<VariantType["kind"]>("size");
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const [colorInputs, setColorInputs] = useState<Record<string, string>>({});

  const addType = () => {
    const name = typeName.trim();
    if (!name) return;
    if (variantTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.warning("A variant type with this name already exists.");
      return;
    }
    onTypesChange([
      ...variantTypes,
      { id: uid(), name, kind: typeKind, values: [] },
    ]);
    setTypeName("");
  };

  const removeType = (id: string) => {
    onTypesChange(variantTypes.filter((t) => t.id !== id));
  };

  const addValue = (typeId: string) => {
    const raw = (valueInputs[typeId] ?? "").trim();
    if (!raw) return;
    onTypesChange(
      variantTypes.map((t) => {
        if (t.id !== typeId || t.values.includes(raw)) return t;
        const colors = t.kind === "color" ? { ...(t.colors ?? {}), [raw]: colorInputs[typeId] ?? "#D21F26" } : t.colors;
        return { ...t, values: [...t.values, raw], colors };
      })
    );
    setValueInputs((p) => ({ ...p, [typeId]: "" }));
  };

  const removeValue = (typeId: string, value: string) => {
    onTypesChange(
      variantTypes.map((t) => {
        if (t.id !== typeId) return t;
        const colors = t.colors ? { ...t.colors } : undefined;
        if (colors) delete colors[value];
        return { ...t, values: t.values.filter((v) => v !== value), colors };
      })
    );
  };

  const setColor = (typeId: string, value: string, hex: string) => {
    onTypesChange(
      variantTypes.map((t) =>
        t.id === typeId
          ? { ...t, colors: { ...(t.colors ?? {}), [value]: hex } }
          : t
      )
    );
  };

  const generate = () => {
    const usable = variantTypes.filter((t) => t.values.length > 0);
    if (usable.length === 0) {
      toast.warning("Add at least one variant type with values first.");
      return;
    }
    // cartesian product
    let combos: Record<string, string>[] = [{}];
    for (const t of usable) {
      combos = combos.flatMap((c) => t.values.map((v) => ({ ...c, [t.name]: v })));
    }
    if (combos.length > 200) {
      toast.error(`Too many combinations (${combos.length}). Keep it under 200.`);
      return;
    }
    const prev = new Map(combinations.map((c) => [comboKey(c.options), c]));
    const next: VariantCombination[] = combos.map((options) => {
      const key = comboKey(options);
      const existing = prev.get(key);
      if (existing) return existing;
      const suffix = Object.values(options).join("-").replace(/\s+/g, "");
      return {
        id: uid(),
        options,
        price: basePrice,
        compareAtPrice: baseCompareAtPrice,
        stock: 0,
        sku: baseSku ? `${baseSku}-${suffix}` : "",
      };
    });
    onCombinationsChange(next);
    toast.success(`${next.length} combinations generated.`);
  };

  const updateCombo = (id: string, patch: Partial<VariantCombination>) => {
    onCombinationsChange(combinations.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCombo = (id: string) => {
    onCombinationsChange(combinations.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* type builder */}
      <div>
        <Label className="mb-2 block">Variant types</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Type name, e.g. Size"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            className="w-44"
          />
          <Select value={typeKind} onValueChange={(v) => setTypeKind(v as VariantType["kind"])}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="size">Size / Inches</SelectItem>
              <SelectItem value="color">Color</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={addType} variant="secondary">
            <Plus className="mr-1 h-4 w-4" /> Add type
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {variantTypes.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="outline" className="capitalize">{t.kind}</Badge>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeType(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {t.values.map((v) => (
                  <Badge key={v} variant="secondary" className="flex items-center gap-1.5 py-1">
                    {t.kind === "color" && (
                      <input
                        type="color"
                        value={t.colors?.[v] ?? "#D21F26"}
                        onChange={(e) => setColor(t.id, v, e.target.value)}
                        className="h-4 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                        title="Pick color"
                      />
                    )}
                    {v}
                    <button
                      type="button"
                      onClick={() => removeValue(t.id, v)}
                      className="ml-1 rounded-full hover:text-destructive"
                      aria-label={`Remove ${v}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  placeholder={`Add ${t.name} value…`}
                  value={valueInputs[t.id] ?? ""}
                  onChange={(e) =>
                    setValueInputs((p) => ({ ...p, [t.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addValue(t.id);
                    }
                  }}
                  className="w-44"
                />
                {t.kind === "color" && (
                  <Input
                    type="color"
                    value={colorInputs[t.id] ?? "#D21F26"}
                    onChange={(e) =>
                      setColorInputs((p) => ({ ...p, [t.id]: e.target.value }))
                    }
                    className="h-10 w-14 cursor-pointer p-1"
                    title="Default color for next value"
                  />
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => addValue(t.id)}>
                  Add value
                </Button>
              </div>
            </motion.div>
          ))}
          {variantTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No variant types yet — products without variants sell at the base price/stock.
            </p>
          )}
        </div>
      </div>

      {/* combinations */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Combinations ({combinations.length})</Label>
          <Button type="button" size="sm" onClick={generate}>
            <Wand2 className="mr-1 h-4 w-4" /> Generate combinations
          </Button>
        </div>
        {combinations.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Options</TableHead>
                  <TableHead className="w-32">Price</TableHead>
                  <TableHead className="w-32">Compare at</TableHead>
                  <TableHead className="w-24">Stock</TableHead>
                  <TableHead className="w-40">SKU</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(c.options).map(([k, v]) => (
                          <Badge key={k} variant="outline">
                            {k}: {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={c.price}
                        onChange={(e) => updateCombo(c.id, { price: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={c.compareAtPrice ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          updateCombo(c.id, {
                            compareAtPrice: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={c.stock}
                        onChange={(e) => updateCombo(c.id, { stock: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={c.sku}
                        onChange={(e) => updateCombo(c.id, { sku: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeCombo(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add variant types with values, then click “Generate combinations”.
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- form --------------------------------- */

export default function ProductForm({
  product,
}: {
  product?: WithId<Product> | null;
}) {
  const router = useRouter();
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>(product?.variantTypes ?? []);
  const [combinations, setCombinations] = useState<VariantCombination[]>(product?.combinations ?? []);

  const { data: categories } = useCollection<Category>(COLLECTIONS.categories);

  const form = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      shortDescription: product?.shortDescription ?? "",
      categoryId: product?.categoryId ?? "",
      basePrice: product?.basePrice ?? 0,
      baseCompareAtPrice: product?.baseCompareAtPrice ?? ("" as unknown as number),
      costPrice: product?.costPrice ?? ("" as unknown as number),
      baseStock: product?.baseStock ?? 0,
      lowStockThreshold: product?.lowStockThreshold ?? ("" as unknown as number),
      sku: product?.sku ?? "",
      tags: (product?.tags ?? []).join(", "),
      videoUrl: product?.videoUrl ?? "",
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = form;

  const watchName = watch("name");
  const watchBasePrice = watch("basePrice");
  const watchCompareAt = watch("baseCompareAtPrice");
  const watchSku = watch("sku");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [published, setPublished] = useState(product?.published ?? true);
  const [show3d, setShow3d] = useState(product?.show3d ?? false);
  const [model3d, setModel3d] = useState(product?.model3d ?? "");

  useEffect(() => {
    // Auto-generate SKU from name when empty (create mode).
    if (!isEdit && !watchSku && watchName) {
      form.setValue("sku", `HTC-${slugify(watchName).slice(0, 12).toUpperCase()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchName, isEdit]);

  const categoryOptions = useMemo(
    () =>
      categories
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((c) => ({ value: c.id, label: c.parentId ? `↳ ${c.name}` : c.name })),
    [categories]
  );

  const onSubmit = async (values: FormValues) => {
    if (!isFirebaseConfigured() || !db) {
      toast.error("Firebase is not configured.");
      return;
    }
    if (images.length === 0) {
      toast.error("Add at least one product image.");
      return;
    }
    setSaving(true);
    try {
      const tags = (values.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Product writes are server-side (POST/PATCH /api/admin/products):
      // the API validates with zod, generates the slug, and stamps
      // timestamps via the Admin SDK.
      const body = {
        name: values.name.trim(),
        description: values.description.trim(),
        ...(values.shortDescription?.trim()
          ? { shortDescription: values.shortDescription.trim() }
          : {}),
        categoryId: values.categoryId,
        images,
        variantTypes,
        combinations,
        basePrice: Number(values.basePrice) || 0,
        ...(values.baseCompareAtPrice === "" ||
        values.baseCompareAtPrice == null
          ? {}
          : { baseCompareAtPrice: Number(values.baseCompareAtPrice) }),
        ...(values.costPrice === "" || values.costPrice == null
          ? {}
          : { costPrice: Number(values.costPrice) }),
        baseStock: Math.floor(Number(values.baseStock) || 0),
        ...(values.lowStockThreshold === "" || values.lowStockThreshold == null
          ? {}
          : { lowStockThreshold: Math.floor(Number(values.lowStockThreshold)) }),
        sku: values.sku.trim(),
        tags,
        videoUrl: values.videoUrl?.trim() || null,
        show3d,
        model3d: show3d && model3d ? model3d : null,
        featured,
        published,
      };
      const isUpdate = isEdit && product;
      const res = await fetch("/api/admin/products", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isUpdate ? { id: product.id, ...body } : body
        ),
      });
      const result = (await res.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        error?: string;
        details?: { path: string; message: string }[];
      } | null;
      if (!res.ok || !result?.ok || (!isUpdate && !result.id)) {
        throw new Error(
          result?.details?.[0]?.message || result?.error || "save-failed"
        );
      }

      if (isUpdate) {
        toast.success("Product updated.");
        router.push("/admin/products");
      } else {
        toast.success("Product created.");
        router.push(`/admin/products/${result.id}`);
      }
    } catch (e) {
      const message =
        e instanceof Error && e.message !== "save-failed"
          ? e.message
          : "Save failed. Please try again.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
      {/* main column */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField control={control} name="name" label="Product name" placeholder="e.g. Sheesham Dining Table" />
            <TextAreaField control={control} name="shortDescription" label="Short description" rows={2} placeholder="One-line summary shown on cards" />
            <TextAreaField control={control} name="description" label="Full description" rows={5} placeholder="Materials, dimensions, craftsmanship…" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={control}
                name="categoryId"
                label="Category"
                placeholder="Select category"
                options={categoryOptions}
              />
              <TextField control={control} name="sku" label="SKU" placeholder="HTC-…" />
            </div>
            <TextField
              control={control}
              name="tags"
              label="Tags"
              placeholder="dining, sheesham, handcrafted"
              hint="Comma-separated"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload
              value={images}
              onChange={setImages}
              folder="products"
              label="Product images"
              hint="(at least 1 required — first image is the cover)"
            />
            <TextField
              control={control}
              name="videoUrl"
              label="Demo video URL"
              placeholder="YouTube link or direct mp4 URL"
              hint="Optional — shows a video player on the product page. Huzaifa will upload the actual demo videos later."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <VariantBuilder
              variantTypes={variantTypes}
              onTypesChange={setVariantTypes}
              combinations={combinations}
              onCombinationsChange={setCombinations}
              basePrice={Number(watchBasePrice) || 0}
              baseCompareAtPrice={
                watchCompareAt === "" || watchCompareAt == null
                  ? undefined
                  : Number(watchCompareAt)
              }
              baseSku={watchSku}
            />
          </CardContent>
        </Card>
      </div>

      {/* side column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pricing & stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField control={control} name="basePrice" label="Base price (PKR)" type="number" />
            <TextField
              control={control}
              name="costPrice"
              label="Cost price (PKR)"
              type="number"
              hint="Optional — purchase cost, used for profit reports"
            />
            <TextField
              control={control}
              name="baseCompareAtPrice"
              label="Compare-at price (PKR)"
              type="number"
              hint="Optional — shows a discount badge"
            />
            <TextField control={control} name="baseStock" label="Base stock" type="number" />
            <TextField
              control={control}
              name="lowStockThreshold"
              label="Low-stock alert at"
              type="number"
              hint="Optional — warn when stock falls to this level (default 10)"
            />
            {Number(watchBasePrice) > 0 && (
              <p className="text-sm text-muted-foreground">
                {formatPKR(Number(watchBasePrice))}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Published</Label>
              <Button
                type="button"
                variant={published ? "default" : "secondary"}
                size="sm"
                onClick={() => setPublished(!published)}
              >
                {published ? "Published" : "Draft"}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Label>Featured</Label>
              <Input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </div>
            {isEdit && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                <div>
                  <p className="text-base font-bold text-foreground">{product?.soldCount ?? 0}</p>
                  Sold
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">{product?.reviewCount ?? 0}</p>
                  Reviews
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">{product?.rating?.toFixed(1) ?? "0.0"}</p>
                  Rating
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3D View</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show 3D viewer</Label>
              <Input
                type="checkbox"
                checked={show3d}
                onChange={(e) => setShow3d(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </div>
            {show3d && (
              <div className="space-y-2">
                <Label>3D model (match the product)</Label>
                <Select value={model3d} onValueChange={setModel3d}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick the closest model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Customers see the 3D viewer on the product page only when this
                  is on. Pick the model that looks most like the product.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/admin/products")}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || isSubmitting}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

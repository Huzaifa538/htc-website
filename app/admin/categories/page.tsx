"use client";

/**
 * Categories: CRUD with image upload, icon (lucide name or emoji),
 * sub-category support (parentId), product counts.
 */
import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Category, Product } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import { slugify } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, SelectField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  icon: z.string().optional(),
  parentId: z.string().optional(),
  order: z.coerce.number().int().default(0),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

export default function CategoriesPage() {
  const { data: categories, loading } = useCollection<Category>(COLLECTIONS.categories);
  const { data: products } = useCollection<Product>(COLLECTIONS.products);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [image, setImage] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", icon: "", parentId: "", order: 0, enabled: true },
  });
  const { control, handleSubmit, reset, watch } = form;
  const watchParent = watch("parentId");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return m;
  }, [products]);

  const sorted = useMemo(
    () => categories.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );
  const topLevel = useMemo(() => sorted.filter((c) => !c.parentId), [sorted]);

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", icon: "", parentId: "", order: categories.length, enabled: true });
    setImage([]);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    reset({
      name: c.name,
      icon: c.icon ?? "",
      parentId: c.parentId ?? "",
      order: c.order ?? 0,
      enabled: c.enabled,
    });
    setImage(c.image ? [c.image] : []);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    if (image.length === 0) {
      toast.error("Please upload a category image.");
      return;
    }
    try {
      const payload = {
        name: values.name.trim(),
        slug: slugify(values.name),
        image: image[0]!,
        icon: values.icon?.trim() || null,
        parentId: values.parentId || null,
        order: values.order ?? 0,
        enabled: values.enabled,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.categories, editing.id), payload);
        toast.success("Category updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.categories), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Category created.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const doDelete = async () => {
    if (!db || !confirmDelete) return;
    const count = counts.get(confirmDelete.id) ?? 0;
    if (count > 0) {
      toast.error(`${count} product(s) use this category. Reassign them first.`);
      return;
    }
    try {
      await deleteDoc(doc(db, COLLECTIONS.categories, confirmDelete.id));
      toast.success("Category deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Category management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Categories" />
        <LoadingState rows={6} />
      </>
    );

  const renderCard = (c: Category, isChild = false) => (
    <Card key={c.id} className={isChild ? "ml-8" : ""}>
      <CardContent className="flex items-center gap-4 p-4">
        {isChild && <GripVertical className="h-4 w-4 text-muted-foreground" />}
        {c.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xl">
            {c.icon ?? "📦"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {c.icon && <span className="mr-1">{c.icon}</span>}
            {c.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{counts.get(c.id) ?? 0} products</Badge>
            <Badge variant={c.enabled ? "default" : "secondary"}>
              {c.enabled ? "Enabled" : "Disabled"}
            </Badge>
            {c.parentId && <Badge variant="secondary">Sub-category</Badge>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(c)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} categories`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add category
          </Button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first category to organize products."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add category</Button>}
        />
      ) : (
        <div className="space-y-3">
          {topLevel.map((c) => (
            <div key={c.id} className="space-y-2">
              {renderCard(c)}
              {sorted.filter((s) => s.parentId === c.id).map((s) => renderCard(s, true))}
            </div>
          ))}
          {sorted
            .filter((c) => c.parentId && !categories.some((p) => p.id === c.parentId))
            .map((c) => renderCard(c))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField control={control} name="name" label="Name" placeholder="e.g. Dining Tables" />
            <TextField
              control={control}
              name="icon"
              label="Icon"
              placeholder="Lucide name (Sofa) or emoji 🛋️"
              hint="Stored as-is; the storefront maps known Lucide names"
            />
            <SelectField
              control={control}
              name="parentId"
              label="Parent category"
              placeholder="None — top-level category"
              options={[
                { value: "", label: "None — top-level" },
                ...sorted
                  .filter((c) => !editing || c.id !== editing.id)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            {watchParent && (
              <p className="text-xs text-muted-foreground">
                This will be a sub-category of the selected parent.
              </p>
            )}
            <TextField control={control} name="order" label="Sort order" type="number" />
            <ImageUpload
              value={image}
              onChange={setImage}
              folder="categories"
              multiple={false}
              max={1}
              compact
              label="Category image"
              hint="(required)"
            />
            <SwitchField control={control} name="enabled" label="Enabled" hint="Visible on the storefront" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete category?"
        description={`"${confirmDelete?.name}" will be permanently deleted.`}
        onConfirm={() => {
          void doDelete();
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

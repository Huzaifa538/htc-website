"use client";

/**
 * Hero slide manager: max 15 slides enforced, image upload, title /
 * subtitle / CTA fields, drag-style ordering (up/down), enable toggle.
 */
import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { HeroSlide } from "@/lib/types";
import { useCollection } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, SwitchField } from "@/components/admin/FormFields";
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

const MAX_SLIDES = 15;

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  enabled: z.boolean().default(true),
});

type FormValues = z.input<typeof schema>;

export default function HeroPage() {
  const { data: slides, loading } = useCollection<HeroSlide>(COLLECTIONS.heroSlides);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [image, setImage] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<HeroSlide | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", subtitle: "", ctaText: "", ctaLink: "", enabled: true },
  });
  const { control, handleSubmit, reset } = form;

  const sorted = useMemo(
    () => slides.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [slides]
  );

  const openCreate = () => {
    if (slides.length >= MAX_SLIDES) {
      toast.warning(`Maximum ${MAX_SLIDES} slides reached. Delete one first.`);
      return;
    }
    setEditing(null);
    reset({ title: "", subtitle: "", ctaText: "", ctaLink: "", enabled: true });
    setImage([]);
    setDialogOpen(true);
  };

  const openEdit = (s: HeroSlide) => {
    setEditing(s);
    reset({
      title: s.title,
      subtitle: s.subtitle ?? "",
      ctaText: s.ctaText ?? "",
      ctaLink: s.ctaLink ?? "",
      enabled: s.enabled,
    });
    setImage(s.image ? [s.image] : []);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    if (image.length === 0) {
      toast.error("Please upload a slide image.");
      return;
    }
    try {
      const payload = {
        image: image[0]!,
        title: values.title.trim(),
        subtitle: values.subtitle?.trim() ?? "",
        ctaText: values.ctaText?.trim() ?? "",
        ctaLink: values.ctaLink?.trim() ?? "",
        enabled: values.enabled,
      };
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.heroSlides, editing.id), payload);
        toast.success("Slide updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.heroSlides), {
          ...payload,
          order: slides.length,
          createdAt: serverTimestamp(),
        });
        toast.success("Slide created.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!db) return;
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[index]!;
    const b = sorted[j]!;
    try {
      await Promise.all([
        updateDoc(doc(db, COLLECTIONS.heroSlides, a.id), { order: b.order }),
        updateDoc(doc(db, COLLECTIONS.heroSlides, b.id), { order: a.order }),
      ]);
    } catch {
      toast.error("Reorder failed.");
    }
  };

  const toggleEnabled = async (s: HeroSlide) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.heroSlides, s.id), { enabled: !s.enabled });
    } catch {
      toast.error("Update failed.");
    }
  };

  const doDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.heroSlides, confirmDelete.id));
      toast.success("Slide deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Hero slide management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Hero Slides" />
        <LoadingState rows={5} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Hero Slides"
        subtitle={`${slides.length}/${MAX_SLIDES} slides`}
        actions={
          <Button onClick={openCreate} disabled={slides.length >= MAX_SLIDES}>
            <Plus className="mr-2 h-4 w-4" /> Add slide
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No hero slides yet"
          description="Slides appear in the storefront hero carousel."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add slide</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s, i) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.title} className="h-40 w-full object-cover" />
                <Badge
                  variant={s.enabled ? "default" : "secondary"}
                  className="absolute left-2 top-2"
                >
                  {s.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                  #{i + 1}
                </span>
              </div>
              <CardContent className="space-y-2 p-4">
                <p className="truncate font-semibold">{s.title}</p>
                {s.subtitle && (
                  <p className="line-clamp-1 text-sm text-muted-foreground">{s.subtitle}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => void move(i, -1)} title="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={i === sorted.length - 1} onClick={() => void move(i, 1)} title="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(s)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void toggleEnabled(s)}>
                    {s.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit slide" : "New slide"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ImageUpload
              value={image}
              onChange={setImage}
              folder="hero"
              multiple={false}
              max={1}
              compact
              label="Slide image"
              hint="(required, wide banner works best)"
            />
            <TextField control={control} name="title" label="Title" placeholder="Handcrafted Furniture Sale" />
            <TextField control={control} name="subtitle" label="Subtitle" placeholder="Up to 30% off this week" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name="ctaText" label="CTA text" placeholder="Shop now" />
              <TextField control={control} name="ctaLink" label="CTA link" placeholder="/shop or /category/…" />
            </div>
            <SwitchField control={control} name="enabled" label="Enabled" hint="Show in the carousel" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Create slide"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete slide?"
        description={`"${confirmDelete?.title}" will be removed from the carousel.`}
        onConfirm={() => {
          void doDelete();
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

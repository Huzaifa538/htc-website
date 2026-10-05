"use client";

/**
 * About page editor: edits the single aboutContent/main doc —
 * { heading, body, images[], stats[{ label, value }] } per lib/types.ts.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AboutContent } from "@/lib/types";
import { useDoc } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, TextAreaField } from "@/components/admin/FormFields";
import { PageHeader, LoadingState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const ABOUT_DOC_ID = "main";

const schema = z.object({
  heading: z.string().min(2, "Heading is required"),
  body: z.string().min(20, "Story should be at least 20 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function AboutPage() {
  const { data: about, loading } = useDoc<AboutContent>(COLLECTIONS.aboutContent, ABOUT_DOC_ID);
  const [images, setImages] = useState<string[]>([]);
  const [stats, setStats] = useState<{ label: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { heading: "", body: "" },
  });
  const { control, handleSubmit, reset } = form;

  useEffect(() => {
    if (about) {
      reset({ heading: about.heading ?? "", body: about.body ?? "" });
      setImages(about.images ?? []);
      setStats(about.stats ?? []);
    }
  }, [about, reset]);

  const addStat = () => setStats((s) => [...s, { label: "", value: "" }]);
  const updateStat = (i: number, patch: Partial<{ label: string; value: string }>) =>
    setStats((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const removeStat = (i: number) => setStats((s) => s.filter((_, j) => j !== i));

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.aboutContent, ABOUT_DOC_ID),
        {
          heading: values.heading.trim(),
          body: values.body.trim(),
          images,
          stats: stats.filter((s) => s.label.trim() && s.value.trim()),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success("About page saved.");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="About page editor" />;
  if (loading)
    return (
      <>
        <PageHeader title="About" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader title="About" subtitle="Edit the storefront about page content." />
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Story</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TextField control={control} name="heading" label="Heading" placeholder="Our story" />
              <TextAreaField control={control} name="body" label="Body" rows={10} placeholder="Tell the HTC story…" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload value={images} onChange={setImages} folder="about" label="About images" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stats</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addStat}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="15+" />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={s.label} onChange={(e) => updateStat(i, { label: e.target.value })} placeholder="Years of craft" />
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="mt-5 text-destructive" onClick={() => removeStat(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {stats.length === 0 && (
                <p className="text-sm text-muted-foreground">No stats yet — add highlights like “15+ Years of craft”.</p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save about page"}
          </Button>
        </div>
      </form>
    </>
  );
}

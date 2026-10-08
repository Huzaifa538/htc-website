"use client";

/**
 * Projects: CRUD with multi image + video uploads, status, progress,
 * dates and featured toggle.
 */
import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, User, Play } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Project, ProjectStatus } from "@/lib/types";
import { useCollection, fmtDate, dateInputToTimestamp, timestampToDateInput } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, TextAreaField, SelectField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  client: z.string().min(1, "Client name is required"),
  location: z.string().min(1, "Location is required"),
  status: z.enum(["Ongoing", "Completed", "Upcoming"]),
  progress: z.coerce.number().int().min(0).max(100),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  description: z.string().min(10, "Description should be at least 10 characters"),
  order: z.coerce.number().int().default(0),
  featured: z.boolean().default(false),
});

type FormValues = z.input<typeof schema>;

const STATUSES: ProjectStatus[] = ["Ongoing", "Completed", "Upcoming"];

export default function ProjectsPage() {
  const { data: projects, loading } = useCollection<Project>(COLLECTIONS.projects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [beforeImage, setBeforeImage] = useState<string[]>([]);
  const [afterImage, setAfterImage] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      client: "",
      location: "",
      status: "Upcoming",
      progress: 0,
      startDate: "",
      endDate: "",
      description: "",
      order: 0,
      featured: false,
    },
  });
  const { control, handleSubmit, reset, watch } = form;
  const watchProgress = watch("progress");
  const progressNum = Number(watchProgress) || 0;

  const sorted = useMemo(
    () => projects.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [projects]
  );

  const openCreate = () => {
    setEditing(null);
    reset({
      title: "", client: "", location: "", status: "Upcoming", progress: 0,
      startDate: "", endDate: "", description: "", order: projects.length, featured: false,
    });
    setImages([]);
    setVideos([]);
    setBeforeImage([]);
    setAfterImage([]);
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    reset({
      title: p.title,
      client: p.client,
      location: p.location,
      status: p.status,
      progress: p.progress ?? 0,
      startDate: timestampToDateInput(p.startDate),
      endDate: timestampToDateInput(p.endDate),
      description: p.description,
      order: p.order ?? 0,
      featured: p.featured,
    });
    setImages(p.images ?? []);
    setVideos(p.videos ?? []);
    setBeforeImage(p.beforeImage ? [p.beforeImage] : []);
    setAfterImage(p.afterImage ? [p.afterImage] : []);
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    const startTs = dateInputToTimestamp(values.startDate);
    if (!startTs) {
      toast.error("Invalid start date.");
      return;
    }
    try {
      const payload = {
        title: values.title.trim(),
        client: values.client.trim(),
        location: values.location.trim(),
        status: values.status,
        progress: values.progress ?? 0,
        startDate: startTs,
        endDate: values.endDate ? dateInputToTimestamp(values.endDate) : null,
        description: values.description.trim(),
        images,
        videos,
        beforeImage: beforeImage[0] ?? null,
        afterImage: afterImage[0] ?? null,
        featured: values.featured,
        order: values.order ?? 0,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.projects, editing.id), payload);
        toast.success("Project updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.projects), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Project created.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const doDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.projects, confirmDelete.id));
      toast.success("Project deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Project management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Projects" />
        <LoadingState rows={6} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add project
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Showcase interior-design projects here."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add project</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.title} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-muted text-muted-foreground">No image</div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  <StatusBadge status={p.status} />
                  {p.featured && <Badge className="bg-primary">Featured</Badge>}
                </div>
                {(p.videos?.length ?? 0) > 0 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                    <Play className="h-3 w-3" /> {p.videos.length}
                  </span>
                )}
              </div>
              <CardContent className="space-y-2 p-4">
                <p className="font-semibold">{p.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" /> {p.client}
                  <MapPin className="ml-2 h-3 w-3" /> {p.location}
                </p>
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{p.progress ?? 0}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progress ?? 0}%` }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(p.startDate)} → {p.endDate ? fmtDate(p.endDate) : "—"}
                </p>
                <div className="flex justify-end gap-1 pt-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name="title" label="Title" placeholder="e.g. DHA Villa Interior" />
              <TextField control={control} name="client" label="Client" placeholder="Client name" />
              <TextField control={control} name="location" label="Location" placeholder="e.g. DHA Phase 5, Lahore" />
              <SelectField
                control={control}
                name="status"
                label="Status"
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
              <div className="space-y-1.5">
                <Label>Progress — {progressNum}%</Label>
                <Input type="range" min={0} max={100} value={progressNum} onChange={(e) => form.setValue("progress", Number(e.target.value))} className="w-full" />
              </div>
              <TextField control={control} name="order" label="Sort order" type="number" />
              <TextField control={control} name="startDate" label="Start date" type="date" />
              <TextField control={control} name="endDate" label="End date" type="date" hint="Optional" />
            </div>
            <TextAreaField control={control} name="description" label="Description" rows={4} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload
                value={beforeImage}
                onChange={setBeforeImage}
                folder="projects/before-after"
                multiple={false}
                max={1}
                label="Before photo"
                hint="Shown on the left of the portfolio comparison slider"
              />
              <ImageUpload
                value={afterImage}
                onChange={setAfterImage}
                folder="projects/before-after"
                multiple={false}
                max={1}
                label="After photo"
                hint="Shown on the right of the portfolio comparison slider"
              />
            </div>
            <ImageUpload value={images} onChange={setImages} folder="projects" label="Project images" />
            <ImageUpload
              value={videos}
              onChange={setVideos}
              folder="project-videos"
              accept="video/*"
              max={10}
              label="Project videos"
              hint="(mp4/webm)"
            />
            <SwitchField control={control} name="featured" label="Featured" hint="Highlight on the storefront" />
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
        title="Delete project?"
        description={`"${confirmDelete?.title}" will be permanently deleted.`}
        onConfirm={() => {
          void doDelete();
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

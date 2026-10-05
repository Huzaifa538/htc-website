"use client";

/**
 * Gallery manager: videos (upload + thumbnail) and images, with comment
 * moderation (list/delete comments subcollection) and likes display.
 */
import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Heart, MessageSquare, Play } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { GalleryImage, GalleryVideo } from "@/lib/types";
import { useCollection, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import ImageUpload from "@/components/admin/ImageUpload";
import { TextField, TextAreaField, SwitchField } from "@/components/admin/FormFields";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GalleryComment {
  id: string;
  userName?: string;
  text: string;
  createdAt?: Timestamp;
}

const videoSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  enabled: z.boolean().default(true),
});
type VideoFormValues = z.input<typeof videoSchema>;

const imageSchema = z.object({
  title: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  enabled: z.boolean().default(true),
});
type ImageFormValues = z.input<typeof imageSchema>;

export default function GalleryPage() {
  const { data: videos, loading: videosLoading } = useCollection<GalleryVideo>(COLLECTIONS.galleryVideos);
  const { data: images, loading: imagesLoading } = useCollection<GalleryImage>(COLLECTIONS.galleryImages);

  const [videoDialog, setVideoDialog] = useState(false);
  const [editingVideo, setEditingVideo] = useState<GalleryVideo | null>(null);
  const [videoFile, setVideoFile] = useState<string[]>([]);
  const [videoThumb, setVideoThumb] = useState<string[]>([]);
  const [confirmVideoDelete, setConfirmVideoDelete] = useState<GalleryVideo | null>(null);

  const [imageDialog, setImageDialog] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [imageFile, setImageFile] = useState<string[]>([]);
  const [confirmImageDelete, setConfirmImageDelete] = useState<GalleryImage | null>(null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsVideo, setCommentsVideo] = useState<GalleryVideo | null>(null);
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const videoForm = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", description: "", category: "", enabled: true },
  });
  const imageForm = useForm<ImageFormValues>({
    resolver: zodResolver(imageSchema),
    defaultValues: { title: "", category: "", enabled: true },
  });

  const sortedVideos = useMemo(
    () => videos.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [videos]
  );
  const sortedImages = useMemo(
    () => images.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [images]
  );

  /* ------------------------------- videos ------------------------------- */

  const openVideoCreate = () => {
    setEditingVideo(null);
    videoForm.reset({ title: "", description: "", category: "", enabled: true });
    setVideoFile([]);
    setVideoThumb([]);
    setVideoDialog(true);
  };

  const openVideoEdit = (v: GalleryVideo) => {
    setEditingVideo(v);
    videoForm.reset({
      title: v.title,
      description: v.description ?? "",
      category: v.category,
      enabled: v.enabled,
    });
    setVideoFile(v.videoUrl ? [v.videoUrl] : []);
    setVideoThumb(v.thumbnailUrl ? [v.thumbnailUrl] : []);
    setVideoDialog(true);
  };

  const submitVideo = async (values: VideoFormValues) => {
    if (!db) return;
    if (videoFile.length === 0) {
      toast.error("Please upload a video file.");
      return;
    }
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() ?? "",
        category: values.category.trim(),
        videoUrl: videoFile[0]!,
        thumbnailUrl: videoThumb[0] ?? "",
        enabled: values.enabled,
      };
      if (editingVideo) {
        await updateDoc(doc(db, COLLECTIONS.galleryVideos, editingVideo.id), payload);
        toast.success("Video updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.galleryVideos), {
          ...payload,
          likes: 0,
          order: videos.length,
          createdAt: serverTimestamp(),
        });
        toast.success("Video added to gallery.");
      }
      setVideoDialog(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const toggleVideo = async (v: GalleryVideo) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.galleryVideos, v.id), { enabled: !v.enabled });
    } catch {
      toast.error("Update failed.");
    }
  };

  /* ------------------------------- images ------------------------------- */

  const openImageCreate = () => {
    setEditingImage(null);
    imageForm.reset({ title: "", category: "", enabled: true });
    setImageFile([]);
    setImageDialog(true);
  };

  const openImageEdit = (img: GalleryImage) => {
    setEditingImage(img);
    imageForm.reset({
      title: img.title ?? "",
      category: img.category,
      enabled: img.enabled,
    });
    setImageFile(img.imageUrl ? [img.imageUrl] : []);
    setImageDialog(true);
  };

  const submitImage = async (values: ImageFormValues) => {
    if (!db) return;
    if (imageFile.length === 0) {
      toast.error("Please upload an image.");
      return;
    }
    try {
      const payload = {
        title: values.title?.trim() || null,
        category: values.category.trim(),
        imageUrl: imageFile[0]!,
        enabled: values.enabled,
      };
      if (editingImage) {
        await updateDoc(doc(db, COLLECTIONS.galleryImages, editingImage.id), payload);
        toast.success("Image updated.");
      } else {
        await addDoc(collection(db, COLLECTIONS.galleryImages), {
          ...payload,
          order: images.length,
          createdAt: serverTimestamp(),
        });
        toast.success("Image added to gallery.");
      }
      setImageDialog(false);
    } catch {
      toast.error("Save failed.");
    }
  };

  const toggleImage = async (img: GalleryImage) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.galleryImages, img.id), { enabled: !img.enabled });
    } catch {
      toast.error("Update failed.");
    }
  };

  /* ------------------------------ comments ------------------------------ */

  const openComments = async (v: GalleryVideo) => {
    if (!db) return;
    setCommentsVideo(v);
    setCommentsOpen(true);
    setCommentsLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.galleryVideos, v.id, "comments"),
          orderBy("createdAt", "desc")
        )
      );
      setComments(
        snap.docs.map((d) => ({ ...(d.data() as Omit<GalleryComment, "id">), id: d.id }))
      );
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!db || !commentsVideo) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.galleryVideos, commentsVideo.id, "comments", id));
      setComments((c) => c.filter((x) => x.id !== id));
      toast.success("Comment deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Gallery management" />;
  if (videosLoading || imagesLoading)
    return (
      <>
        <PageHeader title="Gallery" />
        <LoadingState rows={6} />
      </>
    );

  return (
    <>
      <PageHeader title="Gallery" subtitle={`${videos.length} videos · ${images.length} images`} />

      <Tabs defaultValue="videos">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="videos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openVideoCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add video
            </Button>
          </div>
          {sortedVideos.length === 0 ? (
            <EmptyState title="No videos yet" description="Upload showcase videos for the gallery." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedVideos.map((v) => (
                <Card key={v.id} className="overflow-hidden">
                  <div className="relative">
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt={v.title} className="h-44 w-full object-cover" />
                    ) : (
                      <video src={v.videoUrl} className="h-44 w-full object-cover" muted preload="metadata" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/60 p-3">
                        <Play className="h-5 w-5 text-white" />
                      </span>
                    </span>
                    <Badge variant={v.enabled ? "default" : "secondary"} className="absolute left-2 top-2">
                      {v.enabled ? "On" : "Off"}
                    </Badge>
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <p className="truncate font-semibold">{v.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">{v.category}</span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" /> {v.likes ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openVideoEdit(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => void openComments(v)} title="Comments">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmVideoDelete(v)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void toggleVideo(v)}>
                        {v.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="images" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openImageCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add image
            </Button>
          </div>
          {sortedImages.length === 0 ? (
            <EmptyState title="No images yet" description="Upload photos for the gallery." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {sortedImages.map((img) => (
                <Card key={img.id} className="group overflow-hidden">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.title ?? "gallery"} className="h-44 w-full object-cover" />
                    <Badge variant={img.enabled ? "default" : "secondary"} className="absolute left-2 top-2">
                      {img.enabled ? "On" : "Off"}
                    </Badge>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => openImageEdit(img)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => setConfirmImageDelete(img)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button size="sm" variant="secondary" className="h-7" onClick={() => void toggleImage(img)}>
                        {img.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                  {(img.title || img.category) && (
                    <CardContent className="p-3">
                      {img.title && <p className="truncate text-sm font-medium">{img.title}</p>}
                      <p className="text-xs text-muted-foreground">{img.category}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* video dialog */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideo ? "Edit video" : "New gallery video"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={videoForm.handleSubmit(submitVideo)} className="space-y-4">
            <TextField control={videoForm.control} name="title" label="Title" placeholder="Workshop tour" />
            <TextAreaField control={videoForm.control} name="description" label="Description" rows={3} />
            <TextField control={videoForm.control} name="category" label="Category" placeholder="e.g. Workshop, Projects" />
            <ImageUpload value={videoFile} onChange={setVideoFile} folder="gallery-videos" accept="video/*" multiple={false} max={1} compact label="Video file" hint="(required, mp4/webm)" />
            <ImageUpload value={videoThumb} onChange={setVideoThumb} folder="gallery-thumbs" multiple={false} max={1} compact label="Thumbnail" hint="(optional)" />
            <SwitchField control={videoForm.control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVideoDialog(false)}>Cancel</Button>
              <Button type="submit">{editingVideo ? "Save changes" : "Add video"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* image dialog */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingImage ? "Edit image" : "New gallery image"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={imageForm.handleSubmit(submitImage)} className="space-y-4">
            <TextField control={imageForm.control} name="title" label="Title" placeholder="Optional" />
            <TextField control={imageForm.control} name="category" label="Category" placeholder="e.g. Furniture, Interiors" />
            <ImageUpload value={imageFile} onChange={setImageFile} folder="gallery-images" multiple={false} max={1} compact label="Image" hint="(required)" />
            <SwitchField control={imageForm.control} name="enabled" label="Enabled" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImageDialog(false)}>Cancel</Button>
              <Button type="submit">{editingImage ? "Save changes" : "Add image"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* comments moderation */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments — {commentsVideo?.title}</DialogTitle>
          </DialogHeader>
          {commentsLoading ? (
            <LoadingState rows={4} />
          ) : comments.length === 0 ? (
            <EmptyState title="No comments yet" />
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.userName ?? "Visitor"}</p>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteComment(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.text}</p>
                  {c.createdAt && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(tsMillis(c.createdAt)).toLocaleString("en-PK")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmVideoDelete !== null}
        onOpenChange={(o) => !o && setConfirmVideoDelete(null)}
        title="Delete video?"
        description={`"${confirmVideoDelete?.title}" will be permanently deleted.`}
        onConfirm={async () => {
          if (db && confirmVideoDelete) {
            await deleteDoc(doc(db, COLLECTIONS.galleryVideos, confirmVideoDelete.id));
            toast.success("Video deleted.");
          }
          setConfirmVideoDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmImageDelete !== null}
        onOpenChange={(o) => !o && setConfirmImageDelete(null)}
        title="Delete image?"
        description="This image will be permanently deleted from the gallery."
        onConfirm={async () => {
          if (db && confirmImageDelete) {
            await deleteDoc(doc(db, COLLECTIONS.galleryImages, confirmImageDelete.id));
            toast.success("Image deleted.");
          }
          setConfirmImageDelete(null);
        }}
      />
    </>
  );
}

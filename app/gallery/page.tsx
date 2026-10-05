/**
 * /gallery — Videos tab (modal player, like via likedBy array + count,
 * comments with login, delete own comment) + Images tab (masonry +
 * lightbox).
 */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  ImageIcon,
  Loader2,
  MessageCircle,
  Play,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { useAuth } from "@/components/providers";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGalleryImages,
  useVideoComments,
  type VideoComment,
} from "@/components/customer/data-hooks";
import { cn } from "@/lib/utils";
import type { GalleryVideo, WithId } from "@/lib/types";

type VideoDoc = WithId<GalleryVideo> & { likedBy?: string[] };

function useVideosRealtime() {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !db) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.galleryVideos),
      where("enabled", "==", true),
      orderBy("order", "asc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVideos(
          snap.docs.map((d) => {
            const data = d.data() as Omit<GalleryVideo, "id"> & { likedBy?: string[] };
            return { ...data, id: d.id };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [configured]);

  return { videos, loading, configured };
}

function VideoModal({
  video,
  onClose,
}: {
  video: VideoDoc;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { comments, loading: commentsLoading } = useVideoComments(video.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const liked = !!user && (video.likedBy ?? []).includes(user.uid);

  async function toggleLike() {
    if (!db || !user) {
      toast.error("Please sign in to like videos");
      router.push("/login?next=/gallery");
      return;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.galleryVideos, video.id), {
        likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likes: increment(liked ? -1 : 1),
      });
    } catch {
      toast.error("Could not update like — please try again.");
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) {
      toast.error("Please sign in to comment");
      router.push("/login?next=/gallery");
      return;
    }
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await addDoc(collection(db, COLLECTIONS.galleryVideos, video.id, "comments"), {
        userId: user.uid,
        userName: user.displayName ?? user.email ?? "Customer",
        text: body,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch {
      toast.error("Could not post comment — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(c: VideoComment) {
    if (!db || !user || c.userId !== user.uid) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.galleryVideos, video.id, "comments", c.id));
    } catch {
      toast.error("Could not delete comment.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">{video.title}</DialogTitle>
        <div className="relative">
          <video
            src={video.videoUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={video.thumbnailUrl || undefined}
            className="aspect-video w-full bg-black"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#D21F26]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-extrabold">{video.title}</h2>
              {video.description && (
                <p className="mt-1.5 text-sm text-muted-foreground">{video.description}</p>
              )}
            </div>
            <button
              onClick={toggleLike}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition",
                liked
                  ? "border-[#D21F26] bg-[#D21F26]/10 text-[#D21F26]"
                  : "hover:border-[#D21F26] hover:text-[#D21F26]"
              )}
            >
              <Heart size={16} className={liked ? "fill-current" : ""} />
              {video.likes ?? 0}
            </button>
          </div>

          {/* Comments */}
          <div className="mt-6 border-t pt-5">
            <h3 className="flex items-center gap-2 font-display font-bold">
              <MessageCircle size={17} /> Comments ({comments.length})
            </h3>
            {commentsLoading ? (
              <div className="mt-4 space-y-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No comments yet — start the conversation.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 rounded-2xl bg-muted/60 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D21F26]/10 font-display text-sm font-extrabold text-[#D21F26]">
                      {c.userName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{c.userName}</p>
                      <p className="mt-0.5 text-sm">{c.text}</p>
                    </div>
                    {user && c.userId === user.uid && (
                      <button
                        onClick={() => deleteComment(c)}
                        aria-label="Delete comment"
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={sendComment} className="mt-4 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={user ? "Write a comment…" : "Sign in to comment…"}
                className="rounded-full"
                disabled={!user}
              />
              <Button
                type="submit"
                disabled={busy || !text.trim()}
                className="shrink-0 rounded-full bg-[#D21F26] hover:bg-[#a8161c]"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImagesTab() {
  const { items, loading, configured } = useGalleryImages();
  const [lightbox, setLightbox] = useState(0);
  const list = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (loading) {
    return (
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="mb-4 h-56 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!configured || list.length === 0) {
    return (
      <EmptyState
        title="Photo gallery coming soon"
        description="Our finished interiors and craftsmanship photos are on the way."
      />
    );
  }
  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {list.map((img, i) => (
          <motion.button
            key={img.id}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            onClick={() => setLightbox(i + 1)}
            aria-label={`View photo: ${img.title ?? "gallery image"}`}
            className="group relative mb-4 block w-full overflow-hidden rounded-2xl"
          >
            <Image
              src={img.imageUrl}
              alt={img.title ?? "Gallery photo"}
              width={600}
              height={450}
              className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {img.title && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10 text-left text-sm font-bold text-white opacity-0 transition group-hover:opacity-100">
                {img.title}
              </span>
            )}
          </motion.button>
        ))}
      </div>
      <Dialog open={lightbox > 0} onOpenChange={(v) => !v && setLightbox(0)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightbox > 0 && (
            <div className="relative aspect-video w-full">
              <Image
                src={list[lightbox - 1]!.imageUrl}
                alt={list[lightbox - 1]!.title ?? ""}
                fill
                className="object-contain"
                sizes="90vw"
              />
              <button
                onClick={() => setLightbox(((lightbox - 2 + list.length) % list.length) + 1)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
              >
                ‹
              </button>
              <button
                onClick={() => setLightbox((lightbox % list.length) + 1)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
              >
                ›
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function GalleryPage() {
  const [tab, setTab] = useState<"videos" | "images">("videos");
  const { videos, loading, configured } = useVideosRealtime();
  const [active, setActive] = useState<VideoDoc | null>(null);

  // Keep the modal's video in sync with realtime updates (likes).
  const liveActive = active ? (videos.find((v) => v.id === active.id) ?? active) : null;

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Gallery
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Watch our craftsmanship in action and browse finished interiors.
          </p>
        </Reveal>

        <div className="mt-8 inline-flex rounded-full border p-1">
          {(
            [
              { v: "videos", label: "Videos", icon: Video },
              { v: "images", label: "Photos", icon: ImageIcon },
            ] as const
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={cn(
                "flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition",
                tab === t.v ? "bg-[#D21F26] text-white" : "hover:text-[#D21F26]"
              )}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "images" ? (
            <ImagesTab />
          ) : loading ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-3xl" />
              ))}
            </div>
          ) : !configured || videos.length === 0 ? (
            <EmptyState
              title="Video gallery coming soon"
              description="Factory tours and craftsmanship videos are on the way."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {videos.map((v, i) => (
                <Reveal key={v.id} delay={(i % 3) * 0.06}>
                  <button
                    onClick={() => setActive(v)}
                    aria-label={`Play video: ${v.title}`}
                    className="group block w-full overflow-hidden rounded-3xl border bg-card text-left transition hover:shadow-xl"
                  >
                    <span className="relative block aspect-video overflow-hidden">
                      <Image
                        src={v.thumbnailUrl || "/logo.png"}
                        alt={v.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D21F26] text-white shadow-xl transition group-hover:scale-110">
                          <Play size={22} className="ml-0.5 fill-current" />
                        </span>
                      </span>
                      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
                        {v.category}
                      </span>
                    </span>
                    <span className="block p-4">
                      <span className="block truncate font-display font-bold">{v.title}</span>
                      <span className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart size={13} /> {v.likes ?? 0} likes
                        </span>
                      </span>
                    </span>
                  </button>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {liveActive && <VideoModal video={liveActive} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </SiteShell>
  );
}

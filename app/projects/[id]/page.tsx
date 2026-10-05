/**
 * /projects/[id] — detail with gallery, video player, before/after
 * slider, progress, and related projects.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, MessageCircle, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState } from "@/components/customer/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useProject, useProjects } from "@/components/customer/data-hooks";
import { tsMillis } from "@/components/customer/product-utils";
import { cn } from "@/lib/utils";

function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-video select-none overflow-hidden rounded-3xl">
      <Image src={after} alt="After" fill className="object-cover" sizes="100vw" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Image src={before} alt="Before" fill className="object-cover" sizes="100vw" />
      </div>
      <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
        Before
      </span>
      <span className="absolute right-4 top-4 rounded-full bg-[#D21F26] px-3 py-1 text-xs font-bold text-white">
        After
      </span>
      <div
        className="absolute inset-y-0 w-1 bg-white shadow-xl"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-bold text-stone-800 shadow-lg">
          ↔
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Before and after comparison"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function fmtDate(t: unknown): string {
  const ms = tsMillis(t);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const openChat = useChatUiStore((s) => s.openChat);
  const { project, loading, configured } = useProject(id);
  const { items: all } = useProjects();
  const [lightbox, setLightbox] = useState(0); // 0 = closed, else 1-based index

  /** Open the HTC chat with this project attached. */
  function handleAskAbout() {
    if (!project) return;
    if (!user) {
      toast.error("Please sign in to chat about this project");
      router.push(`/login?next=${encodeURIComponent(`/projects/${id}`)}`);
      return;
    }
    openChat({
      kind: "project",
      id: project.id,
      name: project.title,
      image: project.images?.[0] || "/logo.png",
      detail: `${project.location} · ${project.status}`,
      href: `/projects/${project.id}`,
    });
    toast.success("Chat opened — ask us anything about this project");
  }

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-10">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="mt-6 h-8 w-1/2" />
        </div>
      </SiteShell>
    );
  }

  if (!configured || !project) {
    return (
      <SiteShell>
        <div className="container py-16">
          <EmptyState
            title="Project not found"
            description="This project may have been removed."
            actionLabel="All Projects"
            actionHref="/projects"
          />
        </div>
      </SiteShell>
    );
  }

  const related = all.filter((p) => p.id !== project.id).slice(0, 3);
  const images = project.images ?? [];

  return (
    <SiteShell>
      <div className="container py-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{project.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <Reveal>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
                  {project.title}
                </h1>
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-bold text-white",
                    project.status === "Completed"
                      ? "bg-green-600"
                      : project.status === "Ongoing"
                        ? "bg-amber-500"
                        : "bg-sky-600"
                  )}
                >
                  {project.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User size={15} /> {project.client}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} /> {project.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={15} /> {fmtDate(project.startDate)}
                  {project.endDate ? ` – ${fmtDate(project.endDate)}` : ""}
                </span>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Project progress</span>
                  <span className="text-[#D21F26]">{project.progress}%</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D21F26] to-[#7C4A21]"
                    style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                  />
                </div>
              </div>

              <p className="mt-6 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            </Reveal>

            {/* Before / After */}
            {images.length >= 2 && (
              <Reveal className="mt-10">
                <h2 className="mb-4 font-display text-2xl font-extrabold">
                  Before & After
                </h2>
                <BeforeAfter before={images[0]!} after={images[1]!} />
              </Reveal>
            )}

            {/* Videos */}
            {project.videos && project.videos.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="mb-4 font-display text-2xl font-extrabold">
                  Project Videos
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {project.videos.map((v, i) => (
                    <video
                      key={i}
                      src={v}
                      controls
                      preload="metadata"
                      className="aspect-video w-full rounded-3xl bg-black"
                    />
                  ))}
                </div>
              </Reveal>
            )}

            {/* Gallery */}
            {images.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="mb-4 font-display text-2xl font-extrabold">Gallery</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {images.map((src, i) => (
                    <button
                      key={src + i}
                      onClick={() => setLightbox(i + 1)}
                      className="group relative aspect-square overflow-hidden rounded-2xl"
                    >
                      <Image
                        src={src}
                        alt={`${project.title} — photo ${i + 1}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl bg-[#FBF3E4] p-6 dark:bg-stone-900/60">
              <h3 className="font-display text-lg font-extrabold">
                Like this transformation?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get a free consultation and quote for your own space.
              </p>
              <Link
                href="/services"
                className="mt-5 block rounded-full bg-[#D21F26] py-3 text-center font-bold text-white transition hover:bg-[#a8161c]"
              >
                Get Free Quote
              </Link>
              <a
                href="/contact"
                className="mt-2.5 block rounded-full border py-3 text-center font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
              >
                Contact Us
              </a>
              <button
                onClick={handleAskAbout}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border py-3 font-bold transition hover:border-[#D21F26] hover:text-[#D21F26]"
              >
                <MessageCircle size={17} /> Ask about this
              </button>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="mb-6 font-display text-2xl font-extrabold">
              More Projects
            </h2>
            <div className="grid gap-5 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group relative block overflow-hidden rounded-3xl"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={p.images[0] || "/logo.png"}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="font-display font-extrabold text-white">{p.title}</h3>
                    <p className="text-sm text-white/70">{p.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={lightbox > 0} onOpenChange={(v) => !v && setLightbox(0)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2">
          {lightbox > 0 && (
            <div className="relative aspect-video w-full">
              <Image
                src={images[lightbox - 1]!}
                alt=""
                fill
                className="object-contain"
                sizes="90vw"
              />
              <button
                onClick={() => setLightbox(((lightbox - 2 + images.length) % images.length) + 1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={() => setLightbox((lightbox % images.length) + 1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#D21F26]"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}

/**
 * /projects — status badges (Ongoing/Completed/Upcoming), progress bars,
 * status filters.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { useProjects } from "@/components/customer/data-hooks";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";

const FILTERS: ("All" | ProjectStatus)[] = ["All", "Ongoing", "Completed", "Upcoming"];

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Completed: "bg-green-600",
  Ongoing: "bg-amber-500",
  Upcoming: "bg-sky-600",
};

export default function ProjectsPage() {
  const { items, loading, configured } = useProjects();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const list = [...items]
    .filter((p) => filter === "All" || p.status === filter)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <SiteShell>
      <div className="container py-10">
        <Reveal>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D21F26]">
            <Hammer size={14} /> Our portfolio
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Projects
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Real homes and offices transformed by the HTC design team.
          </p>
        </Reveal>

        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-5 py-2.5 text-sm font-bold transition",
                filter === f
                  ? "border-[#D21F26] bg-[#D21F26] text-white"
                  : "hover:border-[#D21F26] hover:text-[#D21F26]"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : !configured || list.length === 0 ? (
            <EmptyState
              title={filter === "All" ? "Projects coming soon" : `No ${filter.toLowerCase()} projects`}
              description="Our portfolio is being prepared — check back shortly."
              actionLabel="Contact Us"
              actionHref="/contact"
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 0.07}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="group block overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1.5 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={p.images[0] || "/logo.png"}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span
                        className={cn(
                          "absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white",
                          STATUS_STYLE[p.status]
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="p-5">
                      <h2 className="font-display text-lg font-extrabold">{p.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.client} · {p.location}
                      </p>
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-[#D21F26]">{p.progress}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[#D21F26] transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

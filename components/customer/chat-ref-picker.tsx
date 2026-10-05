/**
 * ChatRefPicker — in-chat item picker shown inside the chat panel.
 *
 * Brand-aware: on MTR-brand chats it browses store products (search +
 * category chips); on HTC-brand chats it browses services / projects
 * (tabbed). Picking an item attaches it as the chat's refCard, so the
 * next message the customer sends carries the reference.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Package, Search, X } from "lucide-react";
import {
  useCategories,
  useProducts,
  useProjects,
  useServices,
} from "./data-hooks";
import { useChatUiStore } from "@/lib/store/chat-ui";
import { getProductPrice, primaryImage } from "./product-utils";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ChatBrand,
  ChatRefCard,
  Product,
  Project,
  Service,
  WithId,
} from "@/lib/types";

const MAX_RESULTS = 20;
const FALLBACK_IMAGE = "/logo.png";

function productCard(p: WithId<Product>): ChatRefCard {
  return {
    kind: "product",
    id: p.id,
    name: p.name,
    image: primaryImage(p),
    detail: formatPKR(getProductPrice(p).price),
    href: `/product/${p.slug || p.id}`,
  };
}

function serviceCard(s: WithId<Service>): ChatRefCard {
  return {
    kind: "service",
    id: s.id,
    name: s.name,
    image: s.image || FALLBACK_IMAGE,
    detail:
      s.priceFrom != null
        ? `From ${formatPKR(s.priceFrom)}`
        : "Consultation available",
    href: `/services/${s.slug || s.id}`,
  };
}

function projectCard(p: WithId<Project>): ChatRefCard {
  return {
    kind: "project",
    id: p.id,
    name: p.title,
    image: p.images?.[0] || FALLBACK_IMAGE,
    detail: `${p.location} · ${p.status}`,
    href: `/projects/${p.id}`,
  };
}

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ResultRow({
  card,
  onPick,
}: {
  card: ChatRefCard;
  onPick: (card: ChatRefCard) => void;
}) {
  return (
    <button
      onClick={() => onPick(card)}
      className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={card.image} alt="" fill className="object-cover" sizes="40px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{card.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {card.detail}
        </span>
      </span>
    </button>
  );
}

function ProductBrowser({ onPick }: { onPick: (c: ChatRefCard) => void }) {
  const { products, loading } = useProducts();
  const { items: categories } = useCategories();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const debounced = useDebounced(query);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return products
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter((p) =>
        q
          ? `${p.name} ${p.urduName ?? ""} ${p.tags.join(" ")}`
              .toLowerCase()
              .includes(q)
          : true
      )
      .slice(0, MAX_RESULTS)
      .map(productCard);
  }, [products, debounced, categoryId]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-full bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#D21F26]/40"
        />
      </div>
      {categories.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryId(null)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
              categoryId === null
                ? "bg-[#D21F26] text-white"
                : "bg-muted hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
                categoryId === c.id
                  ? "bg-[#D21F26] text-white"
                  : "bg-muted hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Loading products…
          </p>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No products found.
          </p>
        ) : (
          results.map((card) => (
            <ResultRow key={card.id} card={card} onPick={onPick} />
          ))
        )}
      </div>
    </div>
  );
}

function HtcBrowser({ onPick }: { onPick: (c: ChatRefCard) => void }) {
  const { items: services, loading: servicesLoading } = useServices();
  const { items: projects, loading: projectsLoading } = useProjects();
  const [tab, setTab] = useState<"services" | "projects">("services");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (tab === "services") {
      return services
        .filter((s) =>
          q
            ? `${s.name} ${s.description}`.toLowerCase().includes(q)
            : true
        )
        .slice(0, MAX_RESULTS)
        .map(serviceCard);
    }
    return projects
      .filter((p) =>
        q ? `${p.title} ${p.location}`.toLowerCase().includes(q) : true
      )
      .slice(0, MAX_RESULTS)
      .map(projectCard);
  }, [services, projects, tab, debounced]);

  const loading = servicesLoading || projectsLoading;

  return (
    <div>
      <div className="flex gap-1.5">
        {(["services", "projects"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-bold capitalize transition",
              tab === t
                ? "bg-[#D21F26] text-white"
                : "bg-muted hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab}…`}
          className="w-full rounded-full bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#D21F26]/40"
        />
      </div>
      <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Loading…
          </p>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nothing found.
          </p>
        ) : (
          results.map((card) => (
            <ResultRow
              key={`${card.kind}-${card.id}`}
              card={card}
              onPick={onPick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ChatRefPicker({
  brand,
  onClose,
}: {
  brand: ChatBrand;
  onClose: () => void;
}) {
  const openChat = useChatUiStore((s) => s.openChat);

  function handlePick(card: ChatRefCard) {
    // Attaches the card to the chat; the next sendMessage includes it,
    // and the productRef → "mtr" / service|project → "htc" brand rule applies.
    openChat(card);
    onClose();
  }

  return (
    <div className="border-t bg-white px-3 py-3 dark:bg-stone-950">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Package size={13} />
          {brand === "mtr"
            ? "Attach a product to your message"
            : "Attach a service or project"}
        </p>
        <button
          onClick={onClose}
          aria-label="Close picker"
          className="rounded-full p-1 hover:bg-muted"
        >
          <X size={14} />
        </button>
      </div>
      {brand === "mtr" ? (
        <ProductBrowser onPick={handlePick} />
      ) : (
        <HtcBrowser onPick={handlePick} />
      )}
    </div>
  );
}

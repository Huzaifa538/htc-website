/**
 * /shop — filters (category, price, size, color, rating), sort, live
 * search, pagination. All filtering is client-side over the published
 * catalog so no composite Firestore indexes are required.
 */
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { SiteShell } from "@/components/customer/site-shell";
import { ProductCard } from "@/components/customer/product-card";
import { Reveal } from "@/components/customer/reveal";
import { EmptyState, ProductGridSkeleton } from "@/components/customer/skeletons";
import { Stars } from "@/components/customer/stars";
import { useLanguage } from "@/lib/i18n";
import { useCategories, useProducts } from "@/components/customer/data-hooks";
import { getProductPrice, tsMillis } from "@/components/customer/product-utils";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const PAGE_SIZE = 12;
const SORT_VALUES = [
  "featured",
  "newest",
  "popular",
  "best-sellers",
  "rating",
  "price-asc",
  "price-desc",
] as const;

function ShopClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { products, loading, configured } = useProducts();
  const { items: categories } = useCategories();

  const sortLabels: Record<(typeof SORT_VALUES)[number], string> = {
    featured: t.shop.featured,
    newest: t.shop.newest,
    popular: t.shop.mostPopular,
    "best-sellers": t.shop.bestSellers,
    rating: t.shop.topRated,
    "price-asc": t.shop.priceLowHigh,
    "price-desc": t.shop.priceHighLow,
  };

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [selectedCats, setSelectedCats] = useState<string[]>(
    searchParams.get("category") ? [searchParams.get("category")!] : []
  );
  const [sort, setSort] = useState(searchParams.get("sort") ?? "featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Keep filter state in sync when the URL changes (e.g. a new header search
  // submitted while already on /shop). Without this the old results stay.
  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    const cat = searchParams.get("category");
    setSelectedCats(cat ? [cat] : []);
    setSort(searchParams.get("sort") ?? "featured");
    setPage(1);
  }, [searchParams]);

  // Resolve SEO-friendly category slugs (/shop?category=door-locks) to the
  // category ids the filters work with. Runs once categories load.
  useEffect(() => {
    const param = searchParams.get("category");
    if (!param || categories.length === 0) return;
    const match = categories.find((c) => c.id === param || c.slug === param);
    if (match && !selectedCats.includes(match.id)) {
      setSelectedCats([match.id]);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, searchParams]);

  // Expand selected categories to include their sub-categories, so a parent
  // like "Doors" also shows products filed under "Wooden Doors".
  const expandedCats = useMemo(() => {
    const byParent = new Map<string, string[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c.id);
        byParent.set(c.parentId, arr);
      }
    }
    const out = new Set<string>();
    const addWithChildren = (id: string) => {
      if (out.has(id)) return;
      out.add(id);
      for (const child of byParent.get(id) ?? []) addWithChildren(child);
    };
    for (const id of selectedCats) addWithChildren(id);
    return out;
  }, [categories, selectedCats]);

  // Live search suggestions.
  const suggestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 5);
  }, [search, products]);

  // All available sizes/colors across the catalog.
  const { allSizes, allColors, colorHex } = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    const hex: Record<string, string> = {};
    for (const p of products) {
      for (const t of p.variantTypes) {
        if (t.kind === "size") t.values.forEach((v) => s.add(v));
        if (t.kind === "color") {
          t.values.forEach((v) => c.add(v));
          Object.assign(hex, t.colors ?? {});
        }
      }
    }
    return { allSizes: Array.from(s), allColors: Array.from(c), colorHex: hex };
  }, [products]);

  const maxCatalogPrice = useMemo(
    () => products.reduce((m, p) => Math.max(m, getProductPrice(p).price), 0),
    [products]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (selectedCats.length > 0 && !expandedCats.has(p.categoryId)) return false;
      if (needle && !p.name.toLowerCase().includes(needle) && !(p.tags ?? []).some((t) => t.toLowerCase().includes(needle))) return false;
      const price = getProductPrice(p).price;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (minRating > 0 && (p.rating ?? 0) < minRating) return false;
      if (sizes.length > 0) {
        const pSizes = new Set<string>();
        for (const t of p.variantTypes) if (t.kind === "size") t.values.forEach((v) => pSizes.add(v));
        for (const c of p.combinations) {
          const sz = p.variantTypes.find((t) => t.kind === "size")?.name;
          if (sz && c.options[sz]) pSizes.add(c.options[sz]);
        }
        if (!sizes.some((s) => pSizes.has(s))) return false;
      }
      if (colors.length > 0) {
        const pColors = new Set<string>();
        for (const t of p.variantTypes) if (t.kind === "color") t.values.forEach((v) => pColors.add(v));
        for (const c of p.combinations) {
          const cn = p.variantTypes.find((t) => t.kind === "color")?.name;
          if (cn && c.options[cn]) pColors.add(c.options[cn]);
        }
        if (!colors.some((c) => pColors.has(c))) return false;
      }
      return true;
    });

    switch (sort) {
      case "price-asc":
        list = [...list].sort((a, b) => getProductPrice(a).price - getProductPrice(b).price);
        break;
      case "price-desc":
        list = [...list].sort((a, b) => getProductPrice(b).price - getProductPrice(a).price);
        break;
      case "newest":
        list = [...list].sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
        break;
      case "popular":
        list = [...list].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
        break;
      case "best-sellers":
        list = [...list].sort((a, b) => (b.deliveredCount ?? 0) - (a.deliveredCount ?? 0));
        break;
      case "rating":
        list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      default:
        list = [...list].sort(
          (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false)
        );
    }
    return list;
  }, [products, search, selectedCats, expandedCats, sort, minPrice, maxPrice, sizes, colors, minRating]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    setPage(1);
  }

  function reset() {
    setSearch("");
    setSelectedCats([]);
    setSort("featured");
    setMinPrice("");
    setMaxPrice("");
    setSizes([]);
    setColors([]);
    setMinRating(0);
    setPage(1);
    router.replace("/shop");
  }

  const activeFilterCount =
    selectedCats.length +
    sizes.length +
    colors.length +
    (minPrice || maxPrice ? 1 : 0) +
    (minRating > 0 ? 1 : 0);

  const filters = (
    <div className="space-y-7">
      {/* Category */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
          {t.shop.category}
        </h2>
        <div className="space-y-2">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={selectedCats.includes(c.id)}
                onCheckedChange={() => toggle(selectedCats, c.id, setSelectedCats)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
          {t.shop.price}
        </h2>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t.shop.min}
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setPage(1);
            }}
            className="rounded-xl"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder={maxCatalogPrice ? formatPKR(maxCatalogPrice) : t.shop.max}
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setPage(1);
            }}
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Size */}
      {allSizes.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
            {t.shop.size}
          </h2>
          <div className="flex flex-wrap gap-2">
            {allSizes.map((s) => (
              <button
                key={s}
                onClick={() => toggle(sizes, s, setSizes)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                  sizes.includes(s)
                    ? "border-[#D21F26] bg-[#D21F26]/10 font-bold text-[#D21F26]"
                    : "hover:border-foreground/40"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color */}
      {allColors.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
            {t.shop.color}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {allColors.map((c) => (
              <button
                key={c}
                onClick={() => toggle(colors, c, setColors)}
                title={c}
                aria-label={`${t.shop.color}: ${c}`}
                className={cn(
                  "h-9 w-9 rounded-full ring-2 ring-offset-2 transition",
                  colors.includes(c) ? "ring-[#D21F26]" : "ring-transparent hover:ring-black/20"
                )}
                style={{ backgroundColor: colorHex[c] ?? "#ccc" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rating */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">
          {t.shop.rating}
        </h2>
        <div className="space-y-2">
          {[
            { v: 4, label: t.shop.starsUp(4) },
            { v: 3, label: t.shop.starsUp(3) },
            { v: 0, label: t.shop.anyRating },
          ].map((r) => (
            <label key={r.v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="rating"
                checked={minRating === r.v}
                onChange={() => {
                  setMinRating(r.v);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[#D21F26]"
              />
              {r.v > 0 ? <Stars rating={r.v} /> : null}
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        onClick={reset}
        className="w-full rounded-full"
      >
        <RotateCcw size={15} className="mr-2 rtl:ml-2 rtl:mr-0" /> {t.shop.resetFilters}
      </Button>
    </div>
  );

  return (
    <SiteShell>
      <div className="container py-8">
        <Reveal>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.shop.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {configured ? t.shop.productsCount(filtered.length) : t.shop.browseCollection}
          </p>
        </Reveal>

        {/* Search + sort toolbar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t.shop.searchPlaceholder}
              className="rounded-full py-6 pl-5"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-background shadow-2xl">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSearch(p.name);
                      setPage(1);
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-muted"
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="ml-3 shrink-0 font-bold text-[#D21F26]">
                      {formatPKR(getProductPrice(p).price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              className="rounded-full lg:hidden"
            >
              <SlidersHorizontal size={16} className="mr-2 rtl:ml-2 rtl:mr-0" />
              {t.shop.filters}
              {activeFilterCount > 0 && (
                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#D21F26] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48 rounded-full">
                <SelectValue placeholder={t.shop.sortBy} />
              </SelectTrigger>
              <SelectContent>
                {SORT_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {sortLabels[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedCats.map((id) => (
              <Chip key={id} label={categories.find((c) => c.id === id)?.name ?? id} onClear={() => toggle(selectedCats, id, setSelectedCats)} />
            ))}
            {sizes.map((s) => (
              <Chip key={s} label={t.shop.sizeFilter(s)} onClear={() => toggle(sizes, s, setSizes)} />
            ))}
            {colors.map((c) => (
              <Chip key={c} label={c} onClear={() => toggle(colors, c, setColors)} />
            ))}
            {(minPrice || maxPrice) && (
              <Chip
                label={`${minPrice ? formatPKR(Number(minPrice)) : "…"} – ${maxPrice ? formatPKR(Number(maxPrice)) : "…"
                  }`}
                onClear={() => {
                  setMinPrice("");
                  setMaxPrice("");
                }}
              />
            )}
            {minRating > 0 && (
              <Chip label={t.shop.ratingFilter(minRating)} onClear={() => setMinRating(0)} />
            )}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border bg-card p-6">{filters}</div>
          </aside>

          {/* Grid */}
          <div>
            {loading ? (
              <ProductGridSkeleton count={12} />
            ) : !configured || filtered.length === 0 ? (
              <EmptyState
                title={configured ? t.shop.noProducts : t.shop.shopSoon}
                description={
                  configured
                    ? t.shop.noProductsSub
                    : t.shop.shopSoonSub
                }
                actionLabel={configured ? undefined : t.shop.goHome}
                actionHref={configured ? undefined : "/"}
              />
            ) : (
              <>
                <motion.div layout className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
                  {pageItems.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      disabled={page === 1}
                      onClick={() => {
                        setPage(page - 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const n = i + 1;
                      if (totalPages > 7 && Math.abs(n - page) > 2 && n !== 1 && n !== totalPages) {
                        return n === 2 || n === totalPages - 1 ? (
                          <span key={n} className="px-1 text-muted-foreground">…</span>
                        ) : null;
                      }
                      return (
                        <Button
                          key={n}
                          variant={n === page ? "default" : "outline"}
                          size="icon"
                          className={cn(
                            "rounded-full",
                            n === page && "bg-[#D21F26] hover:bg-[#a8161c]"
                          )}
                          onClick={() => {
                            setPage(n);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {n}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      disabled={page === totalPages}
                      onClick={() => {
                        setPage(page + 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal size={18} /> {t.shop.filters}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6" onClick={(e) => e.stopPropagation()}>
            {filters}
          </div>
        </SheetContent>
      </Sheet>
    </SiteShell>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D21F26]/10 py-1.5 pl-3.5 pr-2 text-xs font-bold text-[#D21F26]">
      {label}
      <button
        onClick={onClear}
        aria-label={t.shop.removeFilter(label)}
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#D21F26]/20"
      >
        <X size={12} />
      </button>
    </span>
  );
}

export default function ShopPage() {
  return (
    <Suspense>
      <ShopClient />
    </Suspense>
  );
}

"use client";

/**
 * Products list: search, filter by category + published status, bulk
 * delete / publish / unpublish, client-side pagination.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Plus, Search, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Category, Product } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useCollection, fmtDate } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function ProductsPage() {
  const { data: products, loading } = useCollection<Product>(COLLECTIONS.products);
  const { data: categories } = useCollection<Category>(COLLECTIONS.categories);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== "all" && p.categoryId !== categoryFilter) return false;
        if (statusFilter === "published" && !p.published) return false;
        if (statusFilter === "draft" && p.published) return false;
        if (q && !`${p.name} ${p.sku} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  }, [products, search, categoryFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleSelectAll = () => {
    const ids = pageItems.map((p) => p.id);
    setSelected((s) => {
      if (ids.every((id) => s.includes(id))) return s.filter((id) => ids.indexOf(id) === -1);
      const next = new Set(s);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const bulkDelete = async (ids: string[]) => {
    const fdb = db;
    if (!fdb) return;
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(fdb, COLLECTIONS.products, id))));
      toast.success(`${ids.length} product${ids.length > 1 ? "s" : ""} deleted.`);
      setSelected([]);
    } catch {
      toast.error("Delete failed.");
    }
  };

  const bulkPublish = async (published: boolean) => {
    const fdb = db;
    if (!fdb || selected.length === 0) return;
    try {
      await Promise.all(selected.map((id) => updateDoc(doc(fdb, COLLECTIONS.products, id), { published })));
      toast.success(`${selected.length} product${selected.length > 1 ? "s" : ""} ${published ? "published" : "moved to draft"}.`);
      setSelected([]);
    } catch {
      toast.error("Update failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Product management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Products" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${filtered.length} of ${products.length} products`}
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Link>
          </Button>
        }
      />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, SKU, tags…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5">
            <span className="text-sm font-medium">{selected.length} selected</span>
            <Button size="sm" variant="ghost" onClick={() => void bulkPublish(true)}>
              <Eye className="mr-1 h-3.5 w-3.5" /> Publish
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void bulkPublish(false)}>
              <EyeOff className="mr-1 h-3.5 w-3.5" /> Draft
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(selected)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different search, or add your first product."
          action={
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" /> Add product
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pageItems.length > 0 && pageItems.every((p) => selected.includes(p.id))}
                      onCheckedChange={() => toggleSelectAll()}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium hover:text-primary">{p.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{catMap.get(p.categoryId) ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{formatPKR(p.basePrice)}</TableCell>
                    <TableCell>
                      {(() => {
                        const threshold = p.lowStockThreshold ?? 10;
                        const hasCombos = (p.combinations?.length ?? 0) > 0;
                        const stock = p.baseStock ?? 0;
                        const isLow = hasCombos
                          ? p.combinations.some((c) => c.stock <= threshold)
                          : stock <= threshold;
                        return (
                          <span className="flex items-center gap-2">
                            <span className={isLow ? "font-bold text-amber-600" : ""}>
                              {hasCombos ? `— (${p.combinations.length} combos)` : stock}
                            </span>
                            {isLow && (
                              <Badge variant="destructive" className="text-[10px]">
                                Low
                              </Badge>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.published ? "default" : "secondary"}>
                        {p.published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(p.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild>
                          <Link href={`/admin/products/${p.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setConfirmDelete([p.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete product(s)?"
        description={`This will permanently delete ${confirmDelete?.length ?? 0} product(s). This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) void bulkDelete(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

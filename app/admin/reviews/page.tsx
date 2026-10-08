"use client";

/**
 * Reviews moderation: approve, reject or delete customer reviews.
 * Only approved reviews are shown on the storefront.
 */
import { useMemo, useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Check, X, Trash2 } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Review } from "@/lib/types";
import { useCollection, fmtDateTime, shortId, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { Stars } from "@/components/customer/stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Filter = "all" | "approved" | "pending";

export default function ReviewsPage() {
  const { data: reviews, loading } = useCollection<Review>(COLLECTIONS.reviews);
  const [filter, setFilter] = useState<Filter>("pending");
  const [confirmDelete, setConfirmDelete] = useState<Review | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(
    () => reviews.slice().sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)),
    [reviews]
  );
  const counts = useMemo(
    () => ({
      all: reviews.length,
      approved: reviews.filter((r) => r.approved).length,
      pending: reviews.filter((r) => !r.approved).length,
    }),
    [reviews]
  );
  const visible = useMemo(
    () =>
      sorted.filter((r) =>
        filter === "all" ? true : filter === "approved" ? r.approved : !r.approved
      ),
    [sorted, filter]
  );

  const setApproved = async (r: Review, approved: boolean) => {
    if (!db) return;
    setBusy(r.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.reviews, r.id), { approved });
      toast.success(approved ? "Review approved — now visible on the storefront." : "Review rejected — hidden from the storefront.");
    } catch {
      toast.error("Could not update review.");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.reviews, confirmDelete.id));
      toast.success("Review deleted.");
    } catch {
      toast.error("Could not delete review.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Reviews" />;
  if (loading)
    return (
      <>
        <PageHeader title="Reviews" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Moderate customer reviews. Only approved reviews appear on the storefront."
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending <Badge className="ml-1.5 bg-amber-500">{counts.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved <Badge className="ml-1.5 bg-emerald-600">{counts.approved}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "pending" ? "No pending reviews" : "No reviews yet"}
          description={
            filter === "pending"
              ? "New customer reviews will appear here for approval."
              : "Customer reviews will appear here once submitted."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Review</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-sm">
                        <p className="font-medium">{r.userName}</p>
                        {r.title && (
                          <p className="mt-0.5 text-sm font-semibold">{r.title}</p>
                        )}
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                          {r.comment}
                        </p>
                        {r.images && r.images.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.images.map((src) => (
                              <a key={src} href={src} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt="Review photo"
                                  className="h-12 w-12 rounded-lg border object-cover transition hover:opacity-80"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                          {shortId(r.productId)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <Stars rating={r.rating} size={13} />
                          <span className="text-xs font-semibold">{r.rating}/5</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.approved ? "default" : "secondary"}>
                          {r.approved ? "Approved" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!r.approved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-700 dark:text-emerald-400"
                              disabled={busy === r.id}
                              onClick={() => void setApproved(r, true)}
                            >
                              <Check className="mr-1 h-4 w-4" /> Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-700 dark:text-amber-400"
                              disabled={busy === r.id}
                              onClick={() => void setApproved(r, false)}
                            >
                              <X className="mr-1 h-4 w-4" /> Reject
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setConfirmDelete(r)}
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
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this review?"
        description="This cannot be undone. The customer will not be notified."
        confirmLabel="Delete"
        onConfirm={() => void onDelete()}
      />
    </>
  );
}

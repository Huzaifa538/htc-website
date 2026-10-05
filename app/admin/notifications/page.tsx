"use client";

/**
 * Admin notifications: lists notifications written for the admin
 * (userId === "admin" convention), mark read / mark all / delete.
 */
import { useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { toast } from "sonner";
import { Trash2, CheckCheck, BellRing } from "lucide-react";
import { useEffect } from "react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Notification, WithId } from "@/lib/types";
import { ADMIN_USER_ID } from "../layout";
import { fmtDateTime } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { PageHeader, EmptyState, LoadingState, ConfirmDialog } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  order: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  chat: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  promo: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  system: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<WithId<Notification>[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Notification> | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.notifications),
      where("userId", "==", ADMIN_USER_ID),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id })));
        setLoading(false);
      },
      () => {
        // Permission or query failure: stop the skeleton so the empty
        // state (or an error toast) shows instead of hanging forever.
        setLoading(false);
        toast.error("Could not load notifications.");
      }
    );
  }, []);

  const markRead = async (n: WithId<Notification>) => {
    if (!db || n.read) return;
    await updateDoc(doc(db, COLLECTIONS.notifications, n.id), { read: true });
  };

  const markAllRead = async () => {
    if (!db) return;
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) batch.update(doc(db, COLLECTIONS.notifications, n.id), { read: true });
    await batch.commit();
    toast.success("All notifications marked as read.");
  };

  const doDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.notifications, confirmDelete.id));
      toast.success("Notification deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Notifications" />;
  if (loading)
    return (
      <>
        <PageHeader title="Notifications" />
        <LoadingState rows={6} />
      </>
    );

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread of ${items.length}`}
        actions={
          <Button variant="outline" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="New orders, messages, inquiries and comments will notify you here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 rounded-xl border p-4 transition-colors",
                !n.read && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="rounded-full bg-muted p-2.5">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{n.title}</p>
                  <Badge className={cn("border-0", TYPE_COLORS[n.type] ?? TYPE_COLORS.system)}>
                    {n.type}
                  </Badge>
                  {!n.read && <Badge className="bg-primary">New</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-xs text-primary hover:underline">
                      Open →
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => void markRead(n)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(n)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete notification?"
        description="This notification will be permanently removed."
        onConfirm={() => {
          void doDelete();
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

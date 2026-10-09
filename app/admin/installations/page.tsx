/**
 * Installation bookings: hardware fitting requests from product pages.
 * Confirm, cancel or complete a booking; delete junk entries.
 */
"use client";

import { useMemo, useState } from "react";
import { doc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Check, Trash2, Wrench, X } from "lucide-react";

import { useAuth } from "@/components/providers";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type {
  InstallationBooking,
  InstallationBookingStatus,
} from "@/lib/types";
import { useCollection, fmtDateTime, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatusBadge,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES: InstallationBookingStatus[] = [
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
];

type StatusFilter = "All" | InstallationBookingStatus;

export default function InstallationsPage() {
  const { role } = useAuth();
  const { data: bookings, loading } = useCollection<InstallationBooking>(
    COLLECTIONS.installationBookings
  );

  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      bookings
        .slice()
        .sort((a, b) =>
          a.date === b.date
            ? tsMillis(b.createdAt) - tsMillis(a.createdAt)
            : a.date.localeCompare(b.date)
        ),
    [bookings]
  );

  const counts = useMemo(
    () => ({
      pending: bookings.filter((b) => b.status === "Pending").length,
      confirmed: bookings.filter((b) => b.status === "Confirmed").length,
    }),
    [bookings]
  );

  const visible = useMemo(
    () =>
      sorted.filter(
        (b) =>
          (statusFilter === "All" || b.status === statusFilter) &&
          (!dateFilter || b.date === dateFilter)
      ),
    [sorted, statusFilter, dateFilter]
  );

  /** Viewer role is read-only; fail open while the role is loading. */
  const canManage = role === null || role !== "viewer";

  const setStatus = async (b: InstallationBooking, status: InstallationBookingStatus) => {
    if (!db) return;
    setBusy(b.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.installationBookings, b.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Booking ${status.toLowerCase()}.`);
    } catch {
      toast.error("Could not update booking.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (b: InstallationBooking) => {
    if (!db) return;
    if (!confirm(`Delete the booking for ${b.name}?`)) return;
    setBusy(b.id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.installationBookings, b.id));
      toast.success("Booking deleted.");
    } catch {
      toast.error("Could not delete booking.");
    } finally {
      setBusy(null);
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Installation bookings" />;
  if (loading)
    return (
      <>
        <PageHeader title="Installation Bookings" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Installation Bookings"
        subtitle={`${counts.pending} pending · ${counts.confirmed} confirmed`}
      />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="inst-date-filter" className="text-sm text-muted-foreground">
            Date
          </Label>
          <Input
            id="inst-date-filter"
            type="date"
            className="w-auto"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          )}
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No bookings match"
          description={
            bookings.length === 0
              ? "Installation requests from product pages will appear here."
              : "Try a different date or status filter."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booked</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {b.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.address}, {b.city}
                        </p>
                        {b.notes && (
                          <p className="mt-1 max-w-56 text-xs italic text-muted-foreground">
                            “{b.notes}”
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 text-sm">
                        <span className="flex items-center gap-1.5">
                          <Wrench size={13} className="shrink-0 text-muted-foreground" />
                          <span className="line-clamp-2">{b.productName}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {b.date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {b.timeSlot}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(b.createdAt)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {b.status === "Pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 dark:text-emerald-400"
                                disabled={busy === b.id}
                                onClick={() => setStatus(b, "Confirmed")}
                                title="Confirm"
                              >
                                <Check size={14} />
                              </Button>
                            )}
                            {(b.status === "Pending" || b.status === "Confirmed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-sky-700 dark:text-sky-400"
                                disabled={busy === b.id}
                                onClick={() => setStatus(b, "Completed")}
                                title="Mark completed"
                              >
                                Done
                              </Button>
                            )}
                            {b.status !== "Cancelled" && b.status !== "Completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 dark:text-red-400"
                                disabled={busy === b.id}
                                onClick={() => setStatus(b, "Cancelled")}
                                title="Cancel"
                              >
                                <X size={14} />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              disabled={busy === b.id}
                              onClick={() => remove(b)}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

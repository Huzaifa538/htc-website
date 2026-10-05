"use client";

/**
 * Appointments: consultation requests from the public booking form.
 * Confirm, cancel, complete or reschedule — rescheduling opens a dialog
 * with a date picker and the configured time slots.
 */
import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { CalendarCheck, Check, X, Flag, Pencil } from "lucide-react";

import { useAuth } from "@/components/providers";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Appointment, AppointmentStatus, SiteSettings } from "@/lib/types";
import { useCollection, useDoc, fmtDateTime, tsMillis } from "@/components/admin/firebase";
import { DEFAULT_APPOINTMENT_SLOTS } from "@/components/customer/data-hooks";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES: AppointmentStatus[] = ["Pending", "Confirmed", "Completed", "Cancelled"];

type StatusFilter = "All" | AppointmentStatus;

export default function AppointmentsPage() {
  const { role } = useAuth();
  const { data: appointments, loading } = useCollection<Appointment>(COLLECTIONS.appointments);
  const { data: settings } = useDoc<SiteSettings>(COLLECTIONS.siteSettings, "main");

  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [busy, setBusy] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");

  const slots = useMemo(() => {
    const configured = settings?.appointmentTimeSlots?.map((s) => s.trim()).filter(Boolean);
    return configured && configured.length > 0 ? configured : [...DEFAULT_APPOINTMENT_SLOTS];
  }, [settings]);

  const sorted = useMemo(
    () =>
      appointments
        .slice()
        .sort((a, b) =>
          a.date === b.date
            ? tsMillis(b.createdAt) - tsMillis(a.createdAt)
            : a.date.localeCompare(b.date)
        ),
    [appointments]
  );

  const counts = useMemo(
    () => ({
      pending: appointments.filter((a) => a.status === "Pending").length,
      confirmed: appointments.filter((a) => a.status === "Confirmed").length,
    }),
    [appointments]
  );

  const visible = useMemo(
    () =>
      sorted.filter(
        (a) =>
          (statusFilter === "All" || a.status === statusFilter) &&
          (!dateFilter || a.date === dateFilter)
      ),
    [sorted, statusFilter, dateFilter]
  );

  /** Viewer role is read-only; fail open while the role is loading. */
  const canManage = role === null || role !== "viewer";

  const setStatus = async (a: Appointment, status: AppointmentStatus) => {
    if (!db) return;
    setBusy(a.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.appointments, a.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Appointment ${status.toLowerCase()}.`);
    } catch {
      toast.error("Could not update appointment.");
    } finally {
      setBusy(null);
    }
  };

  const openReschedule = (a: Appointment) => {
    setRescheduleTarget(a);
    setRescheduleDate(a.date);
    setRescheduleSlot(slots.includes(a.timeSlot) ? a.timeSlot : slots[0] ?? "");
  };

  const submitReschedule = async () => {
    if (!db || !rescheduleTarget) return;
    if (!rescheduleDate) {
      toast.error("Please pick a new date.");
      return;
    }
    if (!rescheduleSlot) {
      toast.error("Please pick a time slot.");
      return;
    }
    setBusy(rescheduleTarget.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.appointments, rescheduleTarget.id), {
        date: rescheduleDate,
        timeSlot: rescheduleSlot,
        status: "Confirmed",
        updatedAt: serverTimestamp(),
      });
      toast.success("Appointment rescheduled and confirmed.");
      setRescheduleTarget(null);
    } catch {
      toast.error("Could not reschedule.");
    } finally {
      setBusy(null);
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Appointments" />;
  if (loading)
    return (
      <>
        <PageHeader title="Appointments" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${counts.pending} pending · ${counts.confirmed} confirmed`}
      />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="appt-date-filter" className="text-sm text-muted-foreground">
            Date
          </Label>
          <Input
            id="appt-date-filter"
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
          title="No appointments match"
          description={
            appointments.length === 0
              ? "Consultation requests from the booking form will appear here."
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
                    <TableHead>Date</TableHead>
                    <TableHead>Time slot</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booked</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.phone}</p>
                        {a.email && (
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        )}
                        {a.notes && (
                          <p className="mt-1 max-w-56 text-xs italic text-muted-foreground">
                            “{a.notes}”
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {a.date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {a.timeSlot}
                      </TableCell>
                      <TableCell className="text-sm">{a.serviceType}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(a.createdAt)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {a.status === "Pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 dark:text-emerald-400"
                                disabled={busy === a.id}
                                onClick={() => void setStatus(a, "Confirmed")}
                              >
                                <Check className="mr-1 h-4 w-4" /> Confirm
                              </Button>
                            )}
                            {(a.status === "Pending" || a.status === "Confirmed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === a.id}
                                onClick={() => openReschedule(a)}
                              >
                                <Pencil className="mr-1 h-4 w-4" /> Reschedule
                              </Button>
                            )}
                            {(a.status === "Pending" || a.status === "Confirmed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-700 dark:text-blue-400"
                                disabled={busy === a.id}
                                onClick={() => void setStatus(a, "Completed")}
                              >
                                <Flag className="mr-1 h-4 w-4" /> Complete
                              </Button>
                            )}
                            {(a.status === "Pending" || a.status === "Confirmed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                disabled={busy === a.id}
                                onClick={() => void setStatus(a, "Cancelled")}
                              >
                                <X className="mr-1 h-4 w-4" /> Cancel
                              </Button>
                            )}
                            {(a.status === "Cancelled" || a.status === "Completed") && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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

      {/* reschedule dialog */}
      <Dialog open={rescheduleTarget !== null} onOpenChange={(o) => !o && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" /> Reschedule appointment
            </DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {rescheduleTarget.name} · {rescheduleTarget.phone} — currently{" "}
                <strong>{rescheduleTarget.date}</strong>, {rescheduleTarget.timeSlot}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rs-date">New date</Label>
                  <Input
                    id="rs-date"
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-slot">New time slot</Label>
                  <select
                    id="rs-slot"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={rescheduleSlot}
                    onChange={(e) => setRescheduleSlot(e.target.value)}
                  >
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitReschedule()} disabled={busy !== null}>
              Reschedule & confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
"use client";

/**
 * Staff roster (owner only): list staff members, add (email + role + name)
 * and remove. All mutations go through /api/admin/staff, which verifies the
 * caller's ID token carries owner claims on the server.
 */
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, ShieldAlert, KeyRound } from "lucide-react";

import { useAuth } from "@/components/providers";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { STAFF_ROLE_LABELS, type StaffMember, type StaffRole } from "@/lib/types";
import { useCollection, fmtDateTime, tsMillis } from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import { TextField } from "@/components/admin/FormFields";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({
  email: z.string().email("Enter a valid Gmail address"),
  name: z.string().optional(),
  role: z.enum(["owner", "manager", "staff", "viewer"]),
});
type FormValues = z.input<typeof schema>;

const ROLE_BADGE: Record<StaffRole, string> = {
  owner: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  staff: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function StaffPage() {
  const { user, role, loading: authLoading } = useAuth();
  const { data: staff, loading } = useCollection<StaffMember>(COLLECTIONS.staff);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", role: "staff" },
  });
  const { control, handleSubmit, reset, watch, setValue } = form;

  const sorted = useMemo(
    () => staff.slice().sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)),
    [staff]
  );

  /** Owner-only page: fail open while the role claim is still loading. */
  const isOwner = role === null || role === "owner";

  const callApi = async (method: "POST" | "DELETE", payload: Record<string, unknown>) => {
    if (!user) throw new Error("Not signed in");
    // Force-refresh so the ID token carries the latest role claims.
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/admin/staff", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, ...payload }),
    });
    const data: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
  };

  const openCreate = () => {
    reset({ email: "", name: "", role: "staff" });
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await callApi("POST", {
        email: values.email,
        name: values.name?.trim() || undefined,
        role: values.role,
      });
      toast.success("Staff member added — ask them to sign in again to pick up their role.");
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add staff member");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await callApi("DELETE", { email: confirmDelete.email });
      toast.success("Staff member removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove staff member");
    }
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Staff management" />;
  if (loading || authLoading)
    return (
      <>
        <PageHeader title="Staff" />
        <LoadingState rows={6} />
      </>
    );

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="rounded-full bg-destructive/10 p-5">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Owner only</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Only the account owner can manage the staff roster.
        </p>
      </div>
    );
  }

  const selfEmail = user?.email?.toLowerCase();

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Grant dashboard access with role-based permissions. New members must sign in with Google once added."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add member
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No staff members yet"
          description="Add managers, staff or viewers to share the workload."
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add member
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.email}</TableCell>
                      <TableCell className="text-muted-foreground">{m.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${ROLE_BADGE[m.role]} border-0`}>
                          {STAFF_ROLE_LABELS[m.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.active ? "default" : "secondary"}>
                          {m.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          disabled={m.email.toLowerCase() === selfEmail}
                          title={
                            m.email.toLowerCase() === selfEmail
                              ? "You cannot remove yourself"
                              : "Remove member"
                          }
                          onClick={() => setConfirmDelete(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Add staff member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={control}
              name="email"
              label="Gmail address"
              placeholder="member@gmail.com"
              hint="They sign in with this Google account"
            />
            <TextField
              control={control}
              name="name"
              label="Name (optional)"
              placeholder="e.g. Ahmed Khan"
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={watch("role")}
                onChange={(e) => setValue("role", e.target.value as StaffRole)}
              >
                {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                    {r === "owner" && " — full access"}
                    {r === "manager" && " — everything except settings & staff"}
                    {r === "staff" && " — day-to-day operations"}
                    {r === "viewer" && " — read-only"}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding…" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Remove staff member?"
        description={`${confirmDelete?.email} will lose dashboard access immediately (their next sign-in will no longer mint an admin session).`}
        confirmLabel="Remove"
        onConfirm={() => void onDelete()}
      />

      {/* role reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What each role can do</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p><strong className="text-foreground">Owner</strong> — full access, manages staff and site settings.</p>
          <p><strong className="text-foreground">Manager</strong> — everything except site settings and staff.</p>
          <p><strong className="text-foreground">Staff</strong> — day-to-day operations: orders, messages, appointments, reviews, products.</p>
          <p><strong className="text-foreground">Viewer</strong> — read-only overview of operations pages.</p>
        </CardContent>
      </Card>
    </>
  );
}

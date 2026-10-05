"use client";

/**
 * Expenses ledger: monthly totals, per-category breakdown, and
 * add/edit/delete of expense records (COLLECTIONS.expenses).
 *
 * Expense doc: { date (Timestamp), category, amount, note?, receiptUrl?,
 * addedBy, createdAt }. Rules already allow owner/manager.
 */
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2, Wallet } from "lucide-react";

import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Expense, ExpenseCategory, WithId } from "@/lib/types";
import { formatPKR } from "@/lib/format";
import { useAuth } from "@/components/providers";
import {
  useCollection,
  fmtDate,
  tsMillis,
  timestampToDateInput,
  downloadCsv,
} from "@/components/admin/firebase";
import SetupWarning from "@/components/admin/SetupWarning";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatCard,
  ConfirmDialog,
} from "@/components/admin/ui";
import { TextField } from "@/components/admin/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const EXPENSE_CATEGORIES = [
  "Rent",
  "Salary",
  "Utilities",
  "Stock",
  "Marketing",
  "Transport",
  "Other",
] as const;

const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  note: z.string().optional(),
  receiptUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type ExpenseValues = z.input<typeof expenseSchema>;

function currentMonthInput(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
  });
}

export default function ExpensesPage() {
  const { data: expenses, loading } = useCollection<Expense>(COLLECTIONS.expenses);
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthInput);

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<WithId<Expense> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Expense> | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: "Other",
      amount: 0,
      note: "",
      receiptUrl: "",
    },
  });
  const { control, handleSubmit, reset } = form;

  const monthExpenses = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return expenses
      .filter((e) => {
        const d = e.date instanceof Timestamp ? e.date.toDate() : null;
        return d != null && d.getFullYear() === y && d.getMonth() + 1 === m;
      })
      .sort((a, b) => tsMillis(b.date) - tsMillis(a.date));
  }, [expenses, month]);

  const monthTotal = useMemo(
    () => monthExpenses.reduce((s, e) => s + (e.amount ?? 0), 0),
    [monthExpenses]
  );

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + (e.amount ?? 0));
    }
    return EXPENSE_CATEGORIES.map((c) => ({ category: c, total: map.get(c) ?? 0 })).filter(
      (r) => r.total > 0
    );
  }, [monthExpenses]);

  const openCreate = () => {
    setEditing(null);
    reset({
      date: new Date().toISOString().slice(0, 10),
      category: "Other",
      amount: 0,
      note: "",
      receiptUrl: "",
    });
    setDialog(true);
  };

  const openEdit = (e: WithId<Expense>) => {
    setEditing(e);
    reset({
      date: timestampToDateInput(e.date),
      category: e.category,
      amount: e.amount,
      note: e.note ?? "",
      receiptUrl: e.receiptUrl ?? "",
    });
    setDialog(true);
  };

  const onSubmit = async (values: ExpenseValues) => {
    setSaving(true);
    try {
      // Expense writes are server-side (POST/PATCH /api/admin/expenses):
      // the API validates with zod and converts the date to a Timestamp.
      const body = {
        date: values.date,
        category: values.category,
        amount: Number(values.amount),
        ...(values.note?.trim() ? { note: values.note.trim() } : {}),
        ...(values.receiptUrl?.trim()
          ? { receiptUrl: values.receiptUrl.trim() }
          : {}),
        ...(user?.email ? { addedBy: user.email } : {}),
      };
      const res = await fetch("/api/admin/expenses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { id: editing.id, ...body } : body
        ),
      });
      const result = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        details?: { path: string; message: string }[];
      } | null;
      if (!res.ok || !result?.ok) {
        throw new Error(
          result?.details?.[0]?.message || result?.error || "save-failed"
        );
      }
      toast.success(editing ? "Expense updated." : "Expense added.");
      setDialog(false);
    } catch (e) {
      const message =
        e instanceof Error && e.message !== "save-failed"
          ? e.message
          : "Save failed. Please try again.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!db || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.expenses, confirmDelete.id));
      toast.success("Expense deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Date", "Category", "Amount (PKR)", "Note", "Receipt", "Added by"],
    ];
    for (const e of monthExpenses) {
      rows.push([
        timestampToDateInput(e.date),
        e.category,
        e.amount ?? 0,
        e.note ?? "",
        e.receiptUrl ?? "",
        e.addedBy ?? "",
      ]);
    }
    rows.push([]);
    rows.push(["Month total (PKR)", monthTotal]);
    downloadCsv(`htc-expenses-${month}.csv`, rows);
  };

  if (!isFirebaseConfigured()) return <SetupWarning feature="Expense management" />;
  if (loading)
    return (
      <>
        <PageHeader title="Expenses" />
        <LoadingState rows={8} />
      </>
    );

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Business expense ledger (kharcha)"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={monthExpenses.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="exp-month" className="text-xs">Month</Label>
          <Input
            id="exp-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          Showing {monthLabel(month)} · {monthExpenses.length} expense{monthExpenses.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title={`${monthLabel(month)} total`}
          value={monthTotal}
          format={formatPKR}
          icon={Wallet}
          subtitle="All categories combined"
        />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No expenses this month.
              </p>
            ) : (
              <div className="space-y-3">
                {byCategory.map((r) => (
                  <div key={r.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{r.category}</span>
                      <span className="font-semibold">{formatPKR(r.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${monthTotal > 0 ? (r.total / monthTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {monthExpenses.length === 0 ? (
        <EmptyState
          title="No expenses this month"
          description="Add the first expense with the button above."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add expense</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPKR(e.amount)}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                    {e.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.addedBy ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} aria-label="Edit expense">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(e)} aria-label="Delete expense">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* add/edit dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>
              Record a business expense for the ledger.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name="date" label="Date" type="date" />
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <TextField control={control} name="amount" label="Amount (PKR)" type="number" placeholder="e.g. 15000" />
            <TextField control={control} name="note" label="Note" placeholder="e.g. Shop rent for October" />
            <TextField
              control={control}
              name="receiptUrl"
              label="Receipt URL"
              placeholder="https://…"
              hint="Optional — link to a receipt photo"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete expense?"
        description={`This will permanently delete the ${formatPKR(confirmDelete?.amount)} ${confirmDelete?.category} expense from ${confirmDelete ? fmtDate(confirmDelete.date) : ""}.`}
        onConfirm={onDelete}
      />
    </>
  );
}

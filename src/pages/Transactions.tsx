import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useEditFormDialog, useDeleteDialog } from "@/hooks/useFormState";
import { transactionSchema, type TransactionFormData } from "@/lib/schemas";
import { handleSupabaseError, handleFormError } from "@/lib/errors";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function Transactions() {
  type TxnRow = {
    id: string;
    txn_code?: string | null;
    txn_date?: string | null;
    details?: string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    account_id?: string | null;
    created_by?: string | null;
    accounts?: { name?: string | null; account_no?: string | null; currency?: string | null } | null;
  };

  const [rows, setRows] = useState<TxnRow[] | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { role, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  // Edit form with react-hook-form
  const editForm = useEditFormDialog<TransactionFormData, TxnRow>({
    schema: transactionSchema,
    defaultValues: {
      txn_date: "",
      details: "",
      debit: "",
      credit: "",
      notes: "",
    },
    onSuccess: async (data) => {
      setBusy(true);
      try {
        const debit = Number(data.debit || 0);
        const credit = Number(data.credit || 0);

        const { error: dbError } = await supabase.from("transactions").update({
          txn_date: data.txn_date,
          details: data.details.trim(),
          debit,
          credit,
        }).eq("id", editForm.editingItem?.id);

        if (dbError) throw dbError;
        toast.success("Transaction updated");
        editForm.closeDialog();
        load(true);
      } catch (err: unknown) {
        handleFormError(err, "Update Transaction");
      } finally {
        setBusy(false);
      }
    },
  });

  // Delete dialog with confirmation
  const deleteDialog = useDeleteDialog<TxnRow>();

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const load = useCallback(async (reset = false, pageOverride?: number) => {
    const nextPage = reset ? 0 : (pageOverride ?? page);
    const start = nextPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    setBusy(true);
    let query = supabase.from("transactions")
      .select("id, txn_code, txn_date, details, debit, credit, account_id, created_by, accounts(name, account_no, currency)")
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(start, end);

    if (from) query = query.gte("txn_date", from);
    if (to) query = query.lte("txn_date", to);
    if (debouncedQ) {
      const term = debouncedQ.trim();
      query = query.or(`txn_code.ilike.%${term}%,details.ilike.%${term}%,accounts.name.ilike.%${term}%,accounts.account_no.ilike.%${term}%`);
    }

    const { data } = await query;

    if (data) {
      setRows(reset ? data : (prev) => [...(prev ?? []), ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(nextPage + 1);
    }
    setBusy(false);
  }, [from, to, debouncedQ, page]);

  // Keep a ref to the latest `load` so subscription handlers call the current implementation
  const loadRef = useRef<typeof load | null>(null);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    load(true);
    const sub = supabase.channel('txns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        (loadRef.current ?? load)(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  useEffect(() => {
    setHasMore(true);
    load(true);
  }, [debouncedQ, from, to, load]);

  const editErrors = editForm.form.formState.errors;

  const removeTx = async () => {
    if (!deleteDialog.itemToDelete) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", deleteDialog.itemToDelete.id);
      if (error) throw error;
      toast.success("Transaction deleted");
      deleteDialog.closeDialog();
      load(true);
    } catch (err: unknown) {
      handleSupabaseError(err, { operation: "deleteTransaction", table: "transactions", userId: profile?.id });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Activity</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Transactions</h1>
        </div>
        <Link to="/transactions/new"><Button className="gradient-primary text-primary-foreground shadow-soft"><Plus className="w-4 h-4 mr-1" /> New Transaction</Button></Link>
      </div>

      <Card className="glass p-4 grid md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, account, details..." className="pl-10" />
          </div>
        </div>
        <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </Card>

      {!rows ? (
        <div className="grid gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Code</th>
                  <th className="text-left font-medium px-4 py-3">Account</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Details</th>
                   <th className="text-right font-medium px-4 py-3">Debit</th>
                  <th className="text-right font-medium px-4 py-3">Credit</th>
                  {role === "admin" && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).length === 0 ? (
                  <tr><td colSpan={role === "admin" ? 7 : 6} className="text-center py-12 text-muted-foreground text-sm">No transactions match.</td></tr>
                ) : (rows ?? []).map((t: TxnRow) => (
                  <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 num whitespace-nowrap">{formatDate(t.txn_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.txn_code}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.accounts?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.accounts?.account_no}</div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground truncate max-w-md">{t.details}</td>
                    <td className="px-4 py-2.5 text-right num text-destructive">{Number(t.debit) > 0 ? formatMoney(Number(t.debit), t.accounts?.currency) : "-"}</td>
                    <td className="px-4 py-2.5 text-right num text-success">{Number(t.credit) > 0 ? formatMoney(Number(t.credit), t.accounts?.currency) : "-"}</td>
                    {(role === "admin" || t.created_by === profile?.id) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editForm.openDialog(t)} aria-label="Edit transaction"><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDialog.openDialog(t)} aria-label="Delete transaction"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-4 border-t border-border/50 text-center">
              <Button variant="ghost" size="sm" onClick={() => load()} disabled={busy}>
                {busy ? "Loading..." : "Load More Transactions"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Edit Transaction Dialog */}
      <Dialog open={editForm.open} onOpenChange={(o) => !o && editForm.closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          <form onSubmit={editForm.form.handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...editForm.form.register("txn_date")} />
              {editErrors.txn_date && (
                <p className="text-sm font-medium text-destructive">{editErrors.txn_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Input {...editForm.form.register("details")} />
              {editErrors.details && (
                <p className="text-sm font-medium text-destructive">{editErrors.details.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Debit (Nikala / Diya)</Label>
                <Input type="number" step="0.01" min="0" {...editForm.form.register("debit")} />
                {editErrors.debit && (
                  <p className="text-sm font-medium text-destructive">{editErrors.debit.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Credit (Jama / Liya)</Label>
                <Input type="number" step="0.01" min="0" {...editForm.form.register("credit")} />
                {editErrors.credit && (
                  <p className="text-sm font-medium text-destructive">{editErrors.credit.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || editForm.form.isSubmitting} className="gradient-primary text-primary-foreground">
                {busy || editForm.form.isSubmitting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Transaction"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => !o && deleteDialog.closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction from <strong>{formatDate(deleteDialog.itemToDelete?.txn_date)}</strong>? This will update the running balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeTx} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Transaction</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

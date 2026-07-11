import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, RefreshCw, Trash2, Pencil, Loader, PlayCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

type RecurringTxn = {
  id: string;
  account_id: string;
  amount: number;
  type: "debit" | "credit";
  details: string | null;
  frequency: "daily" | "weekly" | "monthly";
  next_run_date: string;
  active: boolean;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  accounts?: { name?: string; account_no?: string; currency?: string } | null;
};

export default function RecurringTransactions() {
  const { profile, role } = useAuth();
  const [rows, setRows] = useState<RecurringTxn[] | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string; account_no: string; currency: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTxn | null>(null);
  const [deleting, setDeleting] = useState<RecurringTxn | null>(null);
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  const [form, setForm] = useState({
    account_id: "",
    amount: "",
    type: "debit" as "debit" | "credit",
    details: "",
    frequency: "monthly" as "daily" | "weekly" | "monthly",
    next_run_date: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_transactions")
      .select("*, accounts(name, account_no, currency)")
      .order("next_run_date", { ascending: true });
    setRows(data as RecurringTxn[] ?? []);
  }, []);

  useEffect(() => {
    load();
    supabase
      .from("accounts")
      .select("id, name, account_no, currency")
      .then(r => setAccounts((r.data as any[]) ?? []));

    const sub = supabase.channel("recurring-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_transactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const pending = (rows ?? []).filter(r => r.active && r.next_run_date <= today);

  const openAdd = () => {
    setEditing(null);
    setForm({
      account_id: "",
      amount: "",
      type: "debit",
      details: "",
      frequency: "monthly",
      next_run_date: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const openEdit = (r: RecurringTxn) => {
    setEditing(r);
    setForm({
      account_id: r.account_id,
      amount: String(r.amount),
      type: r.type,
      details: r.details ?? "",
      frequency: r.frequency,
      next_run_date: r.next_run_date,
    });
    setOpen(true);
  };

  const computeNextDate = (frequency: string, from: string): string => {
    const d = new Date(from);
    if (frequency === "daily") d.setDate(d.getDate() + 1);
    else if (frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_id || !form.amount || !form.frequency) {
      toast.error("Please fill all required fields");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        account_id: form.account_id,
        amount: Number(form.amount),
        type: form.type,
        details: form.details.trim() || null,
        frequency: form.frequency,
        next_run_date: form.next_run_date,
        branch_id: profile?.branch_id ?? null,
        created_by: profile?.id ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("recurring_transactions").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("recurring_transactions").insert([payload]);
        if (error) throw error;
        toast.success("Recurring transaction created");
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); setDeleting(null); load(); }
  };

  const toggleActive = async (r: RecurringTxn) => {
    const { error } = await supabase.from("recurring_transactions").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  const executeOne = async (r: RecurringTxn) => {
    setExecuting(r.id);
    try {
      const { error } = await supabase.from("transactions").insert([{
        account_id: r.account_id,
        txn_code: "",
        txn_date: today,
        details: r.details ?? `Recurring: ${r.frequency}`,
        debit: r.type === "debit" ? r.amount : 0,
        credit: r.type === "credit" ? r.amount : 0,
        created_by: profile?.id ?? null,
      }]);
      if (error) throw error;

      const nextDate = computeNextDate(r.frequency, today);
      await supabase.from("recurring_transactions").update({ next_run_date: nextDate }).eq("id", r.id);
      toast.success(`Executed! Next run: ${nextDate}`);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Execution failed");
    }
    setExecuting(null);
  };

  const executeAll = async () => {
    if (pending.length === 0) return;
    setBusy(true);
    let success = 0;
    for (const r of pending) {
      try {
        const { error } = await supabase.from("transactions").insert([{
          account_id: r.account_id,
          txn_code: "",
          txn_date: today,
          details: r.details ?? `Recurring: ${r.frequency}`,
          debit: r.type === "debit" ? r.amount : 0,
          credit: r.type === "credit" ? r.amount : 0,
          created_by: profile?.id ?? null,
        }]);
        if (!error) {
          const nextDate = computeNextDate(r.frequency, today);
          await supabase.from("recurring_transactions").update({ next_run_date: nextDate }).eq("id", r.id);
          success++;
        }
      } catch {}
    }
    toast.success(`Executed ${success} of ${pending.length} recurring transactions`);
    load();
    setBusy(false);
  };

  const freqBadge = (f: string) => {
    if (f === "daily") return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-400/30">Daily</Badge>;
    if (f === "weekly") return <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-400/30">Weekly</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Monthly</Badge>;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Automation"
        title={<span className="flex items-center gap-2"><RefreshCw className="w-7 h-7 text-primary" /> Recurring Transactions</span>}
        description="Set up automatic transactions that run on a schedule."
        actions={
          <Button onClick={openAdd} className="gradient-primary text-primary-foreground shadow-soft">
            <Plus className="w-4 h-4 mr-1" /> New Recurring
          </Button>
        }
      />

      {/* Pending Alert */}
      {pending.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-500">{pending.length} Pending Recurring Transaction{pending.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">These transactions are due today or overdue. Click to execute all at once.</p>
            </div>
          </div>
          <Button
            onClick={executeAll}
            disabled={busy}
            className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
          >
            {busy ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Execute All ({pending.length})
          </Button>
        </div>
      )}

      {/* Table */}
      {!rows ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="glass p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 border-primary/20">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold mb-1">No recurring transactions yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Set up automatic transactions for rent, salaries, or any repeating entry.</p>
            <Button onClick={openAdd} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Create First Recurring Transaction
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Account</th>
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Details</th>
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Amount</th>
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Frequency</th>
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Next Run</th>
                  <th className="text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Status</th>
                  <th className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isDue = r.active && r.next_run_date <= today;
                  return (
                    <tr key={r.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isDue ? "bg-amber-500/5" : ""}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-sm">{r.accounts?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.accounts?.account_no}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate">{r.details ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold num text-sm ${r.type === "debit" ? "text-destructive" : "text-emerald-500"}`}>
                          {r.type === "debit" ? "−" : "+"}{formatMoney(r.amount, r.accounts?.currency ?? "PKR")}
                        </span>
                      </td>
                      <td className="py-3 px-4">{freqBadge(r.frequency)}</td>
                      <td className="py-3 px-4">
                        <div className={`flex items-center gap-1.5 text-xs ${isDue ? "text-amber-500 font-semibold" : "text-muted-foreground"}`}>
                          {isDue ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {formatDate(r.next_run_date)}
                          {isDue && <span className="text-[10px] bg-amber-500/20 px-1 rounded">DUE</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(r)}
                          className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 border transition-colors ${r.active ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-muted-foreground border-border hover:bg-muted/30"}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {r.active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {isDue && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500 hover:bg-amber-500/10" disabled={executing === r.id} onClick={() => executeOne(r)}>
                              {executing === r.id ? <Loader className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10" onClick={() => openEdit(r)}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/10" onClick={() => setDeleting(r)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              {editing ? "Edit Recurring Transaction" : "New Recurring Transaction"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account <span className="text-destructive">*</span></Label>
              <Select value={form.account_id} onValueChange={v => setForm(p => ({ ...p, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_no})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as "debit" | "credit" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit (Nikala)</SelectItem>
                    <SelectItem value="credit">Credit (Jama)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
            </div>
            <div className="space-y-1.5">
              <Label>Details / Description</Label>
              <Input value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))} placeholder="e.g. Monthly rent payment" />
            </div>
            <div className="space-y-1.5">
              <Label>First / Next Run Date</Label>
              <Input type="date" value={form.next_run_date} onChange={e => setForm(p => ({ ...p, next_run_date: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
                {busy ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Saving...</> : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the recurring schedule for <strong>{deleting?.details ?? "this transaction"}</strong>. No future transactions will be created automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

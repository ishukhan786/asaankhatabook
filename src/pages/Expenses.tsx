import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Receipt, Search, Trash2, Pencil, Calendar, Loader } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/PageHeader";

const CATEGORIES = ["Rent", "Salaries", "Electricity Bill", "Internet Bill", "Tea / Food", "Stationery", "Maintenance", "Others"];

export default function Expenses() {
  const { role, profile } = useAuth();
  type ExpenseRow = {
    id: string;
    category: string;
    description?: string | null;
    amount: number | string;
    currency?: string | null;
    expense_date?: string | null;
    branch_id?: string | null;
    created_by?: string | null;
    branches?: { name?: string | null } | null;
  };

  const [rows, setRows] = useState<ExpenseRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  
  // Add/Edit state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount: "",
    currency: "PKR",
    expense_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const { data, error } = await supabase.from("expenses").select("*, branches(name)").order("expense_date", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    const sub = supabase.channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.category || !form.amount || !profile?.branch_id) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Expense amount must be greater than zero");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        category: form.category,
        description: form.description.trim(),
        amount,
        currency: form.currency,
        expense_date: form.expense_date,
        branch_id: profile.branch_id,
        created_by: profile.id
      };

      const { error } = editing 
        ? await supabase.from("expenses").update(payload).eq("id", editing.id)
        : await supabase.from("expenses").insert([payload]);

      if (error) throw error;
      toast.success(editing ? "Expense updated" : "Expense recorded");
      setOpen(false);
      setEditing(null);
      setForm({ ...form, description: "", amount: "" });
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : String(err); toast.error(msg); }
    setBusy(false);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Expense deleted");
      setDeleting(null);
      load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : String(err); toast.error(msg); }
  };

  const filtered = (rows ?? []).filter(r => {
    if (q && !r.category.toLowerCase().includes(q.toLowerCase()) && !String(r.description ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (from && r.expense_date < from) return false;
    if (to && r.expense_date > to) return false;
    return true;
  });

  const total = filtered.reduce((acc: Record<string, number>, r) => {
    const cur = r.currency ?? "PKR";
    acc[cur] = (acc[cur] || 0) + Number(r.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title={<span className="flex items-center gap-2"><Receipt className="w-7 h-7 text-primary" /> Business Expenses</span>}
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gradient-primary text-primary-foreground shadow-soft">
            <Plus className="w-4 h-4 mr-1" /> Record Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass p-4 md:col-span-2 grid md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs" />
          </div>
        </Card>
        <Card className="glass p-4 bg-primary/5 border-primary/20 flex flex-col justify-center">
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Total in view</div>
          <div className="text-xl font-display font-black text-primary">
            {Object.entries(total).map(([cur, val]: [string, number]) => (
              <div key={cur}>{formatMoney(val, cur)}</div>
            ))}
            {Object.keys(total).length === 0 && "PKR 0.00"}
          </div>
        </Card>
      </div>

      {!rows ? (
        <div className="grid gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : (
        <Card className="glass overflow-hidden shadow-xl border-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-6 py-4 font-medium">Date</th>
                  <th className="text-left px-6 py-4 font-medium">Category</th>
                  <th className="text-left px-6 py-4 font-medium">Description</th>
                  <th className="text-left px-6 py-4 font-medium hidden md:table-cell">Branch</th>
                  <th className="text-right px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No expenses found.</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{formatDate(r.expense_date)}</td>
                    <td className="px-6 py-4 font-bold">{r.category}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.description}</td>
                    <td className="px-6 py-4 hidden md:table-cell"><Badge variant="secondary">{r.branches?.name}</Badge></td>
                    <td className="px-6 py-4 text-right font-display font-bold text-destructive">{formatMoney(r.amount, r.currency)}</td>
                    <td className="px-6 py-4 text-right">
                      {(role === "admin" || r.created_by === profile?.id) && (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setForm({ category: r.category, description: r.description ?? "", amount: r.amount.toString(), currency: r.currency ?? "PKR", expense_date: r.expense_date ?? new Date().toISOString().slice(0, 10) }); setOpen(true); }} aria-label="Edit expense"><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} aria-label="Delete expense"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if(!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-[425px] glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> {editing ? "Edit Expense" : "Record New Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Choose category..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Currency *</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PKR">PKR</SelectItem><SelectItem value="AED">AED</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
            </div>
            <div className="space-y-1.5">
              <Label>Description / Notes</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-soft">
                {busy ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editing ? "Update Expense" : "Save Expense"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleting?.category} expense of <strong>{formatMoney(deleting?.amount ?? 0, deleting?.currency)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Expense</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

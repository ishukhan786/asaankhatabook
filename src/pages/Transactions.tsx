import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { role } = useAuth();
  const [busy, setBusy] = useState(false);

  // Edit/Delete state
  const [editingTx, setEditingTx] = useState<any>(null);
  const [etDate, setEtDate] = useState("");
  const [etDetails, setEtDetails] = useState("");
  const [etDebit, setEtDebit] = useState("");
  const [etCredit, setEtCredit] = useState("");
  const [deletingTx, setDeletingTx] = useState<any>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const load = async (reset = false) => {
    const start = reset ? 0 : page * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    
    setBusy(true);
    const { data } = await supabase.from("transactions")
      .select("id, txn_code, txn_date, details, debit, credit, account_id, accounts(name, account_no, currency)")
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(start, end);
      
    if (data) {
      setRows(reset ? data : [...(rows ?? []), ...data]);
      setHasMore(data.length === PAGE_SIZE);
      if (!reset) setPage(page + 1);
      else setPage(1);
    }
    setBusy(false);
  };

  useEffect(() => { load(true); }, []);

  const openEditTx = (t: any) => {
    setEditingTx(t);
    setEtDate(t.txn_date);
    setEtDetails(t.details ?? "");
    setEtDebit(t.debit.toString());
    setEtCredit(t.credit.toString());
  };

  const submitEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").update({
        txn_date: etDate,
        details: etDetails.trim(),
        debit: Number(etDebit) || 0,
        credit: Number(etCredit) || 0,
      }).eq("id", editingTx.id);
      if (error) throw error;
      toast.success("Transaction updated");
      setEditingTx(null);
      load(true);
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const removeTx = async () => {
    if (!deletingTx) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", deletingTx.id);
      if (error) throw error;
      toast.success("Transaction deleted");
      setDeletingTx(null);
      load(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    if (debouncedQ && !r.txn_code.toLowerCase().includes(debouncedQ.toLowerCase()) && !r.details.toLowerCase().includes(debouncedQ.toLowerCase()) && !r.accounts?.name?.toLowerCase().includes(debouncedQ.toLowerCase())) return false;
    if (from && r.txn_date < from) return false;
    if (to && r.txn_date > to) return false;
    return true;
  }), [rows, q, from, to]);

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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, account, details…" className="pl-10" />
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
                {filtered.length === 0 ? (
                  <tr><td colSpan={role === "admin" ? 7 : 6} className="text-center py-12 text-muted-foreground text-sm">No transactions match.</td></tr>
                ) : filtered.map((t: any) => (
                  <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 num whitespace-nowrap">{formatDate(t.txn_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.txn_code}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.accounts?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.accounts?.account_no}</div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground truncate max-w-md">{t.details}</td>
                    <td className="px-4 py-2.5 text-right num text-destructive">{Number(t.debit) > 0 ? formatMoney(Number(t.debit), t.accounts?.currency) : "—"}</td>
                    <td className="px-4 py-2.5 text-right num text-success">{Number(t.credit) > 0 ? formatMoney(Number(t.credit), t.accounts?.currency) : "—"}</td>
                    {role === "admin" && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTx(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingTx(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
      <Dialog open={!!editingTx} onOpenChange={(o) => !o && setEditingTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          <form onSubmit={submitEditTx} className="space-y-4">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={etDate} onChange={(e) => setEtDate(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Details</Label><Input value={etDetails} onChange={(e) => setEtDetails(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Debit (Nikala / Diya)</Label><Input type="number" step="0.01" value={etDebit} onChange={(e) => setEtDebit(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Credit (Jama / Liya)</Label><Input type="number" step="0.01" value={etCredit} onChange={(e) => setEtCredit(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">Update Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation */}
      <AlertDialog open={!!deletingTx} onOpenChange={(o) => !o && setDeletingTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction from <strong>{formatDate(deletingTx?.txn_date)}</strong>? This will update the running balance.
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

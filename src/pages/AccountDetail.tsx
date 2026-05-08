import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileDown, Plus, Phone, MapPin, Building2, Trash2, AlertCircle, Pencil, MessageSquare } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { exportStatementPDF } from "@/lib/pdf";
import { useAuth } from "@/hooks/useAuth";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const [account, setAccount] = useState<any | null>(null);
  const [txns, setTxns] = useState<any[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  // Edit Transaction state
  const [editingTx, setEditingTx] = useState<any>(null);
  const [etDate, setEtDate] = useState("");
  const [etDetails, setEtDetails] = useState("");
  const [etDebit, setEtDebit] = useState("");
  const [etCredit, setEtCredit] = useState("");
  
  // Deletion state
  const [deletingTx, setDeletingTx] = useState<any>(null);
  
  // Quick Entry state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({
    txn_date: new Date().toISOString().slice(0, 10),
    details: "",
    notes: "",
    debit: "",
    credit: "",
  });

  const load = async () => {
    if (!id) return;
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from("accounts").select("*, branches(name)").eq("id", id).maybeSingle(),
      supabase.from("transactions").select("*").eq("account_id", id).order("txn_date", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    setAccount(a);
    setTxns(t ?? []);
  };

  useEffect(() => { load(); }, [id]);

  if (!account) return <div className="p-8"><Skeleton className="h-32" /></div>;

  let running = 0;
  const filteredRows = (txns ?? []).filter((t) => {
    if (from && t.txn_date < from) return false;
    if (to && t.txn_date > to) return false;
    return true;
  });

  const rows = filteredRows.map((t) => {
    running += Number(t.credit) - Number(t.debit);
    return { ...t, balance: running };
  });

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);

  const deleteAccount = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Account deleted");
      navigate("/accounts");
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

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
      load();
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
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const sendWhatsApp = (t: any) => {
    if (!account.mobile) {
      toast.error("Is account ka mobile number save nahi hai.");
      return;
    }
    const amount = Number(t.credit) > 0 ? t.credit : t.debit;
    const type = Number(t.credit) > 0 ? "Jama (Credit)" : "Nikala (Debit)";
    const message = `*Assalam-o-Alaikum!*\n\n*Aasaan Khatabook Entry Update*\n---------------------------\n*Account:* ${account.name}\n*Date:* ${formatDate(t.txn_date)}\n*Amount:* ${formatMoney(amount, account.currency)}\n*Type:* ${type}\n*Details:* ${t.details}\n---------------------------\n*Current Balance:* ${formatMoney(t.balance, account.currency)} (${balanceLabel(t.balance)})\n\nShukriya!`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const submitQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    const debit = Number(quickForm.debit || 0);
    const credit = Number(quickForm.credit || 0);
    if (!quickForm.details.trim()) { toast.error("Details required"); return; }
    if (debit <= 0 && credit <= 0) { toast.error("Enter amount"); return; }
    
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("transactions").insert([{
        txn_code: "",
        account_id: id,
        txn_date: quickForm.txn_date,
        details: quickForm.details.trim(),
        notes: quickForm.notes.trim() || null,
        debit, credit,
        created_by: user?.id,
      }]);
      
      if (error) throw error;
      toast.success("Transaction recorded");
      setQuickOpen(false);
      setQuickForm({
        txn_date: new Date().toISOString().slice(0, 10),
        details: "",
        notes: "",
        debit: "",
        credit: "",
      });
      load();
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Link to="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Accounts</Link>
        {role === "admin" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4 mr-1" /> Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the account <strong>{account.name}</strong> and all of its <strong>{rows.length}</strong> transactions. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Forever</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="glass p-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full gradient-primary opacity-10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{account.account_no}</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">{account.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-3">
              {account.mobile && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{account.mobile}</span>}
              {account.address && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{account.address}</span>}
              {account.branches?.name && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{account.branches.name}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <Badge variant="secondary" className="font-mono text-xs">{account.currency}</Badge>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Net Balance</div>
              <div className={`font-display font-bold text-2xl num ${running >= 0 ? "text-success" : "text-destructive"}`}>
                {formatMoney(running, account.currency)} <span className="text-sm">{balanceLabel(running)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setQuickOpen(true)} size="sm" className="gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform"><Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction</Button>
              <Button size="sm" variant="outline" className="glass" onClick={() => exportStatementPDF(account, rows)}><FileDown className="w-3.5 h-3.5 mr-1" /> PDF</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass p-4 border-l-4 border-l-primary/30"><div className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</div><div className="font-display text-2xl font-bold mt-1 num">{rows.length}</div></Card>
        <Card className="glass p-4 border-l-4 border-l-destructive/30"><div className="text-xs text-muted-foreground uppercase tracking-wider">Total Debit</div><div className="font-display text-2xl font-bold text-destructive mt-1 num">{formatMoney(totalDebit, account.currency)}</div></Card>
        <Card className="glass p-4 border-l-4 border-l-success/30"><div className="text-xs text-muted-foreground uppercase tracking-wider">Total Credit</div><div className="font-display text-2xl font-bold text-success mt-1 num">{formatMoney(totalCredit, account.currency)}</div></Card>
        <Card className="glass p-4 border-l-4 border-l-muted-foreground/30"><div className="text-xs text-muted-foreground uppercase tracking-wider">Currency</div><div className="font-display text-2xl font-bold mt-1">{account.currency}</div></Card>
      </div>

      <Card className="glass p-4 grid md:grid-cols-2 gap-3">
        <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </Card>

      <Card className="glass overflow-hidden shadow-xl border-none">
        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            Transaction History
          </h2>
          <div className="text-xs text-muted-foreground font-medium">
            Showing {rows.length} records
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                <th className="text-left px-6 py-4">Date</th>
                <th className="text-left px-6 py-4">Details</th>
                <th className="text-right px-6 py-4">Debit</th>
                <th className="text-right px-6 py-4">Credit</th>
                <th className="text-right px-6 py-4">Balance</th>
                {role === "admin" && <th className="px-6 py-4"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={role === "admin" ? 7 : 6} className="text-center py-12 text-muted-foreground text-sm">No transactions yet.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30 group">
                  <td className="px-6 py-4 num text-muted-foreground whitespace-nowrap">{formatDate(t.txn_date)}</td>
                  <td className="px-6 py-4 font-medium">{t.details}</td>
                  <td className="px-6 py-4 text-right num text-destructive font-medium">{Number(t.debit) > 0 ? formatMoney(Number(t.debit)) : "—"}</td>
                  <td className="px-6 py-4 text-right num text-success font-medium">{Number(t.credit) > 0 ? formatMoney(Number(t.credit)) : "—"}</td>
                  <td className={`px-6 py-4 text-right num font-bold ${t.balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatMoney(t.balance)} <span className="text-[10px] opacity-60 ml-0.5">{balanceLabel(t.balance)}</span>
                  </td>
                  {(role === "admin" || t.created_by === profile?.id) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => sendWhatsApp(t)} title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></Button>
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
      </Card>

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

      {/* Quick Entry Dialog */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="sm:max-w-[425px] glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary"><Receipt className="w-6 h-6" /> Add Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitQuick} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={quickForm.txn_date} onChange={(e) => setQuickForm({ ...quickForm, txn_date: e.target.value })} required className="bg-muted/30" />
              </div>
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Input value={account.name} disabled className="bg-muted/50 cursor-not-allowed text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Details / Narration *</Label>
              <Textarea value={quickForm.details} onChange={(e) => setQuickForm({ ...quickForm, details: e.target.value })} placeholder="What is this transaction for?" required rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-destructive font-bold">Debit (Nikala)</Label>
                <Input type="number" step="0.01" value={quickForm.debit} onChange={(e) => setQuickForm({ ...quickForm, debit: e.target.value })} placeholder="0.00" className="border-destructive/30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-success font-bold">Credit (Jama)</Label>
                <Input type="number" step="0.01" value={quickForm.credit} onChange={(e) => setQuickForm({ ...quickForm, credit: e.target.value })} placeholder="0.00" className="border-success/30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (Optional)</Label>
              <Input value={quickForm.notes} onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })} placeholder="Extra info, ref no, etc." />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-lg h-11 text-base">
                {busy ? "Saving..." : "Save Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



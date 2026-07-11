import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileDown, Plus, Phone, MapPin, Building2, Trash2, Pencil, MessageSquare, Receipt, Loader, ArrowUpRight, ArrowDownRight, Globe2, Mail } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Account, Transaction, TransactionWithBalance } from "@/types";
import { validateTransaction, validateDebitCredit } from "@/lib/validation";
import { handleSupabaseError, handleFormError } from "@/lib/errors";
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

// Type aliases for backward compatibility
export type AccountType = Account;
export type TxnType = Transaction;

type EditTransactionForm = {
  txn_date: string;
  details: string;
  debit: string;
  credit: string;
};

type QuickEntryForm = {
  txn_date: string;
  details: string;
  notes: string;
  debit: string;
  credit: string;
};

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [txns, setTxns] = useState<TxnType[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Email Statement state
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // Edit Transaction state
  const [editingTx, setEditingTx] = useState<TxnType | null>(null);
  const editForm = useForm<EditTransactionForm>({
    defaultValues: {
      txn_date: "",
      details: "",
      debit: "",
      credit: "",
    },
  });
  
  // Deletion state
  const [deletingTx, setDeletingTx] = useState<TxnType | null>(null);
  
  // Quick Entry state
  const [quickOpen, setQuickOpen] = useState(false);
  const quickForm = useForm<QuickEntryForm>({
    defaultValues: {
      txn_date: new Date().toISOString().slice(0, 10),
      details: "",
      notes: "",
      debit: "",
      credit: "",
    },
  });

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from("accounts").select("*, branches(name)").eq("id", id).maybeSingle(),
      supabase.from("transactions").select("*").eq("account_id", id).order("txn_date", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    setAccount(a);
    setTxns(t ?? []);
  }, [id]);

  useEffect(() => {
    load();
    if (!id) return;

    const sub = supabase.channel(`account_detail_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `id=eq.${id}` }, () => {
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${id}` }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [load, id]);

  if (!account) return <div className="p-8"><Skeleton className="h-32" /></div>;

  let running = 0;
  const filteredRows = (txns ?? []).filter((t) => {
    if (from && t.txn_date < from) return false;
    if (to && t.txn_date > to) return false;
    return true;
  });

  const rows = filteredRows.map((t) => {
    running += Number(t.credit ?? 0) - Number(t.debit ?? 0);
    return { ...t, balance: running } as TxnType & { balance: number };
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
    } catch (e: unknown) {
      handleSupabaseError(e, { operation: "deleteAccount", table: "accounts", userId: profile?.id });
    }
    setBusy(false);
  };

  const openEditTx = (t: TxnType) => {
    setEditingTx(t);
    editForm.reset({
      txn_date: String(t.txn_date ?? ""),
      details: t.details ?? "",
      debit: String(t.debit ?? ""),
      credit: String(t.credit ?? ""),
    });
  };

  const submitEditTx = editForm.handleSubmit(async (data) => {
    const error = validateTransaction(data.txn_date, data.details, data.debit, data.credit);
    if (error) {
      toast.error(error.message);
      return;
    }

    setBusy(true);
    try {
      const debit = Number(data.debit || 0);
      const credit = Number(data.credit || 0);
      
      const { error: dbError } = await supabase.from("transactions").update({
        txn_date: data.txn_date,
        details: data.details.trim(),
        debit,
        credit,
      }).eq("id", editingTx?.id);
      
      if (dbError) throw dbError;
      toast.success("Transaction updated");
      setEditingTx(null);
      load();
    } catch (err: unknown) {
      handleFormError(err, "Update Transaction");
    }
    setBusy(false);
  });

  const removeTx = async () => {
    if (!deletingTx) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", deletingTx.id);
      if (error) throw error;
      toast.success("Transaction deleted");
      setDeletingTx(null);
      load();
    } catch (err: unknown) {
      handleSupabaseError(err, { operation: "deleteTransaction", table: "transactions", userId: profile?.id });
    }
  };

  const sendWhatsApp = (t: TxnType & { balance?: number | null }) => {
    if (!account.mobile) {
      toast.error("Is account ka mobile number save nahi hai.");
      return;
    }
    const amount = Number(t.credit ?? 0) > 0 ? t.credit : t.debit;
    const type = Number(t.credit) > 0 ? "Jama (Credit)" : "Nikala (Debit)";
    const message = `*Assalam-o-Alaikum!*\n\n*Aasaan Khatabook Entry Update*\n---------------------------\n*Account:* ${account?.name}\n*Date:* ${formatDate(String(t.txn_date ?? ""))}\n*Amount:* ${formatMoney(amount, account?.currency)}\n*Type:* ${type}\n*Details:* ${t.details ?? ""}\n---------------------------\n*Current Balance:* ${formatMoney(t.balance ?? 0, account?.currency)} (${balanceLabel(t.balance ?? 0)})\n\nShukriya!`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${account.mobile.replace(/\D/g, "")}?text=${encoded}`, "_blank");
  };

  const submitQuick = quickForm.handleSubmit(async (data) => {
    const error = validateTransaction(data.txn_date, data.details, data.debit, data.credit);
    if (error) {
      toast.error(error.message);
      return;
    }
    
    setBusy(true);
    try {
      const debit = Number(data.debit || 0);
      const credit = Number(data.credit || 0);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: dbError } = await supabase.from("transactions").insert([{
        txn_code: "",
        account_id: id,
        txn_date: data.txn_date,
        details: data.details.trim(),
        debit, 
        credit,
        created_by: user?.id,
      }]);
      
      if (dbError) throw dbError;
      toast.success("Transaction recorded");
      setQuickOpen(false);
      quickForm.reset({
        txn_date: new Date().toISOString().slice(0, 10),
        details: "",
        notes: "",
        debit: "",
        credit: "",
      });
      load();
    } catch (err: unknown) {
      handleFormError(err, "Save Transaction");
    }
    setBusy(false);
  });

  const handleExportStatement = async () => {
    setExporting(true);
    try {
      const { exportStatementPDF } = await import("@/lib/pdf");
      await exportStatementPDF(account, rows, profile);
    } catch (error) {
        logger.error("Statement export failed:", error);
      toast.error("Could not export statement PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleEmailStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim()) { toast.error("Please enter a recipient email"); return; }
    setEmailBusy(true);
    try {
      // Build statement rows for mock email
      const stmtRows = rows.map(r => ({
        date: formatDate(String(r.txn_date ?? "")),
        code: r.txn_code,
        details: r.details,
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
        balance: r.balance,
      }));
      logger.info("Email statement payload:", { to: emailTo, account: account.name, rows: stmtRows.length });
      // In production, call your backend/edge function here:
      // await fetch('/api/email-statement', { method: 'POST', body: JSON.stringify({ to: emailTo, account, rows: stmtRows }) });
      await new Promise(r => setTimeout(r, 1200)); // Simulate send
      toast.success(`Statement emailed to ${emailTo}`);
      setEmailOpen(false);
      setEmailTo("");
    } catch (err) {
      toast.error("Failed to send statement");
    }
    setEmailBusy(false);
  };

  return (
    <div className="p-2 md:p-4 max-w-[1600px] mx-auto space-y-3 animate-in fade-in duration-500">
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

      {/* Hero Banner */}
      <Card className="glass-hero px-3 py-2.5 relative overflow-hidden border-border/40">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Details */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[9px] bg-background/50 border-primary/20 text-primary px-1.5 py-0">{account.account_no}</Badge>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground leading-tight">{account.name}</h1>
            </div>
            {(account.mobile || account.branches?.name || account.address) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {account.mobile && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{account.mobile}</span>
                  </div>
                )}
                {account.branches?.name && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{account.branches.name}</span>
                  </div>
                )}
                {account.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{account.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right Balance */}
          <div className="flex items-center gap-3 bg-background/50 border border-border/50 rounded-lg px-3 py-2 shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Net Balance · <span className="font-mono">{account.currency}</span></div>
              <div className={`font-display font-bold text-xl num ${running >= 0 ? "text-success" : "text-destructive"}`}>
                {formatMoney(running, account.currency)} <span className="text-[10px] font-medium opacity-70">{balanceLabel(running)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 pl-3 border-l border-border/50">
              <Button onClick={() => setQuickOpen(true)} size="sm" className="h-7 text-[11px] px-2 gradient-primary text-primary-foreground"><Plus className="w-3 h-3 mr-0.5" /> Add</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={exporting} onClick={handleExportStatement}>
                {exporting ? <Loader className="w-3 h-3 mr-0.5 animate-spin" /> : <FileDown className="w-3 h-3 mr-0.5" />}
                {exporting ? "Wait..." : "PDF"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => setEmailOpen(true)}>
                <Mail className="w-3 h-3 mr-0.5" /> Email
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="glass-card px-3 py-2 border-l-2 border-l-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Transactions</div>
              <div className="font-display text-lg font-bold num tracking-tight text-foreground">{rows.length}</div>
            </div>
            <Receipt className="w-3.5 h-3.5 text-primary opacity-60" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-destructive/40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Total Debit</div>
              <div className="font-display text-sm font-bold text-destructive num tracking-tight truncate">{formatMoney(totalDebit, account.currency)}</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-destructive opacity-60 shrink-0" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-success/40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Total Credit</div>
              <div className="font-display text-sm font-bold text-success num tracking-tight truncate">{formatMoney(totalCredit, account.currency)}</div>
            </div>
            <ArrowDownRight className="w-3.5 h-3.5 text-success opacity-60 shrink-0" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-blue-500/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Currency</div>
              <div className="font-display text-lg font-bold tracking-tight text-foreground">{account.currency}</div>
            </div>
            <Globe2 className="w-3.5 h-3.5 text-blue-500 opacity-60" />
          </div>
        </Card>
      </div>

      <Card className="glass px-3 py-2 flex flex-row items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 text-xs" />
        </div>
      </Card>

      <Card className="glass overflow-hidden border-none">
        <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <h2 className="font-display font-semibold text-sm flex items-center gap-1.5">
            <span className="w-1 h-4 bg-primary rounded-full" />
            Transaction History
          </h2>
          <div className="text-[10px] text-muted-foreground font-medium">{rows.length} records</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Details</th>
                <th className="text-right px-4 py-2">Debit</th>
                <th className="text-right px-4 py-2">Credit</th>
                <th className="text-right px-4 py-2">Balance</th>
                {role === "admin" && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={role === "admin" ? 7 : 6} className="text-center py-6 text-muted-foreground text-sm">No transactions yet.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30 group">
                  <td className="px-4 py-1.5 num text-muted-foreground whitespace-nowrap text-xs">{formatDate(t.txn_date)}</td>
                  <td className="px-4 py-1.5 font-medium text-xs">{t.details}</td>
                  <td className="px-4 py-1.5 text-right num text-destructive font-medium text-xs">{Number(t.debit) > 0 ? formatMoney(Number(t.debit)) : "-"}</td>
                  <td className="px-4 py-1.5 text-right num text-success font-medium text-xs">{Number(t.credit) > 0 ? formatMoney(Number(t.credit)) : "-"}</td>
                  <td className={`px-4 py-1 text-right num font-bold text-xs ${t.balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatMoney(t.balance)} <span className="text-[9px] opacity-60 ml-0.5">{balanceLabel(t.balance)}</span>
                  </td>
                  {(role === "admin" || t.created_by === profile?.id) && (
                    <td className="px-4 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => sendWhatsApp(t)} aria-label="Send WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTx(t)} aria-label="Edit transaction"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingTx(t)} aria-label="Delete transaction"><Trash2 className="w-3.5 h-3.5" /></Button>
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
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input 
                type="date"
                {...editForm.register("txn_date")}
                required 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Input 
                {...editForm.register("details")}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Debit (Nikala / Diya)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  {...editForm.register("debit")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit (Jama / Liya)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  {...editForm.register("credit")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
                {busy ? (
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
                <Input 
                  type="date"
                  {...quickForm.register("txn_date")}
                  required 
                  className="bg-muted/30" 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Input value={account?.name} disabled className="bg-muted/50 cursor-not-allowed text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Details / Narration *</Label>
              <Textarea 
                {...quickForm.register("details")}
                placeholder="What is this transaction for?" 
                required 
                rows={2} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-destructive font-bold">Debit (Nikala)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  {...quickForm.register("debit")}
                  placeholder="0.00" 
                  className="border-destructive/30" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-success font-bold">Credit (Jama)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  {...quickForm.register("credit")}
                  placeholder="0.00" 
                  className="border-success/30" 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (Optional)</Label>
              <Input 
                {...quickForm.register("notes")}
                placeholder="Extra info, ref no, etc." 
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-lg h-11 text-base">
                {busy ? "Saving..." : "Save Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Statement Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Statement — {account.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmailStatement} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
                required
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p>Statement will include <strong>{rows.length} transactions</strong> {from || to ? `filtered from ${from || "start"} to ${to || "today"}` : "(all time)"}.</p>
              <p className="text-amber-500 dark:text-amber-400">⚠ Email sending is currently in demo mode. Integrate a backend email service (e.g. Resend) to send real emails.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={emailBusy} className="gradient-primary text-primary-foreground">
                {emailBusy ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Mail className="w-4 h-4 mr-2" />Send Statement</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


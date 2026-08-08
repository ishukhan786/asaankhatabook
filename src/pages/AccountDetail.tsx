import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileDown, Plus, Phone, MapPin, Building2, Trash2, Pencil, MessageSquare, Receipt, Loader, ArrowUpRight, ArrowDownRight, Globe2, Mail, Search, Printer, Users } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Account, Transaction, TransactionWithBalance } from "@/types";

import { triggerPrint } from "@/lib/print";

const PRINT_STYLES = `
@media print {
  body {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  .screen-ui, header, aside, nav, footer, button, .print\\:hidden { 
    display: none !important; 
  }
  #print-account-detail-wrapper {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  @page {
    size: A4 portrait;
    margin: 10mm 5mm 10mm 5mm;
  }
}
`;
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
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [txns, setTxns] = useState<TxnType[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  const openingBalance = from
    ? (txns ?? [])
        .filter((t) => t.txn_date < from)
        .reduce((acc, t) => acc + (Number(t.credit ?? 0) - Number(t.debit ?? 0)), 0)
    : 0;

  const filteredRows = (txns ?? []).filter((t) => {
    if (from && t.txn_date < from) return false;
    if (to && t.txn_date > to) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchesDetails = t.details?.toLowerCase().includes(q);
      const matchesCode = t.txn_code?.toLowerCase().includes(q);
      const matchesNotes = t.notes?.toLowerCase().includes(q);
      return !!(matchesDetails || matchesCode || matchesNotes);
    }
    return true;
  });

  let running = openingBalance;
  const mappedRows = filteredRows.map((t) => {
    running += Number(t.credit ?? 0) - Number(t.debit ?? 0);
    return { ...t, balance: running } as TxnType & { balance: number };
  });

  const rows = (() => {
    if (from) {
      const bfDebit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
      const bfCredit = openingBalance > 0 ? openingBalance : 0;
      const bfRow = {
        id: "bf-row",
        txn_date: from,
        txn_code: "B/F",
        details: "B/F Balance (سابقہ بقایا / Brought Forward)",
        debit: bfDebit,
        credit: bfCredit,
        balance: openingBalance,
      } as unknown as TxnType & { balance: number };
      return [bfRow, ...mappedRows];
    }
    return mappedRows;
  })();

  const totalDebit = filteredRows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCredit = filteredRows.reduce((s, r) => s + Number(r.credit || 0), 0);

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
      
      const { data, error } = await supabase.functions.invoke('send-statement', {
        body: { to: emailTo, account_name: account.name, rows: stmtRows },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send statement");

      toast.success(`Statement emailed to ${emailTo}`);
      setEmailOpen(false);
      setEmailTo("");
    } catch (err: unknown) {
      logger.error("Email statement failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to send statement");
    }
    setEmailBusy(false);
  };

  const now = new Date();
  const printDate = now.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const printTime = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Dedicated High-End Print Document */}
      <div id="print-account-detail-wrapper" style={{ display: "none" }}>
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#ffffff", color: "#0f172a", fontSize: "11px", padding: "10px" }}>
          
          {/* 1. Top Business Information */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #cbd5e1", paddingBottom: "8px" }}>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
              {profile?.business_name || "AsaanKhata"}
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
              {profile?.business_phone && <span>Phone: {profile.business_phone} · </span>}
              {profile?.business_address && <span>Address: {profile.business_address} · </span>}
              <span>Branch: {account?.branches?.name || "Main"}</span>
            </div>
          </div>

          {/* 2. Centered Report Title */}
          <div style={{ textAlign: "center", margin: "12px 0 10px 0" }}>
            <div style={{ fontSize: "14px", fontWeight: "900", color: "#0369a1", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "2px solid #0369a1", display: "inline-block", paddingBottom: "2px" }}>
              Customer Ledger Report
            </div>
            <div style={{ fontSize: "9.5px", color: "#64748b", marginTop: "4px" }}>
              Printed Date: <strong>{printDate}</strong> · Time: <strong>{printTime}</strong>
            </div>
          </div>

          {/* 3. Customer Details Card */}
          <div style={{ margin: "10px 0 14px 0", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px", background: "transparent" }}>
            <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "6px" }}>
              CUSTOMER &amp; ACCOUNT DETAILS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: "11px" }}>
              <div><span style={{ color: "#64748b" }}>Customer Name:</span> <strong style={{ color: "#0f172a", fontSize: "11.5px" }}>{account?.name}</strong></div>
              <div><span style={{ color: "#64748b" }}>Account No:</span> <strong style={{ color: "#0369a1", fontFamily: "monospace", fontSize: "11.5px" }}>{account?.account_no}</strong></div>
              <div><span style={{ color: "#64748b" }}>Mobile No:</span> <strong style={{ color: "#0f172a" }}>{account?.mobile || "-"}</strong></div>
              <div><span style={{ color: "#64748b" }}>Address:</span> <strong style={{ color: "#0f172a" }}>{account?.address || "-"}</strong></div>
            </div>
          </div>

          {/* Account Overview Box - Zero Background Fill */}
          <div style={{ margin: "14px 0", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 16px", background: "transparent" }}>
            <div style={{ fontSize: "9.5px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "8px" }}>
              ACCOUNT BALANCE OVERVIEW ({account?.currency === "PKR" ? "Rs" : account?.currency})
            </div>
            <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
              <div style={{ borderLeft: "3px solid #0f172a", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL DEBIT (NAM)</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a", fontFamily: "monospace", marginTop: "2px" }}>
                  {formatMoney(totalDebit)}
                </div>
              </div>
              <div style={{ borderLeft: "3px solid #0f172a", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL CREDIT (JAMA)</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a", fontFamily: "monospace", marginTop: "2px" }}>
                  {formatMoney(totalCredit)}
                </div>
              </div>
              <div style={{ borderLeft: "3px solid #0f172a", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>NET BALANCE</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: running >= 0 ? "#047857" : "#b91c1c", fontFamily: "monospace", marginTop: "2px" }}>
                  {formatMoney(running, account?.currency)} {balanceLabel(running)}
                </div>
              </div>
            </div>
          </div>

          {/* Clean Data Table - Transparent Background */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", background: "transparent", color: "#0f172a", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <th style={{ padding: "7px 8px", textAlign: "left", width: "30px", color: "#475569" }}>#</th>
                <th style={{ padding: "7px 8px", textAlign: "left", width: "80px", color: "#475569" }}>Date</th>
                <th style={{ padding: "7px 8px", textAlign: "left", color: "#0f172a" }}>Details / Narration</th>
                <th style={{ padding: "7px 8px", textAlign: "right", color: "#0f172a" }}>Debit (Nam)</th>
                <th style={{ padding: "7px 8px", textAlign: "right", color: "#0f172a" }}>Credit (Jama)</th>
                <th style={{ padding: "7px 8px", textAlign: "right", color: "#0f172a" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                    No transaction entries found for this account.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "7px 8px", color: "#94a3b8", fontWeight: "600" }}>{i + 1}</td>
                    <td style={{ padding: "7px 8px", color: "#475569", fontFamily: "monospace" }}>{formatDate(String(r.txn_date || ""))}</td>
                    <td style={{ padding: "7px 8px", fontWeight: "700", color: "#0f172a" }}>{r.details}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "900", color: "#0f172a", fontFamily: "monospace", fontSize: "12px" }}>
                      {Number(r.debit) > 0 ? formatMoney(Number(r.debit)) : "-"}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "900", color: "#0f172a", fontFamily: "monospace", fontSize: "12px" }}>
                      {Number(r.credit) > 0 ? formatMoney(Number(r.credit)) : "-"}
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "900", color: r.balance >= 0 ? "#047857" : "#b91c1c", fontFamily: "monospace", fontSize: "12px" }}>
                      {formatMoney(r.balance, account?.currency)} {balanceLabel(r.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>


          {/* Page Footer */}
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", fontSize: "8.5px", color: "#94a3b8" }}>
            <div>AsaanKhata System · Official Account Statement</div>
            <div>Printed: {printDate} {printTime}</div>
          </div>
        </div>
      </div>

      <div className="screen-ui p-2 md:p-4 max-w-[1600px] mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <Link to="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Accounts</Link>
          {(role === "admin" || ((role === "branch_manager" || role === "branch_user" || role === "accountant") && account?.branch_id === profile?.branch_id)) && (
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

        {/* Hero Banner Redesigned */}
        <div className="bg-background/80 backdrop-blur-xl border border-border/60 rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-60" />
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-6 lg:items-center">
            
            {/* Left: Customer Info */}
            <div className="flex-1">
              <div className="flex items-start md:items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 shadow-inner hidden sm:flex">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground leading-none">{account.name}</h1>
                    <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/30 shrink-0">{account.account_no}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {account.mobile && (
                      <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 px-2.5 py-1 rounded-md">
                        <Phone className="w-3.5 h-3.5 text-primary/80" />
                        <span className="font-medium">{account.mobile}</span>
                      </div>
                    )}
                    {account.address && (
                      <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 px-2.5 py-1 rounded-md">
                        <MapPin className="w-3.5 h-3.5 text-primary/80" />
                        <span className="font-medium">{account.address}</span>
                      </div>
                    )}
                    {account.branches?.name && (
                      <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 px-2.5 py-1 rounded-md">
                        <Building2 className="w-3.5 h-3.5 text-primary/80" />
                        <span className="font-medium">{account.branches.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Balances & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
              
              {/* Balance Box */}
              <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm w-full sm:w-auto min-w-[200px] text-right">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("NetBalance")}</div>
                <div className={`font-display text-3xl font-bold num tracking-tight ${running >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatMoney(running, account.currency)} 
                </div>
                <div className="text-[11px] font-medium opacity-70 mt-1 uppercase tracking-wider">{balanceLabel(running)}</div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                <Button onClick={() => setQuickOpen(true)} className="flex-1 sm:flex-none shadow-sm gradient-primary text-primary-foreground h-11">
                  <Plus className="w-4 h-4 mr-2" /> {t("AddEntry")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 sm:flex-none h-11 px-3 bg-background" disabled={exporting} onClick={handleExportStatement} title={t("ExportPDF")}>
                    {exporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    <span className="ml-2 sm:hidden">Export PDF</span>
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none h-11 px-3 bg-background" onClick={() => triggerPrint("print-account-detail-wrapper", handleExportStatement)} title="Print">
                    <Printer className="w-4 h-4" />
                    <span className="ml-2 sm:hidden">Print</span>
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none h-11 px-3 bg-background" onClick={() => setEmailOpen(true)} title="Email">
                    <Mail className="w-4 h-4" />
                    <span className="ml-2 sm:hidden">Email</span>
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="glass-card px-3 py-2 border-l-2 border-l-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t("Transactions")}</div>
              <div className="font-display text-lg font-bold num tracking-tight text-foreground">{rows.length}</div>
            </div>
            <Receipt className="w-3.5 h-3.5 text-primary opacity-60" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-destructive/40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t("Debit")}</div>
              <div className="font-display text-sm font-bold text-destructive num tracking-tight truncate">{formatMoney(totalDebit, account.currency)}</div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-destructive opacity-60 shrink-0" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-success/40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t("Credit")}</div>
              <div className="font-display text-sm font-bold text-success num tracking-tight truncate">{formatMoney(totalCredit, account.currency)}</div>
            </div>
            <ArrowDownRight className="w-3.5 h-3.5 text-success opacity-60 shrink-0" />
          </div>
        </Card>
        <Card className="glass-card px-3 py-2 border-l-2 border-l-blue-500/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t("Currency")}</div>
              <div className="font-display text-lg font-bold tracking-tight text-foreground">{account.currency}</div>
            </div>
            <Globe2 className="w-3.5 h-3.5 text-blue-500 opacity-60" />
          </div>
        </Card>
      </div>

      <Card className="glass p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions by narration or voucher no..."
            className="pl-8 h-8 text-xs bg-background/40 border-white/10"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs bg-background/40" />
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs bg-background/40" />
          </div>
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
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Voucher No</th>
                <th className="text-left px-4 py-2.5">Details</th>
                <th className="text-right px-4 py-2.5">Debit</th>
                <th className="text-right px-4 py-2.5">Credit</th>
                <th className="text-right px-4 py-2.5">Balance</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                    {searchQuery ? "No transactions found matching your search." : "No transactions yet."}
                  </td>
                </tr>
              ) : rows.map((t) => (
                <tr key={t.id} className={`border-t border-border/50 hover:bg-muted/30 group transition-colors ${t.id === "bf-row" ? "bg-primary/5 font-semibold" : ""}`}>
                  <td className="px-4 py-2.5 num text-muted-foreground whitespace-nowrap text-xs">{formatDate(t.txn_date)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{t.txn_code || "-"}</td>
                  <td className="px-4 py-2.5 font-medium text-xs">
                    <div className={t.id === "bf-row" ? "font-bold text-primary" : ""}>{t.details}</div>
                    {t.notes && <div className="text-[10px] text-muted-foreground/70 italic mt-0.5">{t.notes}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right num text-destructive font-semibold text-xs">{Number(t.debit) > 0 ? formatMoney(Number(t.debit), account.currency) : "-"}</td>
                  <td className="px-4 py-2.5 text-right num text-success font-semibold text-xs">{Number(t.credit) > 0 ? formatMoney(Number(t.credit), account.currency) : "-"}</td>
                  <td className={`px-4 py-2.5 text-right num font-bold text-xs ${t.balance >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatMoney(t.balance, account.currency)} <span className="text-[9px] opacity-60 ml-0.5">{balanceLabel(t.balance)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.id === "bf-row" ? (
                      <span className="text-[10px] font-mono text-muted-foreground italic">B/F Summary</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:bg-success/10" onClick={() => sendWhatsApp(t)} title="Share via WhatsApp" aria-label="Send WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></Button>
                        {(role === "admin" || t.created_by === profile?.id || ((role === "branch_manager" || role === "branch_user" || role === "accountant") && account?.branch_id === profile?.branch_id)) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => openEditTx(t)} title="Edit transaction" aria-label="Edit transaction"><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeletingTx(t)} title="Delete transaction" aria-label="Delete transaction"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <style>{PRINT_STYLES}</style>

      {/* Printable Account Statement Template */}
      <div id="print-account-detail-wrapper" className="hidden print:block">
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#ffffff", color: "#0f172a", fontSize: "11px", padding: "10px" }}>
          {/* Top Business Info */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #cbd5e1", paddingBottom: "8px" }}>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
              {profile?.business_name || "AsaanKhata"}
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
              {profile?.business_phone && <span>Phone: {profile.business_phone} · </span>}
              {profile?.business_address && <span>Address: {profile.business_address}</span>}
            </div>
          </div>

          {/* Statement Header Title */}
          <div style={{ textAlign: "center", margin: "12px 0 10px 0" }}>
            <div style={{ fontSize: "14px", fontWeight: "900", color: "#0369a1", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "2px solid #0369a1", display: "inline-block", paddingBottom: "2px" }}>
              ACCOUNT STATEMENT &amp; LEDGER
            </div>
            <div style={{ fontSize: "9.5px", color: "#64748b", marginTop: "4px" }}>
              Printed Date: <strong>{new Date().toLocaleDateString("en-PK")}</strong> · Account Ref: <strong>{account.account_no}</strong>
              {from && <span> · Period: <strong>{from} to {to || "Today"}</strong></span>}
            </div>
          </div>

          {/* Customer Info Card */}
          <div style={{ margin: "10px 0 14px 0", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px" }}>
            <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "6px" }}>
              ACCOUNT HOLDER DETAILS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: "11px" }}>
              <div><span style={{ color: "#64748b" }}>Account Name:</span> <strong style={{ color: "#0f172a", fontSize: "11.5px" }}>{account.name}</strong></div>
              <div><span style={{ color: "#64748b" }}>Account No:</span> <strong style={{ color: "#0369a1", fontFamily: "Arial, sans-serif", fontSize: "11.5px" }}>{account.account_no}</strong></div>
              <div><span style={{ color: "#64748b" }}>Mobile / Phone:</span> <strong style={{ color: "#0f172a" }}>{account.mobile || "-"}</strong></div>
              <div><span style={{ color: "#64748b" }}>Address:</span> <strong style={{ color: "#0f172a" }}>{account.address || "-"}</strong></div>
            </div>
          </div>

          {/* Account Metrics Summary */}
          <div style={{ margin: "14px 0", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ fontSize: "9.5px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "8px" }}>
              STATEMENT SUMMARY ({account.currency || "PKR"})
            </div>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ borderLeft: "3px solid #047857", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL CREDIT (JAMA)</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                  {formatMoney(totalCredit, account.currency)}
                </div>
              </div>
              <div style={{ borderLeft: "3px solid #b91c1c", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL DEBIT (NIKALA)</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: "#b91c1c", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                  {formatMoney(totalDebit, account.currency)}
                </div>
              </div>
              <div style={{ borderLeft: "3px solid #0f172a", paddingLeft: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>CLOSING NET BALANCE</div>
                <div style={{ fontSize: "15px", fontWeight: "900", color: running >= 0 ? "#047857" : "#b91c1c", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                  {formatMoney(running, account.currency)} ({balanceLabel(running)})
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#ffffff", fontSize: "9px", textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px", textAlign: "left" }}>Date</th>
                <th style={{ padding: "6px 8px", textAlign: "left" }}>Voucher Details</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Debit (Nikala)</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Credit (Jama)</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "6px 8px", color: "#475569", whiteSpace: "nowrap", fontFamily: "Arial, sans-serif" }}>{formatDate(String(r.txn_date ?? ""))}</td>
                  <td style={{ padding: "6px 8px", color: "#0f172a", fontWeight: "500" }}>{r.details || "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.debit) > 0 ? "#b91c1c" : "#94a3b8", fontWeight: Number(r.debit) > 0 ? "700" : "normal", fontFamily: "Arial, sans-serif" }}>
                    {Number(r.debit) > 0 ? formatMoney(Number(r.debit)) : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: Number(r.credit) > 0 ? "#047857" : "#94a3b8", fontWeight: Number(r.credit) > 0 ? "700" : "normal", fontFamily: "Arial, sans-serif" }}>
                    {Number(r.credit) > 0 ? formatMoney(Number(r.credit)) : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "700", color: (r.balance ?? 0) >= 0 ? "#047857" : "#b91c1c", fontFamily: "Arial, sans-serif" }}>
                    {formatMoney(r.balance ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer Signature & Stamp area */}
          <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
            <div>Prepared By: ___________________</div>
            <div>Authorized Signature &amp; Stamp: ___________________</div>
          </div>

          <div style={{ marginTop: "20px", textAlign: "center", fontSize: "8.5px", color: "#94a3b8", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>
            AsaanKhata System · Official Audit Statement
          </div>
        </div>
      </div>
    </div>
    </>
  );
}


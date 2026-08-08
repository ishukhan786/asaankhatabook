import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, Printer, FileDown, ArrowLeft, ShieldCheck, Wallet,
  Building2, Phone, MapPin, Loader, ArrowUpRight, ArrowDownLeft, CheckCircle2
} from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { exportStatementPDF } from "@/lib/pdf";
import { triggerPrint } from "@/lib/print";
import { AsaanKhataLogo } from "@/components/Logo";
import { toast } from "sonner";
import { Account, TransactionWithBalance } from "@/types";

const PRINT_STYLES = `
@media print {
  body {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  .screen-ui, header, aside, nav, footer, button, .print\\:hidden { 
    display: none !important; 
  }
  #print-passbook-wrapper {
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

export default function CustomerPassbook() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<TransactionWithBalance[]>([]);
  const [searched, setSearched] = useState(false);
  const [filterText, setFilterText] = useState("");

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) {
      toast.error("Please enter your registered Mobile Number");
      return;
    }

    setLoading(true);
    setSearched(true);
    setAccount(null);
    setTxns([]);

    try {
      const searchTerm = q.trim();

      // Fetch all accounts to filter flexibly
      const { data: accountsData, error: accErr } = await supabase
        .from("accounts")
        .select("id, name, account_no, currency, mobile, address, branch_id");

      if (accErr) throw accErr;

      if (!accountsData || accountsData.length === 0) {
        toast.error("No accounts found. Please verify your system database.");
        setLoading(false);
        return;
      }

      // Flexible matching: Strips spaces and hyphens for comparisons
      const cleanSearch = searchTerm.toLowerCase().replace(/[\s-]/g, "");

      const matchedAccount = accountsData.find(acc => {
        const accNo = String(acc.account_no ?? "").toLowerCase();
        const cleanAccNo = accNo.replace(/[\s-]/g, "");
        const mobile = String(acc.mobile ?? "").replace(/[\s-]/g, "");
        const name = String(acc.name ?? "").toLowerCase();

        return (
          accNo === searchTerm.toLowerCase() ||
          cleanAccNo === cleanSearch ||
          accNo.includes(searchTerm.toLowerCase()) ||
          (mobile && (mobile === cleanSearch || mobile.includes(cleanSearch))) ||
          name.includes(searchTerm.toLowerCase())
        );
      });

      if (!matchedAccount) {
        toast.error(`Account '${searchTerm}' not found. Please verify Account No or Mobile No.`);
        setLoading(false);
        return;
      }

      // Fetch branch name if branch_id exists
      let branchName = "Main Branch";
      if (matchedAccount.branch_id) {
        const { data: bData } = await supabase
          .from("branches")
          .select("name")
          .eq("id", matchedAccount.branch_id)
          .maybeSingle();
        if (bData?.name) branchName = bData.name;
      }

      const accWithBranch = {
        ...matchedAccount,
        branches: { name: branchName }
      } as unknown as Account;

      setAccount(accWithBranch);

      // Fetch transactions for this account
      const { data: txnsData, error: txnErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("account_id", acc.id)
        .order("txn_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (txnErr) throw txnErr;

      // Calculate running balance
      let running = 0;
      const computed: TransactionWithBalance[] = (txnsData ?? []).map(t => {
        running += Number(t.credit ?? 0) - Number(t.debit ?? 0);
        return {
          ...t,
          balance: running
        };
      });

      setTxns(computed);
    } catch (err) {
      console.error("Passbook lookup error:", err);
      toast.error("Could not fetch account statement");
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = txns.reduce((s, t) => s + Number(t.debit ?? 0), 0);
  const totalCredit = txns.reduce((s, t) => s + Number(t.credit ?? 0), 0);
  const netBalance = totalCredit - totalDebit;
  const currency = account?.currency || "PKR";

  const filteredTxns = filterText.trim()
    ? txns.filter(t => 
        (t.details ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
        (t.txn_code ?? "").toLowerCase().includes(filterText.toLowerCase())
      )
    : txns;

  const handleExportPDF = async () => {
    if (!account) return;
    setExporting(true);
    try {
      await exportStatementPDF(account, txns);
    } catch (err) {
      toast.error("Failed to export PDF statement");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Printable Passbook Statement Document */}
      {account && (
        <div id="print-passbook-wrapper" className="hidden print:block">
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#ffffff", color: "#0f172a", fontSize: "11px", padding: "10px" }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #cbd5e1", paddingBottom: "8px" }}>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
                AsaanKhata Digital Passbook
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
                Official Online Account Statement · Branch: {(account.branches as { name?: string })?.name || "Main"}
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "12px 0 10px 0" }}>
              <div style={{ fontSize: "14px", fontWeight: "900", color: "#0369a1", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "2px solid #0369a1", display: "inline-block", paddingBottom: "2px" }}>
                CUSTOMER ACCOUNT STATEMENT
              </div>
              <div style={{ fontSize: "9.5px", color: "#64748b", marginTop: "4px" }}>
                Printed Date: <strong>{new Date().toLocaleDateString("en-PK")}</strong> · Account Ref: <strong>{account.account_no}</strong>
              </div>
            </div>

            <div style={{ margin: "10px 0 14px 0", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px" }}>
              <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "6px" }}>
                ACCOUNT HOLDER DETAILS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: "11px" }}>
                <div><span style={{ color: "#64748b" }}>Customer Name:</span> <strong style={{ color: "#0f172a", fontSize: "11.5px" }}>{account.name}</strong></div>
                <div><span style={{ color: "#64748b" }}>Account No:</span> <strong style={{ color: "#0369a1", fontFamily: "Arial, sans-serif", fontSize: "11.5px" }}>{account.account_no}</strong></div>
                <div><span style={{ color: "#64748b" }}>Mobile:</span> <strong style={{ color: "#0f172a" }}>{account.mobile || "-"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Address:</span> <strong style={{ color: "#0f172a" }}>{account.address || "-"}</strong></div>
              </div>
            </div>

            <div style={{ margin: "14px 0", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ fontSize: "9.5px", fontWeight: "800", textTransform: "uppercase", color: "#0369a1", letterSpacing: "0.5px", marginBottom: "8px" }}>
                STATEMENT SUMMARY ({currency})
              </div>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ borderLeft: "3px solid #047857", paddingLeft: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL CREDIT (JAMA)</div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                    {formatMoney(totalCredit, currency)}
                  </div>
                </div>
                <div style={{ borderLeft: "3px solid #b91c1c", paddingLeft: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL DEBIT (NIKALA)</div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#b91c1c", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                    {formatMoney(totalDebit, currency)}
                  </div>
                </div>
                <div style={{ borderLeft: "3px solid #0f172a", paddingLeft: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>CLOSING NET BALANCE</div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: netBalance >= 0 ? "#047857" : "#b91c1c", fontFamily: "Arial, sans-serif", marginTop: "2px" }}>
                    {formatMoney(netBalance, currency)} ({balanceLabel(netBalance)})
                  </div>
                </div>
              </div>
            </div>

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
                {txns.map((r, idx) => (
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

            <div style={{ marginTop: "30px", textAlign: "center", fontSize: "8.5px", color: "#94a3b8", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>
              AsaanKhata System · Official Digital Passbook Statement
            </div>
          </div>
        </div>
      )}

      {/* Screen Web UI */}
      <div className="screen-ui min-h-screen bg-gradient-to-b from-background via-muted/20 to-background flex flex-col justify-between">
        
        {/* Top Header */}
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AsaanKhataLogo showText size={38} />
              <Badge variant="outline" className="inline-flex bg-primary/10 text-primary border-primary/30 font-semibold px-2.5 py-0.5">
                Online Khata Portal
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Official Passbook
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 flex-1 w-full space-y-8">
          
          {/* Search Box Card */}
          <Card className="glass-card p-6 md:p-8 rounded-3xl border-2 border-primary/20 shadow-lg relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4 text-center max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Customer Khata Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Apna Khata Balance Dekhein
              </h1>
              <p className="text-sm text-muted-foreground">
                Apna registered <strong>Mobile Number</strong> (e.g. 03001234567) darj karein.
              </p>

              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="tel"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Enter Mobile Number (e.g. 03001234567)..." 
                    className="pl-12 h-13 text-base rounded-2xl border-2 border-border/80 focus:border-primary bg-background shadow-inner"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="h-13 px-8 text-base font-bold rounded-2xl gradient-primary text-primary-foreground shadow-soft hover:shadow-glow shrink-0"
                >
                  {loading ? <><Loader className="w-5 h-5 mr-2 animate-spin" /> Checking...</> : <><Search className="w-5 h-5 mr-2" /> Khaata Dekhein</>}
                </Button>
              </form>
            </div>
          </Card>

          {/* Account Result View */}
          {account && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* Account Details Card */}
              <Card className="glass-card p-6 rounded-2xl border-l-4 border-l-primary shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold font-display text-foreground">{account.name}</h2>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active Khata
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono font-bold text-primary"><Wallet className="w-3.5 h-3.5" /> {account.account_no}</span>
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {(account.branches as { name?: string })?.name || "Main Branch"}</span>
                      {account.mobile && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {account.mobile}</span>}
                      {account.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {account.address}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleExportPDF} 
                      disabled={exporting}
                      className="h-11 px-4 rounded-xl border-2 font-semibold"
                    >
                      {exporting ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                      PDF Download
                    </Button>
                    <Button 
                      onClick={() => triggerPrint("print-passbook-wrapper", handleExportPDF)}
                      className="h-11 px-4 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm"
                    >
                      <Printer className="w-4 h-4 mr-2" /> Print Passbook
                    </Button>
                  </div>
                </div>
              </Card>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card p-5 border-l-4 border-l-emerald-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Credit (Jama)</div>
                      <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1 num">
                        {formatMoney(totalCredit, currency)}
                      </div>
                    </div>
                    <ArrowDownLeft className="w-8 h-8 text-emerald-500/40" />
                  </div>
                </Card>

                <Card className="glass-card p-5 border-l-4 border-l-red-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Debit (Nikala)</div>
                      <div className="text-2xl font-bold font-display text-red-600 dark:text-red-400 mt-1 num">
                        {formatMoney(totalDebit, currency)}
                      </div>
                    </div>
                    <ArrowUpRight className="w-8 h-8 text-red-500/40" />
                  </div>
                </Card>

                <Card className={`glass-card p-5 border-l-4 ${netBalance >= 0 ? "border-l-emerald-600" : "border-l-red-600"} bg-gradient-to-br from-background to-muted/40`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Net Closing Balance</div>
                      <div className={`text-2xl font-bold font-display mt-1 num ${netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatMoney(netBalance, currency)}
                      </div>
                      <div className="text-xs font-semibold opacity-80 mt-0.5 uppercase tracking-wider">
                        {balanceLabel(netBalance)}
                      </div>
                    </div>
                    <Wallet className="w-8 h-8 text-primary/40" />
                  </div>
                </Card>
              </div>

              {/* Transactions List */}
              <Card className="glass-card overflow-hidden shadow-lg border-none rounded-2xl">
                <div className="p-5 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">Transaction History</h3>
                    <p className="text-xs text-muted-foreground">{txns.length} total entry records</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Filter transactions..."
                      className="pl-9 h-10 text-xs rounded-xl bg-background border-border/60"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="p-4 font-bold">Date</th>
                        <th className="p-4 font-bold">Details</th>
                        <th className="p-4 font-bold text-right">Debit (Nikala)</th>
                        <th className="p-4 font-bold text-right">Credit (Jama)</th>
                        <th className="p-4 font-bold text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredTxns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">
                            No matching transactions found.
                          </td>
                        </tr>
                      ) : (
                        filteredTxns.map((t, idx) => (
                          <tr key={t.id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                              {formatDate(String(t.txn_date || ""))}
                            </td>
                            <td className="p-4 font-medium text-foreground">
                              {t.details || "—"}
                              {t.txn_code && <span className="ml-2 text-[10px] font-mono opacity-60">({t.txn_code})</span>}
                            </td>
                            <td className="p-4 text-right font-bold text-red-600 dark:text-red-400 num">
                              {Number(t.debit) > 0 ? formatMoney(Number(t.debit)) : "—"}
                            </td>
                            <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 num">
                              {Number(t.credit) > 0 ? formatMoney(Number(t.credit)) : "—"}
                            </td>
                            <td className={`p-4 text-right font-bold num ${(t.balance ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {formatMoney(t.balance ?? 0, currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          )}

          {/* Empty state before searching */}
          {!searched && (
            <Card className="glass-card p-12 text-center space-y-4 rounded-3xl border-dashed border-2 border-border/60 max-w-xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display">AasanKhata Digital Passbook</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Apna registered <strong>Mobile Number</strong> (e.g. 03001234567) upar box mein likhein aur <strong>"Khaata Dekhein"</strong> par click karein.
              </p>
            </Card>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground bg-background/50">
          AsaanKhata Digital Ledger Suite · Secure Customer Passbook Portal
        </footer>

      </div>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileDown, FileBarChart, Users, Receipt, ArrowUpRight, ArrowDownLeft, Scale, Building2, Phone, MapPin } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { exportLedgerPDF, exportStatementPDF } from "@/lib/pdf";
import { useDebounce } from "@/hooks/useDebounce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { logger } from "@/lib/logger";
import { PageHeader } from "@/components/PageHeader";

export default function Reports() {
  const { profile } = useAuth();
  type AccountShort = {
    id: string;
    account_no?: string | null;
    name?: string | null;
    mobile?: string | null;
    address?: string | null;
    currency?: string | null;
    branches?: { name?: string | null } | null;
  };
  type AccountTotals = { account_id: string; debit?: number | string | null; credit?: number | string | null };

  const [accounts, setAccounts] = useState<AccountShort[]>([]);
  const [txns, setTxns] = useState<AccountTotals[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  
  // Statement specific state
  const [selectedAccId, setSelectedAccId] = useState("");
  type StatementTxn = { id?: string; txn_date?: string | null; details?: string | null; debit?: number | string | null; credit?: number | string | null; balance?: number | null };
  const [statementTxns, setStatementTxns] = useState<StatementTxn[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAll = useCallback(() => {
    Promise.all([
      supabase.from("accounts").select("id, account_no, name, mobile, address, currency, branches(name)"),
      supabase
        .rpc("report_account_totals", {
          p_from: from || null,
          p_to: to || null,
        }),
    ]).then(([a, totals]) => {
      if (a.error) throw a.error;
      if (totals.error) throw totals.error;
      setAccounts(a.data ?? []);
      setTxns((totals.data as AccountTotals[]) ?? []);
    }).catch((err) => {
      logger.error("Reports load error:", err);
      toast.error("Failed to load report data");
    });
  }, [from, to]);

  const scheduleLoad = useRealtimeRefresh(loadAll, 700);
  useEffect(() => {
    loadAll();
    const sub = supabase.channel('reports_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, scheduleLoad)
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [loadAll, scheduleLoad]);

  const summary = useMemo(() => {
    const txnByAccount = new Map<string, { debit: number; credit: number; txns: AccountTotals[] }>();

    txns.forEach((t) => {
      const existing = txnByAccount.get(t.account_id) ?? { debit: 0, credit: 0, txns: [] };
      existing.debit += Number(t.debit);
      existing.credit += Number(t.credit);
      existing.txns.push(t);
      txnByAccount.set(t.account_id, existing);
    });

    return accounts
      .filter(a => !debouncedQ || String(a.name).toLowerCase().includes(debouncedQ.toLowerCase()) || String(a.account_no).toLowerCase().includes(debouncedQ.toLowerCase()))
      .map((a) => {
        const accountTxn = txnByAccount.get(a.id) ?? { debit: 0, credit: 0, txns: [] };
        return {
          ...a,
          debit: accountTxn.debit,
          credit: accountTxn.credit,
          net: accountTxn.credit - accountTxn.debit,
          txns: accountTxn.txns,
        };
      });
  }, [accounts, txns, debouncedQ]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccId), [accounts, selectedAccId]);

  const loadStatement = useCallback(() => {
    if (!selectedAccId) { setStatementTxns([]); return; }
    setLoadingStatement(true);
    supabase.from("transactions")
      .select("*")
      .eq("account_id", selectedAccId)
      .order("txn_date", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setStatementTxns(data ?? []);
        setLoadingStatement(false);
      });
  }, [selectedAccId]);

  useEffect(() => {
    loadStatement();
    if (!selectedAccId) return;

    const sub = supabase.channel(`reports_statement_${selectedAccId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${selectedAccId}` }, () => {
        loadStatement();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [selectedAccId, loadStatement]);

  const filteredStatement = useMemo(() => {
    return statementTxns.filter(t => (!from || t.txn_date >= from) && (!to || t.txn_date <= to));
  }, [statementTxns, from, to]);

  const statementRows = useMemo(() => {
    let openingBalance = 0;
    if (from) {
      openingBalance = statementTxns
        .filter(t => t.txn_date < from)
        .reduce((acc, t) => acc + (Number(t.credit) - Number(t.debit)), 0);
    }

    let running = openingBalance;
    return filteredStatement.map(t => {
      running += Number(t.credit) - Number(t.debit);
      return { ...t, balance: running };
    });
  }, [filteredStatement, statementTxns, from]);

  const handleExportLedger = async () => {
    setExporting(true);
    try {
      await exportLedgerPDF(summary);
    } catch (error) {
      logger.error("Ledger export failed:", error);
      toast.error("Could not export ledger PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportStatement = async (accountData: AccountShort | undefined, statementData: StatementTxn[]) => {
    setExporting(true);
    try {
      await exportStatementPDF(accountData, statementData, profile);
    } catch (error) {
      logger.error("Statement export failed:", error);
      toast.error("Could not export statement PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportLedgerRowStatement = async (accountData: AccountShort | undefined) => {
    setExporting(true);
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("account_id", accountData.id)
        .order("txn_date", { ascending: true })
        .order("created_at", { ascending: true });

      const accountRows = (data ?? []).filter((t) => (!from || t.txn_date >= from) && (!to || t.txn_date <= to));
      await exportStatementPDF(accountData, accountRows, profile);
    } catch (error) {
      logger.error("Ledger row statement export failed:", error);
      toast.error("Could not export statement PDF");
    } finally {
      setExporting(false);
    }
  };

  const ledgerTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    summary.forEach((r) => {
      debit += r.debit || 0;
      credit += r.credit || 0;
    });
    const net = credit - debit;
    const currency = summary[0]?.currency || "PKR";
    return { debit, credit, net, currency };
  }, [summary]);

  const statementTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    statementRows.forEach((t) => {
      debit += Number(t.debit) || 0;
      credit += Number(t.credit) || 0;
    });
    const net = credit - debit;

    const opening = from 
      ? statementTxns
          .filter(t => t.txn_date < from)
          .reduce((acc, t) => acc + (Number(t.credit) - Number(t.debit)), 0)
      : 0;

    const closing = opening + net;

    return { debit, credit, net, opening, closing };
  }, [statementRows, statementTxns, from]);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Financial Insights"
        title={<span className="flex items-center gap-3"><span className="p-2 rounded-xl bg-primary/10 text-primary"><FileBarChart className="w-7 h-7" /></span>Reports &amp; Ledger</span>}
      />

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-muted/20 border border-border/30 rounded-xl">
          <TabsTrigger value="ledger" className="flex items-center gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <Users className="w-4 h-4" /> Ledger Summary
          </TabsTrigger>
          <TabsTrigger value="statement" className="flex items-center gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <Receipt className="w-4 h-4" /> Account Statement
          </TabsTrigger>
        </TabsList>

        {/* Ledger Summary Tab */}
        <TabsContent value="ledger" className="space-y-6 outline-none">
          {/* Dynamic KPI summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass relative overflow-hidden p-6 rounded-2xl border-none shadow-md flex items-center justify-between group">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Cash Out (Debits)</span>
                <h3 className="text-2xl font-bold num text-destructive tracking-tight">
                  {formatMoney(ledgerTotals.debit, ledgerTotals.currency)}
                </h3>
              </div>
              <div className="p-3 bg-destructive/10 rounded-xl text-destructive group-hover:scale-110 transition-transform duration-300">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </Card>

            <Card className="glass relative overflow-hidden p-6 rounded-2xl border-none shadow-md flex items-center justify-between group">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Cash In (Credits)</span>
                <h3 className="text-2xl font-bold num text-success tracking-tight">
                  {formatMoney(ledgerTotals.credit, ledgerTotals.currency)}
                </h3>
              </div>
              <div className="p-3 bg-success/10 rounded-xl text-success group-hover:scale-110 transition-transform duration-300">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
            </Card>

            <Card className="glass relative overflow-hidden p-6 rounded-2xl border-none shadow-md flex items-center justify-between group">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Ledger Balance</span>
                <h3 className={`text-2xl font-bold num tracking-tight ${ledgerTotals.net >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatMoney(ledgerTotals.net, ledgerTotals.currency)}
                  <span className="text-sm font-semibold ml-1.5 opacity-80">
                    ({balanceLabel(ledgerTotals.net)})
                  </span>
                </h3>
              </div>
              <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 ${ledgerTotals.net >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                <Scale className="w-6 h-6" />
              </div>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
            <Card className="glass p-5 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 border-none shadow-md rounded-2xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Search Account</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    placeholder="Search by name or number..." 
                    className="pl-10 h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">From Date</Label>
                <Input 
                  type="date" 
                  value={from} 
                  onChange={(e) => setFrom(e.target.value)} 
                  className="h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Date</Label>
                <Input 
                  type="date" 
                  value={to} 
                  onChange={(e) => setTo(e.target.value)} 
                  className="h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all"
                />
              </div>
            </Card>
            <Button 
              onClick={handleExportLedger} 
              disabled={exporting} 
              className="gradient-primary text-primary-foreground shadow-soft hover:shadow-glow h-11 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 self-stretch lg:self-auto"
            >
              <FileDown className="w-4 h-4" /> 
              {exporting ? "Exporting..." : "Export Ledger PDF"}
            </Button>
          </div>

          {/* Ledger Table */}
          <Card className="glass overflow-hidden shadow-lg border-none rounded-2xl">
            <div className="p-5 border-b border-border/30 bg-muted/10 flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-foreground">All Accounts Ledger</h2>
              <Badge variant="secondary" className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border-none">
                {summary.length} Accounts
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-widest border-b border-border/30 bg-muted/5">
                    <th className="text-left font-bold px-6 py-4">Account No</th>
                    <th className="text-left font-bold px-6 py-4">Name</th>
                    <th className="text-left font-bold px-6 py-4 hidden md:table-cell">Branch</th>
                    <th className="text-left font-bold px-6 py-4">Cur</th>
                    <th className="text-right font-bold px-6 py-4">Debit</th>
                    <th className="text-right font-bold px-6 py-4">Credit</th>
                    <th className="text-right font-bold px-6 py-4">Net</th>
                    <th className="px-6 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {summary.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-muted-foreground text-base">
                        No ledger accounts found matching filters.
                      </td>
                    </tr>
                  ) : summary.map((r) => (
                    <tr key={r.id} className="group hover:bg-primary/[0.03] transition-all duration-200">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground tracking-wider">{r.account_no}</td>
                      <td className="px-6 py-4 font-semibold text-foreground">{r.name}</td>
                      <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 opacity-65" />
                          {r.branches?.name ?? "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
                          {r.currency}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right num text-destructive font-semibold">{formatMoney(r.debit, r.currency)}</td>
                      <td className="px-6 py-4 text-right num text-success font-semibold">{formatMoney(r.credit, r.currency)}</td>
                      <td className={`px-6 py-4 text-right num font-bold ${r.net >= 0 ? "text-success" : "text-destructive"}`}>
                        <span className="flex items-center justify-end gap-1">
                          {formatMoney(r.net, r.currency)}
                          <span className="text-[10px] font-bold opacity-75 bg-muted/30 px-1 py-0.5 rounded">
                            {balanceLabel(r.net)}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" 
                          disabled={exporting} 
                          onClick={() => handleExportLedgerRowStatement(r)} 
                          aria-label="Export statement"
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Account Statement Tab */}
        <TabsContent value="statement" className="space-y-6 outline-none">
          {/* Filters Control Bar */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
            <Card className="glass p-5 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 border-none shadow-md rounded-2xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Account</Label>
                <Select value={selectedAccId} onValueChange={setSelectedAccId}>
                  <SelectTrigger className="bg-background/50 h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all">
                    <SelectValue placeholder="Choose an account..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id} className="font-sans">
                        <span className="font-mono text-xs mr-2 opacity-60">[{a.account_no}]</span> {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">From Date</Label>
                <Input 
                  type="date" 
                  value={from} 
                  onChange={(e) => setFrom(e.target.value)} 
                  className="h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Date</Label>
                <Input 
                  type="date" 
                  value={to} 
                  onChange={(e) => setTo(e.target.value)} 
                  className="h-11 border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/45 rounded-xl transition-all"
                />
              </div>
            </Card>
            <Button 
              disabled={!selectedAccount || statementRows.length === 0 || exporting} 
              onClick={() => handleExportStatement(selectedAccount, statementRows)}
              className="gradient-primary text-primary-foreground shadow-soft hover:shadow-glow h-11 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 self-stretch lg:self-auto"
            >
              <FileDown className="w-4 h-4" /> 
              {exporting ? "Exporting..." : "Export Statement PDF"}
            </Button>
          </div>

          {!selectedAccId ? (
            <Card className="glass p-16 text-center text-muted-foreground border-none rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-md">
              <div className="p-4 bg-primary/5 rounded-full text-primary">
                <Receipt className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-foreground">No Account Selected</p>
                <p className="text-sm max-w-sm mx-auto">Select a customer or supplier account from the dropdown list above to view their detailed transaction ledger and download their statement.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Account Detail Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Profile Card */}
                <Card className="glass p-5 rounded-2xl border-none shadow-md md:col-span-2 lg:col-span-2 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Profile</span>
                    <h3 className="text-xl font-extrabold text-foreground mt-1 tracking-tight">{selectedAccount?.name}</h3>
                    <p className="font-mono text-xs text-primary font-semibold mt-0.5">{selectedAccount?.account_no}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30 text-xs">
                    {selectedAccount?.mobile && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 opacity-70" />
                        <span>{selectedAccount.mobile}</span>
                      </div>
                    )}
                    {selectedAccount?.branches?.name && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 opacity-70" />
                        <span>{selectedAccount.branches.name}</span>
                      </div>
                    )}
                    {selectedAccount?.address && (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="truncate">{selectedAccount.address}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Opening Balance */}
                <Card className="glass p-5 rounded-2xl border-none shadow-md flex items-center justify-between group">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance</span>
                    <h4 className={`text-xl font-bold num tracking-tight ${statementTotals.opening >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMoney(statementTotals.opening, selectedAccount?.currency || "")}
                      <span className="text-[10px] font-bold opacity-75 bg-muted/30 px-1 py-0.5 rounded ml-1">
                        {balanceLabel(statementTotals.opening)}
                      </span>
                    </h4>
                  </div>
                  <div className="p-2.5 bg-muted/10 rounded-lg text-muted-foreground">
                    <Scale className="w-5 h-5" />
                  </div>
                </Card>

                {/* Cash In */}
                <Card className="glass p-5 rounded-2xl border-none shadow-md flex items-center justify-between group">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period Cash In</span>
                    <h4 className="text-xl font-bold num text-success tracking-tight">
                      {formatMoney(statementTotals.credit, selectedAccount?.currency || "")}
                    </h4>
                  </div>
                  <div className="p-2.5 bg-success/10 rounded-lg text-success">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                </Card>

                {/* Cash Out */}
                <Card className="glass p-5 rounded-2xl border-none shadow-md flex items-center justify-between group">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period Cash Out</span>
                    <h4 className="text-xl font-bold num text-destructive tracking-tight">
                      {formatMoney(statementTotals.debit, selectedAccount?.currency || "")}
                    </h4>
                  </div>
                  <div className="p-2.5 bg-destructive/10 rounded-lg text-destructive">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </Card>

                {/* Closing Balance */}
                <Card className="glass p-5 rounded-2xl border-none shadow-md flex items-center justify-between group">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closing Balance</span>
                    <h4 className={`text-xl font-bold num tracking-tight ${statementTotals.closing >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMoney(statementTotals.closing, selectedAccount?.currency || "")}
                      <span className="text-[10px] font-bold opacity-75 bg-muted/30 px-1 py-0.5 rounded ml-1">
                        {balanceLabel(statementTotals.closing)}
                      </span>
                    </h4>
                  </div>
                  <div className={`p-2.5 rounded-lg ${statementTotals.closing >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    <Scale className="w-5 h-5" />
                  </div>
                </Card>
              </div>

              {/* Transactions Table Card */}
              <Card className="glass overflow-hidden shadow-lg border-none rounded-2xl">
                <div className="p-5 border-b border-border/30 bg-muted/10 flex justify-between items-center">
                  <h2 className="font-display font-bold text-lg text-foreground">Transaction Entries</h2>
                  <Badge variant="secondary" className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border-none">
                    {statementRows.length} Entries
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground uppercase tracking-widest border-b border-border/30 bg-muted/5">
                        <th className="text-left font-bold px-6 py-4 w-36">Date</th>
                        <th className="text-left font-bold px-6 py-4">Details</th>
                        <th className="text-right font-bold px-6 py-4 w-32">Debit</th>
                        <th className="text-right font-bold px-6 py-4 w-32">Credit</th>
                        <th className="text-right font-bold px-6 py-4 w-40">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {statementRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-muted-foreground">
                            No transaction entries found for the selected period.
                          </td>
                        </tr>
                      ) : statementRows.map((t) => (
                        <tr key={t.id} className="hover:bg-primary/[0.02] transition-colors duration-150">
                          <td className="px-6 py-4 num text-muted-foreground whitespace-nowrap">{formatDate(t.txn_date || "")}</td>
                          <td className="px-6 py-4 font-medium text-foreground">{t.details}</td>
                          <td className="px-6 py-4 text-right num text-destructive font-semibold">
                            {Number(t.debit) > 0 ? formatMoney(Number(t.debit), selectedAccount?.currency || "") : "-"}
                          </td>
                          <td className="px-6 py-4 text-right num text-success font-semibold">
                            {Number(t.credit) > 0 ? formatMoney(Number(t.credit), selectedAccount?.currency || "") : "-"}
                          </td>
                          <td className={`px-6 py-4 text-right num font-bold ${t.balance >= 0 ? "text-success" : "text-destructive"}`}>
                            <span className="flex items-center justify-end gap-1">
                              {formatMoney(t.balance, selectedAccount?.currency || "")}
                              <span className="text-[10px] font-bold opacity-75 bg-muted/30 px-1 py-0.5 rounded">
                                {balanceLabel(t.balance)}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

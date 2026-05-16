import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileDown, FileBarChart, Users, Receipt } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { exportLedgerPDF, exportStatementPDF } from "@/lib/pdf";
import { useDebounce } from "@/hooks/useDebounce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

export default function Reports() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  
  // Statement specific state
  const [selectedAccId, setSelectedAccId] = useState("");
  const [statementTxns, setStatementTxns] = useState<Tables<"transactions">[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const loadAll = () => {
    Promise.all([
      supabase.from("accounts").select("id, account_no, name, mobile, address, currency, branches(name)"),
      supabase.from("transactions").select("account_id, debit, credit, txn_date"),
    ]).then(([a, t]) => { setAccounts(a.data ?? []); setTxns(t.data ?? []); });
  };

  useEffect(() => {
    loadAll();
    const sub = supabase.channel('reports_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
        loadAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const summary = useMemo(() => {
    const filteredTxns = txns.filter((t) => (!from || t.txn_date >= from) && (!to || t.txn_date <= to));
    return accounts
      .filter(a => !debouncedQ || a.name.toLowerCase().includes(debouncedQ.toLowerCase()) || a.account_no.toLowerCase().includes(debouncedQ.toLowerCase()))
      .map((a) => {
        const accTxns = filteredTxns.filter((t) => t.account_id === a.id);
        let debit = 0, credit = 0;
        accTxns.forEach((t) => { debit += Number(t.debit); credit += Number(t.credit); });
        return { ...a, debit, credit, net: credit - debit, txns: accTxns };
      });
  }, [accounts, txns, from, to, debouncedQ]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccId), [accounts, selectedAccId]);

  const loadStatement = () => {
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
  };

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
  }, [selectedAccId]);

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

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Insights</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
            <FileBarChart className="w-7 h-7 text-primary" /> Reports
          </h1>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 glass">
          <TabsTrigger value="ledger" className="flex items-center gap-2"><Users className="w-4 h-4" /> Ledger Summary</TabsTrigger>
          <TabsTrigger value="statement" className="flex items-center gap-2"><Receipt className="w-4 h-4" /> Account Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-6 outline-none">
          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <Card className="glass p-4 grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
              <div className="relative">
                <Label className="text-xs text-muted-foreground">Search Account</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or number..." className="pl-10" />
                </div>
              </div>
              <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </Card>
            <Button onClick={() => exportLedgerPDF(summary)} className="gradient-primary text-primary-foreground shadow-soft h-12"><FileDown className="w-4 h-4 mr-1" /> Export Ledger PDF</Button>
          </div>

          <Card className="glass overflow-hidden shadow-xl border-none">
            <div className="p-4 border-b border-border/50 bg-muted/20">
              <h2 className="font-display font-semibold">All Accounts Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left font-medium px-4 py-3">Account No</th>
                    <th className="text-left font-medium px-4 py-3">Name</th>
                    <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Branch</th>
                    <th className="text-left font-medium px-4 py-3">Cur</th>
                    <th className="text-right font-medium px-4 py-3">Debit</th>
                    <th className="text-right font-medium px-4 py-3">Credit</th>
                    <th className="text-right font-medium px-4 py-3">Net</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No data.</td></tr>
                  ) : summary.map((r) => (
                    <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.account_no}</td>
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{r.branches?.name ?? "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant="secondary" className="font-mono text-xs">{r.currency}</Badge></td>
                      <td className="px-4 py-2.5 text-right num text-destructive">{formatMoney(r.debit, r.currency)}</td>
                      <td className="px-4 py-2.5 text-right num text-success">{formatMoney(r.credit, r.currency)}</td>
                      <td className={`px-4 py-2.5 text-right num font-semibold ${r.net >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatMoney(r.net, r.currency)} <span className="text-xs">{balanceLabel(r.net)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportStatementPDF(r, r.txns, profile)} title="Statement"><FileDown className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="statement" className="space-y-6 outline-none">
          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <Card className="glass p-4 grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
              <div>
                <Label className="text-xs text-muted-foreground">Select Account</Label>
                <Select value={selectedAccId} onValueChange={setSelectedAccId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Choose an account..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_no} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </Card>
            <Button 
              disabled={!selectedAccount || statementRows.length === 0} 
              onClick={() => exportStatementPDF(selectedAccount, statementRows, profile)}
              className="gradient-primary text-primary-foreground shadow-soft h-12"
            >
              <FileDown className="w-4 h-4 mr-1" /> Export Statement PDF
            </Button>
          </div>

          {!selectedAccId ? (
            <Card className="glass p-12 text-center text-muted-foreground">
              Select an account above to generate a statement report.
            </Card>
          ) : (
            <Card className="glass overflow-hidden shadow-xl border-none">
              <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
                <h2 className="font-display font-semibold">Statement: {selectedAccount?.name}</h2>
                <Badge variant="outline">{selectedAccount?.currency}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left px-6 py-4">Date</th>
                      <th className="text-left px-6 py-4">Details</th>
                      <th className="text-right px-6 py-4">Debit</th>
                      <th className="text-right px-6 py-4">Credit</th>
                      <th className="text-right px-6 py-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementRows.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No transactions found for the selected period.</td></tr>
                    ) : statementRows.map((t) => (
                      <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-6 py-4 num text-muted-foreground whitespace-nowrap">{formatDate(t.txn_date)}</td>
                        <td className="px-6 py-4 font-medium">{t.details}</td>
                        <td className="px-6 py-4 text-right num text-destructive font-medium">{Number(t.debit) > 0 ? formatMoney(Number(t.debit)) : "—"}</td>
                        <td className="px-6 py-4 text-right num text-success font-medium">{Number(t.credit) > 0 ? formatMoney(Number(t.credit)) : "—"}</td>
                        <td className={`px-6 py-4 text-right num font-bold ${t.balance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatMoney(t.balance)} <span className="text-[10px] opacity-60 ml-0.5">{balanceLabel(t.balance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

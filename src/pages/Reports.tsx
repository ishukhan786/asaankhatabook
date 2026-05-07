import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { exportLedgerPDF, exportStatementPDF } from "@/lib/pdf";
import { Search, FileDown, FileBarChart } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export default function Reports() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    Promise.all([
      supabase.from("accounts").select("id, account_no, name, currency, branches(name)"),
      supabase.from("transactions").select("account_id, debit, credit, txn_date"),
    ]).then(([a, t]) => { setAccounts(a.data ?? []); setTxns(t.data ?? []); });
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

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Insights</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
            <FileBarChart className="w-7 h-7 text-primary" /> Reports
          </h1>
        </div>
        <Button onClick={() => exportLedgerPDF(summary)} className="gradient-primary text-primary-foreground shadow-soft"><FileDown className="w-4 h-4 mr-1" /> Export Ledger PDF</Button>
      </div>

      <Card className="glass p-4 grid md:grid-cols-3 gap-3">
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

      <Card className="glass overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-display font-semibold">All Accounts Summary</h2>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportStatementPDF(r, r.txns)} title="Statement"><FileDown className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

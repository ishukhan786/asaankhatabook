import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowDownLeft, ArrowUpRight, Wallet, Users, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatMoney, balanceLabel } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface AccountBalance {
  id: string;
  name: string;
  account_no: string;
  currency: string;
  branch_name: string;
  balance: number;
}

export default function PayablesReceivables() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<AccountBalance[]>([]);
  const [payables, setPayables] = useState<AccountBalance[]>([]);
  const [q, setQ] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: accounts }, { data: transactions }] = await Promise.all([
        supabase.from("accounts").select("id, name, account_no, currency, branches(name)"),
        supabase.from("transactions").select("account_id, debit, credit")
      ]);

      const balances: Record<string, number> = {};
      (transactions ?? []).forEach(t => {
        const net = Number(t.credit) - Number(t.debit);
        balances[t.account_id] = (balances[t.account_id] || 0) + net;
      });

      const processed: AccountBalance[] = (accounts ?? []).map(a => ({
        id: a.id,
        name: a.name,
        account_no: a.account_no,
        currency: a.currency,
        branch_name: (a.branches as any)?.name ?? "—",
        balance: balances[a.id] || 0
      }));

      // Filter: Balance < 0 (DR) => Receivable, Balance > 0 (CR) => Payable
      setReceivables(processed.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance));
      setPayables(processed.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance));
    } catch (err) {
      console.error("Error loading payables/receivables:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filterList = (list: AccountBalance[]) => {
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter(item => 
      item.name.toLowerCase().includes(s) || 
      item.account_no.toLowerCase().includes(s)
    );
  };

  const filteredReceivables = filterList(receivables);
  const filteredPayables = filterList(payables);

  const totalReceivable = receivables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);
  const totalPayable = payables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Reports")}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{t("PayablesReceivables")}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass p-5 border-l-4 border-l-destructive shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalReceivable")}</div>
              <div className="text-2xl font-display font-black text-destructive num">
                {formatMoney(totalReceivable, "PKR")}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t("Denedari")}</div>
        </Card>

        <Card className="glass p-5 border-l-4 border-l-success shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalPayable")}</div>
              <div className="text-2xl font-display font-black text-success num">
                {formatMoney(totalPayable, "PKR")}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t("Lenedari")}</div>
        </Card>
      </div>

      <Card className="glass p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder={t("Search") || "Search..."} 
            className="pl-10 h-12 bg-background/50 border-none shadow-inner"
          />
        </div>
      </Card>

      <Tabs defaultValue="receivables" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-12 glass p-1">
          <TabsTrigger value="receivables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("Receivables")} ({receivables.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("Payables")} ({payables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReceivables.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass rounded-2xl">
                No receivables found.
              </div>
            ) : (
              filteredReceivables.map((a, i) => (
                <motion.div 
                  key={a.id} 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className="cursor-pointer"
                >
                  <Card className="glass p-5 hover:shadow-lift hover:scale-[1.02] transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-destructive/10 transition-colors" />
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-destructive" />
                      </div>
                      <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 font-mono">
                        DR
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-lg leading-tight truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{a.account_no}</div>
                    </div>
                    <div className="mt-6 flex items-end justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{a.branch_name}</div>
                      <div className="text-xl font-display font-black text-destructive num">
                        {formatMoney(Math.abs(a.balance), a.currency)}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="payables" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPayables.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass rounded-2xl">
                No payables found.
              </div>
            ) : (
              filteredPayables.map((a, i) => (
                <motion.div 
                  key={a.id} 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className="cursor-pointer"
                >
                  <Card className="glass p-5 hover:shadow-lift hover:scale-[1.02] transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-success/10 transition-colors" />
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-success" />
                      </div>
                      <Badge variant="outline" className="bg-success/5 text-success border-success/20 font-mono">
                        CR
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-lg leading-tight truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{a.account_no}</div>
                    </div>
                    <div className="mt-6 flex items-end justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{a.branch_name}</div>
                      <div className="text-xl font-display font-black text-success num">
                        {formatMoney(Math.abs(a.balance), a.currency)}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

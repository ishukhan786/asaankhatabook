import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Wallet, Users, Receipt, TrendingUp, MapPin, Hash, Plus } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { motion } from "framer-motion";

export default function BranchDetail() {
  const { id } = useParams();
  const [branch, setBranch] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBranch = async () => {
    if (!id) return;
    const [{ data: b }, { data: a }] = await Promise.all([
      supabase.from("branches").select("*").eq("id", id).maybeSingle(),
      supabase.from("accounts").select("*, transactions(debit, credit)").eq("branch_id", id),
    ]);
    setBranch(b);
    setAccounts(a ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadBranch();
    if (!id) return;

    const sub = supabase.channel(`branch_detail_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches', filter: `id=eq.${id}` }, () => {
        loadBranch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `branch_id=eq.${id}` }, () => {
        loadBranch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadBranch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [id]);

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-1/4" /><Skeleton className="h-64" /></div>;
  if (!branch) return <div className="p-8 text-center text-muted-foreground">Branch not found.</div>;

  const stats = accounts?.reduce((acc: any, curr: any) => {
    const balance = curr.transactions?.reduce((sum: number, tx: any) => sum + (Number(tx.credit) - Number(tx.debit)), 0) || 0;
    if (!acc[curr.currency]) acc[curr.currency] = { count: 0, balance: 0 };
    acc[curr.currency].count++;
    acc[curr.currency].balance += balance;
    return acc;
  }, {}) || {};

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      <Link to="/branches" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Branches
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="font-mono uppercase tracking-tighter">{branch.code}</Badge>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{branch.name}</h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5">
             <MapPin className="w-3.5 h-3.5" /> Established Business Unit
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(stats).map(([curr, data]: [string, any]) => (
            <Card key={curr} className="glass p-4 border-l-4 border-l-primary/40">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{curr} Net Liquidity</div>
              <div className={`font-display font-bold text-xl num ${data.balance >= 0 ? "text-success" : "text-destructive"}`}>
                {formatMoney(data.balance, curr as any)}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass p-6">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <Users className="w-5 h-5" />
            <h2 className="font-display font-bold">Branch Accounts</h2>
          </div>
          <div className="text-4xl font-display font-black mb-1">{accounts?.length || 0}</div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Total Registered Accounts</p>
        </Card>
        
        <Card className="glass p-6">
          <div className="flex items-center gap-3 mb-4 text-accent">
            <TrendingUp className="w-5 h-5" />
            <h2 className="font-display font-bold">Activity Status</h2>
          </div>
          <div className="text-4xl font-display font-black mb-1 text-success">Active</div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Real-time Synchronization</p>
        </Card>

        <Card className="glass p-6">
          <div className="flex items-center gap-3 mb-4 text-indigo-500">
            <Hash className="w-5 h-5" />
            <h2 className="font-display font-bold">Branch ID</h2>
          </div>
          <div className="text-sm font-mono text-muted-foreground break-all">{branch.id}</div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-2">System GUID Reference</p>
        </Card>
      </div>

      <Card className="glass overflow-hidden border-none shadow-2xl">
        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Branch Ledger Accounts
          </h2>
          <Link to="/accounts/new">
            <Button size="sm" className="gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-1" /> New Account
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-bold px-6 py-4">Account</th>
                <th className="text-left font-bold px-6 py-4">Currency</th>
                <th className="text-right font-bold px-6 py-4">Balance</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {accounts?.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No accounts registered in this branch.</td></tr>
              ) : accounts?.map((acc) => {
                const balance = acc.transactions?.reduce((sum: number, tx: any) => sum + (Number(tx.credit) - Number(tx.debit)), 0) || 0;
                return (
                  <tr key={acc.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-base">{acc.name}</div>
                      <div className="text-xs font-mono text-muted-foreground uppercase">{acc.account_no}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-bold">{acc.currency}</Badge>
                    </td>
                    <td className={`px-6 py-4 text-right font-display font-bold text-lg num ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatMoney(balance, acc.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/accounts/${acc.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          View Ledger <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

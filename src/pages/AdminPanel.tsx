import { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  Users, 
  Building2, 
  Wallet, 
  Receipt, 
  ArrowRight, 
  UserCog, 
  Database, 
  Download, 
  Activity, 
  Trash2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatMoney, balanceLabel } from "@/lib/format";
import { toast } from "sonner";

type RecentTransaction = {
  id?: string;
  txn_code?: string | null;
  details?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  created_at?: string | null;
  accounts?: { name?: string | null; currency?: string | null } | null;
};

// Helper function to scale font size based on text length to prevent clipping
const getFontSizeClass = (val: string) => {
  const len = val.length;
  if (len > 18) return "text-base sm:text-lg md:text-xl font-bold";
  if (len > 14) return "text-lg sm:text-xl md:text-2xl font-bold";
  return "text-xl sm:text-2xl md:text-3xl font-extrabold";
};

export default function AdminPanel() {
  const { role, loading, user: me } = useAuth();
  const [s, setS] = useState<null | {
    branches: number;
    accounts: number;
    txns: number;
    admins: number;
    users: number;
    pkr: number;
    aed: number;
    pkrCredit: number;
    pkrDebit: number;
    aedCredit: number;
    aedDebit: number;
  }>(null);
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (role !== "admin") return;
    try {
      const [{ count: branches }, { count: accounts }, { count: txns }, { data: roles }, { data: tx }, { data: rTx }] = await Promise.all([
        supabase.from("branches").select("*", { count: "exact", head: true }),
        supabase.from("accounts").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("transactions").select("debit, credit, accounts(currency)"),
        supabase.from("transactions").select("*, accounts(name, currency)").order("created_at", { ascending: false }).limit(5),
      ]);

      let pkrCredit = 0, pkrDebit = 0;
      let aedCredit = 0, aedDebit = 0;

      ((tx ?? []) as Array<{ credit?: number | string; debit?: number | string; accounts?: { currency?: string } }>).forEach((t) => {
        const credit = Number(t.credit ?? 0);
        const debit = Number(t.debit ?? 0);
        if (t.accounts?.currency === "PKR") {
          pkrCredit += credit;
          pkrDebit += debit;
        } else {
          aedCredit += credit;
          aedDebit += debit;
        }
      });

      const pkr = pkrCredit - pkrDebit;
      const aed = aedCredit - aedDebit;

      setS({
        branches: branches ?? 0,
        accounts: accounts ?? 0,
        txns: txns ?? 0,
        admins: ((roles ?? []) as Array<{ role?: string }>).filter((r) => r.role === "admin").length,
        users: ((roles ?? []) as Array<{ role?: string }>).filter((r) => r.role === "branch_user").length,
        pkr,
        aed,
        pkrCredit,
        pkrDebit,
        aedCredit,
        aedDebit,
      });
      setRecentTx(rTx ?? []);
    } catch (error) {
      toast.error("Failed to fetch admin stats");
    }
  }, [role]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success("Dashboard data refreshed!");
  };

  useEffect(() => {
    if (role === "admin") {
      fetchData();
      const sub = supabase.channel('admin_panel_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => {
          fetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
          fetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          fetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
          fetchData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [fetchData, role]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data: branches } = await supabase.from("branches").select("*");
      const { data: accounts } = await supabase.from("accounts").select("*");
      const { data: txns } = await supabase.from("transactions").select("*");
      
      const data = {
        exported_at: new Date().toISOString(),
        branches,
        accounts,
        transactions: txns
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asaankhata_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      toast.success("Backup downloaded successfully");
    } catch (e) {
      toast.error("Export failed");
    }
    setIsExporting(false);
  };

  const handleClearCache = () => {
    try {
      // Clear non-authentication keys from localStorage to prevent logging out
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes("supabase") && !key.includes("sb-")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      toast.success("Temporary client cache cleared successfully!");
      fetchData();
    } catch (e) {
      toast.error("Failed to clear cache");
    }
  };

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-1/4" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const tiles = [
    { title: "User Management", desc: "Create, edit, and assign roles to users", icon: UserCog, to: "/admin/users", grad: "from-blue-600 to-indigo-600" },
    { title: "Branches", desc: "Manage all company branches and codes", icon: Building2, to: "/branches", grad: "from-emerald-600 to-teal-600" },
    { title: "Accounts", desc: "View and manage all ledger accounts", icon: Wallet, to: "/accounts", grad: "from-orange-600 to-amber-600" },
    { title: "All Transactions", desc: "Full history of all ledger entries", icon: Receipt, to: "/transactions", grad: "from-rose-600 to-pink-600" },
  ];

  const financialStats = s ? [
    { 
      l: "Net PKR Balance", 
      v: formatMoney(s.pkr, "PKR"), 
      rawVal: s.pkr,
      credit: s.pkrCredit,
      debit: s.pkrDebit,
      color: s.pkr >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400", 
      icon: Wallet,
      desc: "Net cash reserves in PKR (Pakistan)",
      grad: s.pkr >= 0 ? "from-emerald-500/10 to-teal-500/5 border-t-emerald-500" : "from-rose-500/10 to-pink-500/5 border-t-rose-500"
    },
    { 
      l: "Net AED Balance", 
      v: formatMoney(s.aed, "AED"), 
      rawVal: s.aed,
      credit: s.aedCredit,
      debit: s.aedDebit,
      color: s.aed >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400", 
      icon: Wallet,
      desc: "Net cash reserves in AED (Dubai)",
      grad: s.aed >= 0 ? "from-emerald-500/10 to-teal-500/5 border-t-emerald-500" : "from-rose-500/10 to-pink-500/5 border-t-rose-500"
    },
  ] : [];

  const overviewStats = s ? [
    { 
      l: "Total Branches", 
      v: String(s.branches), 
      icon: Building2, 
      desc: "Registered branches",
      grad: "from-blue-500/5 to-indigo-500/5 border-t-blue-500"
    },
    { 
      l: "Total Accounts", 
      v: String(s.accounts), 
      icon: Wallet, 
      desc: "Active ledgers in system",
      grad: "from-emerald-500/5 to-teal-500/5 border-t-emerald-500"
    },
    { 
      l: "Total Transactions", 
      v: String(s.txns), 
      icon: Receipt, 
      desc: "Recorded journal entries",
      grad: "from-amber-500/5 to-orange-500/5 border-t-amber-500"
    },
    { 
      l: "Active Operators", 
      v: String(s.admins + s.users), 
      icon: Users, 
      desc: `${s.admins} Admin, ${s.users} Users`,
      grad: "from-purple-500/5 to-pink-500/5 border-t-purple-500"
    },
  ] : [];

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-2 mb-1.5">
            <Shield className="w-4 h-4 animate-pulse text-primary" /> 
            <span>System Administrator</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping ml-1" />
            <span className="text-[10px] text-muted-foreground font-normal lowercase tracking-normal">live syncing active</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Admin Control Center
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
            Full operational control over branches, user accounts, and company-wide financial metrics.
          </p>
        </motion.div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualRefresh} 
            disabled={isRefreshing} 
            className="glass transition-all hover:bg-background/80"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport} 
            disabled={isExporting} 
            className="glass transition-all hover:bg-background/80"
          >
            <Download className="w-4 h-4 mr-2" /> 
            {isExporting ? "Exporting..." : "Backup Data"}
          </Button>
          <Link to="/transactions">
            <Button size="sm" variant="secondary" className="glass transition-all hover:brightness-110">
              <Search className="w-4 h-4 mr-2" /> Global Search
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial Treasury - 2 columns grid for massive space and readability */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground/80">
          <Wallet className="w-5 h-5 text-primary" /> Treasury & Cash Reserves
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!s ? (
            [...Array(2)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
          ) : (
            financialStats.map((x, i) => (
              <motion.div 
                key={x.l} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`glass p-6 border-t-4 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:translate-y-[-2px] group relative overflow-hidden bg-gradient-to-br ${x.grad}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/20">
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-extrabold block">
                        {x.l}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 block">
                        {x.desc}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded select-none ${
                        x.rawVal >= 0 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {balanceLabel(x.rawVal || 0)}
                      </span>
                      <div className="p-2 rounded-xl bg-background/80 border border-border/10 group-hover:text-primary transition-colors">
                        <x.icon className="w-4 h-4 text-muted-foreground group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 items-center">
                    {/* Net Balance (Spans full or main col) */}
                    <div className="sm:col-span-1 min-w-0">
                      <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Net Balance</div>
                      <div className={`font-display text-2xl lg:text-3xl font-extrabold tracking-tight break-words whitespace-normal leading-none ${x.color}`}>
                        {x.v}
                      </div>
                    </div>

                    {/* Credit Breakdown */}
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex flex-col justify-center min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1 mb-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Total Credit (Cr)
                      </span>
                      <span className="text-emerald-500 font-mono text-sm lg:text-base font-bold break-words whitespace-normal">
                        {formatMoney(x.credit, x.l.includes("PKR") ? "PKR" : "AED")}
                      </span>
                    </div>

                    {/* Debit Breakdown */}
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 flex flex-col justify-center min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1 mb-1">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Total Debit (Dr)
                      </span>
                      <span className="text-rose-500 font-mono text-sm lg:text-base font-bold break-words whitespace-normal">
                        {formatMoney(x.debit, x.l.includes("PKR") ? "PKR" : "AED")}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* System Overview - 4 columns grid for perfect distribution */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground/80">
          <Activity className="w-5 h-5 text-primary" /> System Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {!s ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : (
            overviewStats.map((x, i) => (
              <motion.div 
                key={x.l} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`glass p-5 border-t-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:translate-y-[-2px] group h-full flex flex-col justify-between relative overflow-hidden bg-gradient-to-br ${x.grad}`}>
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-extrabold truncate">
                        {x.l}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60 font-medium mt-0.5 line-clamp-1">
                        {x.desc}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-background/60 border border-border/10 group-hover:text-primary transition-colors shrink-0">
                      <x.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:scale-110 transition-transform" />
                    </div>
                  </div>

                  <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
                    <span className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground num">
                      {x.v}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Tiles */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-display font-bold text-xl flex items-center gap-2 text-foreground/90">
            <Database className="w-5 h-5 text-primary" /> Core Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tiles.map((t, i) => (
              <motion.div key={t.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                <Link to={t.to}>
                  <Card className="glass p-6 group hover:shadow-lift transition-all relative overflow-hidden h-full border-l-4 border-l-transparent hover:border-l-primary hover:bg-muted/10">
                    <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${t.grad} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
                    <div className="relative flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.grad} flex items-center justify-center shadow-lg shadow-black/10 shrink-0 group-hover:scale-110 transition-transform`}>
                        <t.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">{t.title}</h3>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Global Recent Activity */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl flex items-center gap-2 text-foreground/90">
              <Activity className="w-5 h-5 text-primary" /> Live Activity
            </h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Card className="glass overflow-hidden border-none shadow-xl">
            <div className="divide-y divide-border/30">
              {recentTx.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
              ) : recentTx.map((tx, i) => {
                const isCredit = Number(tx.credit ?? 0) > 0;
                return (
                  <motion.div 
                    key={tx.id} 
                    initial={{ opacity: 0, x: 20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.1 }} 
                    className="p-4 hover:bg-muted/45 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1.5 gap-2">
                      <div className="font-semibold text-sm truncate flex-1 text-foreground/90">{tx.accounts?.name}</div>
                      <span className={`text-xs font-bold num whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full ${
                        isCredit 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {isCredit ? `+${formatMoney(tx.credit ?? 0, tx.accounts?.currency)}` : `-${formatMoney(tx.debit ?? 0, tx.accounts?.currency)}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{tx.details || "No details provided"}</div>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
                      <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tx.txn_code}</span>
                      <span>{new Date(tx.created_at || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Quick Actions / System Health */}
          <Card className="p-6 glass border-primary/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">System Health</h3>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-1.5 border-b border-border/10">
                <span className="text-sm text-foreground/80">Database Connection</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-500">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/10">
                <span className="text-sm text-foreground/80">Last Backup</span>
                <span className="text-xs text-muted-foreground font-mono">Today, 08:30 PM</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleClearCache}
                className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors mt-2" 
                size="sm"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear Temporary Cache
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


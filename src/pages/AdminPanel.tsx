import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Building2, Wallet, Receipt, ArrowRight, UserCog, Database, Download, Activity, Trash2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatMoney, balanceLabel } from "@/lib/format";
import { toast } from "sonner";

export default function AdminPanel() {
  const { role, loading, user: me } = useAuth();
  const [s, setS] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = async () => {
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

      let pkr = 0, aed = 0;
      (tx ?? []).forEach((t: any) => {
        const net = Number(t.credit) - Number(t.debit);
        if (t.accounts?.currency === "PKR") pkr += net; else aed += net;
      });

      setS({
        branches: branches ?? 0,
        accounts: accounts ?? 0,
        txns: txns ?? 0,
        admins: (roles ?? []).filter((r: any) => r.role === "admin").length,
        users: (roles ?? []).filter((r: any) => r.role === "branch_user").length,
        pkr, aed,
      });
      setRecentTx(rTx ?? []);
    } catch (error) {
      toast.error("Failed to fetch admin stats");
    }
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
  }, [role]);

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

  if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-1/4" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const tiles = [
    { title: "User Management", desc: "Create, edit, and assign roles to users", icon: UserCog, to: "/admin/users", grad: "from-blue-600 to-indigo-600" },
    { title: "Branches", desc: "Manage all company branches and codes", icon: Building2, to: "/branches", grad: "from-emerald-600 to-teal-600" },
    { title: "Accounts", desc: "View and manage all ledger accounts", icon: Wallet, to: "/accounts", grad: "from-orange-600 to-amber-600" },
    { title: "All Transactions", desc: "Full history of all ledger entries", icon: Receipt, to: "/transactions", grad: "from-rose-600 to-pink-600" },
  ];

  const stats = s ? [
    { l: "Total Branches", v: s.branches, icon: Building2 },
    { l: "Total Accounts", v: s.accounts, icon: Wallet },
    { l: "Total Transactions", v: s.txns, icon: Receipt },
    { l: "Active Users", v: `${s.admins + s.users}`, icon: Users },
    { l: "Net PKR", v: formatMoney(s.pkr, "PKR"), color: s.pkr >= 0 ? "text-success" : "text-destructive" },
    { l: "Net AED", v: formatMoney(s.aed, "AED"), color: s.aed >= 0 ? "text-success" : "text-destructive" },
  ] : [];

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4" /> System Administrator
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Admin Control Center
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            Full operational control over branches, user accounts, and financial data.
          </p>
        </motion.div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="glass">
            <Download className="w-4 h-4 mr-2" /> {isExporting ? "Exporting..." : "Backup Data"}
          </Button>
          <Link to="/transactions">
            <Button size="sm" variant="secondary" className="glass">
              <Search className="w-4 h-4 mr-2" /> Global Search
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {!s ? [...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : stats.map((x, i) => (
          <motion.div key={x.l} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass p-5 border-t-2 border-t-primary/20 hover:border-t-primary transition-all group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{x.l}</div>
                {x.icon && <x.icon className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
              </div>
              <div className={`font-display font-bold text-xl lg:text-2xl mt-1 num ${x.color || ""}`}>{x.v}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Tiles */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Core Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tiles.map((t, i) => (
              <motion.div key={t.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                <Link to={t.to}>
                  <Card className="glass p-6 group hover:shadow-lift transition-all relative overflow-hidden h-full border-l-4 border-l-transparent hover:border-l-primary">
                    <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${t.grad} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
                    <div className="relative flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.grad} flex items-center justify-center shadow-lg shadow-black/10 shrink-0 group-hover:scale-110 transition-transform`}>
                        <t.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display font-bold text-lg">{t.title}</h3>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
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
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Live Activity
            </h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <Card className="glass overflow-hidden border-none shadow-xl">
            <div className="divide-y divide-border/30">
              {recentTx.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
              ) : recentTx.map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-sm truncate max-w-[150px]">{tx.accounts?.name}</div>
                    <div className={`text-xs font-bold num ${Number(tx.credit) > 0 ? "text-success" : "text-destructive"}`}>
                      {Number(tx.credit) > 0 ? `+${formatMoney(tx.credit, tx.accounts?.currency)}` : `-${formatMoney(tx.debit, tx.accounts?.currency)}`}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{tx.details}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/60">
                    <span className="font-mono uppercase">{tx.txn_code}</span>
                    <span>{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Quick Actions / System Health */}
          <Card className="p-6 glass border-primary/10">
            <h3 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">System Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database Connection</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-medium text-success">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Backup</span>
                <span className="text-xs text-muted-foreground">Today, 08:30 PM</span>
              </div>
              <Button variant="ghost" className="w-full justify-start text-xs text-destructive hover:bg-destructive/10" size="sm">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear Temporary Cache
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


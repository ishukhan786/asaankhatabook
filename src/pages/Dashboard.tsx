import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Users, ArrowDownLeft, ArrowUpRight, Plus, Receipt, TrendingUp, Building2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

interface Stats {
  accounts: number;
  branches: number;
  netPKR: number;
  netAED: number;
  todayPKR: { debit: number; credit: number };
  todayAED: { debit: number; credit: number };
  totalExpensePKR: number;
  totalExpenseAED: number;
  byBranch: { name: string; pkr: number; aed: number; accounts: number }[];
  trend: { date: string; pkr: number; aed: number }[];
  totalReceivable: number;
  totalPayable: number;
}

type TransactionWithAccount = Tables<"transactions"> & {
  accounts?: { name?: string | null; account_no?: string | null; currency?: string | null } | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<TransactionWithAccount[]>([]);
  const [Recharts, setRecharts] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    import("recharts").then((mod) => {
      if (mounted) setRecharts(mod);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const load = async () => {
    try {
      const [{ data: recentTx }, { data: summaryRow }, branchResult, { data: trendRows }] = await Promise.all([
        supabase.from("transactions").select("*, accounts(name, account_no, currency)").order("created_at", { ascending: false }).limit(5),
        supabase.rpc("dashboard_summary").single(),
        supabase.rpc("dashboard_branch_distribution"),
        supabase.rpc("dashboard_trend", { p_days: 15 }),
      ]);

      const netPKR = Number(summaryRow?.net_pkr ?? 0), netAED = Number(summaryRow?.net_aed ?? 0);
      const todayPKR = { debit: Number(summaryRow?.today_debit_pkr ?? 0), credit: Number(summaryRow?.today_credit_pkr ?? 0) };
      const todayAED = { debit: Number(summaryRow?.today_debit_aed ?? 0), credit: Number(summaryRow?.today_credit_aed ?? 0) };
      const totalExpensePKR = Number(summaryRow?.total_expense_pkr ?? 0), totalExpenseAED = Number(summaryRow?.total_expense_aed ?? 0);
      const totalReceivable = Number(summaryRow?.total_receivable ?? 0), totalPayable = Number(summaryRow?.total_payable ?? 0);
      type BranchRPC = { branch_name?: string; pkr?: number | string; aed?: number | string; accounts_count?: number | string };
      let branchData = (branchResult.data ?? []).map((b: BranchRPC) => ({
        name: String(b.branch_name ?? ""),
        pkr: Number(b.pkr ?? 0),
        aed: Number(b.aed ?? 0),
        accounts: Number(b.accounts_count ?? 0),
      }));

      // Fallback for environments where branch RPC is missing or blocked by policy/RLS.
      if (!branchData || branchData.length === 0) {
        const [{ data: branches }, { data: accounts }] = await Promise.all([
          supabase.from("branches").select("id, name"),
          supabase.from("accounts").select("id, branch_id"),
        ]);
        const accountCountByBranch = new Map<string, number>();
        (accounts ?? []).forEach((a: { branch_id?: string }) => {
          accountCountByBranch.set(String(a.branch_id ?? ""), (accountCountByBranch.get(String(a.branch_id ?? "")) ?? 0) + 1);
        });
        branchData = (branches ?? []).map((b: { id?: string; name?: string }) => ({
          name: String(b.name ?? ""),
          pkr: 0,
          aed: 0,
          accounts: accountCountByBranch.get(String(b.id ?? "")) ?? 0,
        }));
      }

      const trendData = (trendRows ?? []).map((tRow: { txn_date?: string; pkr?: number | string; aed?: number | string }) => ({
        date: new Date(String(tRow.txn_date ?? "")).toLocaleDateString(i18n.language === "ur" ? "ur-PK" : "en-PK", { day: "2-digit", month: "short" }),
        pkr: Number(tRow.pkr ?? 0),
        aed: Number(tRow.aed ?? 0),
      }));

      setStats({
        accounts: Number(summaryRow?.accounts_count ?? 0),
        branches: Number(summaryRow?.branches_count ?? 0),
        netPKR, netAED, todayPKR, todayAED,
        totalExpensePKR, totalExpenseAED,
        byBranch: branchData,
        trend: trendData,
        totalReceivable,
        totalPayable
      });
      setRecent((recentTx ?? []) as Tables<"transactions">[]);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  };
  const scheduleLoad = useRealtimeRefresh(load, 700);

  useEffect(() => {
    load();
    // Setup Realtime Subscriptions
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, scheduleLoad)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const cards = [
    { label: t("Accounts"), value: stats.accounts.toString(), icon: Users, gradient: "from-primary to-primary-glow", sub: `${stats.branches} ${t("Branches").toLowerCase()}`, hint: t("HintActiveAccounts") },
    { label: t("NetBalance") + " (PKR)", value: formatMoney(stats.netPKR, "PKR"), icon: Wallet, gradient: "from-accent to-accent-glow", sub: balanceLabel(stats.netPKR), hint: `${t("Today")} D ${formatMoney(stats.todayPKR.debit, "PKR")} | C ${formatMoney(stats.todayPKR.credit, "PKR")}`, positive: stats.netPKR >= 0 },
    { label: t("NetBalance") + " (AED)", value: formatMoney(stats.netAED, "AED"), icon: TrendingUp, gradient: "from-emerald-600 to-teal-500", sub: balanceLabel(stats.netAED), hint: `${t("Today")} D ${formatMoney(stats.todayAED.debit, "AED")} | C ${formatMoney(stats.todayAED.credit, "AED")}`, positive: stats.netAED >= 0 },
    {
      label: t("Expenses"),
      value: formatMoney(stats.totalExpensePKR, "PKR"),
      sub: stats.totalExpenseAED > 0 ? `+ ${formatMoney(stats.totalExpenseAED, "AED")}` : "0 AED",
      icon: Receipt,
      gradient: "from-rose-500 to-orange-500",
      hint: t("HintExpenses"),
      positive: false
    },
    {
      label: t("TotalReceivable"),
      value: formatMoney(stats.totalReceivable, "PKR"),
      sub: t("Denedari"),
      icon: ArrowDownLeft,
      gradient: "from-amber-500 to-orange-400",
      hint: t("HintReceivable"),
      positive: false,
      url: "/payables-receivables"
    },
    {
      label: t("TotalPayable"),
      value: formatMoney(stats.totalPayable, "PKR"),
      sub: t("Lenedari"),
      icon: ArrowUpRight,
      gradient: "from-blue-500 to-indigo-400",
      hint: t("HintPayable"),
      positive: true,
      url: "/payables-receivables"
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">{role === "admin" ? t("AdminPanel") : t("Dashboard")}</div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              {t("Welcome", { name: profile?.full_name?.split(" ")[0] ?? "there" })}
            </h1>
            <p className="text-muted-foreground mt-1">Here's what's happening across your ledger today.</p>
          </div>
           <div className="flex gap-2 flex-wrap items-center">
            {role === "admin" && (
              <Link to="/branches"><Button variant="secondary" className="glass"><Building2 className="w-4 h-4 mr-1" /> {t("Branches")}</Button></Link>
            )}
            <Link to="/accounts/new"><Button className="gradient-primary text-primary-foreground shadow-soft"><Plus className="w-4 h-4 mr-1" /> {t("NewAccount")}</Button></Link>
            <Link to="/transactions/new"><Button variant="outline" className="border-2"><Receipt className="w-4 h-4 mr-1" /> {t("NewTransaction")}</Button></Link>
          </div>
        </div>

        {/* Access Debugger (Hidden from non-admins eventually, but shown now for troubleshooting) */}
        {!role && (
          <div className="mt-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span><strong>Access Limited:</strong> Your account does not have Admin privileges. Role: <strong>{role ?? "None"}</strong></span>
            </div>
            <div className="text-[10px] font-mono opacity-50">UID: {profile?.id}</div>
          </div>
        )}
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className={c.url ? "cursor-pointer" : ""}>
            <Card 
              className="glass p-5 relative overflow-hidden group hover:shadow-lift transition-all h-full"
              onClick={() => c.url && navigate(c.url)}
            >
              <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${c.gradient} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-soft`}>
                    <c.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{c.label}</div>
                <div className="text-2xl font-display font-bold mt-1 num">{c.value}</div>
                <div className={`text-xs mt-1 num ${c.positive === false ? "text-destructive" : c.positive === true ? "text-success" : "text-muted-foreground"}`}>{c.sub}</div>
                <div className="text-[11px] text-muted-foreground mt-2 leading-tight">{c.hint}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold">Balance Trend (Last 15 Days)</h2>
            </div>
            <div className="flex gap-4 text-[10px] uppercase tracking-wider font-bold">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /> PKR</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> AED</div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            {Recharts ? (
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.AreaChart data={stats.trend}>
                  <defs>
                    <linearGradient id="colorPkr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" opacity={0.4} />
                  <Recharts.XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Recharts.YAxis hide />
                  <Recharts.Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Recharts.Area type="monotone" dataKey="pkr" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorPkr)" />
                  <Recharts.Area type="monotone" dataKey="aed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAed)" />
                </Recharts.AreaChart>
              </Recharts.ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>
            )}
          </div>
        </Card>

        <Card className="glass p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold">Branch Distribution (PKR Balance)</h2>
          </div>
          <div className="h-[300px] w-full">
            {Recharts ? (
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.BarChart data={stats.byBranch}>
                  <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" opacity={0.4} />
                  <Recharts.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Recharts.YAxis hide />
                  <Recharts.Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Recharts.Bar dataKey="pkr" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </Recharts.BarChart>
              </Recharts.ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>
            )}
          </div>
        </Card>
      </div>

      {/* Branch breakdown + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {role === "admin" && (
          <Card className="glass p-6 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold">Branch Summary</h2>
            </div>
            <div className="text-[11px] text-muted-foreground">{stats.byBranch.length} branches</div>
          </div>
            {stats.byBranch.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No branches yet. <Link to="/branches" className="text-primary underline">Create one</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.byBranch.map((b) => (
                  <div key={b.name} className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate pr-2">{b.name}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{b.accounts} accts</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs num">
                      <div>
                        <div className="text-muted-foreground">PKR</div>
                        <div className={b.pkr >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                          {formatMoney(b.pkr, "PKR")} {balanceLabel(b.pkr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">AED</div>
                        <div className={b.aed >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                          {formatMoney(b.aed, "AED")} {balanceLabel(b.aed)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card className={`glass p-6 ${role === "admin" ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold">{t("RecentTransactions")}</h2>
            </div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-start font-medium py-2 px-2">{t("Date") || "Date"}</th>
                    <th className="text-start font-medium py-2 px-2">{t("Code") || "Code"}</th>
                    <th className="text-start font-medium py-2 px-2">{t("Account") || "Account"}</th>
                    <th className="text-left font-medium py-2 px-2 hidden md:table-cell">Details</th>
                    <th className="text-end font-medium py-2 px-2">{t("Debit") || "Debit"}</th>
                    <th className="text-end font-medium py-2 px-2">{t("Credit") || "Credit"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">{formatDate(t.txn_date)}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{t.txn_code}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-medium">{t.accounts?.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.accounts?.account_no}</div>
                      </td>
                      <td className="py-2.5 px-2 hidden md:table-cell text-muted-foreground truncate max-w-xs">{t.details}</td>
                      <td className="py-2.5 px-2 text-end num text-destructive">{Number(t.debit) > 0 ? <span className="inline-flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />{formatMoney(Number(t.debit), t.accounts?.currency)}</span> : "—"}</td>
                      <td className="py-2.5 px-2 text-end num text-success">{Number(t.credit) > 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{formatMoney(Number(t.credit), t.accounts?.currency)}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

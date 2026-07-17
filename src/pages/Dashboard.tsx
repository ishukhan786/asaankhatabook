import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Users, ArrowDownLeft, ArrowUpRight, Plus, Receipt, TrendingUp, Building2, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

type RechartsModule = typeof import("recharts");

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
  const { profile, role, canWriteTransactions } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<TransactionWithAccount[]>([]);
  const [Recharts, setRecharts] = useState<RechartsModule | null>(null);
  const [timeframe, setTimeframe] = useState<"today" | "7days" | "15days" | "30days" | "custom">("15days");
  const [trendCurrency, setTrendCurrency] = useState<"PKR" | "AED">("PKR");
  const [branchCurrency, setBranchCurrency] = useState<"PKR" | "AED">("PKR");

  const formatCompactNumber = (value: number) => {
    if (value === 0) return "0";
    const absVal = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absVal >= 1.0e7) {
      return sign + (absVal / 1.0e7).toFixed(1).replace(/\.0$/, "") + "Cr";
    }
    if (absVal >= 1.0e5) {
      return sign + (absVal / 1.0e5).toFixed(1).replace(/\.0$/, "") + "L";
    }
    if (absVal >= 1.0e3) {
      return sign + (absVal / 1.0e3).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return value.toString();
  };
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Load recharts on mount (charts are always visible on dashboard)
  useEffect(() => {
    let mounted = true;
    import("recharts").then((mod) => {
      if (mounted) setRecharts(mod);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      let fromStr = "";
      let toStr = new Date().toISOString().split("T")[0];

      const today = new Date();
      if (timeframe === "today") {
        fromStr = today.toISOString().split("T")[0];
        toStr = fromStr;
      } else if (timeframe === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromStr = d.toISOString().split("T")[0];
      } else if (timeframe === "15days") {
        const d = new Date();
        d.setDate(d.getDate() - 15);
        fromStr = d.toISOString().split("T")[0];
      } else if (timeframe === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromStr = d.toISOString().split("T")[0];
      } else if (timeframe === "custom") {
        fromStr = customFrom;
        toStr = customTo;
      }

      const [recentTxRes, summaryRes, branchRes, txPeriodRes, expPeriodRes, alertsRes, totalsRes] = await Promise.all([
        supabase.from("transactions").select("*, accounts(name, account_no, currency)").gte("txn_date", fromStr).lte("txn_date", toStr).order("created_at", { ascending: false }).limit(5),
        supabase.rpc("dashboard_summary").maybeSingle(),
        supabase.rpc("dashboard_branch_distribution"),
        supabase.from("transactions").select("txn_date, debit, credit, accounts(currency)").gte("txn_date", fromStr).lte("txn_date", toStr),
        supabase.from("expenses").select("amount, currency").gte("expense_date", fromStr).lte("expense_date", toStr),
        supabase.from("accounts").select("id, name, currency, alert_threshold").not("alert_threshold", "is", null),
        supabase.rpc("report_account_totals"),
      ]);

      if (recentTxRes.error) logger.error("recentTx error:", recentTxRes.error);
      if (summaryRes.error) logger.error("summary error:", summaryRes.error);
      if (branchRes.error) logger.error("branch error:", branchRes.error);
      if (txPeriodRes.error) logger.error("txPeriod error:", txPeriodRes.error);
      if (expPeriodRes.error) logger.error("expPeriod error:", expPeriodRes.error);

      const recentTx = recentTxRes.data;
      const summaryRow = summaryRes.data;
      const branchResult = branchRes;
      const txPeriod = txPeriodRes.data ?? [];
      const expPeriod = expPeriodRes.data ?? [];

      const lowBalanceAlerts: any[] = [];
      if (alertsRes.data && totalsRes.data) {
        // report_account_totals returns { account_id, debit, credit }
        const balances = new Map((totalsRes.data as any[]).map(t => [
          t.account_id,
          Number(t.credit ?? 0) - Number(t.debit ?? 0)
        ]));
        alertsRes.data.forEach(acc => {
          const bal = balances.get(acc.id) ?? 0;
          if (bal < Number(acc.alert_threshold)) {
            lowBalanceAlerts.push({ ...acc, balance: bal });
          }
        });
      }

      const netPKR = Number(summaryRow?.net_pkr ?? 0), netAED = Number(summaryRow?.net_aed ?? 0);
      const totalReceivable = Number(summaryRow?.total_receivable ?? 0), totalPayable = Number(summaryRow?.total_payable ?? 0);

      const periodPKR = { debit: 0, credit: 0 };
      const periodAED = { debit: 0, credit: 0 };
      txPeriod.forEach((tx: any) => {
        const currency = tx.accounts?.currency;
        const debit = Number(tx.debit || 0);
        const credit = Number(tx.credit || 0);
        if (currency === "PKR") {
          periodPKR.debit += debit;
          periodPKR.credit += credit;
        } else if (currency === "AED") {
          periodAED.debit += debit;
          periodAED.credit += credit;
        }
      });

      let periodExpensePKR = 0;
      let periodExpenseAED = 0;
      expPeriod.forEach((e: any) => {
        const amount = Number(e.amount || 0);
        if (e.currency === "PKR") {
          periodExpensePKR += amount;
        } else if (e.currency === "AED") {
          periodExpenseAED += amount;
        }
      });

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

      const trendMap = new Map<string, { pkr: number; aed: number }>();
      const start = new Date(fromStr);
      const end = new Date(toStr);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        trendMap.set(dateStr, { pkr: 0, aed: 0 });
      }

      txPeriod.forEach((tx: any) => {
        const dateStr = tx.txn_date;
        if (trendMap.has(dateStr)) {
          const current = trendMap.get(dateStr)!;
          const currency = tx.accounts?.currency;
          const net = Number(tx.credit || 0) - Number(tx.debit || 0);
          if (currency === "PKR") {
            current.pkr += net;
          } else if (currency === "AED") {
            current.aed += net;
          }
        }
      });

      const trendData = Array.from(trendMap.entries()).map(([dateStr, val]) => {
        const parsedDate = new Date(dateStr);
        return {
          date: parsedDate.toLocaleDateString(i18n.language === "ur" ? "ur-PK" : "en-PK", { day: "2-digit", month: "short" }),
          pkr: val.pkr,
          aed: val.aed,
        };
      });

      setStats({
        accounts: Number(summaryRow?.accounts_count ?? 0),
        branches: Number(summaryRow?.branches_count ?? 0),
        netPKR,
        netAED,
        todayPKR: periodPKR,
        todayAED: periodAED,
        totalExpensePKR: periodExpensePKR,
        totalExpenseAED: periodExpenseAED,
        byBranch: branchData,
        trend: trendData,
        totalReceivable,
        totalPayable
      } as any);
      setAlerts(lowBalanceAlerts);
      setRecent((recentTx ?? []) as Tables<"transactions">[]);
    } catch (err) {
      logger.error("Dashboard load error:", err);
    }
  }, [i18n.language, timeframe, customFrom, customTo]);

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
  }, [load, scheduleLoad]);

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
    {
      label: t("Accounts"),
      value: stats.accounts.toString(),
      icon: Users,
      gradient: "from-primary to-primary-glow",
      sub: `${stats.branches} ${t("Branches").toLowerCase()}`,
      hint: t("HintActiveAccounts")
    },
    {
      label: "PKR Balance",
      value: formatMoney(stats.netPKR, "PKR"),
      icon: Wallet,
      gradient: "from-accent to-accent-glow",
      sub: balanceLabel(stats.netPKR),
      hint: `Period: Dr ${formatMoney(stats.todayPKR.debit, "PKR")} | Cr ${formatMoney(stats.todayPKR.credit, "PKR")}`,
      positive: stats.netPKR >= 0
    },
    {
      label: "AED Balance",
      value: formatMoney(stats.netAED, "AED"),
      icon: TrendingUp,
      gradient: "from-emerald-600 to-teal-500",
      sub: balanceLabel(stats.netAED),
      hint: `Period: Dr ${formatMoney(stats.todayAED.debit, "AED")} | Cr ${formatMoney(stats.todayAED.credit, "AED")}`,
      positive: stats.netAED >= 0
    },
    {
      label: t("Expenses"),
      value: formatMoney(stats.totalExpensePKR, "PKR"),
      sub: stats.totalExpenseAED > 0 ? `AED: ${formatMoney(stats.totalExpenseAED, "AED")}` : "0 AED",
      icon: Receipt,
      gradient: "from-rose-500 to-orange-500",
      hint: `Period Expenses: PKR ${formatMoney(stats.totalExpensePKR, "PKR")}`,
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
      {/* Hero — Liquid Glass Panel */}
      <div>
        <div className="glass-hero rounded-2xl px-5 py-3 mb-2 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-0.5">{role === "admin" ? t("AdminPanel") : t("Dashboard")}</div>
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-gradient">
                {t("Welcome", { name: profile?.full_name?.split(" ")[0] ?? "there" })}
              </h1>
              <p className="text-muted-foreground text-xs">Here's what's happening across your ledger today.</p>
            </div>
             <div className="flex gap-2 flex-wrap items-center">
              {role === "admin" && (
                <Link to="/branches"><Button variant="secondary" className="glass"><Building2 className="w-4 h-4 mr-1" /> {t("Branches")}</Button></Link>
              )}
              {canWriteTransactions && (
                <>
                  <Link to="/accounts/new"><Button className="gradient-primary text-primary-foreground shadow-soft"><Plus className="w-4 h-4 mr-1" /> {t("NewAccount")}</Button></Link>
                  <Link to="/transactions/new"><Button variant="outline" className="border-2 glass"><Receipt className="w-4 h-4 mr-1" /> {t("NewTransaction")}</Button></Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-destructive">Low Balance Alert: {a.name}</h4>
                <p className="text-xs text-destructive/80">
                  Current balance is {formatMoney(a.balance, a.currency)} which is below the threshold of {formatMoney(a.alert_threshold, a.currency)}.
                </p>
              </div>
              <Link to={`/accounts/${a.id}`}>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">View Account</Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Timeframe Selector Panel */}
      <div
        className="glass-card rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 border border-white/10"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter Timeframe:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "7days", "15days", "30days", "custom"] as const).map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeframe(tf)}
              className={timeframe === tf ? "gradient-primary text-primary-foreground shadow-soft text-xs" : "glass text-xs hover:bg-muted/30"}
            >
              {tf === "today" ? "Today" : tf === "7days" ? "7 Days" : tf === "15days" ? "15 Days" : tf === "30days" ? "30 Days" : "Custom Range"}
            </Button>
          ))}
        </div>

        {timeframe === "custom" && (
          <div 
            className="flex items-center gap-2"
          >
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
        )}
      </div>

      {/* Stat cards — Liquid Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={c.url ? "cursor-pointer" : ""}
          >
            <Card
              className="glass-card rounded-2xl p-5 relative overflow-hidden h-full"
              onClick={() => c.url && navigate(c.url)}
            >
              {/* Ambient gradient orb */}
              <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${c.gradient} opacity-20 blur-2xl transition-opacity  group-hover:opacity-35`} />
              {/* Bottom edge glow */}
              <div className={`absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent`} />

              <div className="relative flex flex-col gap-2 z-10">
                {/* Icon + Label Row */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-soft flex-shrink-0 ring-1 ring-white/30`}>
                    <c.icon className="w-5 h-5 text-white drop-shadow" />
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</div>
                </div>
                {/* Main Value */}
                <div className="text-2xl font-display font-bold num leading-tight" title={c.value}>{c.value}</div>
                {/* Sub Label */}
                <div className={`text-xs font-medium num ${c.positive === false ? "text-destructive" : c.positive === true ? "text-success" : "text-muted-foreground"}`}>
                  {c.sub}
                </div>
                {/* Hint */}
                {c.hint && (
                  <div className="text-[11px] text-muted-foreground leading-snug border-t border-white/20 pt-2 mt-1">
                    {c.hint}
                  </div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      {stats.accounts === 0 ? (
        <Card className="glass rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 border-primary/20">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div className="max-w-sm">
            <h3 className="font-display text-xl font-bold mb-2">Ready to get started?</h3>
            <p className="text-muted-foreground text-sm mb-6">You don't have any accounts yet. Create your first ledger account to start tracking transactions.</p>
            {canWriteTransactions && (
              <Link to="/accounts/new">
                <Button className="gradient-primary text-primary-foreground shadow-soft">
                  <Plus className="w-4 h-4 mr-2" /> Add Your First Account
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <>
        <div className={`grid grid-cols-1 ${role === "admin" ? "lg:grid-cols-2" : ""} gap-4`}>
          {/* Balance Trend Card */}
          <Card className="glass rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-sm md:text-base">Balance Trend</h2>
                  <p className="text-[10px] text-muted-foreground">Showing period net daily changes</p>
                </div>
              </div>
              
              {/* Currency Selector Toggle */}
              <div className="flex items-center gap-1 bg-background/50 border border-white/10 rounded-lg p-0.5">
                {(["PKR", "AED"] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setTrendCurrency(curr)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      trendCurrency === curr
                        ? curr === "PKR"
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-emerald-500 text-white shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Period Summary Statistics */}
            {stats && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-white/5 dark:bg-black/20 border border-white/5 rounded-xl mb-6">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Net Activity</div>
                  <div className={`text-xs md:text-sm font-bold num ${
                    stats.trend.map((d) => (trendCurrency === "PKR" ? d.pkr : d.aed)).reduce((s, v) => s + v, 0) >= 0
                      ? "text-success"
                      : "text-destructive"
                  }`}>
                    {formatMoney(stats.trend.map((d) => (trendCurrency === "PKR" ? d.pkr : d.aed)).reduce((s, v) => s + v, 0), trendCurrency)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Peak Inflow</div>
                  <div className="text-xs md:text-sm font-bold num text-success">
                    {formatMoney(Math.max(...stats.trend.map((d) => (trendCurrency === "PKR" ? d.pkr : d.aed)), 0), trendCurrency)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Peak Outflow</div>
                  <div className="text-xs md:text-sm font-bold num text-destructive">
                    {formatMoney(Math.min(...stats.trend.map((d) => (trendCurrency === "PKR" ? d.pkr : d.aed)), 0), trendCurrency)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-[260px] w-full mt-auto">
            {Recharts ? (
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPkr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="colorAed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <Recharts.XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <Recharts.YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => formatCompactNumber(v)} 
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} 
                  />
                  <Recharts.Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dateVal = payload[0].payload.date;
                        const pkrVal = payload[0].payload.pkr;
                        const aedVal = payload[0].payload.aed;
                        const isPkr = trendCurrency === "PKR";
                        const activeVal = isPkr ? pkrVal : aedVal;
                        return (
                          <div className="glass-card border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1.5 bg-background/95 backdrop-blur-md">
                            <p className="text-muted-foreground font-semibold text-[10px]">{dateVal}</p>
                            <p className={`font-bold num ${activeVal >= 0 ? "text-success" : "text-destructive"}`}>
                              {activeVal >= 0 ? "+" : ""}{formatMoney(activeVal, trendCurrency)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Recharts.Area 
                    type="monotone" 
                    dataKey={trendCurrency === "PKR" ? "pkr" : "aed"} 
                    stroke={trendCurrency === "PKR" ? "hsl(var(--primary))" : "#10b981"} 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill={trendCurrency === "PKR" ? "url(#colorPkr)" : "url(#colorAed)"} 
                  />
                </Recharts.AreaChart>
              </Recharts.ResponsiveContainer>
            ) : (
              <div className="h-full w-full space-y-3 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-40 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Branch Distribution Card */}
        {role === "admin" && (
          <Card className="glass rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-sm md:text-base">Branch Distribution</h2>
                    <p className="text-[10px] text-muted-foreground">Comparative branch balance overview</p>
                  </div>
                </div>
                
                {/* Currency Selector Toggle */}
                <div className="flex items-center gap-1 bg-background/50 border border-white/10 rounded-lg p-0.5">
                  {(["PKR", "AED"] as const).map((curr) => (
                    <button
                      key={curr}
                      onClick={() => setBranchCurrency(curr)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        branchCurrency === curr
                          ? curr === "PKR"
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-emerald-500 text-white shadow"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[260px] w-full mt-auto">
              {Recharts ? (
                <Recharts.ResponsiveContainer width="100%" height="100%">
                  <Recharts.BarChart data={stats.byBranch} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <Recharts.XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <Recharts.YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(v) => formatCompactNumber(v)} 
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Recharts.Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const nameVal = payload[0].payload.name;
                          const val = payload[0].value as number;
                          const count = payload[0].payload.accounts;
                          return (
                            <div className="glass-card border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1 bg-background/95 backdrop-blur-md">
                              <p className="font-semibold text-foreground">{nameVal}</p>
                              <p className={`font-bold num ${val >= 0 ? "text-success" : "text-destructive"}`}>
                                {formatMoney(val, branchCurrency)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{count} accounts</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Recharts.Bar 
                      dataKey={branchCurrency === "PKR" ? "pkr" : "aed"} 
                      fill={branchCurrency === "PKR" ? "hsl(var(--primary))" : "#10b981"} 
                      radius={[6, 6, 0, 0]} 
                    />
                  </Recharts.BarChart>
                </Recharts.ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-end gap-3 px-4 pb-4 pt-8">
                  {[60, 85, 45, 70, 55, 90, 40].map((h, i) => (
                    <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
      {/* Branch breakdown + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {role === "admin" && (
          <Card className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-display font-semibold">Branch Summary</h2>
            </div>
            <div className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full glass">{stats.byBranch.length} branches</div>
          </div>
            {stats.byBranch.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No branches yet. <Link to="/branches" className="text-primary underline">Create one</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.byBranch.map((b) => (
                  <div key={b.name} className="p-3.5 rounded-xl glass border-0">
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

        <Card className={`glass rounded-2xl p-6 ${role === "admin" ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-white" />
              </div>
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
                      <td className="py-2.5 px-2 text-end num text-destructive">{Number(t.debit) > 0 ? <span className="inline-flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />{formatMoney(Number(t.debit), t.accounts?.currency)}</span> : "-"}</td>
                      <td className="py-2.5 px-2 text-end num text-success">{Number(t.credit) > 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{formatMoney(Number(t.credit), t.accounts?.currency)}</span> : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

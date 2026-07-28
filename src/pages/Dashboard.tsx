import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Receipt,
  TrendingUp,
  Building2,
  Calendar,
  AlertCircle,
  Search,
  Bell,
  Sun,
  Moon,
  Send,
  ArrowLeftRight,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useTheme } from "next-themes";

type RechartsModule = typeof import("recharts");

interface Stats {
  accounts: number;
  totalVouchers: number;
  branches: number;
  netPKR: number;
  netAED: number;
  cashPKR: number;
  cashAED: number;
  receivablePKR: number;
  receivableAED: number;
  payablePKR: number;
  payableAED: number;
  totalExpensePKR: number;
  totalExpenseAED: number;
  byBranch: { name: string; pkr: number; aed: number; accounts: number }[];
  trend: { date: string; income: number; expense: number; pkr: number; aed: number }[];
  topCustomers: { id: string; name: string; account_no: string; balance: number; currency: string }[];
}

type TransactionWithAccount = Tables<"transactions"> & {
  accounts?: { name?: string | null; account_no?: string | null; currency?: string | null } | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { profile, role, canWriteTransactions } = useAuth();
  const { theme, setTheme } = useTheme();

  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<TransactionWithAccount[]>([]);
  const [Recharts, setRecharts] = useState<RechartsModule | null>(null);
  const [timeframe, setTimeframe] = useState<"today" | "7days" | "15days" | "30days" | "custom">("15days");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);
  interface AccountAlert {
    id: string;
    name: string;
    currency: string;
    alert_threshold: number;
    balance: number;
  }
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);

  // Load recharts dynamically on mount
  useEffect(() => {
    let mounted = true;
    import("recharts").then((mod) => {
      if (mounted) setRecharts(mod);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Fetch branches list
  useEffect(() => {
    supabase.from("branches").select("id, name").order("name").then(({ data }) => {
      setBranchesList(data ?? []);
    });
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

      // Base query setup with branch filter if selected
      let txQuery = supabase.from("transactions").select("*, accounts!inner(name, account_no, currency, branch_id)").gte("txn_date", fromStr).lte("txn_date", toStr).order("created_at", { ascending: false });
      if (selectedBranch !== "all") {
        txQuery = txQuery.eq("accounts.branch_id", selectedBranch);
      }

      const [recentTxRes, summaryRes, branchRes, txPeriodRes, expPeriodRes, alertsRes, totalsRes, allAccsRes, accountsCountRes] = await Promise.all([
        txQuery.limit(6),
        supabase.rpc("dashboard_summary").maybeSingle(),
        supabase.rpc("dashboard_branch_distribution"),
        txQuery,
        supabase.from("expenses").select("amount, currency").gte("expense_date", fromStr).lte("expense_date", toStr),
        supabase.from("accounts").select("id, name, currency, alert_threshold").not("alert_threshold", "is", null),
        supabase.rpc("report_account_totals"),
        supabase.from("accounts").select("id, account_no, name, currency, account_type, branch_id"),
        supabase.from("accounts").select("*", { count: "exact", head: true }),
      ]);

      if (allAccsRes.error) logger.error("allAccsRes error:", allAccsRes.error);
      if (accountsCountRes.error) logger.error("accountsCountRes error:", accountsCountRes.error);

      const recentTx = recentTxRes.data;
      const summaryRow = summaryRes.data;
      const branchResult = branchRes;
      const txPeriod = txPeriodRes.data ?? [];
      const expPeriod = expPeriodRes.data ?? [];
      const allAccs = allAccsRes.data ?? [];
      const totalAccountsCount = accountsCountRes.count ?? allAccs.length;

      // Calculate detailed financial breakdown
      const balancesMap = new Map((totalsRes.data as Array<{ account_id: string; debit: number; credit: number }> ?? []).map(t => [
        t.account_id,
        Number(t.credit ?? 0) - Number(t.debit ?? 0)
      ]));

      const lowBalanceAlerts: AccountAlert[] = [];
      let cashPKR = 0, cashAED = 0;
      let recPKR = 0, recAED = 0;
      let payPKR = 0, payAED = 0;

      const customerBalances: { id: string; name: string; account_no: string; balance: number; currency: string }[] = [];

      allAccs.forEach(acc => {
        if (selectedBranch !== "all" && acc.branch_id !== selectedBranch) return;

        const bal = balancesMap.get(acc.id) ?? 0;
        const cur = acc.currency || "PKR";

        // Cash/Bank account classification
        if (acc.account_type === "cash" || acc.account_type === "bank") {
          if (cur === "PKR") cashPKR += bal;
          else cashAED += bal;
        }

        // Receivables vs Payables
        if (bal > 0) {
          if (cur === "PKR") recPKR += bal;
          else recAED += bal;
        } else if (bal < 0) {
          if (cur === "PKR") payPKR += Math.abs(bal);
          else payAED += Math.abs(bal);
        }

        // Customer ranking
        if (acc.account_type === "customer") {
          customerBalances.push({
            id: acc.id,
            name: acc.name || "Customer",
            account_no: acc.account_no || "—",
            balance: bal,
            currency: cur
          });
        }

        // Alerts check
        if (acc.alert_threshold && bal < Number(acc.alert_threshold)) {
          lowBalanceAlerts.push({
            id: acc.id,
            name: acc.name || "Account",
            currency: cur,
            alert_threshold: Number(acc.alert_threshold),
            balance: bal,
          });
        }
      });

      // Sort top customers by positive balance (outstanding receivable)
      customerBalances.sort((a, b) => b.balance - a.balance);

      const netPKR = Number(summaryRow?.net_pkr ?? (cashPKR + recPKR - payPKR));
      const netAED = Number(summaryRow?.net_aed ?? (cashAED + recAED - payAED));

      let periodExpensePKR = 0;
      let periodExpenseAED = 0;
      expPeriod.forEach((e: { amount?: number; currency?: string }) => {
        const amount = Number(e.amount || 0);
        if (e.currency === "PKR") periodExpensePKR += amount;
        else if (e.currency === "AED") periodExpenseAED += amount;
      });

      // Branch Distribution
      type BranchRPC = { branch_name?: string; pkr?: number | string; aed?: number | string; accounts_count?: number | string };
      const branchData = (branchResult.data ?? []).map((b: BranchRPC) => ({
        name: String(b.branch_name ?? ""),
        pkr: Number(b.pkr ?? 0),
        aed: Number(b.aed ?? 0),
        accounts: Number(b.accounts_count ?? 0),
      }));

      // Trend data for chart analytics
      const trendMap = new Map<string, { income: number; expense: number; pkr: number; aed: number }>();
      const start = new Date(fromStr);
      const end = new Date(toStr);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        trendMap.set(dateStr, { income: 0, expense: 0, pkr: 0, aed: 0 });
      }

      txPeriod.forEach((tx: { txn_date: string; credit?: number; debit?: number; accounts?: { currency?: string | null } | null }) => {
        const dateStr = tx.txn_date;
        if (trendMap.has(dateStr)) {
          const current = trendMap.get(dateStr)!;
          const currency = tx.accounts?.currency;
          const credit = Number(tx.credit || 0);
          const debit = Number(tx.debit || 0);
          current.income += credit;
          current.expense += debit;
          if (currency === "PKR") current.pkr += (credit - debit);
          else current.aed += (credit - debit);
        }
      });

      const trendData = Array.from(trendMap.entries()).map(([dateStr, val]) => {
        const parsedDate = new Date(dateStr);
        return {
          date: parsedDate.toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
          income: val.income,
          expense: val.expense,
          pkr: val.pkr,
          aed: val.aed,
        };
      });

      const totalVouchersCount = txPeriod.length;

      setStats({
        accounts: totalAccountsCount,
        totalVouchers: totalVouchersCount,
        branches: branchData.length,
        netPKR,
        netAED,
        cashPKR,
        cashAED,
        receivablePKR: recPKR,
        receivableAED: recAED,
        payablePKR: payPKR,
        payableAED: payAED,
        totalExpensePKR: periodExpensePKR,
        totalExpenseAED: periodExpenseAED,
        byBranch: branchData,
        trend: trendData,
        topCustomers: customerBalances.slice(0, 5)
      });
      setAlerts(lowBalanceAlerts);
      setRecent((recentTx ?? []) as Tables<"transactions">[]);
    } catch (err) {
      logger.error("Dashboard load error:", err);
    }
  }, [timeframe, customFrom, customTo, selectedBranch]);

  const scheduleLoad = useRealtimeRefresh(load, 700);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) {
    return (
      <div className="p-6 md:p-10 space-y-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto text-slate-800 dark:text-slate-100">
      
      {/* 🌟 TOP NAVIGATION / CONTROL BAR */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm sticky top-16 z-20 backdrop-blur-md" style={{ isolation: 'isolate' }}>
        {/* Row 1: Title + Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AsaanKhata Dashboard</h1>
              <p className="text-xs text-muted-foreground">Multi-Currency Enterprise Accounting</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Selector */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5 border border-border/60">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                aria-label="Filter Branch"
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branchesList.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Timeframe Filter */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/60">
              {(["today", "7days", "15days", "30days"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    timeframe === tf ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tf === "today" ? "Today" : tf === "7days" ? "7D" : tf === "15days" ? "15D" : "30D"}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher, account..."
                className="pl-9 h-9 text-xs w-44 rounded-xl border-border/60"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Quick Action Buttons — separated with top border */}
        {canWriteTransactions && (
          <div className="flex flex-wrap items-center gap-2.5 pt-3 mt-3 border-t border-border/50">
            <Link to="/accounts/new">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs font-bold transition-transform active:scale-95">
                <Plus className="w-4 h-4 mr-1.5" /> + New Customer
              </Button>
            </Link>
            <Link to="/transactions/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-bold transition-transform active:scale-95">
                <Receipt className="w-4 h-4 mr-1.5" /> New Voucher
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 📍 SECTION 1: FINANCIAL OVERVIEW (TOP ROW) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PKR Balance */}
        <Card className="rounded-2xl p-5 border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-card shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">PKR Balance</span>
            <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">PKR</Badge>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold num text-emerald-700 dark:text-emerald-400 mt-2">
            {formatMoney(stats.netPKR, "PKR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{balanceLabel(stats.netPKR)}</p>
        </Card>

        {/* AED Balance */}
        <Card className="rounded-2xl p-5 border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-card shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">AED Balance</span>
            <Badge className="bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">AED</Badge>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold num text-blue-700 dark:text-blue-400 mt-2">
            {formatMoney(stats.netAED, "AED")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{balanceLabel(stats.netAED)}</p>
        </Card>

        {/* Total Customers */}
        <Card className="rounded-2xl p-5 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Accounts</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold num mt-2">{stats.accounts}</div>
          <p className="text-xs text-muted-foreground mt-1">Active customer & ledger accounts</p>
        </Card>

        {/* Total Vouchers */}
        <Card className="rounded-2xl p-5 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Vouchers</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold num mt-2">{stats.totalVouchers}</div>
          <p className="text-xs text-muted-foreground mt-1">In selected timeframe</p>
        </Card>
      </div>

      {/* 📍 SECTION 2 & 3: FINANCIAL SUMMARIES (PKR & AED) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PKR Summary Card */}
        <Card className="rounded-2xl p-6 border border-emerald-200/80 dark:border-emerald-900/60 bg-card shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 className="font-bold text-base">PKR Financial Summary</h2>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-xs">PKR</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div>
              <div className="text-xs text-muted-foreground font-semibold">Cash</div>
              <div className="text-base font-bold num text-slate-800 dark:text-slate-100 mt-1">
                {formatMoney(stats.cashPKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Receivable</div>
              <div className="text-base font-bold num text-orange-600 dark:text-orange-400 mt-1">
                {formatMoney(stats.receivablePKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-red-600 dark:text-red-400 font-semibold">Payable</div>
              <div className="text-base font-bold num text-red-600 dark:text-red-400 mt-1">
                {formatMoney(stats.payablePKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Net Balance</div>
              <div className="text-base font-bold num text-emerald-600 dark:text-emerald-400 mt-1">
                {formatMoney(stats.netPKR, "PKR")}
              </div>
            </div>
          </div>
        </Card>

        {/* AED Summary Card */}
        <Card className="rounded-2xl p-6 border border-blue-200/80 dark:border-blue-900/60 bg-card shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="font-bold text-base">AED Financial Summary</h2>
            </div>
            <Badge className="bg-blue-600 text-white font-bold text-xs">AED</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div>
              <div className="text-xs text-muted-foreground font-semibold">Cash</div>
              <div className="text-base font-bold num text-slate-800 dark:text-slate-100 mt-1">
                {formatMoney(stats.cashAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Receivable</div>
              <div className="text-base font-bold num text-orange-600 dark:text-orange-400 mt-1">
                {formatMoney(stats.receivableAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-xs text-red-600 dark:text-red-400 font-semibold">Payable</div>
              <div className="text-base font-bold num text-red-600 dark:text-red-400 mt-1">
                {formatMoney(stats.payableAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Net Balance</div>
              <div className="text-base font-bold num text-blue-600 dark:text-blue-400 mt-1">
                {formatMoney(stats.netAED, "AED")}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 📍 SECTION 4: TWO-COLUMN LAYOUT (Branch Summary & Recent Transactions Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Branch Summary */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Branch Summary
              </h2>
              <Badge variant="outline" className="text-[11px] font-semibold">{stats.byBranch.length} Branches</Badge>
            </div>

            {stats.byBranch.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No branches setup yet. <Link to="/branches" className="text-primary underline font-medium">Create one</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.byBranch.map((b) => (
                  <div key={b.name} className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate pr-2">{b.name}</span>
                      <span className="text-xs text-muted-foreground">{b.accounts} accounts</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs num">
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase">PKR: </span>
                        <span className={`font-bold ${b.pkr >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatMoney(b.pkr, "PKR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase">AED: </span>
                        <span className={`font-bold ${b.aed >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {formatMoney(b.aed, "AED")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right: Recent Transactions Table */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Recent Transactions
            </h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline font-semibold">View All</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase border-b border-border/60">
                  <th className="text-left font-semibold py-2.5 px-2">Date</th>
                  <th className="text-left font-semibold py-2.5 px-2">Voucher No</th>
                  <th className="text-left font-semibold py-2.5 px-2">Account</th>
                  <th className="text-center font-semibold py-2.5 px-2">Currency</th>
                  <th className="text-right font-semibold py-2.5 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                      No recent transactions recorded.
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => {
                    const isCredit = Number(r.credit ?? 0) > 0;
                    const amount = isCredit ? Number(r.credit) : Number(r.debit);
                    const cur = r.accounts?.currency || "PKR";
                    return (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2 text-xs num">{formatDate(r.txn_date)}</td>
                        <td className="py-3 px-2 font-mono text-xs">{r.txn_code || "—"}</td>
                        <td className="py-3 px-2 font-semibold text-xs">{r.accounts?.name || "—"}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cur === "PKR" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"}`}>
                            {cur}
                          </Badge>
                        </td>
                        <td className={`py-3 px-2 text-right font-bold num text-xs ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {isCredit ? "+" : "-"}{formatMoney(amount, cur)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 📍 SECTION 5: TWO-COLUMN LAYOUT (Top Customers & Recent Vouchers) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top Customers */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Top Outstanding Customers
            </h2>
            <Link to="/accounts" className="text-xs text-primary hover:underline font-semibold">View All Accounts</Link>
          </div>

          <div className="space-y-3">
            {stats.topCustomers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No customer balances found.</div>
            ) : (
              stats.topCustomers.map((cust, idx) => (
                <div key={cust.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-xs">{cust.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{cust.account_no}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-bold text-xs num ${cust.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatMoney(cust.balance, cust.currency)}
                    </div>
                    <Badge className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${cust.currency === "PKR" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                      {cust.currency}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right: Recent Vouchers Stream */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" /> Recent Vouchers Log
            </h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline font-semibold">Voucher History</Link>
          </div>

          <div className="space-y-3">
            {recent.slice(0, 5).map((v) => {
              const isCredit = Number(v.credit ?? 0) > 0;
              const amount = isCredit ? Number(v.credit) : Number(v.debit);
              const cur = v.accounts?.currency || "PKR";
              return (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${isCredit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {isCredit ? "RCP" : "PAY"}
                    </div>
                    <div>
                      <div className="font-semibold text-xs font-mono">{v.txn_code}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{v.details || "General Entry"}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-bold text-xs num ${isCredit ? "text-emerald-600" : "text-red-600"}`}>
                      {formatMoney(amount, cur)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDate(v.txn_date)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 📍 SECTION 6: ANALYTICS (INCOME VS EXPENSE & CASH FLOW) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense Bar Chart */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" /> Income vs Expense Analytics
            </h2>
            <Badge variant="outline" className="text-xs">Period Overview</Badge>
          </div>

          <div className="h-[250px] w-full">
            {Recharts ? (
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.BarChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <Recharts.XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Recharts.YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Recharts.Tooltip />
                  <Recharts.Bar dataKey="income" fill="#2563eb" name="Income" radius={[4, 4, 0, 0]} />
                  <Recharts.Bar dataKey="expense" fill="#e11d48" name="Expense" radius={[4, 4, 0, 0]} />
                </Recharts.BarChart>
              </Recharts.ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full rounded-xl" />
            )}
          </div>
        </Card>

        {/* Cash Flow Line Chart */}
        <Card className="rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Cash Flow Trend
            </h2>
            <Badge variant="outline" className="text-xs">Net Cash Movement</Badge>
          </div>

          <div className="h-[250px] w-full">
            {Recharts ? (
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.LineChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <Recharts.XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Recharts.YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Recharts.Tooltip />
                  <Recharts.Line type="monotone" dataKey="pkr" stroke="#10b981" strokeWidth={2} name="Net PKR Flow" dot={false} />
                  <Recharts.Line type="monotone" dataKey="aed" stroke="#2563eb" strokeWidth={2} name="Net AED Flow" dot={false} />
                </Recharts.LineChart>
              </Recharts.ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full rounded-xl" />
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}

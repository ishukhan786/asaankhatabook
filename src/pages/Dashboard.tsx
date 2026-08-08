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
  UserCheck,
  Activity
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
  netUSD: number;
  cashPKR: number;
  cashAED: number;
  cashUSD: number;
  receivablePKR: number;
  receivableAED: number;
  receivableUSD: number;
  payablePKR: number;
  payableAED: number;
  payableUSD: number;
  totalExpensePKR: number;
  totalExpenseAED: number;
  totalExpenseUSD: number;
  byBranch: { name: string; pkr: number; aed: number; usd: number; accounts: number }[];
  trend: { date: string; income: number; expense: number; pkr: number; aed: number; usd: number }[];
  topCustomers: { id: string; name: string; account_no: string; balance: number; currency: string }[];
}

type TransactionWithAccount = Tables<"transactions"> & {
  accounts?: { name?: string | null; account_no?: string | null; currency?: string | null } | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { profile, role, canWriteTransactions, user } = useAuth();
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
        supabase.rpc("report_account_totals", { p_from: null, p_to: null }),
        supabase.from("accounts").select("id, account_no, name, currency, account_type, branch_id, alert_threshold, branches(name)"),
        supabase.from("accounts").select("*", { count: "exact", head: true }),
      ]);

      if (allAccsRes.error) logger.error("allAccsRes error:", allAccsRes.error);
      if (accountsCountRes.error) logger.error("accountsCountRes error:", accountsCountRes.error);
      if (totalsRes.error) logger.error("totalsRes error:", totalsRes.error);

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
      let cashPKR = 0, cashAED = 0, cashUSD = 0;
      let recPKR = 0, recAED = 0, recUSD = 0;
      let payPKR = 0, payAED = 0, payUSD = 0;

      const customerBalances: { id: string; name: string; account_no: string; balance: number; currency: string }[] = [];

      allAccs.forEach(acc => {
        if (selectedBranch !== "all" && acc.branch_id !== selectedBranch) return;

        const bal = balancesMap.get(acc.id) ?? 0;
        const cur = acc.currency || "PKR";

        // Cash/Bank account classification
        if (acc.account_type === "cash" || acc.account_type === "bank") {
          if (cur === "PKR") cashPKR += bal;
          else if (cur === "AED") cashAED += bal;
          else if (cur === "USD") cashUSD += bal;
        } else {
          // Receivables vs Payables
          if (bal < 0) {
            if (cur === "PKR") recPKR += Math.abs(bal);
            else if (cur === "AED") recAED += Math.abs(bal);
            else if (cur === "USD") recUSD += Math.abs(bal);
          } else if (bal > 0) {
            if (cur === "PKR") payPKR += bal;
            else if (cur === "AED") payAED += bal;
            else if (cur === "USD") payUSD += bal;
          }
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
      const netUSD = Number(cashUSD + recUSD - payUSD);

      let periodExpensePKR = 0;
      let periodExpenseAED = 0;
      let periodExpenseUSD = 0;
      expPeriod.forEach((e: { amount?: number; currency?: string }) => {
        const amount = Number(e.amount || 0);
        if (e.currency === "PKR") periodExpensePKR += amount;
        else if (e.currency === "AED") periodExpenseAED += amount;
        else if (e.currency === "USD") periodExpenseUSD += amount;
      });

      // Accurate Client-side Branch Distribution calculation
      const branchMap = new Map<string, { name: string; pkr: number; aed: number; usd: number; accounts: number }>();
      
      // Initialize known branches
      branchesList.forEach(b => {
        branchMap.set(b.id, { name: b.name, pkr: 0, aed: 0, usd: 0, accounts: 0 });
      });

      allAccs.forEach(acc => {
        const bal = balancesMap.get(acc.id) ?? 0;
        const cur = acc.currency || "PKR";
        const branchId = acc.branch_id || "unassigned";
        const branchName = acc.branches?.name || "Main Branch";

        if (!branchMap.has(branchId)) {
          branchMap.set(branchId, { name: branchName, pkr: 0, aed: 0, usd: 0, accounts: 0 });
        }
        const b = branchMap.get(branchId)!;
        b.accounts += 1;
        if (cur === "PKR") b.pkr += bal;
        else if (cur === "AED") b.aed += bal;
        else if (cur === "USD") b.usd += bal;
      });

      const branchData = Array.from(branchMap.values()).filter(b => b.accounts > 0 || b.pkr !== 0 || b.aed !== 0 || b.usd !== 0);

      // Trend data for chart analytics
      const trendMap = new Map<string, { income: number; expense: number; pkr: number; aed: number; usd: number }>();
      const start = new Date(fromStr);
      const end = new Date(toStr);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        trendMap.set(dateStr, { income: 0, expense: 0, pkr: 0, aed: 0, usd: 0 });
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
          else if (currency === "AED") current.aed += (credit - debit);
          else if (currency === "USD") current.usd += (credit - debit);
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
          usd: val.usd,
        };
      });

      const totalVouchersCount = txPeriod.length;

      setStats({
        accounts: totalAccountsCount,
        totalVouchers: totalVouchersCount,
        branches: branchData.length,
        netPKR,
        netAED,
        netUSD,
        cashPKR,
        cashAED,
        cashUSD,
        receivablePKR: recPKR,
        receivableAED: recAED,
        receivableUSD: recUSD,
        payablePKR: payPKR,
        payableAED: payAED,
        payableUSD: payUSD,
        totalExpensePKR: periodExpensePKR,
        totalExpenseAED: periodExpenseAED,
        totalExpenseUSD: periodExpenseUSD,
        byBranch: branchData,
        trend: trendData,
        topCustomers: customerBalances,
      });
      setAlerts(lowBalanceAlerts);
      setRecent((recentTx ?? []) as Tables<"transactions">[]);
    } catch (err) {
      logger.error("Dashboard load error:", err);
    }
  }, [timeframe, customFrom, customTo, selectedBranch, branchesList]);

  const scheduleLoad = useRealtimeRefresh(load, 700);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) {
    return (
      <div className="p-6 md:p-10 space-y-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="bg-card border border-border/80 rounded-2xl pt-4 px-4 pb-5 shadow-sm sticky top-16 z-20 backdrop-blur-md" style={{ isolation: 'isolate' }}>
        {/* Row 1: Title + Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AsaanKhata Dashboard</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-muted-foreground">
                <span>Multi-Currency Enterprise Accounting</span>
                <span className="hidden sm:inline opacity-40">·</span>
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary dark:text-blue-400 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wider">
                  User ID: {user?.username || profile?.full_name || "Guest"} ({role})
                </span>
              </div>
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
                <Plus className="w-4 h-4 mr-1.5" /> {t("NewAccount")}
              </Button>
            </Link>
            <Link to="/transactions/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs font-bold transition-transform active:scale-95">
                <Receipt className="w-4 h-4 mr-1.5" /> {t("NewTransaction")}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 📍 SECTION 1: FINANCIAL OVERVIEW (TOP ROW) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 !mt-10">
        {/* Total Customers */}
        <Card className="rounded-2xl p-4 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalAccounts")}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold num mt-2">{stats.accounts}</div>
          <p className="text-xs text-muted-foreground mt-1">{t("HintActiveAccounts")}</p>
        </Card>

        {/* Total Vouchers */}
        <Card className="rounded-2xl p-4 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalVouchers")}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold num mt-2">{stats.totalVouchers}</div>
          <p className="text-xs text-muted-foreground mt-1">In selected timeframe</p>
        </Card>
      </div>

      {/* 📍 SECTION 2, 3 & USD: FINANCIAL SUMMARIES (PKR, AED & USD) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PKR Summary Card */}
        <Card className="rounded-2xl p-5 border border-emerald-200/80 dark:border-emerald-900/60 bg-card shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 className="font-bold text-base">PKR {t("FinancialSummary")}</h2>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-[10px]">PKR</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">{t("Cash")}</div>
              <div className="text-sm font-bold num text-slate-800 dark:text-slate-100 mt-0.5">
                {formatMoney(stats.cashPKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold uppercase">{t("Receivables")}</div>
              <div className="text-sm font-bold num text-orange-600 dark:text-orange-400 mt-0.5">
                {formatMoney(stats.receivablePKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase">{t("Payables")}</div>
              <div className="text-sm font-bold num text-red-600 dark:text-red-400 mt-0.5">
                {formatMoney(stats.payablePKR, "PKR")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">{t("NetBalance")}</div>
              <div className="text-sm font-bold num text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatMoney(stats.netPKR, "PKR")}
              </div>
            </div>
          </div>
        </Card>

        {/* AED Summary Card */}
        <Card className="rounded-2xl p-5 border border-blue-200/80 dark:border-blue-900/60 bg-card shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="font-bold text-base">AED {t("FinancialSummary")}</h2>
            </div>
            <Badge className="bg-blue-600 text-white font-bold text-[10px]">AED</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">{t("Cash")}</div>
              <div className="text-sm font-bold num text-slate-800 dark:text-slate-100 mt-0.5">
                {formatMoney(stats.cashAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold uppercase">{t("Receivables")}</div>
              <div className="text-sm font-bold num text-orange-600 dark:text-orange-400 mt-0.5">
                {formatMoney(stats.receivableAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase">{t("Payables")}</div>
              <div className="text-sm font-bold num text-red-600 dark:text-red-400 mt-0.5">
                {formatMoney(stats.payableAED, "AED")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{t("NetBalance")}</div>
              <div className="text-sm font-bold num text-blue-600 dark:text-blue-400 mt-0.5">
                {formatMoney(stats.netAED, "AED")}
              </div>
            </div>
          </div>
        </Card>

        {/* USD Summary Card */}
        <Card className="rounded-2xl p-5 border border-purple-200/80 dark:border-purple-900/60 bg-card shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <h2 className="font-bold text-base">USD {t("FinancialSummary")}</h2>
            </div>
            <Badge className="bg-purple-600 text-white font-bold text-[10px]">USD</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">{t("Cash")}</div>
              <div className="text-sm font-bold num text-slate-800 dark:text-slate-100 mt-0.5">
                {formatMoney(stats.cashUSD, "USD")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold uppercase">{t("Receivables")}</div>
              <div className="text-sm font-bold num text-orange-600 dark:text-orange-400 mt-0.5">
                {formatMoney(stats.receivableUSD, "USD")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase">{t("Payables")}</div>
              <div className="text-sm font-bold num text-red-600 dark:text-red-400 mt-0.5">
                {formatMoney(stats.payableUSD, "USD")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase">{t("NetBalance")}</div>
              <div className="text-sm font-bold num text-purple-600 dark:text-purple-400 mt-0.5">
                {formatMoney(stats.netUSD, "USD")}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 📍 SECTION 4: TWO-COLUMN LAYOUT (Branch Summary on Left 25%, Recent Activity on Right 75%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Branch Summary (25% width) */}
        <Card className="lg:col-span-1 rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> {t("BranchSummary")}
            </h2>
            <Badge variant="outline" className="text-[11px] font-semibold">{stats ? stats.byBranch.length : 0} Branches</Badge>
          </div>

          {!stats || stats.byBranch.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No branches setup yet. <Link to="/branches" className="text-primary underline font-medium">Create one</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.byBranch.map((b) => (
                <div key={b.name} className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs truncate pr-2">{b.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{b.accounts} accounts</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs num pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold">PKR:</span>
                      <span className={`font-bold ${b.pkr >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatMoney(b.pkr, "PKR")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold">AED:</span>
                      <span className={`font-bold ${b.aed >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>{formatMoney(b.aed, "AED")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold">USD:</span>
                      <span className={`font-bold ${b.usd >= 0 ? "text-purple-600 dark:text-purple-400" : "text-red-600 dark:text-red-400"}`}>{formatMoney(b.usd, "USD")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Side: Recent Activity (75% width) */}
        <Card className="lg:col-span-3 rounded-2xl p-6 border border-border/80 bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> {t("RecentActivity")}
            </h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline font-semibold">{t("ViewAll")}</Link>
          </div>

          <div className="space-y-3">
            {recent.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No recent activity recorded.</div>
            ) : (
              recent.slice(0, 5).map((r) => {
                const isCredit = Number(r.credit ?? 0) > 0;
                const amount = isCredit ? Number(r.credit) : Number(r.debit);
                const cur = r.accounts?.currency || "PKR";
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[10px] shrink-0 ${isCredit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"}`}>
                        {isCredit ? "RCP" : "PAY"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{r.accounts?.name || "General Entry"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{r.txn_code || formatDate(r.txn_date)} · {r.details || "No details"}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div className={`font-bold text-xs num ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isCredit ? "+" : "-"}{formatMoney(amount, cur)}
                      </div>
                      <span className="text-[9px] text-muted-foreground/80 font-mono">{formatDate(r.txn_date)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>



    </div>
  );
}

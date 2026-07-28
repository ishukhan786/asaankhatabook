import React, { useEffect, useState, useMemo, useDeferredValue } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ArrowDownLeft, ArrowUpRight, Phone, MapPin,
  Building2, MessageSquare, Printer, ExternalLink, Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { PageHeader } from "@/components/PageHeader";

interface AccountBalance {
  id: string;
  name: string;
  account_no: string;
  currency: string;
  branch_id: string;
  branch_name: string;
  mobile: string | null;
  address: string | null;
  balance: number;
}

const aggregateByCurrency = (list: AccountBalance[]) => {
  const totals: Record<string, number> = {};
  list.forEach(a => {
    const cur = a.currency || "PKR";
    totals[cur] = (totals[cur] || 0) + Math.abs(a.balance);
  });
  return Object.entries(totals)
    .filter(([_, val]) => val > 0)
    .sort(([curA], [curB]) => curA === "PKR" ? -1 : curB === "PKR" ? 1 : curA.localeCompare(curB));
};

const PRINT_STYLES = `
@media print {
  .screen-ui, header, aside, nav, footer, button { 
    display: none !important; 
  }
  body, html, #root, main, .min-h-screen, .flex-1 {
    display: block !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }
  #print-wrapper { 
    display: block !important; 
    position: static !important;
    width: 100% !important;
    background: #ffffff !important;
    color: #000000 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  @page { margin: 1cm; size: A4; }
}
`;

// ─── Print Document ───────────────────────────────────────────────────────────
const PrintDocument = React.memo(({
  receivables, payables, branchHeaderLabel,
  bizName, bizPhone, bizAddress, printDate, printTime, printType
}: {
  receivables: AccountBalance[];
  payables: AccountBalance[];
  branchHeaderLabel: string;
  bizName: string; bizPhone: string; bizAddress: string;
  printDate: string; printTime: string;
  printType: "both" | "receivable" | "payable";
}) => {
  const recTotals = aggregateByCurrency(receivables);
  const payTotals = aggregateByCurrency(payables);

  const renderTable = (list: AccountBalance[], type: "receivable" | "payable") => {
    const isR = type === "receivable";
    const accent = isR ? "#dc2626" : "#16a34a";
    const accentBg = isR ? "#fff5f5" : "#f0fdf4";
    const accentBorder = isR ? "#fca5a5" : "#86efac";
    const totals = isR ? recTotals : payTotals;
    
    return (
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 36px 10px" }}>
          <div style={{ width: "4px", height: "26px", background: accent, borderRadius: "4px" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: "800", color: "#111827" }}>
              {isR ? `Receivables - Denedari (${branchHeaderLabel})` : `Payables - Lenedari (${branchHeaderLabel})`}
            </div>
            <div style={{ fontSize: "10px", color: "#9ca3af" }}>{list.length} accounts</div>
          </div>
        </div>
        <div style={{ padding: "0 36px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderTop: `3px solid ${accent}`, borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                {["#", "Account No", "Account Name", "Branch", "Mobile", "Address", "Balance"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: i === 6 ? "right" : "left", fontSize: "9px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "7px 10px", color: "#9ca3af", fontSize: "10px" }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px" }}><span style={{ fontFamily: "monospace", fontSize: "10px", background: "#f3f4f6", padding: "2px 5px", borderRadius: "4px", fontWeight: "700" }}>{a.account_no}</span></td>
                  <td style={{ padding: "7px 10px", fontWeight: "700", color: "#111827", fontSize: "11px" }}>{a.name}</td>
                  <td style={{ padding: "7px 10px", color: "#6b7280", fontSize: "10px" }}>{a.branch_name}</td>
                  <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "10px" }}>{a.mobile || "N/A"}</td>
                  <td style={{ padding: "7px 10px", color: "#6b7280", fontSize: "10px" }}>{a.address || "N/A"}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <div style={{ fontWeight: "800", fontSize: "12px", color: accent }}>{formatMoney(Math.abs(a.balance), a.currency)}</div>
                    <div style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase" }}>{a.currency}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: accentBg, borderTop: `2px solid ${accentBorder}` }}>
                <td colSpan={6} style={{ padding: "9px 10px", textAlign: "right", fontWeight: "800", fontSize: "9px", color: "#374151", textTransform: "uppercase" }}>Grand Total — {list.length} Account{list.length !== 1 ? "s" : ""}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: "900", color: accent }}>
                  {totals.map(([cur, amount], idx) => (
                    <div key={cur} style={{ fontSize: idx === 0 ? "13px" : "11px", marginTop: idx > 0 ? "2px" : "0" }}>
                      {formatMoney(amount, cur)}
                    </div>
                  ))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#ffffff", color: "#111827", fontSize: "12px" }}>
      <div style={{ height: "6px", background: "linear-gradient(90deg, #dc2626 0%, #16a34a 100%)" }} />
      <div style={{ padding: "22px 36px 18px", borderBottom: "2px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "#111827" }}>{bizName}</div>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#374151", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {printType === "receivable" ? "Receivable Report" : printType === "payable" ? "Payable Report" : "Payable & Receivable Report"}
          </div>
          {bizPhone && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>📞 {bizPhone}</div>}
          {bizAddress && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>📍 {bizAddress}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>Date: {printDate}</div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>Time: {printTime}</div>
        </div>
      </div>

      {(printType === "both" || printType === "receivable") && renderTable(receivables, "receivable")}
      {(printType === "both" || printType === "payable") && renderTable(payables, "payable")}
      <div style={{ margin: "0 36px", borderTop: "1px solid #e5e7eb", padding: "10px 0", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "9px", color: "#9ca3af" }}>Generated by <strong style={{ color: "#374151" }}>Aasaan Khatabook</strong> — {printDate} {printTime}</div>
        <div style={{ fontSize: "9px", color: "#9ca3af" }}>CONFIDENTIAL</div>
      </div>
      <div style={{ height: "4px", background: "linear-gradient(90deg, #dc2626 0%, #16a34a 100%)" }} />
    </div>
  );
});
PrintDocument.displayName = "PrintDocument";

// ─── Section Table ────────────────────────────────────────────────────────────
const SectionTable = React.memo(({ list, type, navigate, sendWhatsApp }: {
  list: AccountBalance[];
  type: "receivable" | "payable";
  navigate: ReturnType<typeof useNavigate>;
  sendWhatsApp: (e: React.MouseEvent, a: AccountBalance) => void;
}) => {
  const isR = type === "receivable";
  const totals = aggregateByCurrency(list);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className={`border-b-2 text-[11px] uppercase tracking-wider font-bold ${isR ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400" : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400"}`}>
            <th className="px-4 py-3 text-left w-10">#</th>
            <th className="px-4 py-3 text-left">Account</th>
            <th className="px-4 py-3 text-left">Contact & Branch</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Address</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3 text-right w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {list.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-14">
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isR ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
                    <Wallet className={`w-6 h-6 ${isR ? "text-red-400" : "text-emerald-400"}`} />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">No {isR ? "receivables" : "payables"} found.</p>
                </div>
              </td>
            </tr>
          ) : list.map((a, i) => (
            <tr key={a.id} className="hover:bg-muted/25 transition-colors cursor-pointer group" onClick={() => navigate(`/accounts/${a.id}`)}>
              <td className="px-4 py-3 text-xs text-muted-foreground font-semibold">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isR ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"}`}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{a.name}</div>
                    <div className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground inline-block mt-0.5 border">{a.account_no}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  {a.mobile
                    ? <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground"><Phone className="w-3 h-3" />{a.mobile}</div>
                    : <span className="text-muted-foreground/40 text-xs italic">No Phone</span>}
                  {a.branch_name && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="w-3 h-3" />{a.branch_name}</div>}
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {a.address
                  ? <div className="flex items-start gap-1.5 text-xs text-muted-foreground max-w-[180px]"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="truncate" title={a.address}>{a.address}</span></div>
                  : <span className="text-muted-foreground/40 text-xs italic">No Address</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <div className={`font-black text-base num tracking-tight ${isR ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatMoney(Math.abs(a.balance), a.currency)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/40 inline-block px-1.5 py-0.5 rounded mt-0.5">{a.currency}</div>
              </td>
              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  {a.mobile && (
                    <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50" onClick={e => sendWhatsApp(e, a)} title="Send WhatsApp">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/accounts/${a.id}`)} title="View Details">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        {list.length > 0 && (
          <tfoot>
            <tr className={`border-t-2 ${isR ? "border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10" : "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10"}`}>
              <td colSpan={4} className="px-4 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                Grand Total ({list.length} accounts)
              </td>
              <td colSpan={2} className="px-4 py-4 text-right text-xs font-bold text-muted-foreground uppercase md:hidden">Total ({list.length})</td>
              <td className={`px-4 py-4 text-right font-black num ${isR ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {totals.map(([cur, amount], idx) => (
                  <div key={cur} className={idx === 0 ? "text-lg" : "text-sm mt-1 opacity-80"}>
                    {formatMoney(amount, cur)}
                  </div>
                ))}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});
SectionTable.displayName = "SectionTable";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayablesReceivables() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<AccountBalance[]>([]);
  const [payables, setPayables] = useState<AccountBalance[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [recSearch, setRecSearch] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [printType, setPrintType] = useState<"both" | "receivable" | "payable">("both");

  const deferredRec = useDeferredValue(recSearch);
  const deferredPay = useDeferredValue(paySearch);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: accounts }, { data: transactions }, { data: branchesData }] = await Promise.all([
        supabase.from("accounts").select("id, name, account_no, currency, mobile, address, branch_id, branches(id, name)"),
        supabase.from("transactions").select("account_id, debit, credit"),
        supabase.from("branches").select("id, name").order("name")
      ]);
      if (branchesData) setBranches(branchesData);
      const balances: Record<string, number> = {};
      (transactions ?? []).forEach(t => {
        balances[t.account_id] = (balances[t.account_id] || 0) + (Number(t.credit) - Number(t.debit));
      });
      const processed: AccountBalance[] = (accounts ?? []).map(a => ({
        id: a.id, name: a.name, account_no: a.account_no,
        currency: a.currency, mobile: a.mobile ?? null, address: a.address ?? null,
        branch_id: a.branch_id,
        branch_name: (a.branches as { name?: string | null } | null)?.name ?? "N/A",
        balance: balances[a.id] || 0
      }));
      setReceivables(processed.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance));
      setPayables(processed.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance));
    } catch (err) { logger.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel("payables_receivables_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const sendWhatsApp = React.useCallback((e: React.MouseEvent, a: AccountBalance) => {
    e.stopPropagation();
    if (!a.mobile) return;
    const type = a.balance < 0 ? "Denedari (Receivable)" : "Lenedari (Payable)";
    const msg = `*Assalam-o-Alaikum ${a.name}!*\\n\\n*Aasaan Khatabook Balance Update*\\n---------------------------\\n*Account:* ${a.name}\\n*Account No:* ${a.account_no}\\n*Type:* ${type}\\n*Balance:* ${formatMoney(Math.abs(a.balance), a.currency)}\\n---------------------------\\nShukriya!`;
    window.open(`https://wa.me/${a.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  }, []);

  const handlePrint = (type: "both" | "receivable" | "payable") => {
    setPrintType(type);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintType("both"), 1000);
    }, 150);
  };

  const applyBranchFilter = (list: AccountBalance[]) => {
    if (role === "admin") return selectedBranch !== "all" ? list.filter(a => a.branch_id === selectedBranch) : list;
    return profile?.branch_id ? list.filter(a => a.branch_id === profile.branch_id) : list;
  };

  const filteredReceivables = useMemo(() => {
    let res = applyBranchFilter(receivables);
    if (deferredRec) { const s = deferredRec.toLowerCase(); res = res.filter(a => a.name.toLowerCase().includes(s) || a.account_no.toLowerCase().includes(s) || (a.mobile ?? "").includes(s)); }
    return res;
  }, [receivables, role, selectedBranch, profile?.branch_id, deferredRec]);

  const filteredPayables = useMemo(() => {
    let res = applyBranchFilter(payables);
    if (deferredPay) { const s = deferredPay.toLowerCase(); res = res.filter(a => a.name.toLowerCase().includes(s) || a.account_no.toLowerCase().includes(s) || (a.mobile ?? "").includes(s)); }
    return res;
  }, [payables, role, selectedBranch, profile?.branch_id, deferredPay]);

  const recTotals = useMemo(() => aggregateByCurrency(filteredReceivables), [filteredReceivables]);
  const payTotals = useMemo(() => aggregateByCurrency(filteredPayables), [filteredPayables]);

  const branchHeaderLabel = useMemo(() => {
    if (role === "admin") return selectedBranch !== "all" ? branches.find(x => x.id === selectedBranch)?.name || "All Branches" : "All Branches";
    return branches.find(x => x.id === profile?.branch_id)?.name || profile?.business_name || "My Branch";
  }, [role, selectedBranch, branches, profile]);

  const printDate = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>
      <Skeleton className="h-[350px] w-full rounded-2xl" />
      <Skeleton className="h-[350px] w-full rounded-2xl" />
    </div>
  );

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div id="print-wrapper" style={{ display: "none" }}>
        <PrintDocument
          receivables={filteredReceivables} payables={filteredPayables}
          branchHeaderLabel={branchHeaderLabel}
          bizName={profile?.business_name || "Aasaan Khatabook"}
          bizPhone={profile?.business_phone || ""} bizAddress={profile?.business_address || ""}
          printDate={printDate} printTime={printTime}
          printType={printType}
        />
      </div>

      <div className="screen-ui p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          eyebrow={`${t("Reports")} • ${branchHeaderLabel}`}
          title={t("PayablesReceivables")}
          description="Receivables aur Payables — dono alag sections mein clearly dikhain."
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              {role === "admin" && (
                <div className="w-56">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-11 glass border-2 font-medium rounded-xl shadow-sm">
                      <Building2 className="w-4 h-4 mr-2 text-primary" />
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-bold">🌍 All Branches</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>📍 {b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => handlePrint("both")} variant="outline" className="h-11 px-5 gap-2 border-2 hover:bg-primary hover:text-primary-foreground transition-all rounded-xl font-semibold">
                <Printer className="w-4 h-4" /> Print Both
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="relative overflow-hidden border-2 border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-card">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
            <div className="p-6 flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-2 flex-wrap mb-2">
                  <span>Receivables — Denedari</span>
                  <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full text-[10px]">{filteredReceivables.length} accounts</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {recTotals.map(([cur, amount], idx) => (
                    <span key={cur} className={`font-black num tracking-tight text-red-600 dark:text-red-400 ${idx === 0 ? "text-3xl" : "text-xl opacity-80"}`}>
                      {formatMoney(amount, cur)}
                    </span>
                  ))}
                  {recTotals.length === 0 && <span className="text-3xl font-black text-red-600 dark:text-red-400 num">0</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Customers ko dena hai aap ko</p>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-2 border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-card">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
            <div className="p-6 flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                <ArrowUpRight className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2 flex-wrap mb-2">
                  <span>Payables — Lenedari</span>
                  <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px]">{filteredPayables.length} accounts</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {payTotals.map(([cur, amount], idx) => (
                    <span key={cur} className={`font-black num tracking-tight text-emerald-600 dark:text-emerald-400 ${idx === 0 ? "text-3xl" : "text-xl opacity-80"}`}>
                      {formatMoney(amount, cur)}
                    </span>
                  ))}
                  {payTotals.length === 0 && <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 num">0</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Aap ko customers se lena hai</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Receivables Section ─────────────────────────────────────────────── */}
        <Card className="rounded-2xl border-2 border-red-200 dark:border-red-900/40 overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-red-50/60 dark:bg-red-950/20 border-b-2 border-red-200 dark:border-red-900/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25 shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-red-700 dark:text-red-400">Receivables (Denedari)</h2>
                <p className="text-xs text-red-500/60">{filteredReceivables.length} accounts — customers ko aap se lena hai</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="Search receivables..." className="pl-9 h-10 rounded-xl border-red-200 dark:border-red-900/40 bg-white dark:bg-card" />
              </div>
              <Button onClick={() => handlePrint("receivable")} variant="outline" className="h-10 px-3 border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 rounded-xl" title="Print Receivables">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <SectionTable list={filteredReceivables} type="receivable" navigate={navigate} sendWhatsApp={sendWhatsApp} />
        </Card>

        {/* ── Payables Section ────────────────────────────────────────────────── */}
        <Card className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/40 overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-emerald-50/60 dark:bg-emerald-950/20 border-b-2 border-emerald-200 dark:border-emerald-900/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-emerald-700 dark:text-emerald-400">Payables (Lenedari)</h2>
                <p className="text-xs text-emerald-500/60">{filteredPayables.length} accounts — aap ko customers se lena hai</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={paySearch} onChange={e => setPaySearch(e.target.value)} placeholder="Search payables..." className="pl-9 h-10 rounded-xl border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-card" />
              </div>
              <Button onClick={() => handlePrint("payable")} variant="outline" className="h-10 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl" title="Print Payables">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <SectionTable list={filteredPayables} type="payable" navigate={navigate} sendWhatsApp={sendWhatsApp} />
        </Card>

      </div>
    </>
  );
}

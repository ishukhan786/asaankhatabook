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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  @page { 
    margin: 1cm; 
    size: A4; 
  }
}
`;

// ─── Extracted PrintDocument ──────────────────────────────────────────────────
const PrintDocument = React.memo(({ 
  list, 
  type,
  branchHeaderLabel,
  bizName,
  bizPhone,
  bizAddress,
  printDate,
  printTime,
}: { 
  list: AccountBalance[]; 
  type: "receivable" | "payable";
  branchHeaderLabel: string;
  bizName: string;
  bizPhone: string;
  bizAddress: string;
  printDate: string;
  printTime: string;
}) => {
  const isR = type === "receivable";
  const accentColor = isR ? "#dc2626" : "#16a34a";
  const accentBg   = isR ? "#fff5f5" : "#f0fdf4";
  const accentBorder = isR ? "#fca5a5" : "#86efac";
  const totalPKR = list.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalAED = list.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);
  const label = isR ? `Receivables - Denedari (${branchHeaderLabel})` : `Payables - Lenedari (${branchHeaderLabel})`;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#ffffff", color: "#111827", padding: "0", fontSize: "12px" }}>
      <div style={{ height: "6px", background: `linear-gradient(90deg, ${accentColor} 0%, #60a5fa 100%)` }} />
      <div style={{ padding: "24px 36px 20px", borderBottom: "2px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "#111827", letterSpacing: "-0.5px" }}>{bizName}</div>
          {bizPhone   && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>📞 {bizPhone}</div>}
          {bizAddress && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>📍 {bizAddress}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "inline-block", padding: "5px 16px", borderRadius: "20px",
            background: accentBg, border: `1.5px solid ${accentBorder}`,
            color: accentColor, fontWeight: "800", fontSize: "11px", letterSpacing: "0.5px"
          }}>
            {isR ? "DR - Receivables" : "CR - Payables"}
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px" }}>Date: {printDate}</div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>Time: {printTime}</div>
        </div>
      </div>

      <div style={{ padding: "16px 36px 0", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "4px", height: "28px", background: accentColor, borderRadius: "4px" }} />
        <div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#111827" }}>{label}</div>
          <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "1px" }}>Aasaan Khatabook - Ledger Report</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", padding: "16px 36px" }}>
        <div style={{ flex: 1, border: `1.5px solid ${accentBorder}`, borderRadius: "8px", padding: "12px 16px", background: accentBg }}>
          <div style={{ fontSize: "9px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700" }}>Grand Total</div>
          <div style={{ fontSize: "18px", fontWeight: "900", color: accentColor, marginTop: "3px" }}>{formatMoney(totalPKR, "PKR")}</div>
          {totalAED > 0 && <div style={{ fontSize: "14px", fontWeight: "800", color: accentColor, marginTop: "2px" }}>{formatMoney(totalAED, "AED")}</div>}
        </div>
        <div style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: "8px", padding: "12px 16px", background: "#f9fafb" }}>
          <div style={{ fontSize: "9px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700" }}>Total Accounts</div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#1d4ed8", marginTop: "3px" }}>{list.length}</div>
        </div>
        <div style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: "8px", padding: "12px 16px", background: "#f9fafb" }}>
          <div style={{ fontSize: "9px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700" }}>Report</div>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#374151", marginTop: "5px" }}>{isR ? "Denedari" : "Lenedari"}</div>
          <div style={{ fontSize: "9px", color: "#9ca3af" }}>{printDate}</div>
        </div>
      </div>

      <div style={{ padding: "0 36px 24px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderTop: `3px solid ${accentColor}`, borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
              {["#", "Account No", "Account Name", "Branch", "Mobile No", "Address", "Balance"].map((h, i) => (
                <th key={h} style={{
                  padding: "9px 10px", textAlign: i === 6 ? "right" : "left",
                  fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                  letterSpacing: "1px", color: "#374151"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a, i) => (
              <tr key={a.id} style={{
                background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                borderBottom: "1px solid #e5e7eb"
              }}>
                <td style={{ padding: "8px 10px", color: "#9ca3af", fontSize: "10px", fontWeight: "600" }}>{i + 1}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "10px", background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px", color: "#374151", fontWeight: "700", border: "1px solid #e5e7eb" }}>
                    {a.account_no}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", fontWeight: "700", color: "#111827", fontSize: "12px" }}>{a.name}</td>
                <td style={{ padding: "8px 10px", color: "#6b7280", fontSize: "10px" }}>{a.branch_name}</td>
                <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "10px", color: "#374151" }}>{a.mobile || "N/A"}</td>
                <td style={{ padding: "8px 10px", color: "#6b7280", fontSize: "10px", maxWidth: "140px" }}>{a.address || "N/A"}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <div style={{ fontWeight: "800", fontSize: "12px", color: accentColor }}>{formatMoney(Math.abs(a.balance), a.currency)}</div>
                  <div style={{ fontSize: "8px", color: "#9ca3af", textTransform: "uppercase" }}>{a.currency}</div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: accentBg, borderTop: `2px solid ${accentColor}` }}>
              <td colSpan={6} style={{ padding: "10px", textAlign: "right", fontWeight: "800", fontSize: "10px", color: "#374151", textTransform: "uppercase", letterSpacing: "1px" }}>
                Grand Total - {list.length} Account{list.length !== 1 ? "s" : ""}
              </td>
              <td style={{ padding: "10px", textAlign: "right", fontWeight: "900", fontSize: "14px", color: accentColor }}>
                <div>{formatMoney(totalPKR, "PKR")}</div>
                {totalAED > 0 && <div style={{ marginTop: "2px", fontSize: "12px" }}>{formatMoney(totalAED, "AED")}</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ margin: "0 36px", borderTop: "1px solid #e5e7eb", padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "9px", color: "#9ca3af" }}>
          Generated by <strong style={{ color: "#374151" }}>Aasaan Khatabook</strong> - {printDate} {printTime}
        </div>
        <div style={{ fontSize: "9px", color: "#9ca3af" }}>
          {list.length} records - {label} - CONFIDENTIAL
        </div>
      </div>
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${accentColor} 0%, #60a5fa 100%)` }} />
    </div>
  );
});
PrintDocument.displayName = "PrintDocument";

// ─── Extracted ScreenTable ────────────────────────────────────────────────────
const ScreenTable = React.memo(({ 
  list, 
  type,
  navigate,
  sendWhatsApp
}: { 
  list: AccountBalance[]; 
  type: "receivable" | "payable";
  navigate: ReturnType<typeof useNavigate>;
  sendWhatsApp: (e: React.MouseEvent, a: AccountBalance) => void;
}) => {
  const isR = type === "receivable";
  const totalPKR = list.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalAED = list.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);
  
  return (
    <Card className="glass overflow-hidden shadow-lg border-none mt-4    ">
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-muted/40 border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
              <th className="px-5 py-4 text-left">Account</th>
              <th className="px-5 py-4 text-left">Details</th>
              <th className="px-5 py-4 text-left hidden md:table-cell">Location</th>
              <th className="px-5 py-4 text-right">Balance</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground font-medium">No {isR ? "receivables" : "payables"} found.</p>
                  </div>
                </td>
              </tr>
            ) : list.map((a, i) => (
              <tr 
                key={a.id} 
                className="hover:bg-muted/30 transition-all cursor-pointer group" 
                onClick={() => navigate(`/accounts/${a.id}`)}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-base">{a.name}</div>
                      <div className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground inline-block mt-1 border">
                        {a.account_no}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    {a.mobile ? (
                      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />{a.mobile}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">No Phone</span>
                    )}
                    {a.branch_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5" />{a.branch_name}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  <div className="max-w-[200px]">
                    {a.address ? (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="truncate" title={a.address}>{a.address}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">No Address</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className={`font-bold font-display text-lg tracking-tight num ${isR ? "text-destructive" : "text-success"}`}>
                    {formatMoney(Math.abs(a.balance), a.currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest bg-muted/40 inline-block px-1.5 py-0.5 rounded">
                    {a.currency}
                  </div>
                </td>
                <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all  translate-x-2 group-hover:translate-x-0">
                    {a.mobile && (
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50" 
                        onClick={e => sendWhatsApp(e, a)} 
                        title="Send WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary" 
                      onClick={() => navigate(`/accounts/${a.id}`)} 
                      title="View Details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 ${isR ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5"}`}>
                <td colSpan={3} className="px-5 py-5 text-right uppercase tracking-widest text-xs font-bold text-muted-foreground hidden md:table-cell">
                  Grand Total ({list.length} accounts)
                </td>
                <td colSpan={2} className="px-5 py-5 text-right uppercase tracking-widest text-xs font-bold text-muted-foreground md:hidden">
                  Total ({list.length})
                </td>
                <td className={`px-5 py-5 text-right font-display font-black num ${isR ? "text-destructive" : "text-success"}`}>
                  <div className="text-xl">{formatMoney(totalPKR, "PKR")}</div>
                  {totalAED > 0 && <div className="text-sm mt-1 opacity-80">{formatMoney(totalAED, "AED")}</div>}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
});
ScreenTable.displayName = "ScreenTable";

export default function PayablesReceivables() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, role } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<AccountBalance[]>([]);
  const [payables, setPayables] = useState<AccountBalance[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState("receivables");

  // Use deferred value for search input so typing doesn't block the UI
  const deferredQ = useDeferredValue(q);

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
    } catch (err) {
        logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('payables_receivables_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const sendWhatsApp = React.useCallback((e: React.MouseEvent, a: AccountBalance) => {
    e.stopPropagation();
    if (!a.mobile) return;
    const type = a.balance < 0 ? "Denedari (Receivable)" : "Lenedari (Payable)";
    const msg = `*Assalam-o-Alaikum ${a.name}!*\\n\\n*Aasaan Khatabook Balance Update*\\n---------------------------\\n*Account:* ${a.name}\\n*Account No:* ${a.account_no}\\n*Type:* ${type}\\n*Balance:* ${formatMoney(Math.abs(a.balance), a.currency)}\\n---------------------------\\nShukriya!`;
    window.open(`https://wa.me/${a.mobile.replace(/\\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  }, []);

  // Memoized filtered lists based on deferred search term to prevent re-filtering on every keystroke
  const filteredReceivables = useMemo(() => {
    let res = receivables;
    if (role === "admin") {
      if (selectedBranch !== "all") res = res.filter(a => a.branch_id === selectedBranch);
    } else {
      if (profile?.branch_id) res = res.filter(a => a.branch_id === profile.branch_id);
    }

    if (deferredQ) {
      const s = deferredQ.toLowerCase();
      res = res.filter(a =>
        a.name.toLowerCase().includes(s) || a.account_no.toLowerCase().includes(s) ||
        (a.mobile ?? "").includes(s) || (a.address ?? "").toLowerCase().includes(s)
      );
    }
    return res;
  }, [receivables, role, selectedBranch, profile?.branch_id, deferredQ]);

  const filteredPayables = useMemo(() => {
    let res = payables;
    if (role === "admin") {
      if (selectedBranch !== "all") res = res.filter(a => a.branch_id === selectedBranch);
    } else {
      if (profile?.branch_id) res = res.filter(a => a.branch_id === profile.branch_id);
    }

    if (deferredQ) {
      const s = deferredQ.toLowerCase();
      res = res.filter(a =>
        a.name.toLowerCase().includes(s) || a.account_no.toLowerCase().includes(s) ||
        (a.mobile ?? "").includes(s) || (a.address ?? "").toLowerCase().includes(s)
      );
    }
    return res;
  }, [payables, role, selectedBranch, profile?.branch_id, deferredQ]);

  // Memoized totals
  const totalReceivablePKR = useMemo(() => filteredReceivables.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0), [filteredReceivables]);
  const totalReceivableAED = useMemo(() => filteredReceivables.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0), [filteredReceivables]);
  const totalPayablePKR = useMemo(() => filteredPayables.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0), [filteredPayables]);
  const totalPayableAED = useMemo(() => filteredPayables.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0), [filteredPayables]);

  const branchHeaderLabel = useMemo(() => {
    if (role === "admin") {
      if (selectedBranch !== "all") {
        const b = branches.find(x => x.id === selectedBranch);
        return b?.name || "All Branches";
      }
      return "All Branches";
    } else {
      if (profile?.branch_id) {
        const b = branches.find(x => x.id === profile.branch_id);
        return b?.name || profile?.business_name || "My Branch";
      }
      return "My Branch";
    }
  }, [role, selectedBranch, branches, profile]);

  const printDate = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const bizName = profile?.business_name || "Aasaan Khatabook";
  const bizPhone = profile?.business_phone || "";
  const bizAddress = profile?.business_address || "";

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-2xl" />
      </div>
    );
  }

  const currentList = activeTab === "receivables" ? filteredReceivables : filteredPayables;
  const currentType  = activeTab === "receivables" ? "receivable" : "payable";

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Hidden Print Wrapper */}
      <div id="print-wrapper" style={{ display: "none" }}>
        <PrintDocument 
          list={currentList} 
          type={currentType} 
          branchHeaderLabel={branchHeaderLabel}
          bizName={bizName}
          bizPhone={bizPhone}
          bizAddress={bizAddress}
          printDate={printDate}
          printTime={printTime}
        />
      </div>

      {/* Screen UI */}
      <div className="screen-ui p-4 md:p-8 max-w-[1600px] mx-auto space-y-8   ">

        <PageHeader
          eyebrow={`${t("Reports")} • ${branchHeaderLabel}`}
          title={t("PayablesReceivables")}
          description="Monitor all outstanding balances grouped by receivables and payables."
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              {role === "admin" && (
                <div className="w-64">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-12 glass border-2 font-medium rounded-xl shadow-sm hover:border-primary/50 transition-colors">
                      <Building2 className="w-4 h-4 mr-2 text-primary" />
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-bold">🌍 All Branches</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>📍 {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => window.print()} variant="outline" className="h-12 px-6 gap-2 border-2 hover:bg-primary hover:text-primary-foreground transition-all rounded-xl shadow-sm font-semibold">
                <Printer className="w-4 h-4" />
                Print Report
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Receivables Card */}
          <Card className="relative overflow-hidden group cursor-pointer" onClick={() => setActiveTab("receivables")}>
            <div className={`absolute inset-0 bg-gradient-to-br from-destructive/20 via-destructive/5 to-transparent transition-opacity  ${activeTab === 'receivables' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
            <div className={`absolute left-0 top-0 bottom-0 w-2 transition-colors  ${activeTab === 'receivables' ? 'bg-destructive' : 'bg-destructive/20 group-hover:bg-destructive/50'}`} />
            <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row md:items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform  group-hover:scale-110 ${activeTab === 'receivables' ? 'bg-destructive text-destructive-foreground' : 'bg-background border-2 border-destructive text-destructive'}`}>
                <ArrowDownLeft className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span>{t("TotalReceivable")}</span>
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-[10px]">{filteredReceivables.length} ACCOUNTS</span>
                </div>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="text-3xl md:text-4xl font-display font-black text-destructive num tracking-tight">
                    {formatMoney(totalReceivablePKR, "PKR")}
                  </span>
                  {totalReceivableAED > 0 && (
                    <span className="text-xl md:text-2xl font-display font-bold text-destructive/70 num">
                      {formatMoney(totalReceivableAED, "AED")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Payables Card */}
          <Card className="relative overflow-hidden group cursor-pointer" onClick={() => setActiveTab("payables")}>
            <div className={`absolute inset-0 bg-gradient-to-br from-success/20 via-success/5 to-transparent transition-opacity  ${activeTab === 'payables' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
            <div className={`absolute left-0 top-0 bottom-0 w-2 transition-colors  ${activeTab === 'payables' ? 'bg-success' : 'bg-success/20 group-hover:bg-success/50'}`} />
            <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row md:items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform  group-hover:scale-110 ${activeTab === 'payables' ? 'bg-success text-success-foreground' : 'bg-background border-2 border-success text-success'}`}>
                <ArrowUpRight className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span>{t("TotalPayable")}</span>
                  <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-[10px]">{filteredPayables.length} ACCOUNTS</span>
                </div>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="text-3xl md:text-4xl font-display font-black text-success num tracking-tight">
                    {formatMoney(totalPayablePKR, "PKR")}
                  </span>
                  {totalPayableAED > 0 && (
                    <span className="text-xl md:text-2xl font-display font-bold text-success/70 num">
                      {formatMoney(totalPayableAED, "AED")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="glass p-2 rounded-2xl flex flex-col md:flex-row gap-4 items-center shadow-md">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="h-12 w-full md:w-[300px] grid grid-cols-2 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="receivables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold tracking-wide">
                Receivables
              </TabsTrigger>
              <TabsTrigger value="payables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold tracking-wide">
                Payables
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              value={q} 
              onChange={e => setQ(e.target.value)}
              placeholder="Search accounts by name, no, mobile or address..."
              className="pl-12 h-12 bg-transparent border-none shadow-none text-base focus-visible:ring-0" 
            />
          </div>
        </Card>

        {activeTab === "receivables" && (
          <ScreenTable list={filteredReceivables} type="receivable" navigate={navigate} sendWhatsApp={sendWhatsApp} />
        )}
        {activeTab === "payables" && (
          <ScreenTable list={filteredPayables} type="payable" navigate={navigate} sendWhatsApp={sendWhatsApp} />
        )}

      </div>
    </>
  );
}

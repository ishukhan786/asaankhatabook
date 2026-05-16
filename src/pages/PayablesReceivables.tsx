import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ArrowDownLeft, ArrowUpRight, Phone, MapPin,
  Building2, MessageSquare, Printer, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        branch_name: (a.branches as any)?.name ?? "—",
        balance: balances[a.id] || 0
      }));
      setReceivables(processed.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance));
      setPayables(processed.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance));
    } catch (err) {
      console.error(err);
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

  const filterList = (list: AccountBalance[]) => {
    let res = list;
    if (role === "admin") {
      if (selectedBranch !== "all") {
        res = res.filter(a => a.branch_id === selectedBranch);
      }
    } else {
      if (profile?.branch_id) {
        res = res.filter(a => a.branch_id === profile.branch_id);
      }
    }

    if (q) {
      const s = q.toLowerCase();
      res = res.filter(a =>
        a.name.toLowerCase().includes(s) || a.account_no.toLowerCase().includes(s) ||
        (a.mobile ?? "").includes(s) || (a.address ?? "").toLowerCase().includes(s)
      );
    }
    return res;
  };

  const sendWhatsApp = (e: React.MouseEvent, a: AccountBalance) => {
    e.stopPropagation();
    if (!a.mobile) return;
    const type = a.balance < 0 ? "Denedari (Receivable)" : "Lenedari (Payable)";
    const msg = `*Assalam-o-Alaikum ${a.name}!*\n\n*Aasaan Khatabook Balance Update*\n---------------------------\n*Account:* ${a.name}\n*Account No:* ${a.account_no}\n*Type:* ${type}\n*Balance:* ${formatMoney(Math.abs(a.balance), a.currency)}\n---------------------------\nShukriya!`;
    window.open(`https://wa.me/${a.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const filteredReceivables = filterList(receivables);
  const filteredPayables = filterList(payables);
  const totalReceivablePKR = filteredReceivables.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalReceivableAED = filteredReceivables.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalPayablePKR = filteredPayables.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalPayableAED = filteredPayables.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);

  let branchHeaderLabel = "All Branches";
  if (role === "admin") {
    if (selectedBranch !== "all") {
      const b = branches.find(x => x.id === selectedBranch);
      if (b) branchHeaderLabel = b.name;
    }
  } else {
    if (profile?.branch_id) {
      const b = branches.find(x => x.id === profile.branch_id);
      if (b) branchHeaderLabel = b.name;
      else branchHeaderLabel = profile?.business_name || "My Branch";
    }
  }

  const printDate = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const bizName = profile?.business_name || "Aasaan Khatabook";
  const bizPhone = profile?.business_phone || "";
  const bizAddress = profile?.business_address || "";

  // ─── Print Document ───────────────────────────────────────────────────────────
  const PrintDocument = ({ list, type }: { list: AccountBalance[]; type: "receivable" | "payable" }) => {
    const isR = type === "receivable";
    const accentColor = isR ? "#dc2626" : "#16a34a";
    const accentBg   = isR ? "#fff5f5" : "#f0fdf4";
    const accentBorder = isR ? "#fca5a5" : "#86efac";
    const totalPKR = list.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
    const totalAED = list.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);
    const label = isR ? `Receivables — Denedari (${branchHeaderLabel})` : `Payables — Lenedari (${branchHeaderLabel})`;

    return (
      <div style={{ fontFamily: "Arial, sans-serif", background: "#ffffff", color: "#111827", padding: "0", fontSize: "12px" }}>

        {/* ── Top accent line ── */}
        <div style={{ height: "6px", background: `linear-gradient(90deg, ${accentColor} 0%, #60a5fa 100%)` }} />

        {/* ── Header ── */}
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
              {isR ? "DR · Receivables" : "CR · Payables"}
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px" }}>Date: {printDate}</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>Time: {printTime}</div>
          </div>
        </div>

        {/* ── Report Title ── */}
        <div style={{ padding: "16px 36px 0", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "28px", background: accentColor, borderRadius: "4px" }} />
          <div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#111827" }}>{label}</div>
            <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "1px" }}>Aasaan Khatabook · Ledger Report</div>
          </div>
        </div>

        {/* ── Summary Boxes ── */}
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

        {/* ── Table ── */}
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
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "10px", color: "#374151" }}>{a.mobile || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "#6b7280", fontSize: "10px", maxWidth: "140px" }}>{a.address || "—"}</td>
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
                  Grand Total — {list.length} Account{list.length !== 1 ? "s" : ""}
                </td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: "900", fontSize: "14px", color: accentColor }}>
                  <div>{formatMoney(totalPKR, "PKR")}</div>
                  {totalAED > 0 && <div style={{ marginTop: "2px", fontSize: "12px" }}>{formatMoney(totalAED, "AED")}</div>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{ margin: "0 36px", borderTop: "1px solid #e5e7eb", padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "9px", color: "#9ca3af" }}>
            Generated by <strong style={{ color: "#374151" }}>Aasaan Khatabook</strong> · {printDate} {printTime}
          </div>
          <div style={{ fontSize: "9px", color: "#9ca3af" }}>
            {list.length} records · {label} · CONFIDENTIAL
          </div>
        </div>

        {/* ── Bottom accent line ── */}
        <div style={{ height: "4px", background: `linear-gradient(90deg, ${accentColor} 0%, #60a5fa 100%)` }} />
      </div>
    );
  };

  // ─── Screen Table ─────────────────────────────────────────────────────────────
  const ScreenTable = ({ list, type }: { list: AccountBalance[]; type: "receivable" | "payable" }) => {
    const isR = type === "receivable";
    const totalPKR = list.filter(a => a.currency === "PKR").reduce((s, a) => s + Math.abs(a.balance), 0);
    const totalAED = list.filter(a => a.currency === "AED").reduce((s, a) => s + Math.abs(a.balance), 0);
    return (
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/50">
              {["#", "Account No", "Account Name", "Branch", "Mobile", "Address", "Balance", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 font-bold ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No {isR ? "receivables" : "payables"} found.</td></tr>
            ) : list.map((a, i) => (
              <tr key={a.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => navigate(`/accounts/${a.id}`)}>
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3"><span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded border">{a.account_no}</span></td>
                <td className="px-4 py-3 font-semibold">{a.name}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1.5 text-muted-foreground text-xs"><Building2 className="w-3 h-3" />{a.branch_name}</div></td>
                <td className="px-4 py-3">{a.mobile ? <div className="flex items-center gap-1.5 text-xs font-mono"><Phone className="w-3 h-3 text-muted-foreground" />{a.mobile}</div> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>
                <td className="px-4 py-3 max-w-[180px]">{a.address ? <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{a.address}</span></div> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-bold font-mono text-sm num ${isR ? "text-destructive" : "text-success"}`}>{formatMoney(Math.abs(a.balance), a.currency)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">{a.currency}</div>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {a.mobile && <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={e => sendWhatsApp(e, a)}><MessageSquare className="w-3.5 h-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/accounts/${a.id}`)}><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className={`border-t-2 font-bold text-sm ${isR ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}>
                <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-xs">Total ({list.length} accounts)</td>
                <td className={`px-4 py-3 text-right font-display font-black num ${isR ? "text-destructive" : "text-success"}`}>
                  <div className="text-base">{formatMoney(totalPKR, "PKR")}</div>
                  {totalAED > 0 && <div className="text-sm mt-0.5 opacity-90">{formatMoney(totalAED, "AED")}</div>}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full" />
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
        <PrintDocument list={currentList} type={currentType} />
      </div>

      {/* Screen UI */}
      <div className="screen-ui p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Reports")} · {branchHeaderLabel}</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{t("PayablesReceivables")}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {role === "admin" && (
              <div className="w-56">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-11 glass border-2 font-medium">
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
            <Button onClick={() => window.print()} variant="outline" className="h-11 gap-2 border-2 hover:bg-primary/5 shadow-sm">
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass p-5 border-l-4 border-l-destructive shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalReceivable")} · {receivables.length} accounts</div>
                <div className="flex items-baseline gap-4 mt-1">
                  <div>
                    <span className="text-2xl font-display font-black text-destructive num">{formatMoney(totalReceivablePKR, "PKR")}</span>
                  </div>
                  {totalReceivableAED > 0 && (
                    <div>
                      <span className="text-xl font-display font-bold text-destructive/80 num">{formatMoney(totalReceivableAED, "AED")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
          <Card className="glass p-5 border-l-4 border-l-success shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalPayable")} · {payables.length} accounts</div>
                <div className="flex items-baseline gap-4 mt-1">
                  <div>
                    <span className="text-2xl font-display font-black text-success num">{formatMoney(totalPayablePKR, "PKR")}</span>
                  </div>
                  {totalPayableAED > 0 && (
                    <div>
                      <span className="text-xl font-display font-bold text-success/80 num">{formatMoney(totalPayableAED, "AED")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="glass p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search by name, account no, mobile, address..."
              className="pl-10 h-11 bg-background/50 border-none shadow-inner" />
          </div>
        </Card>

        <Tabs defaultValue="receivables" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-11 glass p-1">
            <TabsTrigger value="receivables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5 text-destructive" />
              {t("Receivables")} ({filteredReceivables.length})
            </TabsTrigger>
            <TabsTrigger value="payables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1.5 text-success" />
              {t("Payables")} ({filteredPayables.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="receivables" className="mt-4">
            <ScreenTable list={filteredReceivables} type="receivable" />
          </TabsContent>
          <TabsContent value="payables" className="mt-4">
            <ScreenTable list={filteredPayables} type="payable" />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

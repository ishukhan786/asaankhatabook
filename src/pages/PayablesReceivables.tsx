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
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

interface AccountBalance {
  id: string;
  name: string;
  account_no: string;
  currency: string;
  branch_name: string;
  mobile: string | null;
  address: string | null;
  balance: number;
}

const PRINT_STYLES = `
@media print {
  /* Hide everything except the print wrapper */
  body > * { display: none !important; }
  #print-wrapper { display: block !important; }

  #print-wrapper {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: white;
    z-index: 99999;
  }

  @page {
    margin: 1.2cm 1.5cm;
    size: A4;
  }

  /* Force color printing */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
}
`;

export default function PayablesReceivables() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<AccountBalance[]>([]);
  const [payables, setPayables] = useState<AccountBalance[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState("receivables");

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: accounts }, { data: transactions }] = await Promise.all([
        supabase.from("accounts").select("id, name, account_no, currency, mobile, address, branches(name)"),
        supabase.from("transactions").select("account_id, debit, credit")
      ]);

      const balances: Record<string, number> = {};
      (transactions ?? []).forEach(t => {
        const net = Number(t.credit) - Number(t.debit);
        balances[t.account_id] = (balances[t.account_id] || 0) + net;
      });

      const processed: AccountBalance[] = (accounts ?? []).map(a => ({
        id: a.id,
        name: a.name,
        account_no: a.account_no,
        currency: a.currency,
        mobile: a.mobile ?? null,
        address: a.address ?? null,
        branch_name: (a.branches as any)?.name ?? "—",
        balance: balances[a.id] || 0
      }));

      setReceivables(processed.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance));
      setPayables(processed.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance));
    } catch (err) {
      console.error("Error loading payables/receivables:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filterList = (list: AccountBalance[]) => {
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter(item =>
      item.name.toLowerCase().includes(s) ||
      item.account_no.toLowerCase().includes(s) ||
      (item.mobile ?? "").includes(s) ||
      (item.address ?? "").toLowerCase().includes(s)
    );
  };

  const sendWhatsApp = (e: React.MouseEvent, a: AccountBalance) => {
    e.stopPropagation();
    if (!a.mobile) return;
    const type = a.balance < 0 ? "Denedari (Receivable)" : "Lenedari (Payable)";
    const message = `*Assalam-o-Alaikum ${a.name}!*\n\n*Aasaan Khatabook Balance Update*\n---------------------------\n*Account:* ${a.name}\n*Account No:* ${a.account_no}\n*Type:* ${type}\n*Balance:* ${formatMoney(Math.abs(a.balance), a.currency)}\n---------------------------\nShukriya!`;
    const phone = a.mobile.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handlePrint = () => window.print();

  const filteredReceivables = filterList(receivables);
  const filteredPayables = filterList(payables);
  const totalReceivable = receivables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);
  const totalPayable = payables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);

  const printDate = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });
  const printTime = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const bizName = profile?.business_name || "Aasaan Khatabook";
  const bizPhone = profile?.business_phone || "";
  const bizAddress = profile?.business_address || "";

  // ── Screen table ─────────────────────────────────────────────────────────────
  const ScreenTable = ({ list, type }: { list: AccountBalance[]; type: "receivable" | "payable" }) => {
    const isR = type === "receivable";
    const total = list.reduce((acc, a) => acc + Math.abs(a.balance), 0);
    return (
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/50">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Account No</th>
              <th className="text-left px-4 py-3">Account Name</th>
              <th className="text-left px-4 py-3">Branch</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Address</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No {isR ? "receivables" : "payables"} found.</td></tr>
            ) : list.map((a, i) => (
              <tr key={a.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => navigate(`/accounts/${a.id}`)}>
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3"><span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">{a.account_no}</span></td>
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
                <td className={`px-4 py-3 text-right font-display font-black text-base num ${isR ? "text-destructive" : "text-success"}`}>{formatMoney(total, "PKR")}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  };

  // ── Print Document ────────────────────────────────────────────────────────────
  const PrintDocument = ({ list, type }: { list: AccountBalance[]; type: "receivable" | "payable" }) => {
    const isR = type === "receivable";
    const accentColor = isR ? "#dc2626" : "#16a34a";
    const accentLight = isR ? "#fef2f2" : "#f0fdf4";
    const accentMid = isR ? "#fecaca" : "#bbf7d0";
    const total = list.reduce((acc, a) => acc + Math.abs(a.balance), 0);
    const label = isR ? "Receivables (Denedari)" : "Payables (Lenedari)";

    return (
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a", background: "#fff", minHeight: "100vh", padding: "0" }}>

        {/* ── Header Band ── */}
        <div style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)`, padding: "28px 36px 24px", marginBottom: "0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "6px" }}>Business Report</div>
              <div style={{ color: "#ffffff", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", lineHeight: 1.2 }}>{bizName}</div>
              {bizPhone && <div style={{ color: "#cbd5e1", fontSize: "12px", marginTop: "4px" }}>📞 {bizPhone}</div>}
              {bizAddress && <div style={{ color: "#cbd5e1", fontSize: "12px", marginTop: "2px" }}>📍 {bizAddress}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ background: accentColor, color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 14px", borderRadius: "20px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px", display: "inline-block" }}>
                {isR ? "DR" : "CR"} · {label}
              </div>
              <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "6px" }}>Date: {printDate}</div>
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>Time: {printTime}</div>
            </div>
          </div>
        </div>

        {/* ── Color Accent Bar ── */}
        <div style={{ height: "5px", background: `linear-gradient(90deg, ${accentColor}, ${accentMid}, #e2e8f0)` }} />

        {/* ── Summary Strip ── */}
        <div style={{ display: "flex", gap: "16px", padding: "20px 36px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ flex: 1, background: accentLight, border: `1.5px solid ${accentMid}`, borderRadius: "10px", padding: "14px 18px" }}>
            <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "700" }}>Total {label}</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: accentColor, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>{formatMoney(total, "PKR")}</div>
          </div>
          <div style={{ flex: 1, background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px" }}>
            <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "700" }}>Total Accounts</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#1e3a5f", marginTop: "4px" }}>{list.length}</div>
          </div>
          <div style={{ flex: 1, background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px" }}>
            <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "700" }}>Report Type</div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e3a5f", marginTop: "6px" }}>{isR ? "Denedari" : "Lenedari"}</div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>Aasaan Khatabook</div>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ padding: "20px 36px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                {["#", "Account No", "Account Name", "Branch", "Mobile No", "Address", "Balance"].map((h, i) => (
                  <th key={h} style={{
                    color: "#e2e8f0", fontWeight: "700", fontSize: "9px", textTransform: "uppercase",
                    letterSpacing: "1.5px", padding: "10px 12px",
                    textAlign: i === 6 ? "right" : "left",
                    borderBottom: `3px solid ${accentColor}`
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "9px 12px", color: "#94a3b8", fontSize: "10px", fontWeight: "600" }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "10px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#475569", fontWeight: "600" }}>
                      {a.account_no}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", fontWeight: "700", color: "#0f172a", fontSize: "12px" }}>{a.name}</td>
                  <td style={{ padding: "9px 12px", color: "#475569", fontSize: "10px" }}>{a.branch_name}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: "10px", color: "#374151" }}>{a.mobile || "—"}</td>
                  <td style={{ padding: "9px 12px", color: "#475569", fontSize: "10px", maxWidth: "160px" }}>{a.address || "—"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>
                    <div style={{ fontWeight: "800", fontSize: "12px", color: accentColor, fontVariantNumeric: "tabular-nums" }}>{formatMoney(Math.abs(a.balance), a.currency)}</div>
                    <div style={{ fontSize: "8px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>{a.currency}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: accentLight, borderTop: `2.5px solid ${accentColor}` }}>
                <td colSpan={6} style={{ padding: "12px", textAlign: "right", fontWeight: "800", fontSize: "11px", color: "#374151", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Grand Total — {list.length} Account{list.length !== 1 ? "s" : ""}
                </td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "900", fontSize: "16px", color: accentColor, fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(total, "PKR")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{ margin: "0 36px", borderTop: "1.5px solid #e2e8f0", padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "9px", color: "#94a3b8" }}>
            Generated by <strong style={{ color: "#1e3a5f" }}>Aasaan Khatabook</strong> · {printDate} {printTime}
          </div>
          <div style={{ fontSize: "9px", color: "#94a3b8" }}>
            {list.length} records · {isR ? "Denedari / Receivables" : "Lenedari / Payables"} Report · CONFIDENTIAL
          </div>
        </div>

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
  const currentType = activeTab === "receivables" ? "receivable" : "payable";

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* ── Hidden Print Wrapper ── */}
      <div id="print-wrapper" style={{ display: "none" }}>
        <PrintDocument list={currentList} type={currentType} />
      </div>

      {/* ── Screen UI ── */}
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Reports")}</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{t("PayablesReceivables")}</h1>
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2 border-2 hover:bg-primary/5">
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass p-5 border-l-4 border-l-destructive shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalReceivable")} · {receivables.length} accounts</div>
                <div className="text-2xl font-display font-black text-destructive num">{formatMoney(totalReceivable, "PKR")}</div>
              </div>
            </div>
          </Card>
          <Card className="glass p-5 border-l-4 border-l-success shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalPayable")} · {payables.length} accounts</div>
                <div className="text-2xl font-display font-black text-success num">{formatMoney(totalPayable, "PKR")}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, account no, mobile, address..."
              className="pl-10 h-11 bg-background/50 border-none shadow-inner"
            />
          </div>
        </Card>

        {/* Tabs */}
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

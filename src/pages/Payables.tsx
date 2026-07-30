import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpRight, Phone, MapPin, Building2, MessageSquare, Printer, ExternalLink, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { PageHeader } from "@/components/PageHeader";
import { exportToCSV } from "@/lib/export";

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
  body {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  .screen-ui, header, aside, nav, footer, button, .print\\:hidden { 
    display: none !important; 
  }
  #print-payables-wrapper {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  @page {
    size: A4 portrait;
    margin: 10mm 12mm 10mm 12mm;
  }
}
`;

export default function Payables() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: accs }, { data: txns }, { data: brs }] = await Promise.all([
        supabase.from("accounts").select("id, name, account_no, currency, mobile, address, branch_id, branches(id, name)"),
        supabase.from("transactions").select("account_id, debit, credit"),
        supabase.from("branches").select("id, name").order("name")
      ]);
      if (brs) setBranches(brs);

      const balances: Record<string, number> = {};
      (txns ?? []).forEach(t => {
        balances[t.account_id] = (balances[t.account_id] || 0) + (Number(t.credit) - Number(t.debit));
      });

      const processed: AccountBalance[] = (accs ?? [])
        .map(a => ({
          id: a.id,
          name: a.name,
          account_no: a.account_no,
          currency: a.currency,
          mobile: a.mobile ?? null,
          address: a.address ?? null,
          branch_id: a.branch_id,
          branch_name: (a.branches as { name?: string | null } | null)?.name ?? "N/A",
          balance: balances[a.id] || 0
        }))
        .filter(a => a.balance > 0) // Payables
        .sort((a, b) => b.balance - a.balance);

      setAccounts(processed);
    } catch (err) {
      logger.error("Payables load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    let list = accounts;
    if (role === "admin" && selectedBranch !== "all") {
      list = list.filter(a => a.branch_id === selectedBranch);
    } else if (role !== "admin" && profile?.branch_id) {
      list = list.filter(a => a.branch_id === profile.branch_id);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.account_no.toLowerCase().includes(q) || 
        (a.mobile && a.mobile.includes(q))
      );
    }
    return list;
  }, [accounts, selectedBranch, search, role, profile]);

  const totals = useMemo(() => aggregateByCurrency(filtered), [filtered]);

  const sendWhatsApp = (e: React.MouseEvent, a: AccountBalance) => {
    e.stopPropagation();
    if (!a.mobile) return;
    const msg = `*Assalam-o-Alaikum ${a.name}!*\n\n*Aasaan Khatabook Payable Balance*\n---------------------------\n*Account:* ${a.name}\n*Account No:* ${a.account_no}\n*Payable Amount:* ${formatMoney(Math.abs(a.balance), a.currency)}\n---------------------------\nShukriya!`;
    window.open(`https://wa.me/${a.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleExportCSV = () => {
    const data = filtered.map(a => ({
      "Account No": a.account_no,
      "Name": a.name,
      "Mobile": a.mobile || "",
      "Branch": a.branch_name,
      "Currency": a.currency,
      "Payable Amount": Math.abs(a.balance),
    }));
    exportToCSV(data, `Payables_Report_${new Date().toISOString().slice(0, 10)}`);
  };

  const now = new Date();
  const printDate = now.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const printTime = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const selectedBranchName = selectedBranch === "all" ? "All Branches" : branches.find(b => b.id === selectedBranch)?.name || "Main";

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Dedicated High-End Print Document */}
      <div id="print-payables-wrapper" style={{ display: "none" }}>
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#ffffff", color: "#0f172a", fontSize: "11px", padding: "10px" }}>
          
          {/* Business & Document Header */}
          <div style={{ paddingBottom: "12px", borderBottom: "2px solid #0f172a", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
                {profile?.business_name || "AsaanKhata"}
              </div>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#059669", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                PAYABLES STATEMENT REPORT · (خلاصہ قابلِ ادائیگی - دینا ہے)
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
                {profile?.business_phone && <span>Phone: {profile.business_phone} · </span>}
                {profile?.business_address && <span>Address: {profile.business_address} · </span>}
                <span>Branch: {selectedBranchName}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "10px", color: "#475569" }}>
              <div>Date: <strong style={{ color: "#0f172a" }}>{printDate}</strong></div>
              <div>Time: <strong style={{ color: "#0f172a" }}>{printTime}</strong></div>
              <div>Total Accounts: <strong style={{ color: "#059669" }}>{filtered.length}</strong></div>
            </div>
          </div>

          {/* Multi-Currency Grand Totals Summary Box - Zero Background Color */}
          <div style={{ margin: "14px 0", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 16px", background: "transparent" }}>
            <div style={{ fontSize: "9.5px", fontWeight: "800", textTransform: "uppercase", color: "#059669", letterSpacing: "0.5px", marginBottom: "8px" }}>
              OUTSTANDING PAYABLES SUMMARY
            </div>
            <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
              {totals.map(([cur, amount]) => (
                <div key={cur} style={{ borderLeft: "3px solid #059669", paddingLeft: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                    {cur} TOTAL
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#059669", fontFamily: "monospace", marginTop: "2px" }}>
                    {formatMoney(amount, cur)}
                  </div>
                </div>
              ))}
              {totals.length === 0 && (
                <div style={{ borderLeft: "3px solid #059669", paddingLeft: "10px" }}>
                  <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b" }}>TOTAL</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#059669", fontFamily: "monospace", marginTop: "2px" }}>0.00</div>
                </div>
              )}
            </div>
          </div>

          {/* Clean Data Table - Transparent Background */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", background: "transparent", color: "#0f172a", fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <th style={{ padding: "7px 8px", textAlign: "left", width: "30px", color: "#475569" }}>#</th>
                <th style={{ padding: "7px 8px", textAlign: "left", width: "95px", color: "#0369a1" }}>Account No</th>
                <th style={{ padding: "7px 8px", textAlign: "left", color: "#0f172a" }}>Party / Vendor Name</th>
                <th style={{ padding: "7px 8px", textAlign: "left", color: "#475569" }}>Contact</th>
                <th style={{ padding: "7px 8px", textAlign: "left", color: "#475569" }}>Branch</th>
                <th style={{ padding: "7px 8px", textAlign: "right", color: "#059669" }}>Payable Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                    No payable records found.
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "7px 8px", color: "#94a3b8", fontWeight: "600" }}>{i + 1}</td>
                    <td style={{ padding: "7px 8px", fontFamily: "monospace", fontWeight: "700", color: "#0369a1" }}>{a.account_no}</td>
                    <td style={{ padding: "7px 8px", fontWeight: "700", color: "#0f172a" }}>{a.name}</td>
                    <td style={{ padding: "7px 8px", color: "#475569" }}>{a.mobile || "-"}</td>
                    <td style={{ padding: "7px 8px", color: "#475569" }}>{a.branch_name}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "900", color: "#059669", fontFamily: "monospace", fontSize: "11px" }}>
                      {formatMoney(Math.abs(a.balance), a.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Signatures & Stamp Footer */}
          <div style={{ marginTop: "40px", paddingTop: "15px", borderTop: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ width: "180px", textAlign: "center" }}>
              <div style={{ borderBottom: "1px solid #0f172a", height: "25px", marginBottom: "4px" }} />
              <div style={{ fontSize: "9px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Prepared By</div>
            </div>
            <div style={{ width: "180px", textAlign: "center" }}>
              <div style={{ borderBottom: "1px solid #0f172a", height: "25px", marginBottom: "4px" }} />
              <div style={{ fontSize: "9px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Authorized Signature &amp; Stamp</div>
            </div>
          </div>

          {/* Page Footer */}
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", fontSize: "8.5px", color: "#94a3b8" }}>
            <div>AsaanKhata System · Official Payable Statement</div>
            <div>Printed: {printDate} {printTime}</div>
          </div>
        </div>
      </div>

      {/* Screen Web UI */}
      <div className="screen-ui p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          eyebrow={t("Reports")}
          title={<span className="flex items-center gap-3"><span className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600"><ArrowUpRight className="w-7 h-7" /></span>{t("Payables")}</span>}
          description="Vendors and suppliers to whom you owe payments."
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
                      <SelectItem value="all" className="font-bold">🌍 {t("AllBranches")}</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>📍 {b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleExportCSV} variant="outline" className="h-11 px-4 gap-2 border-2 rounded-xl font-semibold">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="h-11 px-4 gap-2 border-2 rounded-xl font-semibold hover:bg-emerald-600 hover:text-white">
                <Printer className="w-4 h-4" /> Print Statement
              </Button>
            </div>
          }
        />

        {/* Summary KPI Card */}
        <Card className="relative overflow-hidden border-2 border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-card p-6 rounded-2xl shadow-md">
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                <ArrowUpRight className="w-8 h-8" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-2">
                  <span>{t("TotalPayable")}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px]">{filtered.length} {t("TotalAccounts")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {totals.map(([cur, amount]) => (
                    <div key={cur} className="flex items-center gap-2 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 px-3.5 py-1.5 rounded-xl shadow-xs">
                      <span className="text-xs font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                        {cur === "PKR" ? "🇵🇰 PKR" : cur === "AED" ? "🇦🇪 AED" : cur === "USD" ? "🇺🇸 USD" : cur}
                      </span>
                      <span className="font-black text-lg num text-emerald-700 dark:text-emerald-300">
                        {formatMoney(amount, cur)}
                      </span>
                    </div>
                  ))}
                  {totals.length === 0 && <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 num">0</span>}
                </div>
              </div>
            </div>

            <div className="relative max-w-md w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder={t("SearchPlaceholder")} 
                className="pl-9 h-11 bg-background/60 border-emerald-200 dark:border-emerald-900/40 rounded-xl"
              />
            </div>
          </div>
        </Card>

        {/* Payables Table */}
        <Card className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 border-b-2 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 text-left w-12">#</th>
                  <th className="px-4 py-3.5 text-left">{t("Account")}</th>
                  <th className="px-4 py-3.5 text-left">{t("Mobile")} &amp; {t("Branch")}</th>
                  <th className="px-4 py-3.5 text-left hidden md:table-cell">{t("Address")}</th>
                  <th className="px-4 py-3.5 text-right">{t("Payables")}</th>
                  <th className="px-4 py-3.5 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      No payables found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a, i) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => navigate(`/accounts/${a.id}`)}>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-semibold">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{a.name}</div>
                            <div className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground inline-block mt-0.5 border">{a.account_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {a.mobile ? (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground"><Phone className="w-3 h-3" />{a.mobile}</div>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs italic">No Phone</span>
                          )}
                          {a.branch_name && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="w-3 h-3" />{a.branch_name}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {a.address ? (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground max-w-[200px]"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="truncate" title={a.address}>{a.address}</span></div>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs italic">No Address</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-black text-base num text-emerald-600 dark:text-emerald-400 tracking-tight">
                          {formatMoney(Math.abs(a.balance), a.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {a.mobile && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50" onClick={e => sendWhatsApp(e, a)} title="Send WhatsApp">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => navigate(`/accounts/${a.id}`)} title="View Ledger">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowDownLeft, ArrowUpRight, Phone, MapPin, Building2, MessageSquare, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

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

export default function PayablesReceivables() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const AccountTable = ({ list, type }: { list: AccountBalance[]; type: "receivable" | "payable" }) => {
    const isReceivable = type === "receivable";
    const total = list.reduce((acc, a) => acc + Math.abs(a.balance), 0);

    return (
      <div className="print-section">
        {/* Print Header - only visible when printing */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h2 className="text-2xl font-bold">Aasaan Khatabook</h2>
          <p className="text-lg mt-1">{isReceivable ? "Receivables (Denedari)" : "Payables (Lenedari)"} Report</p>
          <p className="text-sm text-gray-500 mt-1">Printed on: {new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm print:text-xs">
            <thead>
              <tr className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/50 print:bg-gray-100 print:text-gray-700">
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Account No</th>
                <th className="text-left px-4 py-3">Account Name</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Mobile</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="px-4 py-3 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No {isReceivable ? "receivables" : "payables"} found.
                  </td>
                </tr>
              ) : (
                list.map((a, i) => (
                  <tr
                    key={a.id}
                    className="border-t border-border/40 hover:bg-muted/30 transition-colors cursor-pointer print:hover:bg-transparent print:border-gray-200"
                    onClick={() => navigate(`/accounts/${a.id}`)}
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>

                    {/* Account No */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded print:bg-transparent print:p-0">
                        {a.account_no}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold">{a.name}</div>
                    </td>

                    {/* Branch */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Building2 className="w-3 h-3 print:hidden" />
                        {a.branch_name}
                      </div>
                    </td>

                    {/* Mobile */}
                    <td className="px-4 py-3">
                      {a.mobile ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <Phone className="w-3 h-3 text-muted-foreground print:hidden" />
                          {a.mobile}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {a.address ? (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0 print:hidden" />
                          <span className="line-clamp-2">{a.address}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-3 text-right">
                      <div className={`font-bold font-mono text-sm num ${isReceivable ? "text-destructive" : "text-success"}`}>
                        {formatMoney(Math.abs(a.balance), a.currency)}
                      </div>
                      <div className="text-[9px] text-muted-foreground uppercase">{a.currency}</div>
                    </td>

                    {/* Actions - hidden on print */}
                    <td className="px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {a.mobile && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:bg-green-500/10"
                            onClick={(e) => sendWhatsApp(e, a)} title="WhatsApp">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => navigate(`/accounts/${a.id}`)} title="View">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Total Row */}
            {list.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 font-bold text-sm ${isReceivable ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"} print:border-gray-400 print:bg-gray-50`}>
                  <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-xs">
                    Total ({list.length} accounts)
                  </td>
                  <td className={`px-4 py-3 text-right font-display font-black text-base num ${isReceivable ? "text-destructive" : "text-success"}`}>
                    {formatMoney(total, "PKR")}
                  </td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            )}
          </table>
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

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div className="printable-area p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Reports")}</div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{t("PayablesReceivables")}</h1>
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2 border-2">
            <Printer className="w-4 h-4" />
            Print / PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
          <Card className="glass p-5 border-l-4 border-l-destructive shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalReceivable")} ({receivables.length} accounts)</div>
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
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalPayable")} ({payables.length} accounts)</div>
                <div className="text-2xl font-display font-black text-success num">{formatMoney(totalPayable, "PKR")}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass p-4 print:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, account no, mobile, address..."
              className="pl-10 h-11 bg-background/50 border-none shadow-inner"
            />
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="receivables" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-11 glass p-1 print:hidden">
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
            <AccountTable list={filteredReceivables} type="receivable" />
          </TabsContent>

          <TabsContent value="payables" className="mt-4">
            <AccountTable list={filteredPayables} type="payable" />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

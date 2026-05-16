import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowDownLeft, ArrowUpRight, Users, Phone, MapPin, Building2, MessageSquare, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
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
    const encoded = encodeURIComponent(message);
    const phone = a.mobile.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const filteredReceivables = filterList(receivables);
  const filteredPayables = filterList(payables);
  const totalReceivable = receivables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);
  const totalPayable = payables.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      </div>
    );
  }

  const AccountCard = ({ a, type }: { a: AccountBalance; type: "receivable" | "payable" }) => {
    const isReceivable = type === "receivable";
    const color = isReceivable ? "destructive" : "success";
    const colorClass = isReceivable ? "text-destructive" : "text-success";
    const bgClass = isReceivable ? "bg-destructive/10" : "bg-success/10";
    const borderClass = isReceivable ? "border-destructive/20" : "border-success/20";
    const glowClass = isReceivable ? "bg-destructive/5 group-hover:bg-destructive/10" : "bg-success/5 group-hover:bg-success/10";

    return (
      <motion.div
        key={a.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="cursor-pointer"
        onClick={() => navigate(`/accounts/${a.id}`)}
      >
        <Card className="glass p-5 hover:shadow-lift hover:scale-[1.01] transition-all group relative overflow-hidden h-full">
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full ${glowClass} -mr-12 -mt-12 blur-2xl transition-colors`} />

          {/* Header: Icon + Badge */}
          <div className="flex justify-between items-start mb-4 relative">
            <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
              <Users className={`w-5 h-5 ${colorClass}`} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${bgClass} ${colorClass} ${borderClass} font-mono text-[10px]`}>
                {isReceivable ? "DR" : "CR"}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {a.currency}
              </Badge>
            </div>
          </div>

          {/* Account Name + No */}
          <div className="relative space-y-0.5 mb-4">
            <div className="font-bold text-base leading-tight">{a.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{a.account_no}</div>
          </div>

          {/* Details */}
          <div className="relative space-y-2 mb-4">
            {/* Branch */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{a.branch_name}</span>
            </div>

            {/* Mobile */}
            {a.mobile ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono">{a.mobile}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>No mobile</span>
              </div>
            )}

            {/* Address */}
            {a.address ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{a.address}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>No address</span>
              </div>
            )}
          </div>

          {/* Balance + Actions */}
          <div className="relative flex items-end justify-between pt-3 border-t border-border/40">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">
                {isReceivable ? t("Denedari") : t("Lenedari")}
              </div>
              <div className={`text-xl font-display font-black num ${colorClass}`}>
                {formatMoney(Math.abs(a.balance), a.currency)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {a.mobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-500 hover:bg-green-500/10"
                  onClick={(e) => sendWhatsApp(e, a)}
                  title="Send WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${a.id}`); }}
                title="View Account"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Reports")}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{t("PayablesReceivables")}</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass p-5 border-l-4 border-l-destructive shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalReceivable")}</div>
              <div className="text-2xl font-display font-black text-destructive num">
                {formatMoney(totalReceivable, "PKR")}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t("Denedari")} — {receivables.length} accounts</div>
        </Card>

        <Card className="glass p-5 border-l-4 border-l-success shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("TotalPayable")}</div>
              <div className="text-2xl font-display font-black text-success num">
                {formatMoney(totalPayable, "PKR")}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t("Lenedari")} — {payables.length} accounts</div>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, account no, mobile, address..."
            className="pl-10 h-12 bg-background/50 border-none shadow-inner"
          />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="receivables" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-12 glass p-1">
          <TabsTrigger value="receivables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("Receivables")} ({filteredReceivables.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t("Payables")} ({filteredPayables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReceivables.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass rounded-2xl">
                No receivables found.
              </div>
            ) : (
              filteredReceivables.map((a) => (
                <AccountCard key={a.id} a={a} type="receivable" />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="payables" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPayables.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground glass rounded-2xl">
                No payables found.
              </div>
            ) : (
              filteredPayables.map((a) => (
                <AccountCard key={a.id} a={a} type="payable" />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

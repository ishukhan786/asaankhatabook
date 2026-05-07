import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { z } from "zod";

const schema = z.object({
  account_id: z.string().uuid("Select an account"),
  txn_date: z.string().min(1),
  details: z.string().trim().min(2).max(300),
  debit: z.number().min(0),
  credit: z.number().min(0),
}).refine((d) => d.debit > 0 || d.credit > 0, { message: "Enter debit or credit amount" });

export default function NewTransaction() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account_id: params.get("account") ?? "",
    txn_date: new Date().toISOString().slice(0, 10),
    details: "",
    debit: "",
    credit: "",
  });

  useEffect(() => {
    supabase.from("accounts").select("id, account_no, name, currency, mobile").order("name").then(({ data }) => setAccounts(data ?? []));
  }, []);

  const sendWhatsApp = (t: any, acc: any) => {
    if (!acc.mobile) return;
    const amount = Number(form.credit) > 0 ? form.credit : form.debit;
    const type = Number(form.credit) > 0 ? "Jama (Credit)" : "Nikala (Debit)";
    const message = `*Assalam-o-Alaikum!*\n\n*Aasaan Khatabook Entry Update*\n---------------------------\n*Account:* ${acc.name}\n*Date:* ${formatDate(t.txn_date)}\n*Amount:* ${formatMoney(Number(amount), acc.currency)}\n*Type:* ${type}\n*Details:* ${t.details}\n---------------------------\n\nShukriya!`;
    const encoded = encodeURIComponent(message);
    const phone = acc.mobile.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const debit = Number(form.debit || 0);
    const credit = Number(form.credit || 0);
    const parsed = schema.safeParse({ ...form, debit, credit });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("transactions").insert([{
      txn_code: "",
      account_id: form.account_id,
      txn_date: form.txn_date,
      details: form.details.trim(),
      debit, credit,
      created_by: user?.id,
    }]).select("id, txn_code, account_id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data?.txn_code} recorded`);
    
    const acc = accounts.find(a => a.id === form.account_id);
    if ((e.nativeEvent as any).submitter?.name === "whatsapp" && acc?.mobile) {
      sendWhatsApp({ txn_date: form.txn_date, details: form.details.trim() }, acc);
    }
    
    nav(`/accounts/${data?.account_id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/transactions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Record</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">New Transaction</h1>
      </div>

      <Card className="glass p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Account *</Label>
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger><SelectValue placeholder={accounts.length ? "Select account" : "No accounts yet"} /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_no} — {a.name} ({a.currency})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Details *</Label>
            <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3} placeholder="Description / narration" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Debit (Nikashat / Raqam Di)</Label>
              <Input type="number" step="0.01" min="0" value={form.debit} onChange={(e) => setForm({ ...form, debit: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Credit (Jama / Raqam Li)</Label>
              <Input type="number" step="0.01" min="0" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} placeholder="0.00" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground shadow-soft">
              {busy ? "Saving..." : "Record transaction"}
            </Button>
            <Button 
              type="submit" 
              name="whatsapp" 
              variant="outline" 
              disabled={busy || !accounts.find(a => a.id === form.account_id)?.mobile} 
              className="border-success text-success hover:bg-success/5"
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Record & WhatsApp
            </Button>
            <Link to="/transactions"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

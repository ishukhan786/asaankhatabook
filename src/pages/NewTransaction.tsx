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
import { ArrowLeft, MessageSquare, Loader } from "lucide-react";
import { formatMoney, balanceLabel, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { z } from "zod";

const schema = z.object({
  account_id: z.string().uuid("Select an account"),
  transaction_type: z.enum(["general", "payment", "receipt", "transfer", "expense", "journal"]),
  txn_date: z.string().min(1),
  details: z.string().trim().min(2).max(300),
  debit: z.number().min(0),
  credit: z.number().min(0),
}).refine((d) => d.debit > 0 || d.credit > 0, { message: "Enter debit or credit amount" })
  .refine((d) => !(d.debit > 0 && d.credit > 0), { message: "Enter either debit or credit, not both" });

const transactionTypeOptions = [
  { value: "general", label: "General", prefix: "TXN" },
  { value: "payment", label: "Payment", prefix: "PAY" },
  { value: "receipt", label: "Receipt", prefix: "RCP" },
  { value: "transfer", label: "Transfer", prefix: "TRF" },
  { value: "expense", label: "Expense", prefix: "EXP" },
  { value: "journal", label: "Journal", prefix: "JRN" },
] as const;

export default function NewTransaction() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  type AccountShort = { id: string; account_no?: string | null; name?: string | null; currency?: string | null; mobile?: string | null };
  const [accounts, setAccounts] = useState<AccountShort[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_id: params.get("account") ?? "",
    transaction_type: "general" as "general" | "payment" | "receipt" | "transfer" | "expense" | "journal",
    txn_date: new Date().toISOString().slice(0, 10),
    details: "",
    debit: "",
    credit: "",
  });
  const selectedTransactionType = transactionTypeOptions.find((option) => option.value === form.transaction_type);
  const txnCodePreview = `${selectedTransactionType?.prefix ?? "TXN"}-${form.txn_date.replaceAll("-", "") || "YYYYMMDD"}-000001`;

  useEffect(() => {
    supabase.from("accounts").select("id, account_no, name, currency, mobile").order("name").then(({ data }) => setAccounts(data ?? []));
  }, []);

  const sendWhatsApp = (t: { txn_date: string; details?: string }, acc: AccountShort) => {
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
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setFormError(null);
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("transactions").insert([{
      txn_code: "",
      transaction_type: form.transaction_type,
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
    if ((e.nativeEvent as unknown as { submitter?: HTMLButtonElement })?.submitter?.name === "whatsapp" && acc?.mobile) {
      sendWhatsApp({ txn_date: form.txn_date, details: form.details.trim() }, acc);
    }
    
    nav(`/accounts/${data?.account_id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/transactions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      <PageHeader
        eyebrow="Record"
        title="New Transaction"
        description="Transaction code is generated automatically and stays locked after save."
      />

      <Card className="glass p-6">
        <form onSubmit={submit} className="space-y-5">
          {formError && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
              {formError}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Transaction Type *</Label>
              <Select value={form.transaction_type} onValueChange={(v: 'general'|'payment'|'receipt'|'transfer'|'expense'|'journal') => setForm({ ...form, transaction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {transactionTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Transaction Code</Label>
              <Input value={txnCodePreview} readOnly disabled className="bg-muted/50 font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Account *</Label>
            <Select value={form.account_id} onValueChange={(v: string) => setForm({ ...form, account_id: v })}>
              <SelectTrigger><SelectValue placeholder={accounts.length ? "Select account" : "No accounts yet"} /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_no} - {a.name} ({a.currency})</SelectItem>)}
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
              {busy ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Record transaction"
              )}
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

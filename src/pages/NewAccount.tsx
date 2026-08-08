import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Loader } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  currency: z.enum(["PKR", "AED", "USD"]),
  account_type: z.enum(["customer", "supplier", "employee", "bank", "cash", "party"]),
  branch_id: z.string().uuid("Select a branch").optional().or(z.literal("")),
});

const currentYear = new Date().getFullYear();

const accountTypeOptions = [
  { value: "customer", label: "Customer", preview: `${currentYear}-001` },
  { value: "supplier", label: "Supplier", preview: `${currentYear}-002` },
  { value: "employee", label: "Employee", preview: `${currentYear}-003` },
  { value: "bank", label: "Bank", preview: `${currentYear}-004` },
  { value: "cash", label: "Cash", preview: `${currentYear}-005` },
  { value: "party", label: "Party", preview: `${currentYear}-006` },
] as const;

const accountTypePrefix = {
  customer: "CUS",
  supplier: "SUP",
  employee: "EMP",
  bank: "BNK",
  cash: "CAS",
  party: "PRT",
} as const;

type BranchShort = { id: string; name: string };

export default function NewAccount() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { role, profile } = useAuth();
  const [branches, setBranches] = useState<BranchShort[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    mobile: "", 
    address: "", 
    account_type: "customer" as "customer" | "supplier" | "employee" | "bank" | "cash" | "party",
    currency: "PKR" as "PKR" | "AED" | "USD", 
    branch_id: profile?.branch_id || "" 
  });
  const selectedAccountType = accountTypeOptions.find((option) => option.value === form.account_type);

  useEffect(() => {
    if (profile?.branch_id) {
      setForm(f => ({ ...f, branch_id: profile.branch_id! }));
    }
  }, [profile?.branch_id]);

  useEffect(() => {
    supabase.from("branches").select("id, name").order("name").then(({ data }) => {
      setBranches(data ?? []);
    });
  }, []);

  const nextAccountNo = useCallback(async (_accountType?: string, offset = 1) => {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("accounts")
      .select("account_no")
      .like("account_no", `${year}-%`)
      .order("account_no", { ascending: false })
      .limit(1);

    const lastNumber = Number(String(data?.[0]?.account_no ?? "").match(new RegExp(`^${year}-(\\d+)$`))?.[1] ?? "0");
    return `${year}-${String(lastNumber + offset).padStart(3, "0")}`;
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setFormError(null);
    
    // Logic: Use selected branch, or fallback to user's branch
    const finalBranchId = form.branch_id || profile?.branch_id;
    
    if (!finalBranchId) {
      setFormError("Please select a branch or assign your user to a branch first.");
      return;
    }

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const generatedAccountNo = await nextAccountNo(form.account_type);

    const accountPayload = {
      account_no: generatedAccountNo,
      name: form.name.trim(),
      mobile: form.mobile?.trim() || null,
      address: form.address?.trim() || null,
      currency: form.currency,
      branch_id: finalBranchId,
      created_by: user?.id,
    };

    let { data, error } = await supabase.from("accounts").insert([{
      ...accountPayload,
      account_type: form.account_type,
    }]).select("id, account_no").single();

    if (error) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const fallbackAccountNo = await nextAccountNo(form.account_type, attempt + 1);
        const fallback = await supabase
          .from("accounts")
          .insert([{ ...accountPayload, account_no: fallbackAccountNo }])
          .select("id, account_no")
          .single();

        data = fallback.data;
        error = fallback.error;
        if (!error || error.code !== "23505") break;
      }
    }
    
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${data?.account_no} created`);
    nav(`/accounts/${data?.id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("Cancel")}</Link>
      <PageHeader
        eyebrow={t("Accounts")}
        title={t("NewAccount")}
        description="A unique readonly account code will be generated automatically when you save."
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
              <Label>{t("Account")} Type *</Label>
              <Select value={form.account_type} onValueChange={(v: string) => setForm({ ...form, account_type: v as typeof form.account_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("AccountNo")}</Label>
              <Input value={selectedAccountType?.preview ?? "Auto generated"} readOnly disabled className="bg-muted/50 font-mono" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Account")} Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer or vendor name" required />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Mobile")}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Address")}</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" rows={3} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Currency")} *</Label>
              <Select value={form.currency} onValueChange={(v: string) => setForm({ ...form, currency: v as typeof form.currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                  <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Branch")} {role === "admin" ? "(Optional)" : ""}</Label>
              <Select 
                value={form.branch_id} 
                onValueChange={(v) => setForm({ ...form, branch_id: v })}
                disabled={role !== "admin"}
              >
                <SelectTrigger className={role !== "admin" ? "bg-muted/50 cursor-not-allowed" : ""}>
                  <SelectValue placeholder={branches.length ? "Select branch" : "Loading branches..."} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {role === "admin" && !form.branch_id && profile?.branch_id && (
                <p className="text-[10px] text-muted-foreground mt-1">Defaulting to your branch: {branches.find(b => b.id === profile.branch_id)?.name}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground shadow-soft">
              {busy ? (
                <>
                  <Loader className="w-4 h-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                t("Save")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => nav("/accounts")}>{t("Cancel")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

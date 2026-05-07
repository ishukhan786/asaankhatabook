import { useEffect, useState } from "react";
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
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  currency: z.enum(["PKR", "AED"]),
  branch_id: z.string().uuid("Select a branch").optional().or(z.literal("")),
});

export default function NewAccount() {
  const nav = useNavigate();
  const { role, profile } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "", currency: "PKR" as "PKR" | "AED", branch_id: "" });

  useEffect(() => {
    supabase.from("branches").select("id, name").order("name").then(({ data }) => {
      setBranches(data ?? []);
      // Auto-select user's branch if they have one
      if (profile?.branch_id) {
        setForm((f) => ({ ...f, branch_id: profile.branch_id! }));
      }
    });
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    
    // Logic: Use selected branch, or fallback to user's branch
    const finalBranchId = form.branch_id || profile?.branch_id;
    
    if (!finalBranchId) {
      toast.error("Please select a branch or assign your user to a branch first.");
      return;
    }

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("accounts").insert([{
      account_no: "",
      name: form.name.trim(),
      mobile: form.mobile?.trim() || null,
      address: form.address?.trim() || null,
      currency: form.currency,
      branch_id: finalBranchId,
      created_by: user?.id,
    }]).select("id, account_no").single();
    
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${data?.account_no} created`);
    nav(`/accounts/${data?.id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Create</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">New Account</h1>
        <p className="text-muted-foreground text-sm mt-1">A unique account number will be generated automatically.</p>
      </div>

      <Card className="glass p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer or vendor name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" rows={3} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency *</Label>
              <Select value={form.currency} onValueChange={(v: any) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR — Pakistani Rupee</SelectItem>
                  <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch {role === "admin" ? "(Optional)" : ""}</Label>
              <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={branches.length ? "Select branch (Default: Current)" : "No branches yet"} />
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
            <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground shadow-soft">{busy ? "Saving..." : "Create account"}</Button>
            <Link to="/accounts"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}


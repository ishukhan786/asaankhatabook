import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Accounts() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  
  // Edit state
  const [editing, setEditing] = useState<any>(null);
  const [eName, setEName] = useState("");
  const [eMobile, setEMobile] = useState("");
  const [eBranch, setEBranch] = useState("");
  const [busy, setBusy] = useState(false);

  // Deletion state
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const reload = async () => {
    const [{ data: accs }, { data: brs }] = await Promise.all([
      supabase.from("accounts").select("id, account_no, name, mobile, currency, branch_id, branches(name)").order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name"),
    ]);
    setRows(accs ?? []);
    setBranches(brs ?? []);
  };

  useEffect(() => {
    reload();
    const sub = supabase.channel('accounts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const openEdit = (a: any) => {
    setEditing(a);
    setEName(a.name);
    setEMobile(a.mobile ?? "");
    setEBranch(a.branch_id);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("accounts").update({
        name: eName.trim(),
        mobile: eMobile.trim() || null,
        branch_id: eBranch,
      }).eq("id", editing.id);
      if (error) throw error;
      toast.success("Account updated");
      setEditing(null);
      reload();
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Account deleted");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error("Could not delete. Make sure there are no transactions linked to this account.");
    }
  };

  const filtered = (rows ?? []).filter((r) => {
    const s = debouncedQ.toLowerCase();
    return !s || r.name.toLowerCase().includes(s) || r.account_no.toLowerCase().includes(s) || (r.mobile ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ledger</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Accounts</h1>
        </div>
        <Link to="/accounts/new"><Button className="gradient-primary text-primary-foreground shadow-soft"><Plus className="w-4 h-4 mr-1" /> New Account</Button></Link>
      </div>

      <Card className="glass p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, account no, mobile…" className="pl-10" />
        </div>
      </Card>

      {!rows ? (
        <div className="grid gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="glass p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <div className="font-display font-semibold">No accounts yet</div>
          <div className="text-sm text-muted-foreground mb-4">Create your first account to start tracking transactions.</div>
          <Link to="/accounts/new"><Button className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Create account</Button></Link>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left font-medium px-4 py-3">Account No</th>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Mobile</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Branch</th>
                  <th className="text-left font-medium px-4 py-3">Currency</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr 
                    key={r.id} 
                    className="border-t border-border/50 hover:bg-muted/40 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/accounts/${r.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.account_no}</td>
                    <td className="px-4 py-3 font-bold text-primary group-hover:underline">{r.name}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.mobile ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.branches?.name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="font-mono">{r.currency}</Badge></td>
                    <td className="px-4 py-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      {role === "admin" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8"><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting({ id: r.id, name: r.name })} className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-1.5"><Label>Account Name</Label><Input value={eName} onChange={(e) => setEName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input value={eMobile} onChange={(e) => setEMobile(e.target.value)} placeholder="03xx..." /></div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={eBranch} onValueChange={setEBranch}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account <strong>{deleting?.name}</strong>. This action cannot be undone and will fail if there are existing transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


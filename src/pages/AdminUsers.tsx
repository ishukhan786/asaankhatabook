import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog, Plus, Trash2, KeyRound, Pencil } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  branch_id: string | null;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
}

const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

async function call(method: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(fnUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function AdminUsers() {
  const { role, loading, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "branch_user">("branch_user");
  const [branchId, setBranchId] = useState<string>("");

  // Edit form
  const [eName, setEName] = useState("");
  const [eRole, setERole] = useState<"admin" | "branch_user">("branch_user");
  const [eBranch, setEBranch] = useState<string>("");
  const [ePassword, setEPassword] = useState("");

  const reload = async () => {
    // Fetch branches independently to ensure they load even if users fetch is slow/fails
    supabase.from("branches").select("id, name, code").order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching branches:", error);
          toast.error("Failed to load branches");
        } else {
          setBranches(data ?? []);
        }
      });

    try {
      const res = await call("GET");
      setUsers(res.users);
    } catch (e: any) {
      console.error("Reload error:", e);
      const msg = e.message === "Failed to fetch" 
        ? "Edge Function not reachable. Please ensure 'admin-users' function is deployed: npx supabase functions deploy admin-users"
        : e.message;
      toast.error("Failed to load users: " + msg);
      setUsers([]); // Set to empty array to stop loading skeleton
    }
  };

  useEffect(() => { if (role === "admin") reload(); }, [role]);

  if (loading) return <div className="p-8"><Skeleton className="h-32" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password min 6 chars"); return; }
    if (newRole === "branch_user" && !branchId) { toast.error("Select a branch"); return; }
    setBusy(true);
    try {
      await call("POST", {
        email: email.trim(), password, full_name: fullName.trim() || null,
        role: newRole, branch_id: newRole === "branch_user" ? branchId : null,
      });
      toast.success("User created");
      setCreateOpen(false);
      setEmail(""); setPassword(""); setFullName(""); setNewRole("branch_user"); setBranchId("");
      reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setEName(u.full_name ?? "");
    setERole((u.roles[0] as any) ?? "branch_user");
    setEBranch(u.branch_id ?? "");
    setEPassword("");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (eRole === "branch_user" && !eBranch) { toast.error("Select a branch"); return; }
    setBusy(true);
    try {
      await call("PATCH", {
        id: editing.id,
        full_name: eName.trim() || null,
        branch_id: eRole === "branch_user" ? eBranch : null,
        role: eRole,
        password: ePassword || undefined,
      });
      toast.success("Updated");
      setEditing(null);
      reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const remove = async (u: AdminUser) => {
    if (u.id === me?.id) { toast.error("You can't delete yourself"); return; }
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try { await call("DELETE", { id: u.id }); toast.success("Deleted"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
            <UserCog className="w-7 h-7 text-primary" /> User Management
          </h1>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> New User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
            <form onSubmit={submitCreate} className="space-y-3">
              <div className="space-y-1.5"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="branch_user">Branch User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newRole === "branch_user" && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">No branches found. Please add branches first.</div>
                      ) : (
                        branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass overflow-hidden">
        {!users ? <Skeleton className="h-40 m-4" /> : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No users.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left font-medium px-4 py-3">User</th>
                  <th className="text-left font-medium px-4 py-3">Role</th>
                  <th className="text-left font-medium px-4 py-3">Branch</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Last sign-in</th>
                  <th className="text-right font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}{u.id === me?.id && <span className="ml-1 text-primary">(you)</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="mr-1">{r}</Badge>
                      ))}
                    </td>
                    <td className="px-4 py-3">{branchName(u.branch_id)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(u)} disabled={u.id === me?.id}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={submitEdit} className="space-y-3">
              <div className="text-sm text-muted-foreground">{editing.email}</div>
              <div className="space-y-1.5"><Label>Full name</Label><Input value={eName} onChange={(e) => setEName(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={eRole} onValueChange={(v: any) => setERole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="branch_user">Branch User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eRole === "branch_user" && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={eBranch} onValueChange={setEBranch}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">No branches found. Please add branches first.</div>
                      ) : (
                        branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> New password (optional)</Label>
                <Input type="text" minLength={6} value={ePassword} onChange={(e) => setEPassword(e.target.value)} placeholder="Leave blank to keep current" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

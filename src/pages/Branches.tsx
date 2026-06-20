import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Plus, Trash2, MapPin, Hash, Briefcase, Loader, Search, Edit2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type BranchRow = {
  id: string;
  name: string;
  code?: string;
};

export default function Branches() {
  const { role, loading } = useAuth();
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit State
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const nextBranchNumber = (rows ?? []).reduce((max, branch) => {
    const match = String(branch.code ?? "").match(/^BRN-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  const branchCodePreview = `BRN-${String(nextBranchNumber).padStart(2, "0")}`;

  const reload = () => supabase.from("branches").select("*").order("name").then(({ data }) => setRows(data ?? []));
  
  useEffect(() => {
    reload();
    const sub = supabase.channel('branches_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => {
        reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    if (!searchQuery) return rows;
    const lowerQuery = searchQuery.toLowerCase();
    return rows.filter(b => 
      b.name.toLowerCase().includes(lowerQuery) || 
      (b.code && b.code.toLowerCase().includes(lowerQuery))
    );
  }, [rows, searchQuery]);

  if (loading) return <div className="p-8 max-w-4xl mx-auto space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-40 w-full" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("Branch name must be at least 2 characters"); return; }
    
    setBusy(true);
    const { error } = await supabase.from("branches").insert([{
      name: name.trim(),
      code: branchCodePreview,
    }]);
    setBusy(false);
    
    if (error) {
      if (error.code === "23505") toast.error("That branch code already exists. Refresh and try again.");
      else toast.error(error.message);
      return;
    }
    
    toast.success("New branch established successfully");
    setName(""); reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) {
      toast.error("Cannot delete: Branch has active accounts or transactions.");
      return;
    }
    toast.success("Branch removed");
    reload();
  };

  const updateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    if (editName.trim().length < 2) { toast.error("Branch name must be at least 2 characters"); return; }
    
    setEditBusy(true);
    const { error } = await supabase.from("branches").update({ name: editName.trim() }).eq("id", editingBranch.id);
    setEditBusy(false);
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Branch updated successfully");
    setEditingBranch(null);
    reload();
  };

  const openEditDialog = (branch: BranchRow) => {
    setEditingBranch(branch);
    setEditName(branch.name);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs uppercase tracking-widest text-primary font-bold mb-1">Administrative Tools</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-primary/10 text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          Network <span className="text-gradient">Branches</span>
        </h1>
        <p className="text-muted-foreground mt-2">Manage your business locations with auto-generated unique branch codes.</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Creation Form */}
        <Card className="glass p-6 lg:col-span-1 sticky top-20">
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent" /> Add New Branch
          </h2>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Name</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Lahore Gulberg" 
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Code</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={branchCodePreview}
                  readOnly
                  disabled
                  className="pl-10 font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Code is generated automatically on save and cannot be edited later.</p>
            </div>
            <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-soft py-6 text-base font-semibold">
              {busy ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Establishing...
                </>
              ) : (
                "Establish Branch"
              )}
            </Button>
          </form>
        </Card>

        {/* Branches List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search branches by name or code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass border-primary/20 focus-visible:ring-primary h-12 rounded-xl"
            />
          </div>

          {!filteredRows ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="glass p-12 text-center rounded-3xl">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg">No Branches Found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
                {searchQuery ? "Try adjusting your search query." : "Start by adding your first business location using the form on the left."}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredRows.map((b, i) => (
                <motion.div 
                  key={b.id} 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass p-5 group hover:shadow-lg transition-all relative overflow-hidden border-l-4 border-l-transparent hover:border-l-primary flex flex-col h-full">
                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors" />
                    
                    <div className="flex justify-between items-start relative mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-mono tracking-tighter">
                            {b.code}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-xl">{b.name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.preventDefault(); openEditDialog(b); }}
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the branch <strong>{b.name}</strong>.
                                It will fail if there are active accounts linked to this branch.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete Branch
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="mt-auto">
                      <Link to={`/branches/${b.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Briefcase className="w-3 h-3" />
                        <span>Active Branch - Click to view</span>
                      </Link>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update the name of this branch. The branch code cannot be modified.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={updateBranch} className="space-y-4 py-4">
             <div className="space-y-2">
              <Label>Branch Code</Label>
              <Input value={editingBranch?.code || ""} disabled className="font-mono bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                placeholder="Branch name" 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingBranch(null)}>Cancel</Button>
              <Button type="submit" disabled={editBusy} className="gradient-primary">
                {editBusy ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Plus, Trash2, MapPin, Hash, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Branches() {
  const { role, loading } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

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

  if (loading) return <div className="p-8 max-w-4xl mx-auto space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-40 w-full" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("Branch name must be at least 2 characters"); return; }
    if (code.trim().length < 1) { toast.error("Branch code is required"); return; }
    
    setBusy(true);
    const { error } = await supabase.from("branches").insert([{ 
      name: name.trim(), 
      code: code.trim().toUpperCase() 
    }]);
    setBusy(false);
    
    if (error) {
      if (error.code === "23505") toast.error("A branch with this code already exists");
      else toast.error(error.message);
      return;
    }
    
    toast.success("New branch established successfully");
    setName(""); setCode(""); reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure? This will fail if there are accounts linked to this branch.")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) {
      toast.error("Cannot delete: Branch has active accounts or transactions.");
      return;
    }
    toast.success("Branch removed");
    reload();
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
        <p className="text-muted-foreground mt-2">Manage your business locations and their unique identification codes.</p>
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
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                  placeholder="e.g. LHR-01" 
                  className="pl-10 font-mono"
                  maxLength={10}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-soft py-6 text-base font-semibold">
              {busy ? "Establishing..." : "Establish Branch"}
            </Button>
          </form>
        </Card>

        {/* Branches List */}
        <div className="lg:col-span-2 space-y-4">
          {!rows ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="glass p-12 text-center rounded-3xl">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-bold text-lg">No Branches Defined</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">Start by adding your first business location using the form on the left.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rows.map((b, i) => (
                <motion.div 
                  key={b.id} 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/branches/${b.id}`}>
                    <Card className="glass p-5 group hover:shadow-lg transition-all relative overflow-hidden border-l-4 border-l-transparent hover:border-l-primary">
                      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors" />
                      <div className="flex justify-between items-start relative">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-mono tracking-tighter">
                              {b.code}
                            </span>
                          </div>
                          <h3 className="font-display font-bold text-xl">{b.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                            <Briefcase className="w-3 h-3" />
                            <span>Active Branch • Click to view</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.preventDefault(); remove(b.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


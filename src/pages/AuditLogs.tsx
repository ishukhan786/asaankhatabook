import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Search, Clock, User, Table as TableIcon, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setLogs(data ?? []));
  }, []);

  const filtered = (logs ?? []).filter(l => 
    !q || 
    l.table_name.toLowerCase().includes(q.toLowerCase()) || 
    l.action_type.toLowerCase().includes(q.toLowerCase()) ||
    (l.user_email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Security</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-primary" /> Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1">Track all database activities and user actions.</p>
      </div>

      <Card className="glass p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Search by table, action, or user email..." 
            className="pl-10"
          />
        </div>
      </Card>

      {!logs ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <Card className="glass overflow-hidden shadow-xl border-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-4 font-medium">Time</th>
                  <th className="text-left px-4 py-4 font-medium">User</th>
                  <th className="text-left px-4 py-4 font-medium">Table</th>
                  <th className="text-left px-4 py-4 font-medium">Action</th>
                  <th className="text-left px-4 py-4 font-medium">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No logs found.</td></tr>
                ) : filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono text-[11px]">{formatDate(l.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">{l.user_email ?? "System/Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <TableIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="capitalize">{l.table_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge 
                        variant={l.action_type === 'DELETE' ? 'destructive' : l.action_type === 'INSERT' ? 'success' : 'secondary'}
                        className="text-[10px] font-bold"
                      >
                        {l.action_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-w-xs truncate text-xs text-muted-foreground font-mono bg-muted/50 p-1.5 rounded border border-border/50">
                        {l.action_type === 'DELETE' ? JSON.stringify(l.old_data) : JSON.stringify(l.new_data)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

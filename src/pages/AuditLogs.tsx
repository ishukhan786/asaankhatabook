import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Search, Clock, User, Table as TableIcon, History, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const { data } = await supabase.from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data ?? []);
    if (showSpinner) setRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();

    const sub = supabase.channel('audit_logs_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const filtered = (logs ?? []).filter(l => 
    !q || 
    l.table_name.toLowerCase().includes(q.toLowerCase()) || 
    l.action_type.toLowerCase().includes(q.toLowerCase()) ||
    (l.user_email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const renderChangesText = (l: any) => {
    try {
      const oldObj = l.old_data || {};
      const newObj = l.new_data || {};
      const table = l.table_name?.toLowerCase() || "";
      const action = l.action_type?.toUpperCase() || "";

      const getRecordName = (obj: any) => {
        if (obj.name && obj.account_no) return `"${obj.name}" (${obj.account_no})`;
        if (obj.name) return `"${obj.name}"`;
        if (obj.full_name) return `"${obj.full_name}"`;
        if (obj.txn_code) return `Transaction (${obj.txn_code})`;
        if (obj.email) return `User (${obj.email})`;
        if (obj.title) return `Expense "${obj.title}"`;
        return `Record #${obj.id?.slice(0, 6) || "Unknown"}`;
      };

      if (action === "INSERT") {
        const name = getRecordName(newObj);
        let details = "";
        if (table === "accounts") details = ` · Currency: ${newObj.currency || "PKR"}`;
        if (table === "transactions") details = ` · Debit: ${newObj.debit || 0}, Credit: ${newObj.credit || 0}`;
        if (table === "expenses") details = ` · Amount: ${newObj.amount || 0} ${newObj.currency || ""}`;
        if (table === "branches") details = ` · Location: ${newObj.location || newObj.address || "—"}`;
        return `✨ Created new ${table.slice(0, -1)} ${name}${details}`;
      }

      if (action === "DELETE") {
        const name = getRecordName(oldObj);
        return `🗑️ Deleted ${table.slice(0, -1)} ${name}`;
      }

      if (action === "UPDATE") {
        const name = getRecordName(newObj || oldObj);
        const changes: string[] = [];

        const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
        allKeys.forEach(k => {
          if (["id", "created_at", "updated_at", "user_id"].includes(k)) return;
          const oldVal = oldObj[k];
          const newVal = newObj[k];
          if (oldVal !== newVal && newVal !== undefined) {
            changes.push(`${k}: "${oldVal ?? 'none'}" ➔ "${newVal ?? 'none'}"`);
          }
        });

        if (changes.length === 0) {
          return `📝 Updated ${table.slice(0, -1)} ${name} (Metadata/System update)`;
        }

        return `📝 Updated ${table.slice(0, -1)} ${name} — ${changes.join(", ")}`;
      }

      return JSON.stringify(newObj || oldObj);
    } catch (err) {
      return JSON.stringify(l.new_data || l.old_data);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Security</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" /> Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">Track all database activities and user actions.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchLogs(true)} 
          disabled={refreshing}
          className="w-full md:w-auto flex items-center gap-2 shadow-sm hover:shadow transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Logs
        </Button>
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
                      <div className="text-xs text-muted-foreground font-medium bg-muted/40 p-2.5 rounded-lg border border-border/60 leading-relaxed whitespace-normal max-w-xl shadow-inner">
                        {renderChangesText(l)}
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

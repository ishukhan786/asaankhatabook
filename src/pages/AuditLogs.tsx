import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Search, Clock, User, Table as TableIcon, History, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type AuditLog = {
  id: string;
  table_name?: string | null;
  action_type?: string | null;
  user_email?: string | null;
  created_at?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
};

export default function AuditLogs() {
  const { role, loading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
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
    if (loading || role !== "admin") return;
    fetchLogs();

    const sub = supabase.channel('audit_logs_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [loading, role]);

  const filtered = (logs ?? []).filter(l => {
    const table = String(l.table_name ?? "").toLowerCase();
    const action = String(l.action_type ?? "").toLowerCase();
    const email = String(l.user_email ?? "").toLowerCase();
    return !q || table.includes(q.toLowerCase()) || action.includes(q.toLowerCase()) || email.includes(q.toLowerCase());
  });

  const renderChangesText = (l: AuditLog) => {
    try {
      const oldObj = l.old_data || {};
      const newObj = l.new_data || {};
      const table = String(l.table_name ?? "").toLowerCase();
      const action = String(l.action_type ?? "").toUpperCase();

      const getRecordName = (obj: Record<string, unknown>) => {
        const name = typeof obj["name"] === "string" ? obj["name"] as string : undefined;
        const account_no = typeof obj["account_no"] === "string" ? obj["account_no"] as string : undefined;
        const full_name = typeof obj["full_name"] === "string" ? obj["full_name"] as string : undefined;
        const txn_code = typeof obj["txn_code"] === "string" ? obj["txn_code"] as string : undefined;
        const email = typeof obj["email"] === "string" ? obj["email"] as string : undefined;
        const title = typeof obj["title"] === "string" ? obj["title"] as string : undefined;

        if (name && account_no) return `"${name}" (${account_no})`;
        if (name) return `"${name}"`;
        if (full_name) return `"${full_name}"`;
        if (txn_code) return `Transaction (${txn_code})`;
        if (email) return `User (${email})`;
        if (title) return `Expense "${title}"`;
        return `Record #${String(obj["id"] ?? "").slice(0, 6) || "Unknown"}`;
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
        const name = getRecordName(oldObj as Record<string, unknown>);
        return `🗑️ Deleted ${table.slice(0, -1)} ${name}`;
      }

      if (action === "UPDATE") {
        const record = (newObj && Object.keys(newObj).length) ? newObj : oldObj;
        const name = getRecordName(record as Record<string, unknown>);
        const changes: string[] = [];

        const allKeys = Array.from(new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]));
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

  if (loading) return <div className="p-8"><Skeleton className="h-32" /></div>;
  if (role !== "admin") return <Navigate to="/" replace />;

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

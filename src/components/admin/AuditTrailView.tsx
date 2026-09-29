import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuditLogRow as AuditRow } from "@/types";
import EmptyState from "@/components/ui/empty-state";

export default function AuditTrailView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_log")
        .select("id, actor_id, table_name, action, row_id, site_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows(data ?? []);
      const ids = Array.from(new Set((data ?? []).map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id, email").in("id", ids);
        const map: Record<string, string> = {};
        (ps ?? []).forEach((p: any) => {
          map[p.id] = p.email;
        });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ScrollText className="h-4 w-4 text-primary" /> Statutory Audit Trail
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground">{rows.length} events</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No Audit Activity"
            description="No compliance audit actions or log records have been recorded yet."
            compact
          />
        ) : (
          <div className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
            {rows.map((r) => (
              <div key={r.id} className="p-2.5 space-y-0.5">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-foreground">
                    <span className="capitalize">{r.action.toLowerCase()}</span> on{" "}
                    <code className="bg-muted px-1.5 py-0.2 rounded text-[10px] font-mono">{r.table_name}</code>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  Operator: {r.actor_id ? profiles[r.actor_id] ?? r.actor_id.slice(0, 8) : "System Automated"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuditLogRow as AuditRow } from "@/types";
import { formatDateTimeDDMMYYYY } from "@/lib/wasteTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";

export default function AuditTrailView({ siteId }: { siteId: string }) {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [siteId]);
  const query = useQuery({queryKey:["audit_log",user?.id,siteId,page],enabled:!!user && siteId !== "ALL_SITES",queryFn:async()=>{
    const {data,error}=await supabase.from("audit_log").select("*").eq("site_id",siteId).order("created_at",{ascending:false}).order("id").range(page*100,page*100+99);
    if(error) throw new Error(error.message);
    return data;
  }});
  const rows = query.data ?? [];
  const loading = query.isLoading;
  const profiles: Record<string,string> = {};

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ScrollText className="h-4 w-4 text-primary" /> Statutory Audit Trail
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground">{rows.length} events</span>
        </div>
        {query.error && <p role="alert">{query.error.message}</p>}
        <div className="flex gap-2"><Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page + 1}</span><Button disabled={rows.length < 100} onClick={() => setPage(p => p + 1)}>Next</Button></div>
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
          <div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                    <th className="py-2.5 px-3">Target Entity</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3 text-right">Record Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((r) => {
                    const actionLower = r.action.toLowerCase();
                    const actionBadge =
                      actionLower.includes("insert") || actionLower.includes("create")
                        ? "success"
                        : actionLower.includes("delete") || actionLower.includes("remove")
                        ? "destructive"
                        : "secondary";

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                          {formatDateTimeDDMMYYYY(r.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={actionBadge} className="text-[10px] uppercase font-mono px-1.5 py-0">
                            {r.action}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground font-semibold">
                            {r.table_name}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {r.actor_id ? profiles[r.actor_id] ?? r.actor_id.slice(0, 8) : "System Automated"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                          {r.row_id ? `${r.row_id.slice(0, 8)}…` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
              {rows.map((r) => (
                <div key={r.id} className="p-2.5 space-y-0.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-foreground">
                      <span className="capitalize">{r.action.toLowerCase()}</span> on{" "}
                      <code className="bg-muted px-1.5 py-0.2 rounded text-[10px] font-mono">{r.table_name}</code>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatDateTimeDDMMYYYY(r.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Operator: {r.actor_id ? profiles[r.actor_id] ?? r.actor_id.slice(0, 8) : "System Automated"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

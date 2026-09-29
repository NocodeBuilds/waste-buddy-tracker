import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, UserMinus, Plus, CheckCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Role, Member } from "@/types";

interface Props {
  siteId: string;
  siteName: string;
  callerId: string;
}

export default function UserManagementView({ siteId, siteName, callerId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [approveRoles, setApproveRoles] = useState<Record<string, Role>>({});
  const [showInvite, setShowInvite] = useState(false);

  const setReqRole = (reqId: string, r: Role) => setApproveRoles((prev) => ({ ...prev, [reqId]: r }));

  const load = async () => {
    setLoading(true);
    const [{ data: ms }, { data: rs }] = await Promise.all([
      supabase.from("user_sites").select("user_id").eq("site_id", siteId),
      supabase.from("user_roles").select("user_id, role").eq("site_id", siteId),
    ]);
    const userIds = Array.from(
      new Set([...(ms ?? []).map((m: any) => m.user_id), ...(rs ?? []).map((r: any) => r.user_id)])
    );
    let profMap: Record<string, { email: string | null; full_name: string | null }> = {};
    if (userIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, email, full_name").in("id", userIds);
      (ps ?? []).forEach((p: any) => {
        profMap[p.id] = { email: p.email, full_name: p.full_name };
      });
    }
    const byUser: Record<string, Role[]> = {};
    (rs ?? []).forEach((r: any) => {
      byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
    });
    setMembers(
      (ms ?? []).map((m: any) => ({
        user_id: m.user_id,
        email: profMap[m.user_id]?.email ?? null,
        full_name: profMap[m.user_id]?.full_name ?? null,
        roles: byUser[m.user_id] ?? [],
      }))
    );

    const { data: reqRows } = await supabase
      .from("site_access_requests")
      .select("id, user_id, note, created_at, status")
      .eq("site_id", siteId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRequests((reqRows ?? []).map((r: any) => ({ ...r, profile: profMap[r.user_id] })));

    const missing = (reqRows ?? []).map((r: any) => r.user_id).filter((id: string) => !profMap[id]);
    if (missing.length) {
      const { data: ps2 } = await supabase.from("profiles").select("id, email, full_name").in("id", missing);
      const extra: Record<string, any> = {};
      (ps2 ?? []).forEach((p: any) => {
        extra[p.id] = { email: p.email, full_name: p.full_name };
      });
      setRequests((reqRows ?? []).map((r: any) => ({ ...r, profile: profMap[r.user_id] ?? extra[r.user_id] })));
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [siteId]);

  const call = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Operation failed");
      return false;
    }
    toast.success(success);
    await load();
    return true;
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const ok = await call({ action: "invite", email, site_id: siteId, role }, `Invited ${email}`);
    if (ok) {
      setEmail("");
      setShowInvite(false);
    }
  };

  const approveReq = async (r: any) => {
    const chosenRole = approveRoles[r.id] ?? "member";
    await call({ action: "approve_request", request_id: r.id, site_id: siteId, role: chosenRole }, "Access approved");
    setApproveRoles((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
  };

  const rejectReq = async (r: any) => {
    await call({ action: "reject_request", request_id: r.id, site_id: siteId }, "Access rejected");
  };

  return (
    <div className="space-y-3">
      {/* Pending site access requests banner */}
      {requests.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/[0.03] shadow-xs">
          <CardContent className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Pending Access Requests ({requests.length})
              </h3>
            </div>
            <div className="divide-y divide-border/60">
              {requests.map((r) => (
                <div key={r.id} className="py-2 space-y-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {r.profile?.full_name ?? r.profile?.email ?? r.user_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.profile?.email} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    {r.note && (
                      <p className="text-[11px] italic text-muted-foreground mt-0.5 bg-muted/40 p-1.5 rounded">
                        "{r.note}"
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Select
                      value={approveRoles[r.id] ?? "member"}
                      onValueChange={(v) => setReqRole(r.id, v as Role)}
                    >
                      <SelectTrigger className="h-7 text-xs w-24 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                      disabled={busy}
                      onClick={() => approveReq(r)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-lg"
                      disabled={busy}
                      onClick={() => rejectReq(r)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Directory */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Site Operators ({members.length})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary/90 gap-1 px-2"
              onClick={() => setShowInvite(!showInvite)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showInvite ? "Cancel" : "Invite Teammate"}</span>
            </Button>
          </div>

          {/* Invite Drawer */}
          {showInvite && (
            <form onSubmit={invite} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-primary" /> Invite Operator to {siteName}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[11px] font-semibold">Email address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@domain.com"
                    className="h-8 text-xs rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="h-8 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={busy || !email}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Send Invitation
              </Button>
            </form>
          )}

          {/* Members High-Density Rows */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No members assigned to this site yet.</p>
          ) : (
            <div className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
              {members.map((m) => (
                <div key={m.user_id} className="p-2.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/60">
                      {m.email?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {m.email ?? m.full_name ?? m.user_id}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {m.roles.join(", ") || "no role"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(["admin", "manager", "member"] as Role[]).map((r) => {
                      const has = m.roles.includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          className={`h-6 px-2 text-[10px] capitalize rounded-md ${
                            has ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : ""
                          }`}
                          disabled={busy || (m.user_id === callerId && r === "admin" && has)}
                          onClick={() =>
                            call(
                              has
                                ? { action: "revoke_role", user_id: m.user_id, site_id: siteId, role: r }
                                : { action: "assign", user_id: m.user_id, site_id: siteId, role: r },
                              has ? `Revoked ${r}` : `Granted ${r}`
                            )
                          }
                        >
                          {r}
                        </Button>
                      );
                    })}

                    {m.user_id !== callerId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-md shrink-0 ml-1"
                        disabled={busy}
                        onClick={() =>
                          call({ action: "remove_from_site", user_id: m.user_id, site_id: siteId }, "Member removed")
                        }
                        aria-label="Remove member"
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

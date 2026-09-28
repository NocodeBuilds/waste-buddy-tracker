import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  Users,
  Building2,
  FileText,
  History,
  Loader2,
  UserPlus,
  Trash2,
  UserMinus,
  LogOut,
  MapPin,
  Plus,
  ScrollText,
  CheckCircle,
  X,
  AlertCircle,
  Search,
  Tag,
} from "lucide-react";
import { WASTE_TYPES } from "@/lib/wasteTypes";
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
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Role, Member, SiteRow, AuditLogRow as AuditRow } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminTab() {
  const { currentSite, sites, isAdmin, refresh } = useSite();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "sites" | "records" | "audit">("users");

  if (!isAdmin || !currentSite) {
    return (
      <Card className="border-border/80 p-8 text-center">
        <CardContent className="p-0 flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-amber-500 opacity-60" />
          <h3 className="text-sm font-semibold text-foreground">Admin Privileges Required</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            You need administrator permissions for <strong>{currentSite?.name ?? "this site"}</strong> to access governance settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto">
      {/* ── Sub-Navigation Pill Segment Switcher (eliminates vertical scroll overload) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/60 pb-2">
        <div className="inline-flex p-1 bg-muted/70 rounded-xl gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "users"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>Team & Access</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sites")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "sites"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Facilities & Tags</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("records")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "records"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" />
            <span>Records Oversight</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === "audit"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5 text-emerald-600" />
            <span>Audit Trail</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{currentSite.name}</span>
        </div>
      </div>

      {/* ────────────────────────── TAB 1: USERS & ACCESS ────────────────────────── */}
      {activeTab === "users" && (
        <UsersPanel siteId={currentSite.id} siteName={currentSite.name} callerId={user?.id ?? ""} />
      )}

      {/* ────────────────────────── TAB 2: SITES & LOCATION TAGS ────────────────────────── */}
      {activeTab === "sites" && (
        <SitesPanel sites={sites} onChanged={refresh} />
      )}

      {/* ────────────────────────── TAB 3: RECORDS OVERSIGHT ────────────────────────── */}
      {activeTab === "records" && (
        <RecordsPanel siteId={currentSite.id} />
      )}

      {/* ────────────────────────── TAB 4: AUDIT LOG ────────────────────────── */}
      {activeTab === "audit" && (
        <AuditPanel />
      )}
    </div>
  );
}

// ─────────────── Users Panel
function UsersPanel({ siteId, siteName, callerId }: { siteId: string; siteName: string; callerId: string }) {
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

// ─────────────── Sites & Location Tags Panel
function SitesPanel({ sites, onChanged }: { sites: SiteRow[]; onChanged: () => Promise<void> }) {
  const { setCurrentSite } = useSite();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SiteRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SiteRow | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast.error("Site name is required");
    setBusy(true);
    const { data, error } = await supabase
      .from("sites")
      .insert({ name: n, location: loc.trim() || null })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Facility "${data.name}" created`);
    setName("");
    setLoc("");
    setShowAddSite(false);
    await onChanged();
    setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  const openRename = (s: SiteRow) => {
    setRenameTarget(s);
    setRenameValue(s.name);
  };

  const commitRename = async () => {
    if (!renameTarget) return;
    const v = renameValue.trim();
    if (!v || v === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const { error } = await supabase.from("sites").update({ name: v }).eq("id", renameTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Site renamed");
    setRenameTarget(null);
    onChanged();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { count: entryCount } = await supabase
      .from("waste_entries")
      .select("*", { count: "exact", head: true })
      .eq("site_id", deleteTarget.id);
    const { count: batchCount } = await supabase
      .from("disposal_batches")
      .select("*", { count: "exact", head: true })
      .eq("site_id", deleteTarget.id);
    const { count: memberCount } = await supabase
      .from("user_sites")
      .select("*", { count: "exact", head: true })
      .eq("site_id", deleteTarget.id);
    const total = (entryCount ?? 0) + (batchCount ?? 0) + (memberCount ?? 0);
    if (
      total > 0 &&
      !confirm(
        `"${deleteTarget.name}" has ${entryCount ?? 0} waste entries, ${batchCount ?? 0} disposal batches, and ${
          memberCount ?? 0
        } members. Deleting the site will permanently remove all of them. This cannot be undone. Continue?`
      )
    )
      return;
    const { error } = await supabase.from("sites").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Site deleted");
    setDeleteTarget(null);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facilities & Location Tags ({sites.length})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary/90 gap-1 px-2"
              onClick={() => setShowAddSite(!showAddSite)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddSite ? "Cancel" : "Add Facility"}</span>
            </Button>
          </div>

          {/* Add Site Drawer */}
          {showAddSite && (
            <form onSubmit={create} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Register Facility
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Facility name"
                  className="h-8 text-xs rounded-lg"
                  required
                />
                <Input
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder="Location region (optional)"
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={busy}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} Create Site
              </Button>
            </form>
          )}

          {/* Sites list with Location Tag Manager */}
          <div className="space-y-2.5">
            {sites.map((s) => (
              <div key={s.id} className="p-3 rounded-lg border border-border/70 bg-background space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                    {s.location && <p className="text-[10px] text-muted-foreground font-mono truncate">{s.location}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] rounded-md"
                      onClick={() => openRename(s)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md"
                      onClick={() => setDeleteTarget(s)}
                      aria-label="Delete site"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <LocationsManager siteId={s.id} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <AlertDialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Rename facility</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Enter a new name for "{renameTarget?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-9 text-xs rounded-lg my-1"
            autoFocus
          />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                commitRename();
              }}
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">
              Delete facility "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This permanently removes all members, entries, and disposal records associated with this site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Facility
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────── Locations Sub-Panel
function LocationsManager({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ id: string; code: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_locations")
      .select("id, code, sort_order")
      .eq("site_id", siteId)
      .order("sort_order");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, siteId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from("site_locations")
      .insert({ site_id: siteId, code, sort_order: nextOrder });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Location tag ${code} added`);
    setNewCode("");
    load();
  };

  const del = async (id: string, code: string) => {
    if (!confirm(`Delete location "${code}"?`)) return;
    const { error } = await supabase.from("site_locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Location deleted");
    load();
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-2.5 py-1.5 text-left text-[11px] font-medium flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-foreground font-semibold">
          <Tag className="h-3 w-3 text-primary" />
          Location Tags ({rows.length || "0"})
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/50 pt-2">
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rows.length === 0 && (
                <p className="text-[10px] text-muted-foreground py-0.5">No location tags configured.</p>
              )}
              {rows.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded bg-background border border-border/80 px-1.5 py-0.5 text-[10px] font-mono font-medium shadow-2xs"
                >
                  {r.code}
                  <button
                    onClick={() => del(r.id, r.code)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    aria-label={`Delete ${r.code}`}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={add} className="flex gap-1 pt-0.5">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. WTG-01, BAY-2"
              className="h-7 text-xs rounded-md uppercase"
            />
            <Button type="submit" size="sm" className="h-7 px-2.5 rounded-md" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─────────────── Records Oversight Panel
function RecordsPanel({ siteId }: { siteId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("waste_entries")
      .select("id, location, waste_type_id, weight_kg, quantity, generated_date, activity_type, disposal_batch_id, created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [siteId]);

  const del = async (id: string) => {
    setPendingDel(null);
    const { error } = await supabase.from("waste_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Record deleted");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const wt = (WASTE_TYPES.find((w) => w.id === r.waste_type_id)?.name ?? r.waste_type_id).toLowerCase();
    const loc = (r.location ?? "").toLowerCase();
    return wt.includes(q) || loc.includes(q);
  });

  return (
    <>
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Records Oversight (100 Max)
            </h3>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No matching records found.</p>
          ) : (
            <div className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
              {filtered.map((r) => {
                const wt = WASTE_TYPES.find((w) => w.id === r.waste_type_id);
                return (
                  <div key={r.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        <span className="font-mono bg-muted/60 px-1 py-0.2 rounded border border-border/40 mr-1.5">
                          {r.location || "General"}
                        </span>
                        {wt?.name ?? r.waste_type_id}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.generated_date} · {r.weight_kg ?? r.quantity ?? "—"} kg · {r.activity_type}
                        {r.disposal_batch_id ? " · (Disposed)" : ""}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                      onClick={() => setPendingDel(r.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDel} onOpenChange={(open) => !open && setPendingDel(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">Permanently delete record?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will remove the entry from inventory totals and statutory reports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setPendingDel(null)} className="h-9 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDel) await del(pendingDel);
              }}
              className="h-9 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────── Audit Log Panel
function AuditPanel() {
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
          <p className="text-xs text-muted-foreground py-4 text-center">No compliance audit activity recorded yet.</p>
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

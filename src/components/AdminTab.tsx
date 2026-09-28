import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function AdminTab() {
  const { currentSite, sites, isAdmin, refresh } = useSite();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("users");

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Admin Control Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Facility access, team roles, site location tags, and compliance audit trail
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-10 p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="users" className="text-xs py-1.5 gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="sites" className="text-xs py-1.5 gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Building2 className="h-3.5 w-3.5" /> Sites
          </TabsTrigger>
          <TabsTrigger value="records" className="text-xs py-1.5 gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <FileText className="h-3.5 w-3.5" /> Records
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs py-1.5 gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <History className="h-3.5 w-3.5" /> Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0">
          <UsersPanel siteId={currentSite.id} siteName={currentSite.name} callerId={user?.id ?? ""} />
        </TabsContent>
        <TabsContent value="sites" className="mt-0">
          <SitesPanel sites={sites} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="records" className="mt-0">
          <RecordsPanel siteId={currentSite.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-0">
          <AuditPanel />
        </TabsContent>
      </Tabs>

      {/* Account Info card */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signed In Operator</h3>
            <p className="text-sm font-semibold text-foreground mt-0.5">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Admin on {currentSite.name}</p>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-destructive hover:bg-destructive/10" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </CardContent>
      </Card>
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
    if (ok) setEmail("");
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
      {/* Pending site access requests */}
      <Card className={`border-border/80 shadow-xs ${requests.length > 0 ? "border-amber-500/50 bg-amber-500/[0.02]" : ""}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-amber-500" /> Pending Requests
            </h3>
            <Badge variant={requests.length > 0 ? "warning" : "outline"} className="text-[11px] font-mono">
              {requests.length}
            </Badge>
          </div>
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No pending site access requests.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {requests.map((r) => (
                <li key={r.id} className="py-2.5 space-y-2 first:pt-1 last:pb-1">
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
                      <SelectTrigger className="h-8 text-xs w-28 rounded-lg">
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
                      className="h-8 text-xs flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                      disabled={busy}
                      onClick={() => approveReq(r)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-lg"
                      disabled={busy}
                      onClick={() => rejectReq(r)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invite user */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <UserPlus className="h-4 w-4 text-primary" /> Invite Colleague to {siteName}
          </h3>
          <form onSubmit={invite} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@domain.com"
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Log waste records)</SelectItem>
                  <SelectItem value="manager">Manager (Approve & record disposals)</SelectItem>
                  <SelectItem value="admin">Admin (Site administrator)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              size="sm"
              className="w-full h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
              disabled={busy || !email}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send Access Invitation
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Site Members
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">{members.length} members</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No members assigned to this site yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {members.map((m) => (
                <li key={m.user_id} className="py-2.5 space-y-2 first:pt-1 last:pb-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {m.email ?? m.full_name ?? m.user_id}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {m.roles.join(", ") || "no role assigned"}
                      </p>
                    </div>
                    {m.user_id !== callerId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        disabled={busy}
                        onClick={() =>
                          call({ action: "remove_from_site", user_id: m.user_id, site_id: siteId }, "Member removed")
                        }
                        aria-label="Remove member"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["admin", "manager", "member"] as Role[]).map((r) => {
                      const has = m.roles.includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          className={`h-7 px-2.5 text-[11px] capitalize rounded-lg ${
                            has ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : ""
                          }`}
                          disabled={busy || (m.user_id === callerId && r === "admin" && has)}
                          onClick={() =>
                            call(
                              has
                                ? { action: "revoke_role", user_id: m.user_id, site_id: siteId, role: r }
                                : { action: "assign", user_id: m.user_id, site_id: siteId, role: r },
                              has ? `Revoked ${r} role` : `Granted ${r} role`
                            )
                          }
                        >
                          {r}
                        </Button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────── Sites Panel
function SitesPanel({ sites, onChanged }: { sites: SiteRow[]; onChanged: () => Promise<void> }) {
  const { setCurrentSite } = useSite();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SiteRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SiteRow | null>(null);

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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" /> Active Facilities
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">{sites.length} sites</span>
          </div>
          <ul className="divide-y divide-border/60">
            {sites.map((s) => (
              <li key={s.id} className="py-2.5 space-y-2 first:pt-1 last:pb-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                    {s.location && <p className="text-[11px] text-muted-foreground truncate">{s.location}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs rounded-lg"
                      onClick={() => openRename(s)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => setDeleteTarget(s)}
                      aria-label="Delete site"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <LocationsManager siteId={s.id} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-primary" /> Add New Facility
          </h3>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Facility Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Kayathar Wind Farm - Phase 1"
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Geographic Location (optional)</Label>
              <Input
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="e.g., Tamil Nadu, IN"
                className="h-9 text-xs rounded-lg"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="w-full h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Facility Site
            </Button>
          </form>
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
              This permanently removes all members, entries, and disposal records associated with this site. This
              action cannot be reversed.
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
    <div className="rounded-lg border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-foreground font-semibold">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Location Tags ({rows.length || "0"})
        </span>
        <span className="text-[11px] text-muted-foreground">{open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border/50 pt-2">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {rows.length === 0 && (
                <p className="text-[11px] text-muted-foreground py-1">No site-specific locations configured yet.</p>
              )}
              {rows.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-background border border-border/80 px-2 py-0.5 text-xs font-mono font-medium shadow-2xs"
                >
                  {r.code}
                  <button
                    onClick={() => del(r.id, r.code)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    aria-label={`Delete ${r.code}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={add} className="flex gap-1.5 pt-1">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. WTG-01, BAY-2"
              className="h-8 text-xs rounded-lg uppercase"
            />
            <Button type="submit" size="sm" className="h-8 px-3 rounded-lg" disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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

  return (
    <>
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Recent Site Records (100 Max)
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">{rows.length} records</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No records logged yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((r) => {
                const wt = WASTE_TYPES.find((w) => w.id === r.waste_type_id);
                return (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs first:pt-1 last:pb-1">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        <span className="font-mono">{r.location || "General"}</span> · {wt?.name ?? r.waste_type_id}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.generated_date} · {r.weight_kg ?? r.quantity ?? "—"} kg · {r.activity_type}
                        {r.disposal_batch_id ? " · (Disposed)" : ""}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      onClick={() => setPendingDel(r.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDel} onOpenChange={(open) => !open && setPendingDel(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">Permanently delete record?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will remove the entry from inventory totals, statutory reports, and analytics. This cannot be undone.
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
          <span className="text-[11px] font-mono text-muted-foreground">{rows.length} entries</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No compliance audit activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="py-2 text-xs space-y-0.5 first:pt-1 last:pb-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-foreground">
                    <span className="capitalize">{r.action.toLowerCase()}</span> on{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{r.table_name}</code>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  Operator: {r.actor_id ? profiles[r.actor_id] ?? r.actor_id.slice(0, 8) : "System Automated"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

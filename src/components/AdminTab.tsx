import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Users, Building2, FileText, History, Loader2, UserPlus, Trash2, UserMinus, LogOut, MapPin, Plus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Role = "admin" | "manager" | "member";

interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
}
interface SiteRow { id: string; name: string; location: string | null }
interface AuditRow {
  id: string;
  actor_id: string | null;
  table_name: string;
  action: string;
  row_id: string | null;
  site_id: string | null;
  created_at: string;
}

export default function AdminTab() {
  const { currentSite, sites, isAdmin, refresh } = useSite();
  const { user, signOut } = useAuth();

  const [tab, setTab] = useState("users");

  if (!isAdmin || !currentSite) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          You need admin access on the selected site to use this panel.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" /> Admin Panel
      </h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="users" className="text-[11px] py-1.5 gap-1"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
          <TabsTrigger value="sites" className="text-[11px] py-1.5 gap-1"><Building2 className="h-3.5 w-3.5" />Sites</TabsTrigger>
          <TabsTrigger value="records" className="text-[11px] py-1.5 gap-1"><FileText className="h-3.5 w-3.5" />Records</TabsTrigger>
          <TabsTrigger value="audit" className="text-[11px] py-1.5 gap-1"><History className="h-3.5 w-3.5" />Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-3">
          <UsersPanel siteId={currentSite.id} siteName={currentSite.name} callerId={user?.id ?? ""} />
        </TabsContent>
        <TabsContent value="sites" className="mt-3">
          <SitesPanel sites={sites} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="records" className="mt-3">
          <RecordsPanel siteId={currentSite.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-3">
          <AuditPanel />
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">Account</h3>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


// ─────────────── Users
function UsersPanel({ siteId, siteName, callerId }: { siteId: string; siteName: string; callerId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: ms } = await supabase
      .from("user_sites")
      .select("user_id, profiles!inner(email, full_name)")
      .eq("site_id", siteId);
    const { data: rs } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("site_id", siteId);
    const byUser: Record<string, Role[]> = {};
    (rs ?? []).forEach((r: any) => { byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role]; });
    setMembers((ms ?? []).map((m: any) => ({
      user_id: m.user_id,
      email: m.profiles?.email ?? null,
      full_name: m.profiles?.full_name ?? null,
      roles: byUser[m.user_id] ?? [],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [siteId]);

  const call = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
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

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite to {siteName}
          </h3>
          <form onSubmit={invite} className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">Members ({members.length})</h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.user_id} className="py-2 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs truncate font-medium">{m.email ?? m.full_name ?? m.user_id}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{m.roles.join(", ") || "no role"}</p>
                    </div>
                    {m.user_id !== callerId && (
                      <Button
                        size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                        disabled={busy}
                        onClick={() => call({ action: "remove_from_site", user_id: m.user_id, site_id: siteId }, "Removed")}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["admin","manager","member"] as Role[]).map((r) => {
                      const has = m.roles.includes(r);
                      return (
                        <Button
                          key={r} size="sm" variant={has ? "default" : "outline"}
                          className="h-6 px-2 text-[10px] capitalize"
                          disabled={busy || m.user_id === callerId && r === "admin" && has}
                          onClick={() => call(
                            has
                              ? { action: "revoke_role", user_id: m.user_id, site_id: siteId, role: r }
                              : { action: "assign", user_id: m.user_id, site_id: siteId, role: r },
                            has ? `Removed ${r}` : `Granted ${r}`,
                          )}
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

// ─────────────── Sites
function SitesPanel({ sites, onChanged }: { sites: SiteRow[]; onChanged: () => Promise<void> }) {
  const { setCurrentSite } = useSite();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast.error("Name required");
    setBusy(true);
    const { data, error } = await supabase
      .from("sites").insert({ name: n, location: loc.trim() || null }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Site "${data.name}" created`);
    setName(""); setLoc("");
    await onChanged();
    setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  const rename = async (s: SiteRow) => {
    const newName = prompt("New name", s.name);
    if (!newName || newName === s.name) return;
    const { error } = await supabase.from("sites").update({ name: newName }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Renamed");
    onChanged();
  };

  const remove = async (s: SiteRow) => {
    if (!confirm(`Delete site "${s.name}"? This removes all its data.`)) return;
    const { error } = await supabase.from("sites").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">Sites ({sites.length})</h3>
          <ul className="divide-y">
            {sites.map((s) => (
              <li key={s.id} className="py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    {s.location && <p className="text-[10px] text-muted-foreground truncate">{s.location}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => rename(s)}>Rename</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(s)}>
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
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> New site</h3>
          <form onSubmit={create} className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name" required />
            <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location (optional)" />
            <Button type="submit" size="sm" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────── Locations sub-panel
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

  useEffect(() => { if (open) load(); }, [open, siteId]);

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
    toast.success(`Added ${code}`);
    setNewCode("");
    load();
  };

  const del = async (id: string, code: string) => {
    if (!confirm(`Delete location "${code}"?`)) return;
    const { error } = await supabase.from("site_locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-1.5 text-left text-[11px] font-medium flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          Locations ({rows.length || "—"})
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rows.length === 0 && (
                <p className="text-[10px] text-muted-foreground py-1">No site-specific locations.</p>
              )}
              {rows.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1 rounded bg-background border px-1.5 py-0.5 text-[10px] font-mono">
                  {r.code}
                  <button onClick={() => del(r.id, r.code)} className="text-destructive hover:opacity-70">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={add} className="flex gap-1">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. KCTRE21"
              className="h-7 text-xs"
            />
            <Button type="submit" size="sm" className="h-7 px-2" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─────────────── Records oversight
function RecordsPanel({ siteId }: { siteId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("waste_entries")
      .select("id, location, waste_type_id, quantity, generated_date, activity_type, disposal_batch_id, created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [siteId]);

  const del = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    const { error } = await supabase.from("waste_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold">Latest waste records ({rows.length})</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No records yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.location} · {r.waste_type_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.generated_date} · {r.quantity} · {r.activity_type}
                    {r.disposal_batch_id ? " · disposed" : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => del(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────── Audit log
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
        (ps ?? []).forEach((p: any) => { map[p.id] = p.email; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold">Recent activity ({rows.length})</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2 text-xs space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    <span className="capitalize">{r.action.toLowerCase()}</span> · {r.table_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  by {r.actor_id ? (profiles[r.actor_id] ?? r.actor_id.slice(0, 8)) : "system"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

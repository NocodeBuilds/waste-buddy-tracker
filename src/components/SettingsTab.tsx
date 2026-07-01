import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Download, LogOut, UserPlus, Building2, Loader2, Shield } from "lucide-react";
import { WasteEntry, WASTE_TYPES } from "@/lib/wasteTypes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  entries: WasteEntry[];
}

interface SiteMember {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: string[];
}

export default function SettingsTab({ entries }: Props) {
  const { user, signOut } = useAuth();
  const { currentSite, isAdmin, sites, refresh, setCurrentSite } = useSite();
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteLocation, setNewSiteLocation] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);

  const loadMembers = async () => {
    if (!currentSite) return;
    const { data: memberships } = await supabase
      .from("user_sites")
      .select("user_id, profiles!inner(email, full_name)")
      .eq("site_id", currentSite.id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("site_id", currentSite.id);
    const rolesByUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
    });
    setMembers(
      (memberships ?? []).map((m: any) => ({
        user_id: m.user_id,
        email: m.profiles?.email ?? null,
        full_name: m.profiles?.full_name ?? null,
        roles: rolesByUser[m.user_id] ?? [],
      }))
    );
  };

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [currentSite, isAdmin]);

  const handleExport = () => {
    const csv = [
      "Location,Waste Type,Category,Quantity,Activity,Generated,Disposed Batch,Notes",
      ...entries.map((e) =>
        [
          e.location,
          WASTE_TYPES.find((w) => w.id === e.waste_type_id)?.name ?? e.waste_type_id,
          e.waste_category,
          e.quantity,
          e.activity_type,
          e.generated_date,
          e.disposal_batch_id ?? "",
          (e.notes ?? "").replace(/,/g, ";"),
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waste-${currentSite?.name}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSite || !inviteEmail) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email: inviteEmail, site_id: currentSite.id, role: inviteRole },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Invite failed");
      return;
    }
    toast.success(`Invited ${inviteEmail}`);
    setInviteEmail("");
    loadMembers();
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSiteName.trim();
    if (!name) return toast.error("Site name is required");
    if (name.length > 80) return toast.error("Site name too long (max 80 chars)");
    setCreatingSite(true);
    const { data, error } = await supabase
      .from("sites")
      .insert({ name, location: newSiteLocation.trim() || null })
      .select()
      .single();
    setCreatingSite(false);
    if (error) {
      const detail = [error.message, (error as any).details, (error as any).hint]
        .filter(Boolean)
        .join(" — ");
      toast.error(detail || "Could not create site");
      return;
    }
    toast.success(`Site "${data.name}" created — you're the admin`);
    setNewSiteName("");
    setNewSiteLocation("");
    await refresh();
    if (data) setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Settings className="h-5 w-5 text-accent" /> Settings
      </h2>

      {/* Account */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" /> Account
          </h3>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          {currentSite && (
            <p className="text-xs"><span className="text-muted-foreground">Current site:</span> <span className="font-semibold">{currentSite.name}</span></p>
          )}
          <Button variant="outline" size="sm" className="w-full mt-2 gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Sites */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" /> My Sites ({sites.length})
          </h3>
          {sites.length > 0 && (
            <ul className="text-xs space-y-1">
              {sites.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span className={s.id === currentSite?.id ? "font-semibold" : ""}>{s.name}</span>
                  {s.location && <span className="text-muted-foreground">{s.location}</span>}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && (
            <form onSubmit={handleCreateSite} className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-semibold">Create new site</h4>
              <div className="space-y-1.5">
                <Label htmlFor="new-site-name" className="text-xs">Name</Label>
                <Input
                  id="new-site-name"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="e.g. North Wind Farm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-site-loc" className="text-xs">Location (optional)</Label>
                <Input
                  id="new-site-loc"
                  value={newSiteLocation}
                  onChange={(e) => setNewSiteLocation(e.target.value)}
                  placeholder="e.g. Tamil Nadu, IN"
                />
              </div>
              <Button type="submit" size="sm" className="w-full gap-2" disabled={creatingSite}>
                {creatingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                Create site
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Admin only. Any site you create is assigned to you as admin.
              </p>
            </form>
          )}

        </CardContent>
      </Card>

      {/* Admin: invite users */}
      {isAdmin && currentSite && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite User to {currentSite.name}
            </h3>
            <form onSubmit={handleInvite} className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs">Email</Label>
                <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member (log entries)</SelectItem>
                    <SelectItem value="manager">Manager (mark disposals)</SelectItem>
                    <SelectItem value="admin">Admin (manage users)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Invite
              </Button>
            </form>

            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold mb-2">Site Members ({members.length})</h4>
              <ul className="space-y-1.5 text-xs">
                {members.map((m) => (
                  <li key={m.user_id} className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate">{m.email ?? m.full_name}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 capitalize">
                      {m.roles.join(", ") || "member"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data export */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Data Export</h3>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export Data as CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-1">About</h3>
          <p className="text-xs text-muted-foreground">
            Hazardous Waste Tracker v2.0 — Multi-site, role-based waste compliance for wind-turbine maintenance. Disposal limit: 90 days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

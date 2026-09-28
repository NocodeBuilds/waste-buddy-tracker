import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Download,
  LogOut,
  UserPlus,
  Building2,
  Loader2,
  Shield,
  FileSpreadsheet,
  CheckCircle2,
  Info,
} from "lucide-react";
import { WasteEntry, WASTE_TYPES } from "@/lib/wasteTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

  const sanitizeCsv = (v: unknown): string => {
    const s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) return `\t${s.replace(/"/g, '""')}`;
    if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExport = () => {
    const csv = [
      "Location,Waste Type,Category,Weight,Unit,Count (pcs),Activity,Generated,Disposed Batch,Notes",
      ...entries.map((e) => {
        const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
        const unit = wt?.measureUnit === "litres" ? "Ltr" : "kg";
        return [
          sanitizeCsv(e.location),
          sanitizeCsv(wt?.name ?? e.waste_type_id),
          sanitizeCsv(e.waste_category),
          sanitizeCsv(e.weight_kg ?? ""),
          sanitizeCsv(unit),
          sanitizeCsv(e.piece_count ?? ""),
          sanitizeCsv(e.activity_type),
          sanitizeCsv(e.generated_date),
          sanitizeCsv(e.disposal_batch_id ?? ""),
          sanitizeCsv(e.notes ?? ""),
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waste-${currentSite?.name ?? "facility"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV dataset exported successfully");
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
    toast.success(`Access invitation sent to ${inviteEmail}`);
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
    toast.success(`Site "${data.name}" created — you are administrator`);
    setNewSiteName("");
    setNewSiteLocation("");
    await refresh();
    if (data) setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> Application Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          User account, site access permissions, data backups, and regulatory parameters
        </p>
      </div>

      {/* Account Info */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" /> My Account
            </h3>
            {isAdmin && <Badge variant="default" className="text-[10px]">Admin Access</Badge>}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{user?.email}</p>
            {currentSite && (
              <p className="text-xs text-muted-foreground">
                Active facility: <span className="font-semibold text-foreground">{currentSite.name}</span>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs gap-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out of WasteBuddy
          </Button>
        </CardContent>
      </Card>

      {/* Sites */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" /> My Authorized Facilities
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">{sites.length} sites</span>
          </div>

          {sites.length > 0 && (
            <ul className="divide-y divide-border/60 text-xs">
              {sites.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-2 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.id === currentSite?.id && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    <span className={`truncate ${s.id === currentSite?.id ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                      {s.name}
                    </span>
                  </div>
                  {s.location && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{s.location}</span>}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && (
            <form onSubmit={handleCreateSite} className="space-y-3 border-t border-border/60 pt-3">
              <h4 className="text-xs font-semibold text-foreground">Create New Facility Site</h4>
              <div className="space-y-1.5">
                <Label htmlFor="new-site-name" className="text-xs font-semibold">
                  Facility Name
                </Label>
                <Input
                  id="new-site-name"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="e.g. Kayathar Wind Farm"
                  className="h-9 text-xs rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-site-loc" className="text-xs font-semibold">
                  Location (optional)
                </Label>
                <Input
                  id="new-site-loc"
                  value={newSiteLocation}
                  onChange={(e) => setNewSiteLocation(e.target.value)}
                  placeholder="e.g. Tamil Nadu, IN"
                  className="h-9 text-xs rounded-lg"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={creatingSite}
              >
                {creatingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                Create Facility Site
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Admin privilege. You will automatically be assigned as manager and administrator of the newly created site.
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Admin: Invite Users */}
      {isAdmin && currentSite && (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-primary" /> Invite Team Member to {currentSite.name}
            </h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-semibold">
                  Email Address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@domain.com"
                  className="h-9 text-xs rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member (Log waste records)</SelectItem>
                    <SelectItem value="manager">Manager (Approve disposals)</SelectItem>
                    <SelectItem value="admin">Admin (Manage facility & users)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={inviting}
              >
                {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send Access Invitation
              </Button>
            </form>

            <div className="border-t border-border/60 pt-3">
              <h4 className="text-xs font-semibold mb-2 text-foreground">
                Site Members ({members.length})
              </h4>
              <ul className="space-y-2 text-xs divide-y divide-border/40">
                {members.map((m) => (
                  <li key={m.user_id} className="flex justify-between items-center gap-2 pt-1.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{m.email ?? m.full_name}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 capitalize text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">
                      {m.roles.join(", ") || "member"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Export */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Download className="h-4 w-4 text-primary" /> Full Raw Dataset Export
          </h3>
          <p className="text-xs text-muted-foreground">
            Download the complete inventory archive for the active facility as a standardized CSV file for backup and spreadsheet analysis.
          </p>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 h-9 text-xs font-semibold rounded-lg shadow-xs"
            onClick={handleExport}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export All Records as CSV
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              WasteBuddy Enterprise PWA v2.0
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-site, role-based hazardous and solid waste compliance tracking system tailored for industrial wind-turbine maintenance under Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016. Statutory on-site storage limit: 90 days.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  User,
  Users,
  Plus,
  ChevronRight,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";

interface Props {
  entries: WasteEntry[];
  onNavigateToAdmin?: () => void;
}

interface SiteMember {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: string[];
}

export default function SettingsTab({ entries, onNavigateToAdmin }: Props) {
  const { user, signOut } = useAuth();
  const { currentSite, isAdmin, sites, refresh, setCurrentSite } = useSite();
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteLocation, setNewSiteLocation] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [showAddSite, setShowAddSite] = useState(false);

  const loadMembers = async () => {
    if (!currentSite?.id) return;
    try {
      const [{ data: ms }, { data: rs }] = await Promise.all([
        supabase.from("user_sites").select("user_id").eq("site_id", currentSite.id),
        supabase.from("user_roles").select("user_id, role").eq("site_id", currentSite.id),
      ]);
      const userIds = Array.from(
        new Set([...(ms ?? []).map((m: any) => m.user_id), ...(rs ?? []).map((r: any) => r.user_id)])
      );
      let profMap: Record<string, { email: string | null; full_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("id, email, full_name").in("id", userIds);
        (ps ?? []).forEach((p: any) => {
          profMap[p.id] = { email: p.email, full_name: p.full_name };
        });
      }
      const rolesByUser: Record<string, string[]> = {};
      (rs ?? []).forEach((r: any) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
      });
      setMembers(
        userIds.map((uid) => ({
          user_id: uid,
          email: profMap[uid]?.email ?? null,
          full_name: profMap[uid]?.full_name ?? null,
          roles: rolesByUser[uid] ?? [],
        }))
      );
    } catch (err) {
      console.error("Failed to load facility members:", err);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [currentSite?.id]);

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
    setShowAddSite(false);
    await refresh();
    if (data) setCurrentSite({ id: data.id, name: data.name, location: data.location });
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* ── User Profile & Facility Header Banner ── */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/20">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate">{user?.email}</h3>
                  {isAdmin && (
                    <Badge variant="default" className="text-[10px] uppercase font-mono">
                      Admin
                    </Badge>
                  )}
                </div>
                {currentSite && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>Active: </span>
                    <strong className="text-foreground">{currentSite.name}</strong>
                    {currentSite.location && <span className="text-[11px] font-mono">({currentSite.location})</span>}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10 rounded-lg self-start sm:self-auto shrink-0"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Admin Portal Access Card (Mobile & Desktop) ── */}
      {isAdmin && onNavigateToAdmin && (
        <Card className="border-primary/40 bg-primary/5 shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">Enterprise Administration</h3>
                  <Badge variant="default" className="text-[9px] uppercase font-mono bg-primary">
                    Admin
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage user accounts, roles, site permissions, and disposal batch approvals.
                </p>
              </div>
            </div>

            <Button
              onClick={onNavigateToAdmin}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs rounded-lg shrink-0 self-stretch sm:self-auto"
            >
              <Shield className="h-4 w-4" />
              <span>Open Admin Portal</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Grouped Section 1: Facility Sites & Workspaces ── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Authorized Facilities ({sites.length})
              </h3>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary/90 gap-1 px-2"
                onClick={() => setShowAddSite(!showAddSite)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{showAddSite ? "Cancel" : "Add Facility"}</span>
              </Button>
            )}
          </div>

          {/* Site List */}
          <div className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
            {sites.map((s) => {
              const isActive = s.id === currentSite?.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer",
                    isActive ? "bg-primary/5" : "hover:bg-muted/40"
                  )}
                  onClick={() => setCurrentSite({ id: s.id, name: s.name, location: s.location })}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        isActive ? "bg-emerald-600 ring-2 ring-emerald-600/30" : "bg-muted-foreground/30"
                      )}
                    />
                    <span className={cn("truncate", isActive ? "font-bold text-foreground" : "text-muted-foreground")}>
                      {s.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  {s.location && (
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {s.location}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Site Inline Drawer */}
          {showAddSite && isAdmin && (
            <form onSubmit={handleCreateSite} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3 pt-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" /> Register New Facility Site
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="new-site-name" className="text-[11px] font-semibold">
                    Facility Name
                  </Label>
                  <Input
                    id="new-site-name"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="e.g. Kayathar Wind Farm - Phase 1"
                    className="h-8 text-xs rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-site-loc" className="text-[11px] font-semibold">
                    Geographic Region
                  </Label>
                  <Input
                    id="new-site-loc"
                    value={newSiteLocation}
                    onChange={(e) => setNewSiteLocation(e.target.value)}
                    placeholder="e.g. Tamil Nadu, IN"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                disabled={creatingSite}
              >
                {creatingSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                Confirm & Create Facility
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Grouped Section 2: Facility Team Roster ── */}
      {currentSite && (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Facility Operators on {currentSite.name} ({members.length})</span>
                </h3>
              </div>
              {isAdmin && onNavigateToAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-2.5 rounded-lg shadow-2xs font-medium text-foreground hover:bg-muted"
                  onClick={onNavigateToAdmin}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Manage in Admin</span>
                </Button>
              )}
            </div>

            {/* Member List */}
            {members.length === 0 ? (
              <EmptyState
                key="empty-members"
                icon={Users}
                title="No Members Assigned"
                description="No operator accounts are assigned to this facility."
                compact
              />
            ) : (
              <div key="members-list" className="divide-y divide-border/60 text-xs rounded-lg border border-border/60 overflow-hidden bg-background">
                {members.map((m) => (
                  <div key={m.user_id} className="p-2.5 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                        <span>{m.email?.charAt(0).toUpperCase() ?? "U"}</span>
                      </div>
                      <p className="truncate font-medium text-foreground">{m.email ?? m.full_name}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 capitalize text-[10px] font-mono bg-muted/80 px-2 py-0.5 rounded border border-border/50">
                      {m.roles.join(", ") || "member"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Grouped Section 3: Data Management ── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data Management & Backup
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
            <div>
              <p className="text-xs font-semibold text-foreground">Facility Raw Dataset (CSV)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Export all historical waste generations, location tags, and manifest linkages as a spreadsheet.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 rounded-lg shrink-0 shadow-2xs"
              onClick={handleExport}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Grouped Section 4: Regulatory Standard & App Info ── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Compliance Standard & System Info
            </h3>
          </div>
          <div className="text-xs text-muted-foreground space-y-1.5 pt-1">
            <p>
              <strong className="text-foreground">Governing Regulation:</strong> Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 (HOWM).
            </p>
            <p>
              <strong className="text-foreground">Statutory Storage Threshold:</strong> 90 calendar days on-site maximum storage window.
            </p>
            <p>
              <strong className="text-foreground">Platform Engine:</strong> Waste<span className="text-primary font-semibold">Buddy</span> Enterprise PWA v2.0 (Offline-capable, role-based).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

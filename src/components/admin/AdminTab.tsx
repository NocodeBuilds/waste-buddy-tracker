import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Users,
  Building2,
  FileText,
  History,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import UserManagementView from "./UserManagementView";
import FacilitiesManagementView from "./FacilitiesManagementView";
import RecordsOversightView from "./RecordsOversightView";
import AuditTrailView from "./AuditTrailView";

interface AdminTabProps {
  initialSubTab?: "users" | "sites" | "records" | "audit";
}

export default function AdminTab({ initialSubTab = "users" }: AdminTabProps) {
  const { currentSite, sites, isAdmin: siteIsAdmin, refresh } = useSite();
  const { user, isAdmin: isAuthAdmin, loading: authLoading } = useAuth();
  const isAdmin = siteIsAdmin || isAuthAdmin;

  // Wait for auth session to load before deciding — isAdmin is derived from
  // session metadata or site membership which is loading
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
        <p className="text-sm">Verifying administrator access…</p>
      </div>
    );
  }

  // Defense-in-depth: deny non-admins even if parent render guard is bypassed
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
        <Shield className="h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">Unauthorized</p>
        <p className="text-xs">You need admin privileges to access this area.</p>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<"users" | "sites" | "records" | "audit">(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2">
        <div className="grid grid-cols-4 sm:flex p-1 bg-muted/70 rounded-xl gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-1.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 shrink-0",
              activeTab === "users"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="sm:hidden">Team</span>
            <span className="hidden sm:inline">Team & Access</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sites")}
            className={cn(
              "px-1.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 shrink-0",
              activeTab === "sites"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="sm:hidden">Facilities</span>
            <span className="hidden sm:inline">Facilities & Tags</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("records")}
            className={cn(
              "px-1.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 shrink-0",
              activeTab === "records"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" />
            <span className="sm:hidden">Records</span>
            <span className="hidden sm:inline">Records Oversight</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "px-1.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 sm:gap-1.5 shrink-0",
              activeTab === "audit"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5 text-emerald-600" />
            <span className="sm:hidden">Audit</span>
            <span className="hidden sm:inline">Audit Trail</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{currentSite.name}</span>
        </div>
      </div>

      {/* ────────────────────────── TAB 1: USERS & ACCESS ────────────────────────── */}
      {activeTab === "users" && (
        <UserManagementView siteId={currentSite.id} siteName={currentSite.name} callerId={user?.id ?? ""} />
      )}

      {/* ────────────────────────── TAB 2: SITES & LOCATION TAGS ────────────────────────── */}
      {activeTab === "sites" && (
        <FacilitiesManagementView sites={sites} onChanged={refresh} />
      )}

      {/* ────────────────────────── TAB 3: RECORDS OVERSIGHT ────────────────────────── */}
      {activeTab === "records" && (
        <RecordsOversightView siteId={currentSite.id} />
      )}

      {/* ────────────────────────── TAB 4: AUDIT LOG ────────────────────────── */}
      {activeTab === "audit" && (
        <AuditTrailView />
      )}
    </div>
  );
}

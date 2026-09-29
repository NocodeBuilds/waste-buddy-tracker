import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Users,
  Building2,
  FileText,
  History,
  AlertCircle,
} from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import UserManagementView from "./UserManagementView";
import FacilitiesManagementView from "./FacilitiesManagementView";
import RecordsOversightView from "./RecordsOversightView";
import AuditTrailView from "./AuditTrailView";

export default function AdminTab() {
  const { currentSite, sites, isAdmin, refresh } = useSite();
  const { user } = useAuth();
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

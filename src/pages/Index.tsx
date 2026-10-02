import { useMemo, useState } from "react";
import { useWasteEntries } from "@/hooks/useWasteEntries";
import { useSite } from "@/contexts/SiteContext";
import WasteEntryForm from "@/components/inventory/WasteEntryForm";
import FuturisticDashboard from "@/components/dashboard/FuturisticDashboard";
import WasteInventoryTable from "@/components/inventory/WasteInventoryTable";
import AlertsPanel from "@/components/common/AlertsPanel";
import AnalyticsTab from "@/components/analytics/AnalyticsTab";
import SettingsTab from "@/components/settings/SettingsTab";
import AdminTab from "@/components/admin/AdminTab";
import RequestSiteAccess from "@/components/auth/RequestSiteAccess";
import BottomNav, { TabId } from "@/components/layout/BottomNav";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import EditWasteDialog from "@/components/inventory/EditWasteDialog";
import OfflineBanner from "@/components/layout/OfflineBanner";
import { WasteEntry, isEntryOverdue, isEntryWarning } from "@/lib/wasteTypes";

import SiteSwitcher from "@/components/layout/SiteSwitcher";
import { Bell, Home, List, BarChart3, Settings, Shield, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TAB_CONFIG: Record<TabId, { title: string; subtitle: string; icon: typeof Home }> = {
  home: {
    title: "Dashboard Overview",
    subtitle: "Real-time waste generation and 90-day statutory tracking",
    icon: Home,
  },
  inventory: {
    title: "Waste Inventory & Records",
    subtitle: "Active storage logs, piece counts, and disposal manifest history",
    icon: List,
  },
  analytics: {
    title: "Analytics & Compliance",
    subtitle: "Generation trends, category breakdowns, and audit readiness",
    icon: BarChart3,
  },
  settings: {
    title: "Facility & Team Settings",
    subtitle: "Authorized facilities, team roster, and raw dataset export",
    icon: Settings,
  },
  admin: {
    title: "Enterprise Administration",
    subtitle: "User access control, disposal batch oversight, and audit logs",
    icon: Shield,
  },
};

const Index = () => {
  const { currentSite, sites, loading: siteLoading, isAdmin, refresh } = useSite();
  const { entries, batches, isLoading, addEntry, updateEntry, deleteEntry, createDisposalBatch, approveDisposalBatch } = useWasteEntries();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WasteEntry | null>(null);

  const overdueCount = useMemo(
    () => entries.filter((e) => isEntryOverdue(e)).length,
    [entries],
  );

  const warningCount = useMemo(
    () => entries.filter((e) => isEntryWarning(e)).length,
    [entries],
  );

  const alertCount = overdueCount + warningCount;

  // No site assigned → show request-access flow
  if (!siteLoading && sites.length === 0) {
    return <RequestSiteAccess onApproved={refresh} />;
  }

  const currentTab = TAB_CONFIG[activeTab] || TAB_CONFIG.home;
  const ActiveTabIcon = currentTab.icon;

  return (
    <div className="h-screen h-[100dvh] bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left Sidebar (Desktop Only: lg and above) ── */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogWaste={() => setDrawerOpen(true)}
        isAdmin={isAdmin}
        overdueCount={overdueCount}
      />

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Modern Fixed Top Header (Non-scrolling on Mobile and Desktop) */}
        <header className="sticky top-0 shrink-0 z-20 w-full border-b border-border/80 bg-card/90 backdrop-blur-md safe-area-top">
          <div className="w-full px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
            {/* Desktop View Header (Left side of top bar on desktop) */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <ActiveTabIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">
                  {currentTab.title}
                </h1>
                <p className="text-[11px] text-muted-foreground mt-1 leading-none truncate">
                  {currentTab.subtitle}
                </p>
              </div>
            </div>

            {/* Mobile Brand Mark (Left side of top bar on mobile only) */}
            <div className="flex lg:hidden items-center gap-2.5 shrink-0">
              <img
                src="/icons/icon-192x192.png"
                alt="WasteBuddy"
                className="h-8 w-8 rounded-lg shadow-xs object-cover border border-primary/20 shrink-0"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Waste<span className="text-primary font-bold">Buddy</span>
                </span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              <SiteSwitcher />

              {/* Notification Bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    {alertCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center px-1 shadow-xs ring-2 ring-card">
                        {alertCount > 9 ? "9+" : alertCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-80 sm:w-96 p-0 border-none shadow-none">
                  <AlertsPanel entries={entries} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* Offline Status & Sync Banner */}
        <OfflineBanner />

        {/* Main content - Scrollable */}
        <main className="flex-1 overflow-y-auto min-h-0 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8 space-y-4 overscroll-y-contain">
          {isLoading || siteLoading ? (
            <div className="space-y-4">
              {/* Skeleton header */}
              <div className="flex items-center justify-between gap-2">
                <div className="h-7 w-40 bg-muted/60 rounded-md animate-pulse" />
                <div className="h-8 w-24 bg-muted/60 rounded-md animate-pulse" />
              </div>
              {/* Skeleton stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="h-3 w-16 bg-muted/60 rounded animate-pulse" />
                    <div className="h-6 w-12 bg-muted/40 rounded animate-pulse" />
                  </div>
                ))}
              </div>
              {/* Skeleton chart area */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
                <div className="h-[200px] bg-muted/30 rounded-md animate-pulse" />
              </div>
              {/* Skeleton table */}
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="h-4 w-36 bg-muted/60 rounded animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 bg-muted/30 rounded-md animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "home" && (
                <FuturisticDashboard
                  entries={entries}
                  onLogWaste={() => setDrawerOpen(true)}
                />
              )}
              {activeTab === "inventory" && (
                <WasteInventoryTable
                  entries={entries}
                  batches={batches}
                  onDelete={(id) => deleteEntry.mutateAsync({ id, siteId: currentSite?.id ?? "" })}
                  onEdit={(e) => setEditEntry(e)}
                  onCreateDisposal={(p) => createDisposalBatch.mutateAsync({ ...p, siteId: currentSite?.id ?? "" })}
                  onApproveDisposal={(id) => approveDisposalBatch.mutateAsync({ batchId: id, action: "approve", siteId: currentSite?.id ?? "" })}
                  onRejectDisposal={(id, reason) => approveDisposalBatch.mutateAsync({ batchId: id, action: "reject", reason, siteId: currentSite?.id ?? "" })}
                />
              )}
              {activeTab === "analytics" && <AnalyticsTab entries={entries} batches={batches} />}
              {activeTab === "settings" && (
                <SettingsTab entries={entries} onNavigateToAdmin={() => setActiveTab("admin")} />
              )}
              {activeTab === "admin" && <AdminTab />}
            </>
          )}
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
      <div className="lg:hidden">
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddClick={() => setDrawerOpen(true)}
          isAdmin={isAdmin}
          overdueCount={overdueCount}
        />
      </div>

      <EditWasteDialog
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={async (p) => {
          const { id, ...updates } = p;
          await updateEntry.mutateAsync({ id, siteId: currentSite?.id ?? "", updates });
        }}
      />

      {/* Waste Entry Dialog */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Waste Generation</DialogTitle>
            <DialogDescription>Record new waste from maintenance activity</DialogDescription>
          </DialogHeader>
          <WasteEntryForm
            onAdd={async (entries) => {
              for (const entry of entries) {
                await addEntry.mutateAsync(entry);
              }
            }}
            onClose={() => setDrawerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

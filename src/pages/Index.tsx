import { useMemo, useState } from "react";
import { useWasteEntries } from "@/hooks/useWasteEntries";
import { useSite } from "@/contexts/SiteContext";
import WasteEntryForm from "@/components/WasteEntryForm";
import FuturisticDashboard from "@/components/FuturisticDashboard";
import WasteInventoryTable from "@/components/WasteInventoryTable";
import AlertsPanel from "@/components/AlertsPanel";
import AnalyticsTab from "@/components/AnalyticsTab";
import SettingsTab from "@/components/SettingsTab";
import AdminTab from "@/components/AdminTab";
import RequestSiteAccess from "@/components/RequestSiteAccess";
import BottomNav, { TabId } from "@/components/BottomNav";
import EditWasteDialog from "@/components/EditWasteDialog";
import OfflineBanner from "@/components/OfflineBanner";
import { WasteEntry, DISPOSAL_LIMIT_DAYS, getDaysStored, isDisposed, isEntryOverdue, isEntryWarning } from "@/lib/wasteTypes";

import SiteSwitcher from "@/components/SiteSwitcher";
import { Loader2, Bell, Home, List, BarChart3, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Unified Modern Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/90 backdrop-blur-md">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-14 flex items-center justify-between gap-3">
          {/* Brand mark */}
          <div className="flex items-center gap-2.5 shrink-0">
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

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
            {[
              { id: "home" as TabId, label: "Dashboard", icon: Home },
              { id: "inventory" as TabId, label: "Inventory", icon: List },
              { id: "analytics" as TabId, label: "Analytics", icon: BarChart3 },
              { id: "settings" as TabId, label: "Settings", icon: Settings },
              ...(isAdmin ? [{ id: "admin" as TabId, label: "Admin", icon: Shield }] : []),
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all select-none",
                    isActive
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === "inventory" && overdueCount > 0 && (
                    <span className="ml-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {overdueCount > 99 ? "99+" : overdueCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Header Actions */}
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

      {/* Main content */}
      <main className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 pb-24 lg:pb-8 space-y-4">
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
            {activeTab === "settings" && <SettingsTab entries={entries} />}
            {activeTab === "admin" && <AdminTab />}
          </>
        )}
      </main>

      {/* Bottom Navigation (mobile only) */}
      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setDrawerOpen(true)} isAdmin={isAdmin} overdueCount={overdueCount} />
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

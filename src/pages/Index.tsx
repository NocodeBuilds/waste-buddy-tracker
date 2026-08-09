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
import { WasteEntry, DISPOSAL_LIMIT_DAYS, getDaysStored, isDisposed } from "@/lib/wasteTypes";

import SiteSwitcher from "@/components/SiteSwitcher";
import { Leaf, Loader2, Bell, Home, List, BarChart3, Settings, Plus, Shield } from "lucide-react";
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
    () => entries.filter((e) => !isDisposed(e) && getDaysStored(e.generated_date) >= DISPOSAL_LIMIT_DAYS).length,
    [entries],
  );

  const warningCount = useMemo(
    () => entries.filter((e) => {
      if (isDisposed(e)) return false;
      const d = getDaysStored(e.generated_date);
      return d >= 70 && d < DISPOSAL_LIMIT_DAYS;
    }).length,
    [entries],
  );

  const alertCount = overdueCount + warningCount;

  // No site assigned → show request-access flow
  if (!siteLoading && sites.length === 0) {
    return <RequestSiteAccess onApproved={refresh} />;
  }

  return (
    <div className="min-h-screen bg-background pt-[52px] lg:pt-[96px]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-primary text-primary-foreground border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="bg-accent rounded-lg p-1.5">
            <Leaf className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-tight truncate">WasteBuddy</h1>
          </div>
          <SiteSwitcher />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10">
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-overdue text-[9px] font-bold text-white flex items-center justify-center leading-none">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-80 max-h-[70vh] overflow-y-auto p-0">
              <AlertsPanel entries={entries} />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Desktop tab bar (hidden on mobile) */}
      <nav className="hidden lg:flex fixed top-[52px] left-0 right-0 z-30 items-center gap-1 border-b bg-card px-4 max-w-7xl mx-auto">
        {[
          { id: "home" as TabId, label: "Home", icon: Home },
          { id: "inventory" as TabId, label: "Inventory", icon: List },
          { id: "analytics" as TabId, label: "Analytics", icon: BarChart3 },
          { id: "settings" as TabId, label: "Settings", icon: Settings },
          ...(isAdmin ? [{ id: "admin" as TabId, label: "Admin", icon: Shield }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button onClick={() => setDrawerOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Log Entry
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <main className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 pb-20 sm:pb-4 space-y-3 sm:space-y-4 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <>
                <FuturisticDashboard entries={entries} />
              </>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>Log Waste Generation</DialogTitle>
            <DialogDescription>Record new waste from maintenance activity</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <WasteEntryForm
              onAdd={async (entries) => {
                for (const entry of entries) {
                  await addEntry.mutateAsync(entry);
                }
              }}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

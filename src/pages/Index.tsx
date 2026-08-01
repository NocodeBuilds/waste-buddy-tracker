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
import { Leaf, ArrowLeft, Loader2, Bell } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { currentSite, sites, loading: siteLoading, isAdmin, refresh } = useSite();
  const { signOut } = useAuth();
  const { entries, batches, isLoading, addEntry, updateEntry, deleteEntry, createDisposalBatch } = useWasteEntries();
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="bg-accent rounded-lg p-1.5">
            <Leaf className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">Waste Tracker</h1>
            <p className="text-[10px] text-primary-foreground/70">Site Waste Management</p>
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

      <main className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 max-w-2xl mx-auto">
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
                onDelete={(id) => deleteEntry.mutateAsync(id)}
                onEdit={(e) => setEditEntry(e)}
                onCreateDisposal={(p) => createDisposalBatch.mutateAsync(p)}
              />
            )}
            {activeTab === "analytics" && <AnalyticsTab entries={entries} batches={batches} />}
            {activeTab === "settings" && <SettingsTab entries={entries} />}
            {activeTab === "admin" && <AdminTab />}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setDrawerOpen(true)} isAdmin={isAdmin} overdueCount={overdueCount} />

      <EditWasteDialog
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={(p) => updateEntry.mutateAsync(p)}
      />


      {/* Waste Entry Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center gap-2">
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </DrawerClose>
            <div className="flex-1 text-left">
              <DrawerTitle>Log Waste Generation</DrawerTitle>
              <DrawerDescription>Record new waste from maintenance activity</DrawerDescription>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <WasteEntryForm
              onAdd={(entry) => addEntry.mutateAsync(entry)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Index;

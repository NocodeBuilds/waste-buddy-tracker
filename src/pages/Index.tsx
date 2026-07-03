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
import { Leaf, ArrowLeft, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
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
            <h1 className="text-base font-bold tracking-tight truncate">Hazardous Waste Tracker</h1>
            <p className="text-[10px] text-primary-foreground/70">Wind Turbine Maintenance — Waste Management</p>
          </div>
          <SiteSwitcher />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <>
                <AlertsPanel entries={entries} />
                <FuturisticDashboard entries={entries} />
              </>
            )}
            {activeTab === "inventory" && (
              <WasteInventoryTable
                entries={entries}
                batches={batches}
                onDelete={(id) => deleteEntry.mutateAsync(id)}
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
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setDrawerOpen(true)} isAdmin={isAdmin} />


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

import { useState } from "react";
import { useWasteEntries } from "@/hooks/useWasteEntries";
import { useSite } from "@/contexts/SiteContext";
import WasteEntryForm from "@/components/WasteEntryForm";
import DashboardStats from "@/components/DashboardStats";
import WasteInventoryTable from "@/components/WasteInventoryTable";
import AlertsPanel from "@/components/AlertsPanel";
import AnalyticsTab from "@/components/AnalyticsTab";
import SettingsTab from "@/components/SettingsTab";
import BottomNav, { TabId } from "@/components/BottomNav";
import SiteSwitcher from "@/components/SiteSwitcher";
import { Leaf, ArrowLeft, Loader2, Building2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { currentSite, sites, loading: siteLoading } = useSite();
  const { signOut } = useAuth();
  const { entries, batches, isLoading, addEntry, deleteEntry, createDisposalBatch } = useWasteEntries();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // No site assigned
  if (!siteLoading && sites.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-bold">No site assigned</h2>
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to any site yet. Please contact your administrator.
            </p>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
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
            <p className="text-[10px] text-primary-foreground/70">WTG Maintenance — Waste Management</p>
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
                <DashboardStats entries={entries} />
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
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setDrawerOpen(true)} />

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

import { useState } from "react";
import { useWasteStore } from "@/hooks/useWasteStore";
import WasteEntryForm from "@/components/WasteEntryForm";
import DashboardStats from "@/components/DashboardStats";
import WasteInventoryTable from "@/components/WasteInventoryTable";
import AlertsPanel from "@/components/AlertsPanel";
import AnalyticsTab from "@/components/AnalyticsTab";
import SettingsTab from "@/components/SettingsTab";
import BottomNav, { TabId } from "@/components/BottomNav";
import { AlertTriangle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

const Index = () => {
  const { entries, addEntry, disposeEntry, deleteEntry } = useWasteStore();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-primary text-primary-foreground border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="bg-accent rounded-lg p-1.5">
            <AlertTriangle className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Hazardous Waste Tracker</h1>
            <p className="text-[10px] text-primary-foreground/70">WTG Maintenance — Waste Management</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {activeTab === "home" && (
          <>
            <AlertsPanel entries={entries} />
            <DashboardStats entries={entries} />
          </>
        )}
        {activeTab === "inventory" && (
          <WasteInventoryTable entries={entries} onDispose={disposeEntry} onDelete={deleteEntry} />
        )}
        {activeTab === "analytics" && <AnalyticsTab entries={entries} />}
        {activeTab === "settings" && <SettingsTab entries={entries} />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onAddClick={() => setDrawerOpen(true)} />

      {/* Waste Entry Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Log Waste Generation</DrawerTitle>
            <DrawerDescription>Record new waste from maintenance activity</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <WasteEntryForm onAdd={addEntry} onClose={() => setDrawerOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Index;

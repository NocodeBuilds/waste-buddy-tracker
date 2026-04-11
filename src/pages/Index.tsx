import { useWasteStore } from "@/hooks/useWasteStore";
import WasteEntryForm from "@/components/WasteEntryForm";
import DashboardStats from "@/components/DashboardStats";
import WasteInventoryTable from "@/components/WasteInventoryTable";
import AlertsPanel from "@/components/AlertsPanel";
import { AlertTriangle } from "lucide-react";

const Index = () => {
  const { entries, addEntry, disposeEntry, deleteEntry } = useWasteStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-accent rounded-lg p-2">
            <AlertTriangle className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Hazardous Waste Tracker</h1>
            <p className="text-xs text-primary-foreground/70">WTG Maintenance — Daily Waste Management & Compliance</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <AlertsPanel entries={entries} />
        <DashboardStats entries={entries} />
        <WasteEntryForm onAdd={addEntry} />
        <WasteInventoryTable entries={entries} onDispose={disposeEntry} onDelete={deleteEntry} />
      </main>
    </div>
  );
};

export default Index;

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Download } from "lucide-react";
import { WasteEntry } from "@/lib/wasteTypes";
import { toast } from "sonner";

interface Props {
  entries: WasteEntry[];
}

export default function SettingsTab({ entries }: Props) {
  const handleExport = () => {
    const csv = [
      "WTG,Waste Type,Quantity,Activity,Generated,Disposed,Disposed Date,Notes",
      ...entries.map((e) =>
        `${e.wtgId},${e.wasteTypeId},${e.quantity},${e.activityType},${e.generatedDate},${e.disposed},${e.disposedDate || ""},${e.notes || ""}`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waste-data-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear ALL waste data? This cannot be undone.")) {
      localStorage.removeItem("hazwaste-entries");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Settings className="h-5 w-5 text-accent" /> Settings
      </h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Data Management</h3>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export Data as CSV
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 text-overdue border-overdue/30 hover:bg-overdue/10" onClick={handleClearAll}>
            <Trash2 className="h-4 w-4" /> Clear All Data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-1">About</h3>
          <p className="text-xs text-muted-foreground">
            Hazardous Waste Tracker v1.0 — Tracks waste generation from WTG maintenance activities. Disposal limit: 90 days from date of generation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

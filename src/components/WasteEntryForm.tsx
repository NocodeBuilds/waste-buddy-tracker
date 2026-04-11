import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WASTE_TYPES, WasteEntry } from "@/lib/wasteTypes";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onAdd: (entry: Omit<WasteEntry, "id" | "disposed">) => void;
}

export default function WasteEntryForm({ onAdd }: Props) {
  const [wtgId, setWtgId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [generatedDate, setGeneratedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activityType, setActivityType] = useState<"breakdown" | "preventive">("preventive");
  const [notes, setNotes] = useState("");

  const selectedWaste = WASTE_TYPES.find((w) => w.id === wasteTypeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wtgId || !wasteTypeId || !quantity || Number(quantity) <= 0) {
      toast.error("Please fill all required fields with valid values");
      return;
    }
    onAdd({
      wtgId: wtgId.toUpperCase(),
      wasteTypeId,
      quantity: Number(quantity),
      generatedDate,
      activityType,
      notes: notes || undefined,
    });
    toast.success("Waste entry recorded successfully");
    setWtgId("");
    setWasteTypeId("");
    setQuantity("");
    setNotes("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5 text-accent" />
          Log Waste Generation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wtg">WTG ID *</Label>
            <Input id="wtg" placeholder="e.g. WTG-01" value={wtgId} onChange={(e) => setWtgId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Activity Type *</Label>
            <Select value={activityType} onValueChange={(v) => setActivityType(v as "breakdown" | "preventive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="breakdown">Breakdown Maintenance</SelectItem>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Waste Type *</Label>
            <Select value={wasteTypeId} onValueChange={setWasteTypeId}>
              <SelectTrigger><SelectValue placeholder="Select waste type" /></SelectTrigger>
              <SelectContent>
                {WASTE_TYPES.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity ({selectedWaste?.unit || "unit"}) *</Label>
            <Input id="qty" type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date Generated *</Label>
            <Input id="date" type="date" value={generatedDate} onChange={(e) => setGeneratedDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Record Waste Entry
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { WASTE_TYPES, WasteCategory, WasteEntry, ActivityType } from "@/lib/wasteTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entry: WasteEntry | null;
  onClose: () => void;
  onSave: (params: {
    id: string;
    waste_type_id: string;
    waste_category: WasteCategory;
    quantity: number;
    generated_date: string;
    activity_type: ActivityType;
    location?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}

export default function EditWasteDialog({ entry, onClose, onSave }: Props) {
  const [category, setCategory] = useState<WasteCategory>("hazardous");
  const [typeId, setTypeId] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [activity, setActivity] = useState<ActivityType>("preventive");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setCategory(entry.waste_category);
    setTypeId(entry.waste_type_id);
    setQty(String(entry.quantity));
    setDate(entry.generated_date);
    setActivity(entry.activity_type);
    setLocation(entry.location ?? "");
    setNotes(entry.notes ?? "");
  }, [entry]);

  const types = WASTE_TYPES.filter((w) => w.wasteCategory === category);

  const submit = async () => {
    if (!entry) return;
    const q = parseFloat(qty);
    if (!typeId || !q || !date) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: entry.id,
        waste_type_id: typeId,
        waste_category: category,
        quantity: q,
        generated_date: date,
        activity_type: activity,
        location: location || null,
        notes: notes || null,
      });
      toast.success("Entry updated");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Waste Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                const c = v as WasteCategory;
                setCategory(c);
                if (!WASTE_TYPES.find((w) => w.id === typeId && w.wasteCategory === c)) setTypeId("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hazardous">Hazardous</SelectItem>
                <SelectItem value="non_hazardous">Non-Hazardous</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Waste Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Select waste type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Generated Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <Select value={activity} onValueChange={(v) => setActivity(v as ActivityType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                <SelectItem value="breakdown">Breakdown Maintenance</SelectItem>
                <SelectItem value="5s">5S Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

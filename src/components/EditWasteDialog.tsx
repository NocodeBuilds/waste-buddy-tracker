import { useEffect, useState } from "react";
import { WASTE_TYPES, WasteCategory, WasteEntry, ActivityType, unitLabel } from "@/lib/wasteTypes";
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
    weight_kg: number;
    piece_count?: number | null;
    generated_date: string;
    activity_type: ActivityType;
    location?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}

export default function EditWasteDialog({ entry, onClose, onSave }: Props) {
  const [category, setCategory] = useState<WasteCategory>("hazardous");
  const [typeId, setTypeId] = useState("");
  const [weight, setWeight] = useState("");
  const [pieceCount, setPieceCount] = useState("");
  const [date, setDate] = useState("");
  const [activity, setActivity] = useState<ActivityType>("preventive");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setCategory(entry.waste_category);
    setTypeId(entry.waste_type_id);
    setWeight(String(entry.weight_kg ?? entry.quantity ?? ""));
    setPieceCount(entry.piece_count != null ? String(entry.piece_count) : "");
    setDate(entry.generated_date);
    setActivity(entry.activity_type);
    setLocation(entry.location ?? "");
    setNotes(entry.notes ?? "");
  }, [entry]);

  const types = WASTE_TYPES.filter((w) => w.wasteCategory === category);
  const selected = WASTE_TYPES.find((w) => w.id === typeId);
  const weightUnit = selected ? unitLabel(selected.measureUnit) : "kg";
  const showCount = !!selected?.countable;

  const submit = async () => {
    if (!entry) return;
    const w = parseFloat(weight);
    if (!typeId || !w || w <= 0 || !date) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: entry.id,
        waste_type_id: typeId,
        waste_category: category,
        weight_kg: w,
        piece_count: showCount && pieceCount ? Number(pieceCount) : null,
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
            <Label className="text-xs">Category</Label>
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
            <Label className="text-xs">Waste Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Select waste type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={`grid gap-2 ${showCount ? "grid-cols-3" : "grid-cols-2"}`}>
            {showCount && (
              <div className="space-y-1.5">
                <Label className="text-xs">Count (pcs)</Label>
                <Input type="number" min="1" step="1" value={pieceCount} onChange={(e) => setPieceCount(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Weight ({weightUnit})</Label>
              <Input type="number" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Generated</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Activity</Label>
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
            <Label className="text-xs">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
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

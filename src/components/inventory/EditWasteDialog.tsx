import { useEffect, useState } from "react";
import { WASTE_TYPES, WasteCategory, WasteEntry, ActivityType, unitLabel, clampDateNotFuture, formatDateDDMMYYYY } from "@/lib/wasteTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar as CalendarIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [dateOpen, setDateOpen] = useState(false);
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
    setDate(clampDateNotFuture(entry.generated_date));
    setActivity(entry.activity_type);
    setLocation(entry.location ?? "");
    setNotes(entry.notes ?? "");
  }, [entry]);

  const types = WASTE_TYPES.filter((w) => w.wasteCategory === category);
  const selected = WASTE_TYPES.find((w) => w.id === typeId);
  const weightUnit = selected ? unitLabel(selected.measureUnit) : "kg";
  const showCount = !!selected?.countable;

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return;
    const newDate = format(d, "yyyy-MM-dd");
    setDate(newDate);
    setDateOpen(false);
  };

  const submit = async () => {
    if (!entry) return;
    const w = parseFloat(weight);
    if (!typeId || !w || w <= 0 || !date) {
      toast.error("Please fill all required fields");
      return;
    }
    const safeDate = clampDateNotFuture(date);
    if (safeDate !== date) {
      setDate(safeDate);
    }
    setSaving(true);
    try {
      await onSave({
        id: entry.id,
        waste_type_id: typeId,
        waste_category: category,
        weight_kg: w,
        piece_count: showCount && pieceCount ? Number(pieceCount) : null,
        generated_date: safeDate,
        activity_type: activity,
        location: location || null,
        notes: notes || null,
      });
      toast.success("Waste record updated successfully");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Waste Entry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                const c = v as WasteCategory;
                setCategory(c);
                if (!WASTE_TYPES.find((w) => w.id === typeId && w.wasteCategory === c)) setTypeId("");
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hazardous">Hazardous</SelectItem>
                <SelectItem value="non_hazardous">Non-Hazardous</SelectItem>
                <SelectItem value="e_waste">E-Waste</SelectItem>
                <SelectItem value="other_wastes">Other Wastes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Waste Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue placeholder="Select waste type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`grid gap-2.5 ${showCount ? "grid-cols-3" : "grid-cols-2"}`}>
            {showCount && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Count (pcs)</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={pieceCount}
                  onChange={(e) => setPieceCount(e.target.value)}
                  className="h-9 text-xs rounded-lg font-mono"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Weight ({weightUnit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-9 text-xs rounded-lg font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Generated Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-xs rounded-lg">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {formatDateDDMMYYYY(date)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date ? new Date(date + "T00:00:00") : undefined}
                    onSelect={handleDateSelect}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Activity</Label>
            <Select value={activity} onValueChange={(v) => setActivity(v as ActivityType)}>
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                <SelectItem value="breakdown">Breakdown Maintenance</SelectItem>
                <SelectItem value="5s">5S Activity</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Location / Tag</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 text-xs rounded-lg"
              placeholder="e.g., WTG 04 or Bay 2"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs rounded-lg resize-none"
              placeholder="Technician observations, reasons..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-9 text-xs">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

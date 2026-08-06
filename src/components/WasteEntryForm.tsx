import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Loader2, Camera, Image as ImageIcon, X, CalendarIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { WASTE_TYPES, WasteCategory, unitLabel, getLocalDate } from "@/lib/wasteTypes";
import { useSiteLocations } from "@/hooks/useSiteLocations";

// ── Types ────────────────────────────────────────────────────
interface EntryLineData {
  waste_type_id: string;
  waste_category: WasteCategory;
  weight_kg: string;
  piece_count: string;
}

interface NewEntry {
  waste_type_id: string;
  waste_category: WasteCategory;
  weight_kg: number;
  piece_count?: number | null;
  generated_date: string;
  activity_type: ActivityType;
  location?: string;
  notes?: string;
  photos?: File[];
}

interface Props {
  onAdd: (entries: NewEntry[]) => Promise<void>;
  onClose?: () => void;
}

// ── Constants ────────────────────────────────────────────────
const WASTE_CATEGORIES: { value: WasteCategory; label: string }[] = [
  { value: "hazardous", label: "Hazardous" },
  { value: "non_hazardous", label: "Non-Hazardous" },
  { value: "e_waste", label: "E-waste" },
  { value: "other_wastes", label: "Other Wastes" },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "breakdown", label: "Breakdown" },
  { value: "preventive", label: "Preventive" },
  { value: "5s", label: "5S" },
  { value: "others", label: "Others" },
];

const CATEGORY_LABEL: Record<WasteCategory, string> = {
  hazardous: "Hazardous",
  non_hazardous: "Non-Hazardous",
  e_waste: "E-waste",
  other_wastes: "Other Wastes",
};

const INITIAL_LINE: EntryLineData = {
  waste_type_id: "",
  waste_category: "hazardous",
  weight_kg: "",
  piece_count: "",
};

// ── Compact Line Row ─────────────────────────────────────────
interface LineRowProps {
  data: EntryLineData;
  onChange: (patch: Partial<EntryLineData>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function LineRow({ data, onChange, onRemove, canRemove }: LineRowProps) {
  const wasteTypeOptions = useMemo(
    () => WASTE_TYPES.filter((w) => w.wasteCategory === data.waste_category),
    [data.waste_category]
  );
  const selectedWaste = WASTE_TYPES.find((w) => w.id === data.waste_type_id);
  const showCount = !!selectedWaste?.countable;

  return (
    <div className="flex gap-1.5 items-center py-1.5">
      {/* Category */}
      <Select
        value={data.waste_category}
        onValueChange={(v) => onChange({ waste_category: v as WasteCategory, waste_type_id: "" })}
      >
        <SelectTrigger className="h-9 text-xs w-[100px] shrink-0">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {WASTE_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Waste Type */}
      <Select
        value={data.waste_type_id}
        onValueChange={(v) => onChange({ waste_type_id: v })}
      >
        <SelectTrigger className="h-9 text-xs flex-1 min-w-0">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {wasteTypeOptions.map((w) => (
            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quantity inputs */}
      <div className="flex gap-1 shrink-0">
        {showCount && (
          <Input
            type="number" min="1" step="1" inputMode="numeric"
            value={data.piece_count}
            onChange={(e) => onChange({ piece_count: e.target.value })}
            placeholder="pcs"
            className="h-9 text-xs w-14 no-spinner"
          />
        )}
        <div className="relative">
          <Input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={data.weight_kg}
            onChange={(e) => onChange({ weight_kg: e.target.value })}
            placeholder="0"
            className={`h-9 text-xs pr-7 no-spinner ${showCount ? "w-[60px]" : "w-[72px]"}`}
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            {unitLabel(selectedWaste?.measureUnit ?? "kg")}
          </span>
        </div>
      </div>

      {/* Remove */}
      {canRemove && (
        <Button
          type="button" variant="ghost" size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────
export default function WasteEntryForm({ onAdd, onClose }: Props) {
  const { data: locations = [], isLoading: locLoading } = useSiteLocations();

  const [generatedDate, setGeneratedDate] = useState(getLocalDate());
  const [location, setLocation] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("preventive");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lines, setLines] = useState<EntryLineData[]>(() => [INITIAL_LINE]);

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<NewEntry[]>([]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Revoke blob URLs
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [photos]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setPhotos((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { ...INITIAL_LINE, waste_category: prev[0]?.waste_category ?? "hazardous" }]);
  }, []);

  const removeLine = useCallback((idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<EntryLineData>) => {
    setLines((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }, []);

  const validationError = useMemo(() => {
    if (!location) return "Please select a location";
    for (const line of lines) {
      if (!line.waste_type_id) return "Select a waste type for each line";
      const w = Number(line.weight_kg);
      if (!line.weight_kg || w <= 0) return "Enter a valid weight for each line";
    }
    return null;
  }, [location, lines]);

  // Build entries and show confirmation dialog
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validationError;
    if (err) { toast.error(err); return; }

    const entries: NewEntry[] = lines.map((line) => {
      const selectedWaste = WASTE_TYPES.find((w) => w.id === line.waste_type_id);
      return {
        waste_type_id: line.waste_type_id,
        waste_category: line.waste_category,
        weight_kg: Number(line.weight_kg),
        piece_count: selectedWaste?.countable && line.piece_count ? Number(line.piece_count) : null,
        generated_date: generatedDate,
        activity_type: activityType,
        location,
        notes: notes || undefined,
        photos: photos.length > 0 ? [...photos] : undefined,
      };
    });

    setPendingEntries(entries);
    setConfirmOpen(true);
  };

  // Actually save after user confirms
  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        pendingEntries.map((entry) => onAdd([entry]))
      );
      const failed = results.filter((r) => r.status === "rejected");
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      if (failed.length > 0) {
        const errMsgs = failed.map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown").join("; ");
        toast.error(`${succeeded} saved, ${failed.length} failed: ${errMsgs}`);
        if (succeeded === 0) throw new Error(failed[0].reason?.message || "All entries failed");
      }
      if (succeeded > 0) {
        toast.success(`${succeeded} waste ${succeeded === 1 ? "entry" : "entries"} recorded`);
      }

      // Reset form
      setGeneratedDate(getLocalDate());
      setLines([INITIAL_LINE]);
      setLocation("");
      setActivityType("preventive");
      setNotes("");
      setPhotos([]);
      setPendingEntries([]);
      onClose?.();
    } catch (err: unknown) {
      console.error("[WasteEntryForm] submit error:", err);
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
    setPendingEntries([]);
  };

  const { siteCodes, commonCodes } = useMemo(() => ({
    siteCodes: locations.filter((l) => !l.is_common),
    commonCodes: locations.filter((l) => l.is_common),
  }), [locations]);

  const activityLabel = ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ?? activityType;

  return (
    <form onSubmit={handleReview} className="waste-form space-y-2.5">
      {/* ── Shared row: Date | Location | Activity ── */}
      <div className="grid grid-cols-3 gap-2">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 text-xs justify-start gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{format(new Date(generatedDate + "T00:00:00"), "dd MMM yyyy")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={new Date(generatedDate + "T00:00:00")} onSelect={(d) => { if (d) { setGeneratedDate(format(d, "yyyy-MM-dd")); setDateOpen(false); }}} disabled={(date) => date > new Date()} />
          </PopoverContent>
        </Popover>

        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={locLoading ? "..." : "Location"} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {siteCodes.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">Site codes</SelectLabel>
                {siteCodes.map((l) => (
                  <SelectItem key={l.id} value={l.code} className="text-xs">{l.code}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {commonCodes.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">Common</SelectLabel>
                {commonCodes.map((l) => (
                  <SelectItem key={l.id} value={l.code} className="text-xs">{l.code}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((a) => (
              <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Section label ── */}
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Waste Types
      </Label>

      {/* ── Waste type lines ── */}
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <LineRow
            key={idx}
            data={line}
            onChange={(patch) => updateLine(idx, patch)}
            onRemove={() => removeLine(idx)}
            canRemove={lines.length > 1}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-foreground w-full"
        onClick={addLine}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add another waste type
      </Button>

      {/* ── Notes ── */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Notes (optional)
        </Label>
        <Textarea
          placeholder="Add notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-16 text-xs resize-none"
        />
      </div>

      {/* ── Photo Evidence ── */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Photo Evidence (optional)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="h-3.5 w-3.5" /> Camera
          </Button>
          <Button type="button" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => galleryInputRef.current?.click()}>
            <ImageIcon className="h-3.5 w-3.5" /> Gallery
          </Button>
        </div>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} className="sr-only" aria-hidden="true" tabIndex={-1} />
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="sr-only" aria-hidden="true" tabIndex={-1} />
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((f, idx) => (
              <div key={idx} className="relative rounded overflow-hidden border aspect-square">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 bg-background/90 rounded-full p-0.5 shadow-sm" aria-label="Remove">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <Button type="submit" className="w-full h-10 text-sm font-medium" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        {`Record ${lines.length} Waste ${lines.length === 1 ? "Entry" : "Entries"}`}
      </Button>

      {/* ── Confirmation Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) handleCancelConfirm(); }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Confirm Waste Log</DialogTitle>
            <DialogDescription className="text-xs">
              {format(new Date(generatedDate + "T00:00:00"), "dd MMM yyyy")} · {location} · {activityLabel}
              {notes && <span className="block mt-0.5 text-muted-foreground">Note: {notes}</span>}
              {photos.length > 0 && <span className="block mt-0.5 text-muted-foreground">{photos.length} photo{photos.length > 1 ? "s" : ""} attached</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 my-2">
            {pendingEntries.map((entry, idx) => {
              const wt = WASTE_TYPES.find((w) => w.id === entry.waste_type_id);
              return (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0">
                  <div className="min-w-0 flex-1 mr-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted mr-1.5 shrink-0">
                      {CATEGORY_LABEL[entry.waste_category]}
                    </span>
                    <span className="truncate">{wt?.name ?? entry.waste_type_id}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.piece_count != null && <span className="text-muted-foreground">{entry.piece_count} pcs</span>}
                    <span className="font-medium">{entry.weight_kg} {unitLabel(wt?.measureUnit ?? "kg")}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={handleCancelConfirm} disabled={submitting}>
              Edit
            </Button>
            <Button size="sm" className="h-8 text-xs flex-1" onClick={handleConfirmSave} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
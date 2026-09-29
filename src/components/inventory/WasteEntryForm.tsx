import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Loader2, Camera, X, Calendar as CalendarIcon, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { WASTE_TYPES, WasteCategory, ActivityType, unitLabel, getLocalDate } from "@/lib/wasteTypes";
import { useSiteLocations } from "@/hooks/useSiteLocations";
import { Badge } from "@/components/ui/badge";

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
  { value: "e_waste", label: "E-Waste" },
  { value: "other_wastes", label: "Other Wastes" },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "preventive", label: "Preventive" },
  { value: "breakdown", label: "Breakdown" },
  { value: "5s", label: "5S Activity" },
  { value: "others", label: "Others" },
];

const CATEGORY_LABEL: Record<WasteCategory, string> = {
  hazardous: "Hazardous",
  non_hazardous: "Non-Hazardous",
  e_waste: "E-Waste",
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
    <div className="flex gap-1.5 items-center py-1">
      {/* Category */}
      <Select
        value={data.waste_category}
        onValueChange={(v) => onChange({ waste_category: v as WasteCategory, waste_type_id: "" })}
      >
        <SelectTrigger className="h-9 text-xs w-[110px] shrink-0 rounded-lg">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {WASTE_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Waste Type */}
      <Select
        value={data.waste_type_id}
        onValueChange={(v) => onChange({ waste_type_id: v })}
      >
        <SelectTrigger className="h-9 text-xs flex-1 min-w-0 rounded-lg">
          <SelectValue placeholder="Select waste type" />
        </SelectTrigger>
        <SelectContent>
          {wasteTypeOptions.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quantity inputs */}
      <div className="flex gap-1 shrink-0">
        {showCount && (
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={data.piece_count}
            onChange={(e) => onChange({ piece_count: e.target.value })}
            placeholder="pcs"
            className="h-9 text-xs w-14 rounded-lg font-mono"
          />
        )}
        <div className="relative">
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={data.weight_kg}
            onChange={(e) => onChange({ weight_kg: e.target.value })}
            placeholder="0.0"
            className={`h-9 text-xs pr-7 rounded-lg font-mono ${showCount ? "w-[65px]" : "w-[78px]"}`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-medium">
            {unitLabel(selectedWaste?.measureUnit ?? "kg")}
          </span>
        </div>
      </div>

      {/* Remove */}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
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

  // Revoke blob URLs
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photos]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setPhotos((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { ...INITIAL_LINE, waste_category: prev[0]?.waste_category ?? "hazardous" },
    ]);
  }, []);

  const removeLine = useCallback((idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<EntryLineData>) => {
    setLines((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
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
    if (err) {
      toast.error(err);
      return;
    }

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
        const errMsgs = failed
          .map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown")
          .join("; ");
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

  const { siteCodes, commonCodes } = useMemo(
    () => ({
      siteCodes: locations.filter((l) => !l.is_common),
      commonCodes: locations.filter((l) => l.is_common),
    }),
    [locations]
  );

  const activityLabel =
    ACTIVITY_TYPES.find((a) => a.value === activityType)?.label ?? activityType;

  return (
    <form onSubmit={handleReview} className="waste-form space-y-3">
      {/* ── Shared row: Date | Location | Activity ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">Date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-full text-xs justify-start gap-1.5 px-2.5 rounded-lg">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {format(new Date(generatedDate + "T00:00:00"), "dd MMM yyyy")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(generatedDate + "T00:00:00")}
                onSelect={(d) => {
                  if (d) {
                    setGeneratedDate(format(d, "yyyy-MM-dd"));
                    setDateOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">Location</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="h-9 text-xs rounded-lg">
              <SelectValue placeholder={locLoading ? "..." : "Select location"} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {siteCodes.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Site codes</SelectLabel>
                  {siteCodes.map((l) => (
                    <SelectItem key={l.id} value={l.code} className="text-xs">
                      {l.code}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {commonCodes.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Common</SelectLabel>
                  {commonCodes.map((l) => (
                    <SelectItem key={l.id} value={l.code} className="text-xs">
                      {l.code}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">Activity</Label>
          <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
            <SelectTrigger className="h-9 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value} className="text-xs">
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Waste Types ({lines.length})
          </Label>
        </div>

        {/* ── Waste type lines ── */}
        <div className="space-y-1.5">
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
          variant="outline"
          size="sm"
          className="h-8 text-xs border-dashed border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 w-full rounded-lg"
          onClick={addLine}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add another waste type
        </Button>
      </div>

      {/* ── Notes ── */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Notes (optional)
        </Label>
        <Textarea
          placeholder="Specific turbine ID, component detail, technician notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-12 text-xs resize-none rounded-lg"
        />
      </div>

      {/* ── Photo Evidence ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Photo Evidence (optional)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </Button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFiles}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {photos.map((f, idx) => (
              <div key={idx} className="relative rounded-lg overflow-hidden border border-border aspect-square">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-background/90 text-foreground hover:text-destructive rounded-full p-1 shadow-xs transition-colors"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <Button
        type="submit"
        className="w-full text-sm font-semibold h-10 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
        disabled={submitting}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        {`Record ${lines.length} Waste ${lines.length === 1 ? "Entry" : "Entries"}`}
      </Button>

      {/* ── Confirmation Dialog ── */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelConfirm();
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirm Waste Entry Log
            </DialogTitle>
            <DialogDescription className="text-xs">
              {format(new Date(generatedDate + "T00:00:00"), "dd MMM yyyy")} · {location} · {activityLabel}
              {notes && <span className="block mt-0.5 text-muted-foreground">Note: {notes}</span>}
              {photos.length > 0 && (
                <span className="block mt-0.5 text-muted-foreground">
                  {photos.length} photo{photos.length > 1 ? "s" : ""} attached
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2 divide-y divide-border/60">
            {pendingEntries.map((entry, idx) => {
              const wt = WASTE_TYPES.find((w) => w.id === entry.waste_type_id);
              return (
                <div key={idx} className="flex items-center justify-between text-xs py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 mr-2">
                    <Badge variant="outline" className="text-[10px] mr-1.5 shrink-0 uppercase font-mono">
                      {CATEGORY_LABEL[entry.waste_category]}
                    </Badge>
                    <span className="font-medium text-foreground truncate">
                      {wt?.name ?? entry.waste_type_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    {entry.piece_count != null && (
                      <span className="text-muted-foreground text-[11px]">{entry.piece_count} pcs ·</span>
                    )}
                    <span className="font-bold text-foreground">
                      {entry.weight_kg} {unitLabel(wt?.measureUnit ?? "kg")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 flex-row justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={handleCancelConfirm}
              disabled={submitting}
            >
              Back to Edit
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={handleConfirmSave}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
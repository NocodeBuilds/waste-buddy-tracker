import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WASTE_TYPES, WasteCategory, ActivityType } from "@/lib/wasteTypes";
import { useSiteLocations } from "@/hooks/useSiteLocations";
import { Plus, Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";

interface NewEntry {
  waste_type_id: string;
  waste_category: WasteCategory;
  quantity: number;
  generated_date: string;
  activity_type: ActivityType;
  location?: string;
  notes?: string;
  photos?: File[];
}

interface Props {
  onAdd: (entry: NewEntry) => Promise<unknown>;
  onClose?: () => void;
}

export default function WasteEntryForm({ onAdd, onClose }: Props) {
  const { data: locations = [], isLoading: locLoading } = useSiteLocations();
  const [wasteCategory, setWasteCategory] = useState<WasteCategory>("hazardous");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [generatedDate, setGeneratedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activityType, setActivityType] = useState<ActivityType>("preventive");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { siteCodes, commonCodes } = useMemo(() => ({
    siteCodes: locations.filter((l) => !l.is_common),
    commonCodes: locations.filter((l) => l.is_common),
  }), [locations]);

  const filteredWasteTypes = useMemo(
    () => WASTE_TYPES.filter((w) => w.wasteCategory === wasteCategory),
    [wasteCategory]
  );

  const selectedWaste = WASTE_TYPES.find((w) => w.id === wasteTypeId);

  const handleCategoryChange = (v: WasteCategory) => {
    setWasteCategory(v);
    setWasteTypeId("");
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteTypeId || !quantity || Number(quantity) <= 0 || !location) {
      toast.error("Please fill all required fields with valid values");
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({
        waste_type_id: wasteTypeId,
        waste_category: wasteCategory,
        quantity: Number(quantity),
        generated_date: generatedDate,
        activity_type: activityType,
        location,
        notes: notes || undefined,
      });
      toast.success("Waste entry recorded");
      setWasteTypeId("");
      setQuantity("");
      setLocation("");
      setNotes("");
      onClose?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Location *</Label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger>
            <SelectValue placeholder={locLoading ? "Loading..." : "Select location"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {siteCodes.length > 0 && (
              <SelectGroup>
                <SelectLabel>Turbine / Site codes</SelectLabel>
                {siteCodes.map((l) => (
                  <SelectItem key={l.id} value={l.code}>{l.code}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {commonCodes.length > 0 && (
              <SelectGroup>
                <SelectLabel>Common areas</SelectLabel>
                {commonCodes.map((l) => (
                  <SelectItem key={l.id} value={l.code}>{l.code}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {locations.length === 0 && !locLoading && (
              <div className="p-2 text-xs text-muted-foreground">
                No locations configured. Ask an admin to add some.
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Waste Category *</Label>
        <Select value={wasteCategory} onValueChange={(v) => handleCategoryChange(v as WasteCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hazardous">Hazardous</SelectItem>
            <SelectItem value="non_hazardous">Non-Hazardous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Activity Type *</Label>
        <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
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
            {filteredWasteTypes.map((w) => (
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
        <Textarea id="notes" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-20" />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        Record Waste Entry
      </Button>
    </form>
  );
}

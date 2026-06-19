export interface WasteType {
  id: string;
  name: string;
  unit: string;
  category: string;
}

export const WASTE_TYPES: WasteType[] = [
  { id: "oil-cotton", name: "Oil/Grease Soaked Cotton Waste", unit: "kg", category: "Solid" },
  { id: "waste-oil", name: "Waste Oil", unit: "litres", category: "Liquid" },
  { id: "waste-grease", name: "Waste Grease", unit: "kg", category: "Semi-Solid" },
  { id: "plastic-waste", name: "Plastic Waste (Contaminated)", unit: "kg", category: "Solid" },
  { id: "hu-oil-filter", name: "HU Oil Filter Waste", unit: "nos", category: "Solid" },
  { id: "gb-oil-filter", name: "GB Oil Filter Waste", unit: "nos", category: "Solid" },
  { id: "carbon-brush", name: "Carbon Brush Waste", unit: "nos", category: "Solid" },
  { id: "oil-filters-misc", name: "Misc Oil Filters", unit: "nos", category: "Solid" },
  { id: "used-batteries", name: "Used Batteries", unit: "nos", category: "Solid" },
  { id: "empty-containers", name: "Empty Chemical Containers", unit: "nos", category: "Solid" },
];

export type WasteCategory = "hazardous" | "non_hazardous";
export type ActivityType = "breakdown" | "preventive";

export interface WasteEntry {
  id: string;
  site_id: string;
  waste_type_id: string;
  waste_category: WasteCategory;
  quantity: number;
  generated_date: string;
  activity_type: ActivityType;
  location?: string | null;
  notes?: string | null;
  disposal_batch_id?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface DisposalBatch {
  id: string;
  site_id: string;
  disposed_date: string;
  disposed_by?: string | null;
  notes?: string | null;
  created_at?: string;
}

export const DISPOSAL_LIMIT_DAYS = 90;

export function getDaysStored(generatedDate: string): number {
  const gen = new Date(generatedDate);
  const now = new Date();
  return Math.floor((now.getTime() - gen.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStatus(entry: WasteEntry): "safe" | "warning" | "overdue" {
  if (entry.disposal_batch_id) return "safe";
  const days = getDaysStored(entry.generated_date);
  if (days >= DISPOSAL_LIMIT_DAYS) return "overdue";
  if (days >= 70) return "warning";
  return "safe";
}

export function isDisposed(entry: WasteEntry): boolean {
  return !!entry.disposal_batch_id;
}

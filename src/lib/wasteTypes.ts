export type WasteCategory = "hazardous" | "non_hazardous" | "e_waste" | "other_wastes";
export type MeasureUnit = "kg" | "litres";

export interface WasteType {
  id: string;
  name: string;
  /** Legacy display unit — kept for backwards compat only. Use `measureUnit` for aggregation. */
  unit: string;
  category: string;
  wasteCategory: WasteCategory;
  /** Unit used for the primary weight measurement (kg for solids, litres for liquids). */
  measureUnit: MeasureUnit;
  /** When true, the entry form also captures a piece count (nos). Never used in totals. */
  countable: boolean;
}

export const WASTE_TYPES: WasteType[] = [
  // Hazardous
  { id: "oil-cotton", name: "Oil/Grease Soaked Cotton Waste", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false },
  { id: "waste-oil", name: "Waste Oil", unit: "litres", category: "Liquid", wasteCategory: "hazardous", measureUnit: "litres", countable: false },
  { id: "waste-grease", name: "Waste Grease", unit: "kg", category: "Semi-Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false },
  { id: "plastic-waste", name: "Plastic Waste (Contaminated)", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false },
  { id: "hu-oil-filter", name: "HU Oil Filter Waste", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  { id: "gb-oil-filter", name: "GB Oil Filter Waste (Online filters)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  { id: "gb-oil-filter-offline", name: "GB Oil Filter Waste (Offline filters)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  { id: "dust-filter-mat", name: "Dust Filter Mat", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false },
  { id: "carbon-brush", name: "Carbon Brush Waste", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  { id: "oil-filters-misc", name: "Misc Oil Filters", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  { id: "empty-containers", name: "Empty Chemical Containers", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true },
  // Non-hazardous
  { id: "paper-waste", name: "Paper Waste", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false },
  { id: "packaging-waste", name: "Packaging Waste", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false },
  { id: "wooden-boxes", name: "Wooden Boxes", unit: "nos", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: true },
  { id: "plastic-non-contaminated", name: "Plastic Waste (Non-Contaminated)", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false },
  { id: "non-haz-others", name: "Others (Non-Hazardous)", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false },
  // E-waste
  { id: "used-batteries", name: "Used Batteries", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-circuit-boards", name: "Circuit Boards", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-general", name: "Electronic Waste", unit: "kg", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: false },
  { id: "e-waste-igbts", name: "IGBTs", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-diodes", name: "Diodes", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-thyristors", name: "Thyristors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-resistors", name: "Resistors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-capacitors", name: "Capacitors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  { id: "e-waste-others", name: "E-waste Others", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true },
  // Other wastes
  { id: "aluminium-scrap", name: "Aluminium Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "copper-scrap", name: "Copper Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "ms-scrap", name: "MS Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "plastic-scrap", name: "Plastic Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "frp-scrap", name: "FRP Scrap (Blade)", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "scrap-insulator", name: "Scrap Insulator", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
  { id: "rubber-scrap", name: "Rubber Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false },
];

export type ActivityType = "breakdown" | "preventive" | "5s" | "others";

export interface WasteEntry {
  id: string;
  site_id: string;
  waste_type_id: string;
  waste_category: WasteCategory;
  /** Legacy — retained for old rows. New code uses `weight_kg`. */
  quantity?: number | null;
  /** Primary measurement: kg for solids, litres for liquids. */
  weight_kg: number;
  /** Optional piece count for items measured in nos (filters, batteries, etc.). Display only. */
  piece_count?: number | null;
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

/** Look up the measurement unit (kg/litres) for a waste type id. Defaults to kg. */
export function getMeasureUnit(wasteTypeId: string): MeasureUnit {
  return WASTE_TYPES.find((w) => w.id === wasteTypeId)?.measureUnit ?? "kg";
}

/** Human-friendly unit suffix ("kg" or "L"). */
export function unitLabel(u: MeasureUnit): string {
  return u === "litres" ? "L" : "kg";
}

/** Sum weight for entries, split by measurement unit. */
export function sumByUnit(entries: WasteEntry[]): { kg: number; litres: number } {
  let kg = 0, litres = 0;
  for (const e of entries) {
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "litres") litres += v; else kg += v;
  }
  return { kg, litres };
}

/** Format a number with up to 2 decimals, trimming trailing zeros. */
export function fmtNum(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

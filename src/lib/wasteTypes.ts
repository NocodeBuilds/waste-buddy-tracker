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
  /** Statutory CPCB Schedule I/II or Rules code */
  statutoryCode?: string;
}

export const WASTE_TYPES: WasteType[] = [
  // Hazardous (HOWM Rules 2016)
  { id: "oil-cotton", name: "Oil/Grease Soaked Cotton Waste", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false, statutoryCode: "Sch-I 5.2" },
  { id: "waste-oil", name: "Waste Oil", unit: "litres", category: "Liquid", wasteCategory: "hazardous", measureUnit: "litres", countable: false, statutoryCode: "Sch-I 5.1" },
  { id: "waste-grease", name: "Waste Grease", unit: "kg", category: "Semi-Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false, statutoryCode: "Sch-I 5.1" },
  { id: "plastic-waste", name: "Plastic Waste (Contaminated)", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false, statutoryCode: "Sch-I 33.1" },
  { id: "hu-oil-filter", name: "HU Oil Filter Waste", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "gb-oil-filter", name: "GB Oil Filter Waste (Online filters)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "gb-oil-filter-offline", name: "GB Oil Filter Waste (Offline filters)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "dust-filter-mat", name: "Dust Filter Mat", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false, statutoryCode: "Sch-I 35.3" },
  { id: "carbon-brush", name: "Carbon Brush Waste", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-II B17" },
  { id: "oil-filters-misc", name: "Misc Oil Filters", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "empty-containers", name: "Empty Chemical Containers", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 33.1" },
  { id: "oil-hose", name: "Oil Hose", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "plastic-cartridge-perma", name: "Plastic Cartridge (PERMA)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 33.1" },
  { id: "plastic-cartridge-breather", name: "Plastic Cartridge (Gearbox Breather)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 33.1" },
  { id: "silica-gel", name: "Silica Gel", unit: "kg", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: false, statutoryCode: "Sch-I 35.3" },
  { id: "yaw-clipper-oil-seal", name: "Yaw Clipper Oil Seal", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "pitch-cylinder-oil-seal", name: "Pitch Cylinder Oil Seal", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 5.2" },
  { id: "empty-tins", name: "Empty Tins (Zinc Spray, WD40 etc.)", unit: "nos", category: "Solid", wasteCategory: "hazardous", measureUnit: "kg", countable: true, statutoryCode: "Sch-I 33.1" },
  // Non-hazardous
  { id: "paper-waste", name: "Paper Waste", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false, statutoryCode: "SWM 2016" },
  { id: "packaging-waste", name: "Packaging Waste", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false, statutoryCode: "PWM 2016" },
  { id: "wooden-boxes", name: "Wooden Boxes", unit: "nos", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: true, statutoryCode: "SWM (Wood)" },
  { id: "plastic-non-contaminated", name: "Plastic Waste (Non-Contaminated)", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false, statutoryCode: "PWM 2016" },
  { id: "non-haz-others", name: "Others (Non-Hazardous)", unit: "kg", category: "Solid", wasteCategory: "non_hazardous", measureUnit: "kg", countable: false, statutoryCode: "SWM 2016" },
  // E-waste (E-Waste Rules 2022 & Battery Waste Rules 2022)
  { id: "used-batteries", name: "Used Batteries", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "BWM 2022" },
  { id: "e-waste-circuit-boards", name: "Circuit Boards", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "ITEW Sch-I" },
  { id: "e-waste-general", name: "Electronic Waste", unit: "kg", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: false, statutoryCode: "E-Waste 2022" },
  { id: "e-waste-igbts", name: "IGBTs", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "CEEW Sch-I" },
  { id: "e-waste-diodes", name: "Diodes", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "CEEW Sch-I" },
  { id: "e-waste-thyristors", name: "Thyristors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "CEEW Sch-I" },
  { id: "e-waste-resistors", name: "Resistors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "CEEW Sch-I" },
  { id: "e-waste-capacitors", name: "Capacitors", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "CEEW Sch-I" },
  { id: "e-waste-others", name: "E-waste Others", unit: "nos", category: "E-waste", wasteCategory: "e_waste", measureUnit: "kg", countable: true, statutoryCode: "E-Waste 2022" },
  // Other wastes
  { id: "aluminium-scrap", name: "Aluminium Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (Al)" },
  { id: "copper-scrap", name: "Copper Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (Cu)" },
  { id: "ms-scrap", name: "MS Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (MS)" },
  { id: "plastic-scrap", name: "Plastic Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (Plastic)" },
  { id: "frp-scrap", name: "FRP Scrap (Blade)", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (FRP)" },
  { id: "scrap-insulator", name: "Scrap Insulator", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (Ceramic)" },
  { id: "rubber-scrap", name: "Rubber Scrap", unit: "kg", category: "Solid", wasteCategory: "other_wastes", measureUnit: "kg", countable: false, statutoryCode: "Scrap (Rubber)" },
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
  const gen = parseLocalDate(generatedDate);
  const now = new Date();
  return Math.floor((now.getTime() - gen.getTime()) / (1000 * 60 * 60 * 24));
}

/** Statutory storage threshold by waste category under Indian environmental rules. */
export function getStorageLimitDays(category?: WasteCategory, wasteTypeId?: string): number {
  if (category === "hazardous") return 90; // HOWM Rules 2016 Rule 8
  if (category === "e_waste" || wasteTypeId === "used-batteries") return 180; // E-Waste Rules 2022 / BWM 2022
  if (category === "non_hazardous" || category === "other_wastes") return 180; // Non-hazardous operational housekeeping
  return 90;
}

export function isEntryOverdue(entry: WasteEntry): boolean {
  if (isDisposed(entry)) return false;
  const days = getDaysStored(entry.generated_date);
  const limit = getStorageLimitDays(entry.waste_category, entry.waste_type_id);
  return days >= limit;
}

export function isEntryWarning(entry: WasteEntry): boolean {
  if (isDisposed(entry)) return false;
  const days = getDaysStored(entry.generated_date);
  const limit = getStorageLimitDays(entry.waste_category, entry.waste_type_id);
  const warnThreshold = limit === 180 ? 150 : 70;
  return days >= warnThreshold && days < limit;
}

export function getStatutoryCode(wasteTypeId: string): string {
  return WASTE_TYPES.find((w) => w.id === wasteTypeId)?.statutoryCode ?? "—";
}

export function getStatus(entry: WasteEntry): "safe" | "warning" | "overdue" {
  if (entry.disposal_batch_id) return "safe";
  if (isEntryOverdue(entry)) return "overdue";
  if (isEntryWarning(entry)) return "warning";
  return "safe";
}

export function isDisposed(entry: WasteEntry): boolean {
  return !!entry.disposal_batch_id;
}

/** Look up the measurement unit (kg/litres) for a waste type id. Defaults to kg. */
export function getMeasureUnit(wasteTypeId: string): MeasureUnit {
  return WASTE_TYPES.find((w) => w.id === wasteTypeId)?.measureUnit ?? "kg";
}

/** Human-friendly unit suffix ("kg" or "Ltr"). */
export function unitLabel(u: MeasureUnit): string {
  return u === "litres" ? "Ltr" : "kg";
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

/** Return today's date as "YYYY-MM-DD" in the user's local timezone. */
export function getLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a date string ("YYYY-MM-DD" or ISO) into a local Date object set to local midnight (00:00:00.000).
 * Prevents UTC string parsing shifts (where "2026-10-01" in UTC is 05:30 IST and shifts across day boundaries).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date(dateStr);
}

/**
 * Format any date input (YYYY-MM-DD string, ISO timestamp, or Date object)
 * into standard DD-MM-YYYY format across the entire PWA.
 * Example: "2026-10-02" -> "02-10-2026"
 */
export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  if (typeof dateInput === "string") {
    const clean = dateInput.slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      // Direct YYYY-MM-DD -> DD-MM-YYYY without timezone hazards
      return `${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[0]}`;
    }
  }
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return typeof dateInput === "string" ? dateInput : "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format timestamp input into DD-MM-YYYY HH:mm format.
 * Example: "2026-10-02T10:30:00Z" -> "02-10-2026 16:00"
 */
export function formatDateTimeDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

/** Clamp a date string (YYYY-MM-DD) so it is not in the future. Returns the clamped string. */
export function clampDateNotFuture(dateStr: string): string {
  const today = getLocalDate();
  return dateStr > today ? today : dateStr;
}

// ─── Period / Range helpers ────────────────────────────────────────

export type PeriodKind = "all" | "month" | "range" | "fy";

export interface AnalyticsPeriod {
  kind: PeriodKind;
  /** Inclusive start date "YYYY-MM-DD". End may be undefined when "all". */
  start?: string;
  /** Exclusive end date "YYYY-MM-DD" (always day-after for inclusive filtering). */
  end?: string;
  /** Human-readable label describing the chosen period. */
  label: string;
}

/** All-time period (no filtering). */
export const ALL_TIME_PERIOD: AnalyticsPeriod = { kind: "all", label: "All time" };

/** Pick a calendar month in a given year (Jan = 0). */
export function monthPeriod(year: number, monthIndex: number): AnalyticsPeriod {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  const monthName = start.toLocaleString("en-US", { month: "long" });
  return {
    kind: "month",
    start: getLocalDate(start),
    end: getLocalDate(end),
    label: `${monthName} ${year}`,
  };
}

/** Custom range. Inclusive of start, exclusive of end. End auto-extended by 1 day for half-open filtering. */
export function rangePeriod(startStr: string, endStr: string): AnalyticsPeriod {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  end.setDate(end.getDate() + 1);
  return {
    kind: "range",
    start: getLocalDate(start),
    end: getLocalDate(end),
    label: `${formatDateDDMMYYYY(startStr)} → ${formatDateDDMMYYYY(endStr)}`,
  };
}

/** Indian financial year: April 1 → March 31. FY "2025-26" runs Apr 2025 – Mar 2026. */
export function fyPeriod(fyStartYear: number): AnalyticsPeriod {
  const start = new Date(fyStartYear, 3, 1); // April 1
  const end = new Date(fyStartYear + 1, 3, 1); // April 1 next year
  const fyLabel = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
  return {
    kind: "fy",
    start: getLocalDate(start),
    end: getLocalDate(end),
    label: `FY ${fyLabel}`,
  };
}

/** Current financial-year starting year (e.g., 2025 if today is in or after Apr 2025). */
export function currentFyStartYear(now: Date = new Date()): number {
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/** List the most recent N financial years (e.g. last 5). Newest first. */
export function recentFinancialYears(count: number, now: Date = new Date()): number[] {
  const current = currentFyStartYear(now);
  return Array.from({ length: count }, (_, i) => current - i);
}

/** List the most recent N months (oldest first, current month last). */
export function recentMonthOptions(count: number, now: Date = new Date()): { year: number; monthIndex: number; label: string }[] {
  const out: { year: number; monthIndex: number; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

/** Filter an entry list to those whose generated_date falls inside the period. */
export function filterByPeriod<T extends { generated_date: string }>(entries: T[], period: AnalyticsPeriod): T[] {
  if (period.kind === "all") return entries;
  if (!period.start || !period.end) return entries;
  return entries.filter((e) => e.generated_date >= period.start! && e.generated_date < period.end!);
}

// ─── Category aggregation helpers ─────────────────────────────────

export interface CategoryBreakdown {
  hazSolidsKg: number;
  nonHazSolidsKg: number;
  liquidLitres: number;
  eWasteKg: number;
  batteryKg: number;
  otherWastesKg: number;
}

export function aggregateByCategory(entries: WasteEntry[]): CategoryBreakdown {
  const r: CategoryBreakdown = {
    hazSolidsKg: 0,
    nonHazSolidsKg: 0,
    liquidLitres: 0,
    eWasteKg: 0,
    batteryKg: 0,
    otherWastesKg: 0,
  };
  for (const e of entries) {
    const v = Number(e.weight_kg ?? 0);
    switch (e.waste_type_id) {
      case "used-batteries":
        r.batteryKg += v;
        break;
      case "e-waste-general":
      case "e-waste-circuit-boards":
      case "e-waste-igbts":
      case "e-waste-diodes":
      case "e-waste-thyristors":
      case "e-waste-resistors":
      case "e-waste-capacitors":
      case "e-waste-others":
        r.eWasteKg += v;
        break;
      case "waste-oil":
      case "waste-grease":
        r.liquidLitres += v;
        break;
      case "plastic-waste":
      case "plastic-non-contaminated":
      case "dust-filter-mat":
      case "empty-containers":
      case "oil-filters-misc":
      case "carbon-brush":
        r.hazSolidsKg += v;
        break;
      case "paper-waste":
      case "packaging-waste":
      case "wooden-boxes":
      case "non-haz-others":
      case "rubber-scrap":
      case "frp-scrap":
      case "scrap-insulator":
      case "aluminium-scrap":
      case "copper-scrap":
      case "ms-scrap":
      case "plastic-scrap":
        r.otherWastesKg += v;
        break;
      default:
        if (e.waste_category === "hazardous") r.hazSolidsKg += v;
        else if (e.waste_category === "non_hazardous") r.nonHazSolidsKg += v;
        else if (e.waste_category === "e_waste") r.eWasteKg += v;
        else if (e.waste_category === "other_wastes") r.otherWastesKg += v;
        break;
    }
  }
  return r;
}

export function aggregateByType(entries: WasteEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const v = Number(e.weight_kg ?? 0);
    map.set(e.waste_type_id, (map.get(e.waste_type_id) ?? 0) + v);
  }
  return map;
}

// ─── Activity type formatting ─────────────────────────────────────

const ACTIVITY_LABELS: Record<string, { long: string; short: string }> = {
  breakdown: { long: "Breakdown Maintenance", short: "BM" },
  preventive: { long: "Preventive Maintenance", short: "PM" },
  "5s": { long: "5S Activity", short: "5S" },
  others: { long: "Others", short: "OTH" },
};

export function formatActivityType(t: string, format: "long" | "short" = "long"): string {
  return ACTIVITY_LABELS[t]?.[format] ?? t;
}
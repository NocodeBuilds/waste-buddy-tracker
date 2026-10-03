/**
 * Centralised application types.
 *
 * - Database-backed rows/types are re-exported from the Supabase-generated types file.
 * - Cross-cutting domain types live here so every component imports from one place.
 */

// ── Supabase-generated ──────────────────────────────────────────────
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
  Json,
} from "@/integrations/supabase/types";

export type { Database, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes, Json };

// ── Table row aliases (shorthand) ──────────────────────────────────
export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type SiteInsert = Database["public"]["Tables"]["sites"]["Insert"];
export type SiteUpdate = Database["public"]["Tables"]["sites"]["Update"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type UserSiteRow = Database["public"]["Tables"]["user_sites"]["Row"];
export type UserSiteInsert = Database["public"]["Tables"]["user_sites"]["Insert"];

export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type UserRoleInsert = Database["public"]["Tables"]["user_roles"]["Insert"];

export type WasteEntryRow = Database["public"]["Tables"]["waste_entries"]["Row"];
export type WasteEntryInsert = Database["public"]["Tables"]["waste_entries"]["Insert"];
export type WasteEntryUpdate = Database["public"]["Tables"]["waste_entries"]["Update"];

export type DisposalBatchRow = Database["public"]["Tables"]["disposal_batches"]["Row"];
export type DisposalBatchInsert = Database["public"]["Tables"]["disposal_batches"]["Insert"];

export type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];

export type AccessRequestRow = Database["public"]["Tables"]["site_access_requests"]["Row"];

export type SiteLocationRow = Database["public"]["Tables"]["site_locations"]["Row"];

export type WasteEntryPhotoRow = Database["public"]["Tables"]["waste_entry_photos"]["Row"];

// ── Enums ──────────────────────────────────────────────────────────
export type Role = Database["public"]["Enums"]["app_role"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];
export type WasteCategory = Database["public"]["Enums"]["waste_category"];

// ── Site ───────────────────────────────────────────────────────────
export interface Site {
  id: string;
  name: string;
  location: string | null;
}

// ── Member (user + site + role join) ───────────────────────────────
export interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
}

// ── Access request (DB column is `note`) ───────────────────────────
export interface AccessRequest {
  id: string;
  user_id: string;
  site_id: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

// ── Re-exports from wasteTypes.ts ──────────────────────────────────
export {
  WASTE_TYPES,
  type WasteType,
  type MeasureUnit,
  type DisposalBatch,
  type AnalyticsPeriod,
  type CategoryBreakdown,
  ALL_TIME_PERIOD,
  getDaysStored,
  getStatus,
  isDisposed,
  sumByUnit,
  getMeasureUnit,
  unitLabel,
  fmtNum,
  monthPeriod,
  rangePeriod,
  fyPeriod,
  filterByPeriod,
  recentFinancialYears,
  recentMonthOptions,
  aggregateByCategory,
  aggregateByType,
  formatActivityType,
  DISPOSAL_LIMIT_DAYS,
  type PeriodKind,
} from "@/lib/wasteTypes";

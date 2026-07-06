# Plan: Weight-based tracking (Kgs & Litres)

## Goal
Move all reporting, aggregation, alerts, and exports to **weight (kg for solids, litres for liquids)**. Count (nos) becomes a secondary field, captured only for items historically counted in pieces, and never used in charts or totals.

---

## 1. Data model changes

`waste_entries` table today has one numeric `quantity`. Split it:

- Add `weight_kg NUMERIC` — kg for solid wastes, litres for the liquid (Waste Oil). Required (>0).
- Add `piece_count INTEGER NULL` — only populated for waste types whose native unit is `nos`.
- Migrate existing rows: copy current `quantity` → `weight_kg` for every entry (per user's choice). Leave `piece_count` NULL. Keep the old `quantity` column for one release as a fallback, then drop in a follow-up if desired.
- Update `src/integrations/supabase/types.ts` will auto-regenerate after migration.

## 2. Waste type metadata (`src/lib/wasteTypes.ts`)

Add a new field to each type:

- `measureUnit`: `"kg"` or `"litres"` — the unit used for weight (drives dashboards & exports).
- `countable`: `boolean` — true for the 7 items currently in `nos` (filters, batteries, containers, boxes, carbon brushes). False otherwise.

Waste Oil → `measureUnit: "litres"`, `countable: false`.
All others → `measureUnit: "kg"`.

The existing `unit` field stays for backwards-compat but is no longer used for aggregation.

## 3. Entry form (`WasteEntryForm.tsx`, `EditWasteDialog.tsx`)

- Replace the single Quantity input with a two-column row:
  - **Left (only when `countable`)**: "Count (pieces)" — integer input.
  - **Right (always)**: "Weight" — decimal input, suffix shows `kg` or `litres` from `measureUnit`.
- For liquids and bulk kg items: hide the count field entirely.
- Validation: `weight_kg > 0` required. `piece_count` optional, integer ≥ 1 when shown.

## 4. Dashboard rework (`DashboardStats.tsx`, `FuturisticDashboard.tsx`)

Restructure into **two sections**:

**Section A — Cumulative overview**
- Card: Total active weight in **kg** (sum of solid `weight_kg`, active only).
- Card: Total active volume in **litres** (sum of liquid `weight_kg`, active only).
- Card: Overdue count (entries >90 days) + total overdue kg / L.
- Card: Warning count (70–90 days) + kg / L.

**Section B — This month**
- Grouped bar/list: **kg generated this month per waste type** (solid).
- Grouped bar/list: **litres generated this month** (liquid — Waste Oil).
- Card: Disposals due this month (kg + L totals, entries hitting 90d within the current month).

Remove any "Total entries" / count-based tiles.

## 5. Analytics (`AnalyticsTab.tsx`)

- "Total entries" card → replaced with **Total kg disposed** + **Total L disposed**.
- Cumulative-by-waste-type bar chart → uses `weight_kg`, y-axis label from `measureUnit`. Drop the `qty × unit` mixed tooltip.
- Top Locations bar chart → rank by summed `weight_kg` per location, not entry count. Split into two mini-charts (kg / L) OR single chart showing kg only + a small L-only sub-panel.
- Activity split (Breakdown / Preventive / 5S) → show kg + L totals per activity instead of entry counts.

## 6. Inventory table (`WasteInventoryTable.tsx`)

- Quantity column shows `weight_kg` with `kg`/`L` suffix from waste-type metadata.
- Add a small secondary line "n pcs" beneath weight only for countable types where `piece_count` is set.
- Storage summary card at top: "**X kg + Y litres in storage**" (not "N entries").

## 7. Alerts (`AlertsPanel.tsx`)

- "Available quantity", "due", overdue messages all use kg / L only.
- Text pattern: "12.5 kg of Waste Grease overdue by 4 days" / "40 L Waste Oil due in 3 days".

## 8. Exports (`src/lib/wasteExports.ts`)

- Excel: Quantity column → `Weight (kg/L)`. Add a `Count (pcs)` column populated only for countable rows. All summary/pivot totals switch to kg + L.
- PDF: Same. Header summary row shows kg + L only.

## 9. Migration steps (order)

1. DB migration: add columns, backfill, update RLS if needed (no policy changes expected).
2. Update `wasteTypes.ts` with metadata.
3. Update `useWasteEntries.ts` insert/update to write `weight_kg` + `piece_count`.
4. Refactor form + edit dialog.
5. Refactor dashboard, analytics, inventory, alerts, exports in one pass.
6. Manual smoke test: add an entry with count + weight, add a liquid entry, verify dashboard sums, export both files.

---

## Technical notes

- `weight_kg` is the single source of truth for all math. `piece_count` is display-only.
- Split solid vs liquid at query time using `WASTE_TYPES.find(...).measureUnit`, not a DB column, to keep the migration light. (If preferred we can denormalize `measure_unit` into `waste_entries` later.)
- No changes to `waste_entry_photos`, `disposal_batches`, `sites`, auth, or roles.
- Historical rows: existing `quantity` values copied into `weight_kg`; users can edit incorrect ones via the edit dialog.

Confirm and I'll implement.
# Dashboard Style Uniformity — Standardization Plan

## Status: PENDING APPROVAL — do not implement yet

---

## Overview

After auditing all five tabs (`Home`/`Dashboard`, `Inventory`, `Analytics`, `Settings`, `Admin`) plus the entry/edit drawers, **19 distinct inconsistency categories** were found. The root cause is organic growth — different developers (or the same developer at different times) applied different conventions.

The plan below defines a single source of truth: a `DashboardCard` wrapper component + a set of Tailwind utility constants that all dashboard-adjacent components must use.

---

## 1. Unified Card Component (`DashboardCard`)

Create a new shared component to eliminate all `Card` / `CardContent` padding fighting.

### New file: `src/components/dashboard/DashboardCard.tsx`

```tsx
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Standardizes card padding, visual treatment, and inner spacing for all dashboard sections. */
export default function DashboardCard({
  children,
  className,
  variant = "default",  // "default" | "glass" | "alert"
  alert = false,        // true = adds border-overdue/30
}: {
  Children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "alert";
  alert?: boolean;
}) {
  return (
    <Card
      className={cn(
        variant === "glass" && "border-border/50 bg-card/70 backdrop-blur",
        variant === "alert" && "border-overdue/30",
        className
      )}
    >
      <CardContent className="p-4 space-y-3">{children}</CardContent>
    </Card>
  );
}
```

**Key rules:**
- `p-4` padding everywhere (not `p-3`, not `p-6`)
- `space-y-3` between child elements
- `variant="glass"` replaces all `bg-card/70 backdrop-blur border-border/50` scattered across components
- `variant="alert"` applies overdue border treatment

---

## 2. Typography Constants

### Heading tokens (to be applied consistently)

| Element | Class | Example usage |
|---|---|---|
| Page title | `text-lg font-bold flex items-center gap-2` | `{icon} Page Name` |
| Section label | `text-xs font-semibold text-muted-foreground uppercase tracking-wider` | Section headers |
| Card h3 | `text-xs font-semibold text-muted-foreground flex items-center gap-1.5` | Card inner headers |
| Stat value (large) | `text-2xl font-bold leading-tight` | Primary KPI numbers |
| Stat value (small) | `text-sm font-bold leading-tight` | Secondary metrics |
| Stat label | `text-[10px] text-muted-foreground` | Below stat values |
| Body text | `text-xs` | General text |
| Small/meta text | `text-[10px] text-muted-foreground` | Timestamps, captions |
| Table body | `text-xs` | Table cells |

---

## 3. Spacing Constants

| Context | Value |
|---|---|
| Card inner padding | `p-4` |
| Between card children | `space-y-3` |
| Section gap (between cards) | `space-y-4` |
| Grid gap | `gap-3` |
| Stat card grid | `grid-cols-2 gap-3` |
| Form label → input | `space-y-1.5` |
| Form group → next form group | `space-y-3` |
| Inline gap (icon + text) | `gap-2` |
| Compact inline gap | `gap-1.5` |

---

## 4. Icon Size Constants

| Context | Size |
|---|---|
| Page title icon | `h-5 w-5` |
| Section/card header icon | `h-3.5 w-3.5` |
| Stat card icon | `h-5 w-5` (consistent — not `h-6`) |
| Button icon | `h-4 w-4` |
| Table action icon | `h-3.5 w-3.5` |
| Alert icon | `h-4 w-4` |

**Fix:** `DashboardStats` currently uses `h-6 w-6` for stat icons — standardize to `h-5 w-5`.

---

## 5. Component-by-Component Changes

### 5.1 `DashboardStats.tsx` (Home tab — top stats)

| Issue | Fix |
|---|---|
| Uses `h-6 w-6` icons | Change to `h-5 w-5` |
| `leading-tight` missing on some stat values | Add to all stat value elements |
| Progress bar section uses different card treatment | Use `DashboardCard`, `variant="default"` |
| Section heading: `px-1` extra padding | Remove `px-1` from headings |
| Stat value `text-2xl` for hazardous/non-haz but `text-sm` for overdue/warning | Standardize: all primary KPIs → `text-2xl font-bold leading-tight`; secondary (overdue/warning) → `text-xl font-bold leading-tight` |

### 5.2 `FuturisticDashboard.tsx` (Home tab — charts)

| Issue | Fix |
|---|---|
| Cards use `bg-card/70 backdrop-blur` | Replace with `DashboardCard variant="glass"` |
| Section headers `h-3`: `text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5` | Already consistent — keep |
| Chart containers have mixed heights (180px, 160px) | Standardize to: Pie → `h-[180px]`, Bar → `h-[180px]`, Line → `h-[160px]` |
| "Disposal Due" list: `divide-y divide-border/50` | Use `divide-border` (no `/50`) |
| Empty state: inline flex, no card | Wrap in `DashboardCard` for consistency |

### 5.3 `AlertsPanel.tsx`

| Issue | Fix |
|---|---|
| Card border only on overdue | Use `DashboardCard variant="alert"` which applies `border-overdue/30` always |
| Alert item: `bg-overdue/10` vs `bg-warning/10` | Keep as-is (semantic colors) |
| "Hide all" button position | Already correct |
| `CardContent` uses `p-6` default — alerts use `p-3` inline | `DashboardCard` already sets `p-4`; move alert item padding to `space-y-2` |

### 5.4 `AnalyticsTab.tsx`

| Issue | Fix |
|---|---|
| Section header `h2` uses `text-lg font-bold` | Keep (page title — correct) |
| Inner section `h3`: no uppercase, no tracking | Apply `text-xs font-semibold text-muted-foreground uppercase tracking-wider` |
| Stat cards use `h-5 w-5` icons | Already consistent |
| Empty state uses `p-8` in CardContent | Replace with `DashboardCard` — empty state renders inside `p-4` |
| Category display: colored `div` backgrounds | Keep as-is (visual distinction for haz/non-haz) |
| Chart tooltips: mixed `fontSize: 12` | Standardize to `fontSize: 11` (matches dashboard charts) |

### 5.5 `WasteInventoryTable.tsx`

| Issue | Fix |
|---|---|
| Storage summary uses `p-3` inside CardContent | `DashboardCard` provides `p-4` |
| "Waste type" section: `p-3 space-y-2` | `DashboardCard` provides `p-4 space-y-3` — update internal spacing |
| Table filter title `text-lg` vs other section titles | Change to `text-base font-semibold` for consistency |
| Export buttons: `grid-cols-2 gap-2` | Keep, but add consistent `gap-3` wrapper |
| Disposal action button: `w-full` | Keep |
| Table headers: `bg-muted/50` | Keep (table-specific) |
| Disposal history cards: uses `Card` directly | Wrap in `DashboardCard` |

### 5.6 `SettingsTab.tsx`

| Issue | Fix |
|---|---|
| Page title: `text-lg font-bold` | Keep (correct) |
| Section `h3`: `text-sm font-semibold` (not uppercase) | Standardize to `text-xs font-semibold uppercase tracking-wider text-muted-foreground` for all section labels |
| Card padding: `p-4 space-y-2` | `DashboardCard` gives `p-4 space-y-3` — slight visual increase |
| Buttons: mixed `gap-2` | Keep `gap-2` for all |
| Form sections: mixed `space-y-1.5` / `space-y-2` | Standardize to `space-y-3` between groups, `space-y-1.5` within label→input |
| "About" card: `p-4` | `DashboardCard` |

### 5.7 `AdminTab.tsx`

| Issue | Fix |
|---|---|
| Page title: `text-lg font-bold` | Keep |
| Tabs: `grid-cols-4` with `text-[11px]` | Keep (tab-specific) |
| Section `h3`: mixed `text-sm` vs `text-xs` | Standardize: section headers → `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Empty states: inline text vs Card | Wrap in `DashboardCard` |
| Nested panels (Users, Sites, Records, Audit) all use Card directly | Each panel's outer card → `DashboardCard` |

### 5.8 `WasteEntryForm.tsx` (Drawer)

| Issue | Fix |
|---|---|
| Page title from Drawer component | Keep (Drawer-provided) |
| Labels: `text-sm` vs `text-xs` | Standardize all form labels to `text-xs font-medium` (not semibold) |
| Section spacing: `space-y-4` | Keep — form sections need more breathing room |
| Weight input: `pr-12` for unit suffix | Keep |
| Photo grid: `gap-2` | Keep |
| Submit button: `w-full` | Keep |
| Location selector: no label shown, `SelectTrigger` shows placeholder | Add visible `<Label>` — accessibility fix |

### 5.9 `EditWasteDialog.tsx`

| Issue | Fix |
|---|---|
| Dialog uses `max-w-md max-h-[90vh] overflow-y-auto` | Keep (dialog-specific) |
| Labels: `text-sm` | Change to `text-xs font-medium` for consistency |
| Grid layout for weight/count/date | Keep |
| Footer: `DialogFooter` | Keep |

---

## 6. Summary of All Changes Required

| # | File | Change Type | Effort |
|---|---|---|---|
| 1 | Create `src/components/dashboard/DashboardCard.tsx` | New file | Small |
| 2 | `DashboardStats.tsx` | Icon size, heading padding, stat value sizes | Small |
| 3 | `FuturisticDashboard.tsx` | Replace card glassmorphism with DashboardCard, chart heights, empty state | Medium |
| 4 | `AlertsPanel.tsx` | Use DashboardCard, remove inline padding overrides | Small |
| 5 | `AnalyticsTab.tsx` | Section header styles, empty state, tooltip sizes | Small |
| 6 | `WasteInventoryTable.tsx` | Section headers, wrapper cards, spacing | Medium |
| 7 | `SettingsTab.tsx` | Section header standardization | Small |
| 8 | `AdminTab.tsx` | Section header standardization, empty states | Small |
| 9 | `WasteEntryForm.tsx` | Label sizes, add location label | Small |
| 10 | `EditWasteDialog.tsx` | Label sizes | Small |
| 11 | `src/index.css` | Add utility classes (optional — can use inline) | None |

---

## 7. Implementation Order

1. **Create `DashboardCard.tsx`** — the foundation
2. **Update `DashboardStats.tsx`** — icon sizes, padding
3. **Update `FuturisticDashboard.tsx`** — use DashboardCard glass variant
4. **Update `AlertsPanel.tsx`** — use DashboardCard alert variant
5. **Update `AnalyticsTab.tsx`** — section headers + empty states
6. **Update `WasteInventoryTable.tsx`** — section headers + wrapper cards
7. **Update `SettingsTab.tsx`** — section headers
8. **Update `AdminTab.tsx`** — section headers
9. **Update `WasteEntryForm.tsx`** — label sizes
10. **Update `EditWasteDialog.tsx`** — label sizes

---

## 8. Verification Checklist

After implementation, all dashboard tabs should pass:

- [ ] Every card uses `DashboardCard` or standard `Card` with `p-4 CardContent`
- [ ] All stat value numbers use `text-2xl font-bold leading-tight` (primary) or `text-xl font-bold leading-tight` (secondary)
- [ ] All section labels use `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- [ ] All stat card icons are `h-5 w-5`
- [ ] All section header icons are `h-3.5 w-3.5`
- [ ] All form labels are `text-xs font-medium`
- [ ] Grid gaps are `gap-3`; form group spacing is `space-y-3`; label→input spacing is `space-y-1.5`
- [ ] Empty states are wrapped in cards (for sections) or use consistent flex centering
- [ ] Page titles consistently use `text-lg font-bold flex items-center gap-2`

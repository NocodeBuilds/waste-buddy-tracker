---
name: Industrial Compliance Modern
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f493f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f7a6e'
  outline-variant: '#becabc'
  surface-tint: '#006d30'
  primary: '#00652c'
  on-primary: '#ffffff'
  primary-container: '#dcfce7'
  on-primary-container: '#14532d'
  inverse-primary: '#79db8d'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#99efe5'
  on-secondary-container: '#006f67'
  tertiary: '#005b8c'
  on-tertiary: '#ffffff'
  tertiary-container: '#0075b1'
  on-tertiary-container: '#ecf4ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#95f8a7'
  primary-fixed-dim: '#79db8d'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#005323'
  secondary-fixed: '#9cf2e8'
  secondary-fixed-dim: '#80d5cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  primary-dark: '#14532d'
  primary-deep: '#166534'
  primary-fab: '#16a34a'
  canvas-bg: '#f8fafc'
  card-surface: '#ffffff'
  border-default: '#e2e8f0'
  border-dim: '#cbd5e1'
  text-primary: '#0f172a'
  text-secondary: '#475569'
  text-muted: '#94a3b8'
  haz-text: '#dc2626'
  haz-bg: '#fef2f2'
  haz-border: '#fecaca'
  safe-text: '#059669'
  safe-bg: '#ecfdf5'
  safe-border: '#a7f3d0'
  liq-text: '#0284c7'
  liq-bg: '#f0f9ff'
  liq-border: '#bae6fd'
  elec-text: '#ea580c'
  elec-bg: '#fff7ed'
  elec-border: '#fed7aa'
  batt-text: '#d97706'
  batt-bg: '#fffbeb'
  batt-border: '#fde68a'
  other-text: '#64748b'
  other-bg: '#f1f5f9'
  other-border: '#e2e8f0'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  metric-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes a high-precision, utilitarian, and dependable operational atmosphere engineered specifically for Environmental Health & Safety (EHS) officers, industrial facility managers, and statutory compliance auditors. The visual narrative merges robust industrial telemetry with crisp enterprise software engineering.

The brand persona balances regulatory rigor with zero-cognitive-friction workflows:
- **Authority & Integrity:** Clean, highly structured layouts evoke statutory compliance, audit-readiness, and environmental responsibility.
- **Field & Plant Floor Clarity:** High-contrast legible readouts, tabular telemetry data, and semantic color coding ensure rapid scanning under bright sunlight, variable handheld terminal displays, or complex desktop multi-monitor control setups.
- **Stylistic Identity:** Corporate / Modern with functional minimalism. The interface avoids frivolous ornamentation, relying on strict mathematical spacing, subtle low-contrast boundaries, crisp tabular figures, and purposeful semantic compliance badges that indicate risk profiles instantly without triggering visual fatigue.

## Colors

The color system delivers strict regulatory classification and clear hierarchical distinction:

- **Primary Brand Hierarchy:** Built upon forest greens. `#15803d` and `#166534` represent confirmed compliance, standard batch generation, and core actions. `#14532d` powers persistent institutional shell anchors such as the unified top header and facility context bar. `#dcfce7` serves as the high-contrast container tint with `#14532d` on-container text.
- **Secondary Compliance Accent:** `#0f766e` (Slate Teal) designates process validation, secondary monitoring workflows, and operational state transitions.
- **Surfaces & Layout Structure:** The background utilizes an ultra-clean cool neutral `#f8fafc`, grounding cards in clinical contrast against pure white `#ffffff` surfaces. Separations are maintained by hairline strokes in `#e2e8f0` and `#cbd5e1`.
- **Text & Data Contrast:** Headlines, total aggregates, and primary values use `#0f172a` (Slate 900) for maximum legibility. Supporting titles and field labels use `#475569` (Slate 600). Metadata, unit tickers, and timestamps use `#94a3b8` (Slate 400).
- **Statutory Category Accents:**
  - *Hazardous Solids (HAZ):* `#dc2626` text/border on `#fef2f2` wash.
  - *Non-Hazardous (SAFE):* `#059669` text/border on `#ecfdf5` wash.
  - *Liquid Waste (LIQ):* `#0284c7` text/border on `#f0f9ff` wash.
  - *E-Waste (ELEC):* `#ea580c` text/border on `#fff7ed` wash.
  - *Battery Waste (BATT):* `#d97706` text/border on `#fffbeb` wash.
  - *General Industrial (OTHER):* `#64748b` text/border on `#f1f5f9` wash.

## Typography

The typographic hierarchy prioritizes rapid scanning, absolute clarity of quantities, and zero ambiguity across regulatory logs:

- **Font Family Execution:** Inter is deployed uniformly across headlines, numerical metrics, form fields, and metadata. Open apertures and tall x-heights maintain crisp character separation even on field tablets with lower DPI or high ambient reflections.
- **Tabular Figures & Metrics:** All numeric values, manifest numbers, statutory weights, dates, and live quantities must render with tabular figures (`font-variant-numeric: tabular-nums;`) to prevent layout shifts and maintain strict vertical column alignment.
- **Weight Governance:**
  - `700 (Bold)`: Reserved exclusively for total quantities, summary card figures (`metric-display`), and top-level view titles (`headline-lg`).
  - `600 (SemiBold)`: Card section headers, modal titles, and interactive action labels.
  - `500 (Medium)`: Input labels, filter chips, and interactive navigation items.
  - `400 (Normal)`: Long descriptions, supplementary metadata, and audit log entries.
- **Metric Unit Pairing:** When rendering units of measurement (e.g., `kg`, `MT`, `L`, `drums`), the numerical value is rendered in bold primary text (`#0f172a`) while the trailing unit is formatted with an inline gap in `label-md` weight 500 in `#64748b`.

## Layout & Spacing

The layout model adapts seamlessly between mobile handheld operation (field inspections) and high-density desktop dashboards (compliance audit management):

- **Grid Architecture:**
  - **Mobile (360px - 767px):** Single-column workflow with dynamic 2-column metric cards. Margin is locked to `1rem` (16px) with an interior component gutter of `0.75rem` (12px). Bottom viewports reserve `4.5rem` (72px) of fixed offset clearance to support the bottom navigation shelf and the center floating action trigger.
  - **Tablet (768px - 1023px):** 6-column fluid grid, `1rem` gutters, and `1.5rem` canvas margins.
  - **Desktop (1024px+):** 12-column responsive layout with a fixed sidebar (`260px`), `1.5rem` gutters, and `2rem` outer padding, wrapping cleanly up to `1440px` maximum viewport constraint.
- **Spacing Rhythm:**
  - Component-internal padding adheres strictly to a 4px/8px baseline grid.
  - Interactive fields and buttons use `space-sm` (8px) vertical padding and `space-lg` (16px) horizontal padding.
  - Card modules separate operational sections using `space-lg` (16px) or `space-xl` (24px).

## Elevation & Depth

Visual depth is achieved through crisp, low-contrast structural hairlines paired with subtle, highly diffused ambient shadowing:

- **Surface Level 0 (Base Canvas):** Neutral cool background (`#f8fafc`). Non-reflective and flat.
- **Surface Level 1 (Panels, Data Rows & Cards):** Pure white container (`#ffffff`) bounded by a subtle hairline border (`1px solid #e2e8f0`). Ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Surface Level 2 (Floating Pickers, Dropdowns & Popovers):** Solid `#ffffff` with `1px solid #cbd5e1` and extended diffusion: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Surface Level 3 (Sheets & Statutory Modals):** Surface `#ffffff` elevated above a backdrop scrim (`rgba(15, 23, 42, 0.45)` with `4px` backdrop blur). Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.
- **Floating Action Elevation (Mobile Primary Action):** The circular central trigger (`#16a34a`) uses a colored ambient drop: `0 8px 20px -4px rgba(22, 163, 74, 0.38), 0 4px 8px -2px rgba(22, 163, 74, 0.2)`.

## Shapes

The shape system expresses ergonomic industrial reliability using calibrated corner radii:

- **Cards & Primary Modules:** Use a standard `0.5rem` (8px) to `0.75rem` (12px) radius (`rounded-lg`), creating distinct, well-contained visual chunks without soft, non-technical curvature.
- **Modals & Bottom Action Drawers:** Large headers and sheet tops employ `1rem` to `1.5rem` (`rounded-2xl` on mobile sheet tops) to signal gestural dismissal and thumb friendliness.
- **Buttons & Input Fields:** Form inputs, date pickers, and interactive action buttons use a uniform `0.5rem` to `0.75rem` (`rounded-lg` / `rounded-xl`), creating comfortable touch hitboxes.
- **Badges, Category Codes & Status Indicators:** Use full pill roundness (`9999px`), distinguishing informational telemetry tags from rectangular actionable form inputs.
- **Primary Action Trigger:** The mobile bottom navigation center button uses a complete circle (`rounded-full`) for unmistakable physical affordance.

## Components

### Header & Navigation Architecture
- **Unified Top Bar:** Styled in `#14532d` to `#166534` deep forest green. Displays the environmental brand emblem alongside the facility pill dropdown (e.g., `'Molagavalli 1 & 2'`), styled with a subtle semi-transparent background (`rgba(255, 255, 255, 0.12)`), crisp white text, and a dropdown chevron. Includes a notification alert bell with a status badge indicator.
- **Mobile Bottom Navigation:** Fixed white container (`#ffffff`) with a `1px` top border in `#e2e8f0`. Five-column distribution: *Home*, *Inventory*, *Elevated '+' Trigger*, *Analytics*, *Settings*. The center trigger is an elevated circular button (`52px` diameter) in `#16a34a` positioned to break the top border line by `14px`.
- **Desktop Sidebar:** Fixed width (`260px`), background `#ffffff`, right border `1px solid #e2e8f0`. Navigation links feature a `40px` height, `8px` corner radius, `font-medium 500` text in `#475569`, and an active state highlighted by `#dcfce7` with `#14532d` text and a bold green leading indicator stroke.

### Buttons & Actions
- **Primary Button:** Background `#15803d` (hover: `#166534`), white text, `font-semibold 600`, minimum touch height `44px`, padding `12px 20px`, radius `0.75rem` (12px).
- **Secondary / Cancel Button:** Pure white background, `1px solid #cbd5e1`, text `#475569` (hover: `#0f172a` on background `#f8fafc`), `font-medium 500`, radius `0.75rem`.
- **Destructive Action:** Background `#fef2f2`, border `1px solid #fecaca`, text `#dc2626` (hover: `#dc2626` text with `#fee2e2` background).

### Category Badges & Compliance Pills
- Structured with an inline badge height of `22px`, padding `2px 8px`, border radius `9999px`, and `11px` bold uppercase font.
- **HAZ (Hazardous Solids):** Text `#dc2626`, background `#fef2f2`, border `1px solid #fecaca`.
- **SAFE (Non-Hazardous):** Text `#059669`, background `#ecfdf5`, border `1px solid #a7f3d0`.
- **LIQ (Liquid Waste):** Text `#0284c7`, background `#f0f9ff`, border `1px solid #bae6fd`.
- **ELEC (E-Waste):** Text `#ea580c`, background `#fff7ed`, border `1px solid #fed7aa`.
- **BATT (Battery Waste):** Text `#d97706`, background `#fffbeb`, border `1px solid #fde68a`.
- **OTHER (General):** Text `#64748b`, background `#f1f5f9`, border `1px solid #e2e8f0`.

### Form Fields & Industrial Data Inputs
- Height `44px`, padding `8px 12px`, background `#ffffff`, border `1px solid #cbd5e1`, radius `8px`.
- Focus state: `2px solid #15803d` outline with zero offset.
- Floating helper label: `12px font-medium #475569` positioned above the input with a `4px` bottom gap.
- Error state: Border `#dc2626`, focus ring `#fecaca`, accompanying warning label in `#dc2626`.

### Cards & Compliance Summaries
- Surface `#ffffff`, border `1px solid #e2e8f0`, radius `12px`, padding `16px`.
- Metric layout: Category badge or status tag at top right; label in `font-medium 500 #475569`; prominent numeric value in `font-bold 700 24px #0f172a` accompanied by small `label-md` unit suffix in `#94a3b8`.

### Modals & Verification Sheets
- **Header:** Radius `1.5rem` (24px) on top, title in `font-semibold 600 20px #0f172a`, minimal circular close icon button (`32px` touch box in `#f1f5f9`).
- **Footer Controls:** Sticky layout with side-by-side or stacked actions: primary submit button (`bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl`) paired with secondary dismiss (`border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium py-3 rounded-xl`).
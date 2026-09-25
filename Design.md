# WasteBuddy — Design System

## Brand & Style

This design system establishes a high-precision, utilitarian, and dependable operational atmosphere engineered specifically for Environmental Health & Safety (EHS) officers, industrial facility managers, and statutory compliance auditors. The visual narrative merges robust industrial telemetry with crisp enterprise software engineering.

The brand persona balances regulatory rigor with zero-cognitive-friction workflows:

- **Authority & Integrity:** Clean, highly structured layouts evoke statutory compliance, audit-readiness, and environmental responsibility.
- **Field & Plant Floor Clarity:** High-contrast legible readouts, tabular telemetry data, and semantic color coding ensure rapid scanning under bright sunlight, variable handheld terminal displays, or complex desktop multi-monitor control setups.
- **Stylistic Identity:** Corporate / Modern with functional minimalism. The interface avoids frivolous ornamentation, relying on strict mathematical spacing, subtle low-contrast boundaries, crisp tabular figures, and purposeful semantic compliance badges that indicate risk profiles instantly without triggering visual fatigue.

---

## Colors

### Brand Color Palette

The brand is built upon a deep forest green foundation with supporting teal and ocean blue accents.

- **Primary (Brand):** `#00652c` — Core actions, standard operations, brand identity. On-primary text: `#ffffff`.
- **Primary Dark:** `#14532d` — Persistent institutional elements: unified top header, facility context bar.
- **Primary Deep:** `#166534` — Hover/active states for primary elements.
- **Primary FAB:** `#16a34a` — Floating action button (mobile), accent highlights.
- **Primary Container:** `#dcfce7` — High-contrast container tint with `#14532d` on-container text.
- **Primary Fixed:** `#95f8a7` — Fixed variant container. `#79db8d` dim variant.
- **Primary Inverse:** `#79db8d` — Inverse-primary state.

- **Secondary (Compliance):** `#006a63` (Slate Teal) — Process validation, secondary monitoring, operational state transitions.
- **Secondary Container:** `#99efe5` — Secondary container tint.
- **Secondary Fixed:** `#9cf2e8`. Dim: `#80d5cb`.

- **Tertiary (Ocean):** `#005b8c` — Tertiary actions, links, informational states.
- **Tertiary Container:** `#0075b1`. Fixed: `#cce5ff`. Dim: `#93ccff`.

### Semantic Statutory Category Colors

Each waste category has a matched text, background wash, and border:

| Category | Label | Text | Background | Border |
|----------|-------|------|------------|--------|
| HAZ | Hazardous Solids | `#dc2626` | `#fef2f2` | `#fecaca` |
| SAFE | Non-Hazardous | `#059669` | `#ecfdf5` | `#a7f3d0` |
| LIQ | Liquid Waste | `#0284c7` | `#f0f9ff` | `#bae6fd` |
| ELEC | E-Waste | `#ea580c` | `#fff7ed` | `#fed7aa` |
| BATT | Battery Waste | `#d97706` | `#fffbeb` | `#fde68a` |
| OTHER | General Industrial | `#64748b` | `#f1f5f9` | `#e2e8f0` |

### Status Colors

- **Error:** `#ba1a1a` (text: `#ffffff`, container: `#ffdad6`, on-container: `#93000a`)
- **Success/On Track:** `#059669` (maps to SAFE green)
- **Warning:** `#d97706` (maps to BATT amber)
- **Overdue:** `#dc2626` (maps to HAZ red)

### Surface System

Surfaces create visual hierarchy through subtle temperature and contrast shifts:

| Token | Value | Usage |
|-------|-------|-------|
| Canvas Background | `#f8f9ff` | Root page background |
| Surface Container Lowest | `#ffffff` | Cards, panels at highest elevation |
| Surface Container Low | `#eff4ff` | Elevated cards, section backgrounds |
| Surface Container | `#e5eeff` | Mid-level containers |
| Surface Container High | `#dce9ff` | Lower elevation containers |
| Surface Container Highest | `#d3e4fe` | Lowest elevation containers |
| Card Surface | `#ffffff` | Card component default |

### Text & Data Contrast

| Token | Value | Usage |
|-------|-------|-------|
| Text Primary | `#0f172a` (Slate 900) | Headlines, total aggregates, primary values |
| Text Secondary | `#475569` (Slate 600) | Supporting titles, field labels |
| Text Muted | `#94a3b8` (Slate 400) | Metadata, unit tickers, timestamps |
| On Surface | `#0b1c30` | Text on surface backgrounds |
| On Surface Variant | `#3f493f` | Secondary text on surfaces |
| Inverse Surface | `#213145` | Dark surface for inverted contexts |
| Inverse On Surface | `#eaf1ff` | Text on inverse surfaces |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| Border Default | `#e2e8f0` | Standard card borders, dividers |
| Border Dim | `#cbd5e1` | Input borders, secondary dividers |
| Outline | `#6f7a6e` | Focus rings, outline elements |
| Outline Variant | `#becabc` | Subtle outlines |

---

## Typography

The typographic hierarchy prioritizes rapid scanning, absolute clarity of quantities, and zero ambiguity across regulatory logs.

### Font Family

**Inter** is deployed uniformly across headlines, numerical metrics, form fields, and metadata. Open apertures and tall x-heights maintain crisp character separation even on field tablets with lower DPI or high ambient reflections.

### Type Scale

| Token | Font Size | Weight | Line Height | Usage |
|-------|-----------|--------|-------------|-------|
| `headline-lg` | 30px | 700 | 38px | Desktop page titles, top-level headings |
| `headline-lg-mobile` | 22px | 700 | 28px | Mobile page titles |
| `headline-md` | 20px | 600 | 26px | Card section headers, modal titles |
| `headline-sm` | 16px | 600 | 22px | Subsection headers |
| `metric-display` | 24px | 700 | 28px | Summary card figures, total quantities |
| `body-lg` | 15px | 400 | 22px | Long descriptions, body content |
| `body-md` | 13px | 400 | 18px | Standard body text, form content |
| `body-sm` | 11px | 400 | 16px | Supplementary metadata, helper text |
| `label-md` | 12px | 500 | 16px | Input labels, filter chips |
| `label-caps` | 11px | 700 | 14px | Uppercase section labels, badges |

### Weight Governance

- **700 (Bold):** Reserved exclusively for total quantities, summary card figures (`metric-display`), and top-level view titles (`headline-lg`).
- **600 (SemiBold):** Card section headers, modal titles, interactive action labels.
- **500 (Medium):** Input labels, filter chips, and interactive navigation items.
- **400 (Normal):** Long descriptions, supplementary metadata, and audit log entries.

### Metric Unit Pairing

When rendering units of measurement (e.g., `kg`, `MT`, `L`, `drums`), the numerical value is rendered in bold primary text (`#0f172a`) while the trailing unit is formatted with an inline gap in `label-md` weight 500 in `#64748b`.

### Tabular Figures

All numeric values, manifest numbers, statutory weights, dates, and live quantities must render with tabular figures (`font-variant-numeric: tabular-nums;`) to prevent layout shifts and maintain strict vertical column alignment.

---

## Layout & Spacing

The layout model adapts seamlessly between mobile handheld operation (field inspections) and high-density desktop dashboards (compliance audit management).

### Grid Architecture

- **Mobile (360px – 767px):** Single-column workflow with dynamic 2-column metric cards. Margin locked to `1rem` (16px) with an interior component gutter of `0.75rem` (12px). Bottom viewports reserve `4.5rem` (72px) of fixed offset clearance for bottom navigation and the floating action trigger.
- **Tablet (768px – 1023px):** 6-column fluid grid, `1rem` gutters, `1.5rem` canvas margins.
- **Desktop (1024px+):** 12-column responsive layout with a fixed sidebar (`260px`), `1.5rem` gutters, `2rem` outer padding, wrapping cleanly up to `1440px` maximum viewport constraint.

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `gutter` | 0.75rem (12px) | Mobile interior spacing |
| `gutter-desktop` | 1.5rem (24px) | Desktop interior spacing |
| `margin` | 1rem (16px) | Mobile outer margin |
| `margin-desktop` | 2rem (32px) | Desktop outer margin |
| `space-xs` | 0.25rem (4px) | Tight inline gaps |
| `space-sm` | 0.5rem (8px) | Component internal padding |
| `space-md` | 0.75rem (12px) | Small section gaps |
| `space-lg` | 1rem (16px) | Card modules, operational sections |
| `space-xl` | 1.5rem (24px) | Large section separation |

### Spacing Rhythm

- Component-internal padding adheres strictly to a 4px/8px baseline grid.
- Interactive fields and buttons use `space-sm` (8px) vertical padding and `space-lg` (16px) horizontal padding.
- Card modules separate operational sections using `space-lg` (16px) or `space-xl` (24px).

---

## Elevation & Depth

Visual depth is achieved through crisp, low-contrast structural hairlines paired with subtle, highly diffused ambient shadowing.

### Surface Levels

**Surface Level 0 (Base Canvas):** Neutral cool background (`#f8f9ff`). Non-reflective and flat.

**Surface Level 1 (Panels, Data Rows & Cards):** Pure white container (`#ffffff`) bounded by a subtle hairline border (`1px solid #e2e8f0`). Ambient shadow:
```
0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)
```

**Surface Level 2 (Floating Pickers, Dropdowns & Popovers):** Solid `#ffffff` with `1px solid #cbd5e1` and extended diffusion:
```
0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)
```

**Surface Level 3 (Sheets & Statutory Modals):** Surface `#ffffff` elevated above a backdrop scrim (`rgba(15, 23, 42, 0.45)` with `4px` backdrop blur). Shadow:
```
0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)
```

**Floating Action Elevation (Mobile Primary Action):** The circular central trigger (`#16a34a`) uses a colored ambient drop:
```
0 8px 20px -4px rgba(22, 163, 74, 0.38), 0 4px 8px -2px rgba(22, 163, 74, 0.2)
```

---

## Shapes

The shape system expresses ergonomic industrial reliability using calibrated corner radii:

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 0.25rem (4px) | Compact elements |
| `rounded-md` | 0.75rem (12px) | Primary radius for cards, buttons, inputs |
| `rounded-lg` | 1rem (16px) | Large cards, modal headers |
| `rounded-xl` | 1.5rem (24px) | Sheet tops, large containers |
| `rounded-full` | 9999px | Pills, badges, status indicators, FAB |

- **Cards & Primary Modules:** `0.5rem` to `0.75rem` (8–12px), creating distinct, well-contained visual chunks.
- **Modals & Bottom Action Drawers:** Large headers and sheet tops employ `1rem` to `1.5rem` to signal gestural dismissal.
- **Buttons & Input Fields:** Uniform `0.5rem` to `0.75rem`, creating comfortable touch hitboxes.
- **Badges, Category Codes & Status Indicators:** Full pill roundness (`9999px`).
- **Primary Action Trigger:** Complete circle (`9999px`) for unmistakable physical affordance.

---

## Components

### Header & Navigation Architecture

**Unified Top Bar:** Styled in `#14532d` to `#166534` deep forest green. Displays the environmental brand emblem alongside the facility pill dropdown (e.g., `'Molagavalli 1 & 2'`), styled with a subtle semi-transparent background (`rgba(255, 255, 255, 0.12)`), crisp white text, and a dropdown chevron. Includes a notification alert bell with a status badge indicator.

**Mobile Bottom Navigation:** Fixed white container (`#ffffff`) with a `1px` top border in `#e2e8f0`. Five-column distribution: *Home*, *Inventory*, *Elevated '+' Trigger*, *Analytics*, *Settings*. The center trigger is an elevated circular button (`52px` diameter) in `#16a34a` positioned to break the top border line by `14px`.

**Desktop Sidebar:** Fixed width (`260px`), background `#ffffff`, right border `1px solid #e2e8f0`. Navigation links feature a `40px` height, `8px` corner radius, `font-medium 500` text in `#475569`, and an active state highlighted by `#dcfce7` with `#14532d` text and a bold green leading indicator stroke.

### Buttons & Actions

**Primary Button:** Background `#00652c` (hover: `#166534`), white text, `font-semibold 600`, minimum touch height `44px`, padding `12px 20px`, radius `12px`.

**Secondary / Cancel Button:** Pure white background, `1px solid #cbd5e1`, text `#475569` (hover: `#0f172a` on background `#f8f9fc`), `font-medium 500`, radius `12px`.

**Destructive Action:** Background `#fef2f2`, border `1px solid #fecaca`, text `#dc2626` (hover: `#dc2626` text with `#fee2e2` background).

### Category Badges & Compliance Pills

Structured with an inline badge height of `22px`, padding `2px 8px`, border radius `9999px`, and `11px` bold uppercase font.

- **HAZ (Hazardous Solids):** Text `#dc2626`, background `#fef2f2`, border `1px solid #fecaca`.
- **SAFE (Non-Hazardous):** Text `#059669`, background `#ecfdf5`, border `1px solid #a7f3d0`.
- **LIQ (Liquid Waste):** Text `#0284c7`, background `#f0f9ff`, border `1px solid #bae6fd`.
- **ELEC (E-Waste):** Text `#ea580c`, background `#fff7ed`, border `1px solid #fed7aa`.
- **BATT (Battery Waste):** Text `#d97706`, background `#fffbeb`, border `1px solid #fde68a`.
- **OTHER (General):** Text `#64748b`, background `#f1f5f9`, border `1px solid #e2e8f0`.

### Form Fields & Industrial Data Inputs

Height `44px`, padding `8px 12px`, background `#ffffff`, border `1px solid #cbd5e1`, radius `8px`.

Focus state: `2px solid #00652c` outline with zero offset.

Floating helper label: `12px font-medium #475569` positioned above the input with a `4px` bottom gap.

Error state: Border `#dc2626`, focus ring `#fecaca`, accompanying warning label in `#dc2626`.

### Cards & Compliance Summaries

Surface `#ffffff`, border `1px solid #e2e8f0`, radius `12px`, padding `16px`.

Metric layout: Category badge or status tag at top right; label in `font-medium 500 #475569`; prominent numeric value in `font-bold 700 24px #0f172a` accompanied by small `label-md` unit suffix in `#94a3b8`.

### Modals & Verification Sheets

**Header:** Radius `24px` on top, title in `font-semibold 600 20px #0f172a`, minimal circular close icon button (`32px` touch box in `#f1f5f9`).

**Footer Controls:** Sticky layout with side-by-side or stacked actions: primary submit button (`bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl`) paired with secondary dismiss (`border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium py-3 rounded-xl`).

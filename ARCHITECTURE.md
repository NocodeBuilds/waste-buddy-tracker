# WasteBuddy — Architecture & System Design

**Document Version:** 2.0  
**Status:** Current Architecture & Implementation  
**Pattern:** Offline-First PWA + BaaS (Supabase) + Stale-While-Revalidate Client State

---

## 1. Technology Stack Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (PWA)                              │
│  React 18 + TypeScript + Vite (SWC) + Tailwind CSS + shadcn/ui         │
├────────────────────────────────────────────────────────────────────────┤
│                     DATA & CACHING PIPELINE                            │
│  TanStack Query v5 (OfflineFirst + Stale-While-Revalidate)             │
│  IndexedDB / LocalStorage Queue (Offline Sync)                         │
│  React Context (AuthContext + SiteContext with SessionStorage Cache)   │
├────────────────────────────────────────────────────────────────────────┤
│                     NETWORK & SECURITY BOUNDARY                        │
│  Supabase Client (JWT) + Origin CORS Validation + HTTPS / TLS 1.3      │
├────────────────────────────────────────────────────────────────────────┤
│                       BACKEND & SERVERLESS                             │
│  Supabase PostgreSQL (RLS Policies) + Supabase Auth + Edge Functions   │
│  Supabase Storage (Encrypted 'waste-photos' bucket)                    │
└────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Key Responsibility |
|---|---|---|
| **Core Framework** | React 18 + TypeScript | UI component trees, strict type safety |
| **Build & Bundler** | Vite 6 | Fast HMR, code chunking, tree-shaking |
| **PWA Runtime** | Workbox (`vite-plugin-pwa`) | Service worker caching, offline shell runtime |
| **State & Cache** | TanStack Query v5 | Server state caching, optimistic updates, offline queue |
| **Design System** | shadcn/ui + Radix UI + Lucide | Mobile-first components, accessible dialogues, icons |
| **Data Visualization**| Recharts | Compliance curves, age breakdowns, telemetry charts |
| **Regulatory Documents**| SheetJS (`xlsx`) + jsPDF | Form 3 regulatory PDFs and multi-sheet audit manifests |
| **Database & Auth** | Supabase (PostgreSQL 15) | Row-Level Security (RLS), JWT authentication |
| **Serverless Logic** | Deno Edge Functions | Root bootstrap, multi-user management, batch approval |

---

## 2. Directory & Component Structure

```
waste-buddy-tracker/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminTab.tsx                  # Admin portal controller & tab navigation
│   │   │   ├── AuditTrailView.tsx            # Cluster-wide audit event ledger
│   │   │   ├── FacilitiesManagementView.tsx  # Facility & location tag configuration
│   │   │   ├── RecordsOversightView.tsx      # Cross-facility record management
│   │   │   └── UserManagementView.tsx        # Single-admin operator provisioning & RBAC
│   │   ├── analytics/
│   │   │   └── AnalyticsTab.tsx              # Generation curves, aging charts, KPIs
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx            # Route auth and session verification
│   │   │   └── RequestSiteAccess.tsx         # Facility join request modal
│   │   ├── dashboard/
│   │   │   ├── FuturisticDashboard.tsx       # Single-site gauge and telemetry view
│   │   │   └── RegionalCoordinatorDashboard.tsx # Multi-site consolidated compliance radar
│   │   ├── inventory/
│   │   │   ├── DisposalHistoryView.tsx       # Manifest log and batch status viewer
│   │   │   ├── EditWasteDialog.tsx           # Record update dialogue
│   │   │   ├── EntryPhotosButton.tsx         # Compressed photo evidence gallery
│   │   │   ├── ExportOptionsDialog.tsx       # Filterable Excel / Form 3 PDF builder
│   │   │   ├── StorageBreakdownView.tsx      # Waste category breakdown cards
│   │   │   ├── WasteEntryForm.tsx            # Quick mobile generation logging drawer
│   │   │   └── WasteInventoryTable.tsx       # Inventory ledger, multi-filter & actions
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx                 # Mobile bottom navigation
│   │   │   ├── DesktopSidebar.tsx            # Desktop collateral navigation bar
│   │   │   ├── InstallPrompt.tsx             # PWA installation banner
│   │   │   ├── OfflineBanner.tsx             # Network connectivity alert banner
│   │   │   └── SiteSwitcher.tsx              # Facility dropdown (supports 'All Sites')
│   │   └── ui/                               # Accessible shadcn/ui components
│   ├── contexts/
│   │   ├── AuthContext.tsx                   # Session lifecycle, sign-out cache wipe
│   │   └── SiteContext.tsx                   # Facility clustering, role resolution, cache
│   ├── hooks/
│   │   ├── useEntryPhotos.ts                 # Photo query with staleTime caching
│   │   └── useWasteEntries.ts                # Main data engine with initialData hydration
│   ├── lib/
│   │   ├── imageCompress.ts                  # Client-side 85% photo compressor
│   │   ├── offlineSync.ts                    # IndexedDB offline mutation queue
│   │   ├── wasteExports.ts                   # CPCB Form 3 PDF & Excel compilers
│   │   └── wasteTypes.ts                     # Waste catalogue, HOWM rules, formatters
│   ├── pages/
│   │   ├── AdminAuth.tsx                     # Root admin login and password reset
│   │   ├── Auth.tsx                          # Operator sign-in portal
│   │   ├── Index.tsx                         # Primary view switcher shell
│   │   └── ResetPassword.tsx                 # Secure password recovery landing page
│   └── types/
│       └── index.ts                          # Central domain and database TypeScript types
├── supabase/
│   ├── functions/
│   │   ├── admin-manage-user/                # Edge function for operator provisioning
│   │   ├── approve-disposal/                 # Edge function for manifest approval
│   │   └── bootstrap-admin/                  # One-time root admin claim function
│   └── migrations/                           # PostgreSQL schema definitions & RLS
├── vite.config.ts                            # Rollup vendor chunking & PWA service worker
├── PRD.md                                    # Product Requirements Document
├── ARCHITECTURE.md                           # This document
└── README.md                                 # Operational manual & quick start
```

---

## 3. High-Performance Data Architecture

```
[ User Action / Facility Switch ]
                 │
                 ▼
 ┌──────────────────────────────┐
 │ Check LocalStorage Cache     │ ──▶ [ YES ] ──▶ Instant Render UI (0ms)
 └──────────────┬───────────────┘
                │ [ Background Stale-While-Revalidate ]
                ▼
 ┌──────────────────────────────┐
 │ Supabase Query via RLS       │ ──▶ Update Local Cache & Silently Refresh UI
 └──────────────────────────────┘
```

### 3.1 Zero-Flicker Hydration (`placeholderData` + `initialData`)
- In [`useWasteEntries.ts`](file:///d:/waste-buddy-tracker/src/hooks/useWasteEntries.ts), queries utilize `initialData` reading directly from `localStorage.getItem("wastebuddy_entries_${siteId}")`.
- `placeholderData: (prev) => prev` ensures that switching between facilities does not tear down the active DOM tree or trigger full-page skeleton loaders.

### 3.2 Vendor Chunk Isolation
To avoid mobile thread blocking during chart and table rendering, [`vite.config.ts`](file:///d:/waste-buddy-tracker/vite.config.ts) extracts heavy dependencies into isolated vendor bundles:
- `vendor-export`: `xlsx`, `jspdf`, `jspdf-autotable`, `html2canvas` (`~911 kB`)
- `vendor-charts`: `recharts` (`~444 kB`)
- `vendor-motion`: `framer-motion` (`~124 kB`)
- `vendor-icons`: `lucide-react` (`~32 kB`)
- `vendor-react`: `react`, `react-dom`, `react-router-dom` (`~154 kB`)
- `index.js`: Primary app code shrank from `~1.5 MB` to `~896 kB`.

---

## 4. Security & Governance Architecture

### 4.1 Single Root Admin Guardrail
- **Prevention of Admin Sprawl**: The root admin cannot promote other users to `admin`. The user management UI only offers `member` and `manager` roles.
- **Self-Demotion Block**: Admins cannot demote or revoke their own administrative access.
- **Direct Database Fallback**: If network or CORS boundaries block the remote `admin-manage-user` Edge Function, [`UserManagementView.tsx`](file:///d:/waste-buddy-tracker/src/components/admin/UserManagementView.tsx) falls back gracefully to direct authenticated Supabase database operations using RLS.

### 4.2 Non-Destructive Data Model
Every generation entry in `waste_entries` is immutable:
- While in facility storage: `disposal_batch_id IS NULL`.
- When added to a manifest: assigned to a `disposal_batches` record (`status = 'pending'`).
- Upon manager authorization: `status = 'approved'`, capturing `approved_by` and `approved_at`.
- Entries are never deleted during normal disposal, guaranteeing continuous CPCB auditability.

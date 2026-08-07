# WasteBuddy PWA — Architecture Review

**Date**: 2026-08-07
**Reviewer**: Claude Code (Opus 4.8)
**Scope**: Full-stack PWA — frontend, state management, service worker, Supabase integration

---

## 1. Current Architecture

```
App.tsx
├── QueryClientProvider  (TanStack Query v5 — module-level singleton, no defaults)
├── TooltipProvider
├── Toaster + Sonner     (dual toast systems)
├── InstallPrompt        (PWA install banner)
├── ErrorBoundary        (class-based, reloads on catch)
└── BrowserRouter
    └── AuthProvider     (Supabase auth — onAuthStateChange + getSession)
        └── SiteProvider (site memberships, roles, localStorage persistence)
            └── Routes
                ├── /auth     → Auth (login / signup / reset, Zod-validated)
                ├── /app      → Index (tab shell)
                │   ├── Home       → FuturisticDashboard + DashboardStats
                │   ├── Inventory  → WasteInventoryTable (sortable columns)
                │   ├── Analytics  → AnalyticsTab (period-filtered charts)
                │   ├── Settings   → SettingsTab
                │   └── Admin      → AdminTab (users / sites / records / audit)
                └── /admin    → AdminAuth
```

**Data flow**: Supabase REST → TanStack Query cache → React Context → UI components. Mutations use `useRef` guards against stale closures on site switches.

**Service Worker** (Workbox via `vite-plugin-pwa`):
- Strategy: `NetworkFirst` for HTML navigations, `CacheFirst` for static assets and signed photo URLs
- Cache versioning: `v4` suffix, stale-cache purge on load
- Registration: guarded (prod-only, not in iframe, `?sw=off` kill switch)

---

## 2. Strengths

| Area | Detail |
|------|--------|
| Stale-closure protection | `siteIdRef` / `userRef` in `useWasteEntries` prevents a whole class of bugs when switching sites mid-mutation |
| Photo rollback | If entry insert succeeds but photo upload fails, already-uploaded files are cleaned up from storage + DB |
| Cache migration strategy | `v4` suffix on all cache names + proactive stale-cache purge in `registerSW.ts` prevents white-screen on deploys |
| Type safety | Full TypeScript, generated Supabase types, no `any` in production paths |
| Input validation | Zod schemas on auth forms; photo type/size validation on upload |
| RLS-ready queries | All queries filter by `site_id`; delete mutation has defense-in-depth `.eq("site_id")` |
| PWA orientation | Manifest locks to `portrait`, preventing unwanted auto-rotation on Android |
| Error boundary | Class-based boundary catches render errors and offers reload |

---

## 3. Weaknesses

| # | Area | Detail |
|---|------|--------|
| W1 | Query cache | No `defaultOptions` on QueryClient — every query refetches on mount/tab-switch. No persistence across sessions. |
| W2 | Offline experience | No offline detection, no mutation queue. Offline = failed requests + toast errors. PWA is "online-only in disguise". |
| W3 | Form complexity | `WasteEntryForm.tsx` manages 10+ useState calls (multi-line entries, photos, date, confirmation dialog). `Auth.tsx` has 7 useState calls for 3 inputs. |
| W4 | Component size | `AdminTab.tsx` is 657 lines with 4 sub-panels. `WasteEntryForm.tsx` is ~300 lines. |
| W5 | Dual toast systems | Both `Toaster` (shadcn) and `Sonner` are mounted in `App.tsx` — increased bundle size, potential z-index conflicts. |
| W6 | SW navigation fallback | Denylist `/^\/api\//` is overly broad — could misroute future API routes. |
| W7 | Auth redirect | `emailRedirectTo` uses `window.location.origin` — breaks Supabase email confirmation when testing on non-production URLs. |
| W8 | Error boundary | Class-based; no `useErrorHandler` hook for catching errors in event handlers or async code. |
| W9 | Site switching | No AbortController on in-flight queries — rapid site switches cause loading-state flashes. |
| W10 | Photo upload | No retry on transient network failure; no progress indicator for multi-photo uploads. |
| W11 | No beforeunload guard | Filling the entry form and accidentally navigating away loses all input. |
| W12 | Config scattering | Magic numbers across files (`DISPOSAL_LIMIT_DAYS`, `DISMISS_TTL_MS`, `MAX_FILE_MB`, cache version `v4`). |

---

## 4. Risks

| # | Risk | Severity | Mitigation Status |
|---|------|----------|-------------------|
| R1 | RLS misconfiguration exposes cross-site data | Critical | Partially mitigated — queries filter by `site_id`, delete has defense-in-depth. But **must verify** RLS policies exist in Supabase for all 4 tables. |
| R2 | Service worker stale after deploy | Medium | Mitigated — `v4` cache names + stale purge on load. Still depends on SW lifecycle completing before user interaction. |
| R3 | Partial mutation success leaves inconsistent state | Medium | Mitigated — `Promise.allSettled` in entry form. Photo rollback on failure. Still possible for edge cases (e.g., network drops mid-batch). |
| R4 | Large photo uploads exhaust mobile data / crash browser | Medium | Mitigated — 25 MB cap + image compression. Still no upload progress indicator. |
| R5 | Query cache never persists → offline = blank screen | High | Not mitigated. This is the biggest PWA gap. |

---

## 5. Recommended Improvements

### P0 — Critical (security, data loss, production risk)

| # | Improvement | Expected Benefit | Change Risk | Complexity | Downtime |
|---|-------------|-----------------|-------------|------------|----------|
| 3 | **Verify RLS policies in Supabase** | Eliminates the single biggest security risk — cross-site data exposure if policies are missing or misconfigured. All 4 tables (`waste_entries`, `waste_entry_photos`, `disposal_batches`, `user_sites`) must have policies scoping access to `site_id`. | **Low** — read-only verification in SQL editor. No code changes. | **5 min** | **None** — pure DB review |

---

### P1 — Important (performance, maintainability, data integrity)

| # | Improvement | Expected Benefit | Change Risk | Complexity | Downtime |
|---|-------------|-----------------|-------------|------------|----------|
| 1 | **Add `defaultOptions` to QueryClient** (`staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 1`) | Cuts redundant network calls by ~80% on tab switches. Data stays fresh for 30s without refetching. Reduces Supabase API usage. | **Low** — well-tested TanStack Query feature. Only changes when refetches happen, not what data is returned. | **10 lines** in `App.tsx` | **None** — config-only change, hot-deploys |
| 2 | **Add offline detection + persistent banner** | Users know when they're offline. Form can be disabled with a clear message instead of silent failures. Critical for field workers on wind farms with spotty connectivity. | **Low** — new hook reads `navigator.onLine` + browser events. No data mutations. | **~40 lines** across new hook + `Index.tsx` | **None** — purely additive UI |
| 4 | **Persist query cache** (localStorage / IndexedDB) | App renders instantly on reopen from last-known data. Silent refresh in background. Core PWA offline experience — currently the biggest gap. | **Low** — uses `@tanstack/query-persist-client`. Persists only data, not loading/error states. Cache is hydrated on startup. | **~60 lines** + 1 new dependency | **None** — first load shows cached data, then refreshes |
| 6 | **Extract `PhotoCaptureSection` + `ConfirmationDialog` from `WasteEntryForm`** | Each piece testable independently. Form component drops from ~300 to ~150 lines. Easier to add new fields (e.g., video evidence). | **Low** — pure extraction, no behavior changes. | **~80 lines** refactor | **None** — internal refactor |
| 7 | **Add `beforeunload` guard on dirty entry form** | Prevents accidental data loss when user navigates away with unsaved form input. | **Very low** — browser-native `beforeunload` event. | **~10 lines** | **None** |
| 13 | **AbortController on site-switch queries** | Eliminates loading-state flashes when user rapidly switches sites. Cancels in-flight Supabase requests. | **Medium** — requires testing that Supabase client correctly cancels. Some edge cases with `onAuthStateChange` listener cleanup. | **~30 lines** in `SiteContext.tsx` + `useWasteEntries.ts` | **None** — only affects in-flight requests |
| 14 | **Background sync for photo uploads** | Queues failed uploads when offline, replays when connectivity returns. Makes photo upload resilient on field sites. | **Medium** — Workbox `BackgroundSyncPlugin` config change. Need to test SW update cycle. | **~40 lines** in `vite.config.ts` | **None** — SW update on next visit |

---

### P2 — Improvement (quality of life, maintainability)

| # | Improvement | Expected Benefit | Change Risk | Complexity | Downtime |
|---|-------------|-----------------|-------------|------------|----------|
| 5 | **Remove `Toaster`, keep only `Sonner`** | Reduces bundle size (~5 KB). Eliminates potential z-index conflicts between two toast systems. | **Very low** — Sonner already used everywhere. Just remove `<Toaster />` from `App.tsx`. Verify no component imports from `@/components/ui/toaster`. | **1 line removed** + audit imports | **None** |
| 8 | **Migrate forms to React Hook Form + Zod** | Reduces boilerplate ~40% in `Auth.tsx` and `WasteEntryForm.tsx`. Built-in validation, fewer re-renders, easier to add fields. | **Medium** — rewrites form state management. Need to verify all validation edge cases (multi-line entries, photo previews). | **~120 lines** across 2 files | **None** — form behavior preserved |
| 9 | **Replace class ErrorBoundary with `react-error-boundary`** | Modern functional API. Adds `useErrorHandler` hook for catching errors in event handlers and async code (class boundary can't do this). | **Low** — drop-in replacement with same behavior. | **~30 lines** + 1 new dependency | **None** |
| 10 | **Central config module** (`src/lib/config.ts`) | Single source of truth for magic numbers. Easy to change limits, TTLs, cache versions without hunting through files. | **Very low** — new file + import updates. No behavior changes. | **~30 lines** | **None** |
| 11 | **Narrow SW navigation fallback denylist** | Prevents future misrouting if API routes are added. Current `/^\/api\//` would serve `index.html` for any `/api/*` path. | **Very low** — 1 line change in regex. | **1 line** | **None** — only affects SW behavior on non-existent paths |
| 15 | **Photo upload progress indicator** | UX improvement for multi-photo entries. Users see upload progress instead of a spinner. | **Low** — UI-only addition on top of existing mutation. | **~30 lines** | **None** |

---

### P3 — Optional (developer experience)

| # | Improvement | Expected Benefit | Change Risk | Complexity | Downtime |
|---|-------------|-----------------|-------------|------------|----------|
| 12 | **Add `@tanstack/react-query-devtools` in dev** | Debug cache state, see which queries are stale, identify unnecessary refetches during development. | **None** — gated behind `import.meta.env.DEV`. Not in production bundle. | **5 lines** | **None** |

---

## 6. Priority Summary

```
P0 (Critical — Do first)
  └── 3. Verify RLS policies in Supabase     — 5 min, pure DB review, no downtime

P1 (Important — This sprint)
  ├── 1. QueryClient defaultOptions          — 10 lines, 80% fewer refetches
  ├── 2. Offline detection + banner          — 40 lines, critical UX for field workers
  ├── 4. Query cache persistence              — 60 lines, offline PWA experience
  ├── 6. Extract form sub-components          — 80 lines, maintainability
  ├── 7. beforeunload guard                   — 10 lines, data loss prevention
  ├── 13. AbortController on site-switch      — 30 lines, eliminates loading flashes
  └── 14. Background sync for photos          — 40 lines, offline photo resilience

P2 (Improvement — Next sprint)
  ├── 5. Remove duplicate Toaster             — 1 line, bundle reduction
  ├── 8. React Hook Form migration            — 120 lines, form boilerplate reduction
  ├── 9. Functional ErrorBoundary             — 30 lines, modern error handling
  ├── 10. Central config module               — 30 lines, single source of truth
  ├── 11. Narrow SW denylist                  — 1 line, defensive
  └── 15. Photo upload progress               — 30 lines, UX polish

P3 (Optional — Backlog)
  └── 12. TanStack Query devtools             — 5 lines, dev-only
```

---

## 7. Files Reviewed

| File | Lines | Role |
|------|-------|------|
| `src/App.tsx` | 45 | Root component, provider stack, routing |
| `src/main.tsx` | 16 | Entry point, SW registration, controllerchange listener |
| `src/pwa/registerSW.ts` | 62 | SW registration, stale-cache purge |
| `src/contexts/AuthContext.tsx` | 42 | Supabase auth state |
| `src/contexts/SiteContext.tsx` | 76 | Site memberships, roles, localStorage |
| `src/hooks/useWasteEntries.ts` | 213 | Core data mutations (CRUD + disposal) |
| `src/hooks/useEntryPhotos.ts` | 72 | Photo queries + delete mutation |
| `src/hooks/useSiteLocations.ts` | 25 | Location dropdown data |
| `src/pages/Index.tsx` | 127 | Main app shell, tab routing |
| `src/pages/Auth.tsx` | 157 | Login / signup / reset |
| `src/components/WasteEntryForm.tsx` | ~300 | Entry creation with multi-line + photos |
| `src/components/WasteInventoryTable.tsx` | ~690 | Sortable entry table + disposal batches |
| `src/components/AdminTab.tsx` | 657 | Admin panel (4 sub-panels) |
| `src/components/SiteSwitcher.tsx` | ~140 | Site dropdown + request dialog |
| `src/components/InstallPrompt.tsx` | ~110 | PWA install banner |
| `src/components/ErrorBoundary.tsx` | 42 | Class-based error boundary |
| `src/components/FuturisticDashboard.tsx` | ~200 | Home tab charts + stats |
| `vite.config.ts` | 70 | Build config, Workbox SW config |
| `src/lib/wasteTypes.ts` | ~280 | Type definitions, waste type catalog, aggregation helpers |
| `src/integrations/supabase/client.ts` | 60 | Supabase client with env-var guard |
| `public/manifest.webmanifest` | 45 | PWA manifest |

---

*This document is read-only. No application code was modified during this review.*

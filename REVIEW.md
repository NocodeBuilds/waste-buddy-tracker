# WasteBuddy — Full Code Review

## Overview

| Metric | Value |
|---|---|
| Total source lines | ~7,100 |
| Components | 16 main + 24 UI primitives |
| React Query hooks | 5 |
| Supabase tables | 8 |
| Edge functions | 3 |
| PWA | Yes (Workbox) |

---

## 1. Architecture

### Strengths
- Clean separation: hooks (data), components (UI), contexts (state), lib (business logic)
- React Query v5 for server state — correct choice, caching and invalidation patterns are well-established
- Service role key only in Edge Functions — never shipped to client
- RLS enabled on all tables with SECURITY DEFINER helper functions
- JWT verification in edge functions is correct (`auth.getUser(token)`)

### Issues
- Two dashboard components (`FuturisticDashboard` and `DashboardStats`) — the "futuristic" one is dead weight from Lovable, never unmounted
- `index.html` has error handler script injected inline — fine for debugging but should be removed for production
- No error boundary wrapping individual tabs — one bad component crashes the whole app shell

---

## 2. Data Layer (React Query)

### Strengths
- Query keys consistently include `siteId` — switching sites loads fresh data
- `enabled: !!siteId` pattern prevents queries from running before site is known
- Cache invalidation on every mutation (add/update/delete/approve)
- Photo compression before upload (~85% size reduction)

### Critical Issues

**C1. Stale `siteId` in mutation callbacks**
- **File:** `src/hooks/useWasteEntries.ts:21, 105-108, 121, 129, 152-156, 181-184`
- **Problem:** `siteId` is captured at hook setup. If the user switches sites while a mutation is in flight, the mutation writes to the PREVIOUS site. Example: user on Site A clicks "Add entry" → switches to Site B → mutation completes → entry appears in Site A.
- **Fix:** Pass `siteId` as an argument, or use a ref updated on site change.

**C2. `useAdminQueries.ts` sites query key mismatch**
- **File:** `src/hooks/useAdminQueries.ts:13, 121`
- **Problem:** Query key is `["sites", user?.id]` but mutation invalidates `["sites"]` — these are different cache entries. After creating a site, the cached list never refreshes.
- **Fix:** Use `["sites"]` consistently (drop `user?.id` — it fetches all sites anyway).

**C3. Photo upload failure leaves partial state**
- **File:** `src/hooks/useWasteEntries.ts:82-101`
- **Problem:** If one photo uploads and the next fails, the entry exists in the DB with incomplete photos. No rollback.
- **Fix:** On failure, delete the entry + any uploaded photos. Or upload all photos first, validate, then insert.

### High Issues

**H1. Missing `onError` callbacks on all `useWasteEntries` mutations**
- **File:** `src/hooks/useWasteEntries.ts:63, 111, 124, 132, 166`
- **Problem:** None of the 5 mutations have `onError`. If a mutation fails, the error is swallowed unless the consumer reads `mutation.error`.
- **Fix:** Add `onError: (e: Error) => toast.error(e.message)` to each mutation.

**H2. `useDeletePhoto` does not invalidate photo count queries**
- **File:** `src/hooks/useEntryPhotos.ts:68`
- **Problem:** `qc.invalidateQueries({ queryKey: ["waste_entry_photos"] })` doesn't match `["waste_entry_photo_counts", ...]` — photo counts stay stale after deletion.
- **Fix:** Invalidate both keys, or consolidate under a shared prefix.

**H3. Signed URLs cached past expiry**
- **File:** `src/hooks/useEntryPhotos.ts:15-37`
- **Problem:** Signed URLs expire after 3600s. React Query's default `staleTime: 0` means data is cached indefinitely. After 1 hour, all cached URLs are broken.
- **Fix:** Set `staleTime: 55 * 60_000` (55 minutes) to refetch before expiry.

---

## 3. UI Components

### Strengths
- MultiSelect component with checkbox support — clean custom implementation
- Export dialog has full filter options with preview
- Calendar pickers now have independent popover state (fixed in this session)
- Error boundary catches React crashes and shows fallback

### Issues

**M1. `WasteInventoryTable` re-renders everything on any state change**
- No memoization on list items. With 100+ entries + photos, each state change (drawer open/close, filter change) triggers a full table re-render.
- **Fix:** Wrap table rows in `React.memo`, use `useMemo` for filtered list.

**M2. ComicBubble and FuturisticDashboard are dead code**
- Legacy Lovable-era components. Not imported anywhere active. Remove them.

**M3. No empty state in inventory table**
- When no entries exist, the table shows headers with no rows — not informative. Should show "No waste entries yet" with a call-to-action.

**M4. Export dialog doesn't validate range dates**
- User can pick "Custom Date Range" and leave both dates empty — falls through silently. The `useMemo` filter just returns all entries with no warning.

---

## 4. Security

### Strengths
- Service role key never exposed client-side (only in edge functions via `Deno.env`)
- RLS enabled on every table
- `dangerouslySetInnerHTML` not used anywhere — no XSS
- No `created_by` spoofing possible (RLS `WITH CHECK` enforces `created_by = auth.uid()`)

### High Issues

**H4. Creator can approve their own disposal batch**
- **File:** `supabase/functions/approve-disposal/index.ts:65-67`
- No `disposed_by != callerId` check. A member creates a batch and immediately approves it — defeats the purpose of the approval workflow.
- **Fix:** After fetching the batch, add `if (batch.disposed_by === callerId) return 403`.

**H5. Audit log readable by any admin across all sites**
- **File:** `supabase/migrations/20250804000000_full_schema.sql:393`
- Policy uses `is_any_admin()` — any admin can read audit entries from sites they don't belong to.
- **Fix:** Use `is_site_admin_or_manager(auth.uid(), site_id)` instead.

**H6. TOCTOU race on last-admin check**
- **File:** `supabase/functions/admin-manage-user/index.ts:121-127, 139-151`
- Counts current admins, then deletes. Concurrent requests can reach zero admins.
- **Fix:** Wrap in a transaction with `FOR UPDATE` lock, or maintain a counter.

### Medium Issues

**M5. CORS falls back to `*` when ALLOWED_ORIGINS is empty**
- **File:** `supabase/functions/approve-disposal/index.ts:13-16`, `admin-manage-user/index.ts:12-15`
- If the env var is unset, any origin can call the function.
- **Fix:** Make `ALLOWED_ORIGINS` required; fail startup if empty.

**M6. `localStorage` stores refresh tokens**
- **File:** `src/integrations/supabase/client.ts:41`
- Token exfiltratable via XSS. No current XSS vectors, but latent risk.
- **Fix:** Use `sessionStorage` instead (cleared on tab close), or implement a cookie-based session.

**M7. Any authenticated user can create sites**
- **File:** `supabase/migrations/20250804000000_full_schema.sql:291-292`
- RLS policy `Authenticated users can create sites` with only `auth.uid() is not null` check. No rate limit, no validation.
- **Fix:** Add `length(name) <= 80`, require existing admin status, or cap sites per user.

### Low Issues

**L1. Profile PII visible to admins of sites user no longer belongs to**
- **File:** `supabase/migrations/20250804000000_full_schema.sql:301-306`
- Admin can query profile data of users who left their site.
- **Fix:** Filter to current memberships only.

**L2. CSV formula injection**
- **File:** `src/components/SettingsTab.tsx:64-68`
- `sanitizeCsv` uses single-quote prefix which Excel ignores. Tab prefix or double-quote wrapping is more reliable.
- **Fix:** Wrap all fields in double quotes, escape internal quotes.

**L3. `user_id` sent in approve-disposal body but never read**
- **File:** `src/hooks/useWasteEntries.ts:170`
- Edge function derives caller from JWT. If future code wires `body.user_id`, it's a privilege escalation vector.
- **Fix:** Remove `user_id` from the payload.

---

## 5. PWA

### Strengths
- Workbox runtime caching for static assets and signed photo URLs
- `NetworkFirst` for navigations (gets fresh HTML)
- `CacheFirst` for assets and photos
- `registerType: "autoUpdate"` with `controllerchange` listener for seamless updates

### Issues

**M8. Service worker scope may be too broad**
- `{ scope: "/" }` — if the app is served from a subdirectory, the SW won't work. Document the deployment requirement.

**M9. No offline fallback UI**
- When offline, Workbox serves cached `index.html` — but if the user is on a deep route (`/app`), `navigateFallback` serves `index.html` which may then fail to load data. No "You're offline" message.
- **Fix:** Add an offline indicator component that reads `navigator.onLine`.

---

## 6. UX Gaps

| Issue | Severity | Description |
|---|---|---|
| No empty states | Medium | Inventory, analytics, and disposal sections show blank areas instead of helpful messages |
| No retry on failed mutation | Low | If `addEntry` fails after photo upload, user must re-fill the entire form |
| No undo for delete | Low | Accidental entry deletion is permanent |
| Admin tab split | Low | Admin tab is a long scroll — users tab, sites tab, requests tab should be separate sub-tabs |
| No pagination on large entry lists | Medium | 200+ entries in inventory = slow table render |
| No loading skeletons | Low | Spinners instead of skeleton cards during data fetch |

---

## 7. Code Quality

### Positives
- TypeScript throughout — no `any` escapes except one in `useEntryPhotos.ts`
- Consistent naming conventions (camelCase for vars, PascalCase for components)
- `cn()` utility for class merging — clean pattern
- Zod validation on auth forms
- Image compression library is well-isolated and has a fallback

### Negatives
- `package.json` name is still `vite_react_shadcn_ts` — boilerplate leftover
- `FuturisticDashboard.tsx` is dead code (~300 lines) — remove
- No unit tests (only `example.test.ts` placeholder)
- No lint rule enforcement in CI (eslint is configured but not gated)
- `bun.lock` and `bun.lockb` present — confusing for npm-only users

---

## 8. Prioritized Fix Plan

| Priority | Item | Effort | Fix |
|---|---|---|---|
| **P0** | C1: Stale siteId in mutations | Medium | Pass siteId as mutation arg |
| **P0** | H4: Creator approves own batch | Trivial | Add `batch.disposed_by !== callerId` check |
| **P0** | C2: Query key mismatch in useAdminQueries | Trivial | Align keys to `["sites"]` |
| **P1** | H5: Audit log cross-site read | Trivial | Change RLS policy to `is_site_admin_or_manager` |
| **P1** | H1: Missing onError handlers | Medium | Add `onError` to all 5 mutations |
| **P1** | H2: Photo count cache invalidation | Trivial | Invalidate both query keys |
| **P1** | H6: TOCTOU on last admin | Medium | Wrap in transaction |
| **P2** | H3: Signed URL expiry | Trivial | Set staleTime to 55 min |
| **P2** | M8: CORS fallback to * | Trivial | Require ALLOWED_ORIGINS |
| **P2** | M4: Table re-render optimization | Medium | Memoize rows |
| **P3** | Remove dead code (FuturisticDashboard) | Small | Delete file + import |
| **P3** | Add empty states | Medium | Add placeholder components |
| **P3** | Replace xlsx with exceljs | Medium | Rewrite export logic |

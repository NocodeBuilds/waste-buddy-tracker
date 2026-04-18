
This is a major upgrade: backend (Supabase via Lovable Cloud), auth, multi-site isolation, role-based disposal, green theme, welcome page, plus the dashboard/form/analytics enhancements. Plan is broken into clear phases.

## Phase 1 — Backend (Lovable Cloud + Supabase)

Enable Lovable Cloud and create these tables:

- `sites` — id, name, location, created_at
- `profiles` — id (= auth.users.id), full_name, created_at
- `user_sites` — user_id, site_id (many-to-many; users can belong to multiple sites)
- `user_roles` — user_id, site_id, role (`admin` | `manager` | `member`) — site-scoped roles via enum `app_role`
- `waste_entries` — id, site_id, wtg_id, waste_type_id, waste_category (`hazardous` | `non_hazardous`), quantity, generated_date, activity_type, notes, disposal_batch_id (nullable), created_by, created_at
- `disposal_batches` — id, site_id, disposed_date, disposed_by, notes, created_at

**RLS**: All tables enabled. Security-definer function `has_site_access(user_id, site_id)` and `has_site_role(user_id, site_id, role)` to avoid recursion. Policies: users only see/insert rows for sites they belong to. Only `admin`/`manager` roles can create disposal batches.

Trigger: auto-create `profiles` row on `auth.users` insert.

## Phase 2 — Auth & Welcome flow

New routes:
- `/` — Welcome page (hero + features overview + Login CTA)
- `/auth` — Login page (email + password). No public signup (invite-only).
- `/reset-password` — required by Lovable for password recovery
- `/app` — protected app shell (current Index moved here)

Auth uses Supabase email/password with `onAuthStateChange` + `getSession` pattern. ProtectedRoute wrapper redirects unauthenticated users to `/auth`.

**Invite-only**: signup UI is removed. Admins create users from a new "Users" section in Settings (admin-only) using `supabase.auth.admin.inviteUserByEmail` via an edge function (since admin API requires service role).

## Phase 3 — Site selection

After login, if user belongs to >1 site, show site picker. Selected site stored in a `SiteContext` (React Context + localStorage). All queries filter by `site_id`. Header shows current site with a switcher dropdown.

## Phase 4 — Form enhancements (`WasteEntryForm`)

- Add **Waste Category** dropdown: Hazardous / Non-Hazardous (required, persisted to DB)
- Add **back arrow** in drawer header (closes drawer)
- Form writes to Supabase `waste_entries` scoped to current site

## Phase 5 — Simplified disposal

Remove per-entry "Dispose" buttons. Add a single **"Mark Quarterly Disposal"** action (admin/manager only) on the Inventory tab. It:
1. Opens confirmation dialog listing all active entries at the site
2. Creates one `disposal_batches` row
3. Updates all selected active entries' `disposal_batch_id` in one transaction (via edge function or RPC)

Inventory shows disposal batch history below active entries.

## Phase 6 — Dashboard cumulative totals

New section **"Cumulative Available Waste"**: aggregates active (non-disposed) entries by `waste_type_id`, summed in correct units. Shows e.g. "Waste Oil: 124 L", "Waste Grease: 38 kg", grouped by Hazardous vs Non-Hazardous category. Existing per-type breakdown stays.

## Phase 7 — Analytics enhancements

- Avg days to disposal (computed from `disposal_batches` vs entry generated_date)
- **Nearby disposal countdown** — days until oldest active entry hits 90d
- **Disposal history timeline** — list of past batches with date + total qty disposed
- **Stats by category** — Hazardous vs Non-Hazardous totals + counts
- **Stats by waste type** — bar chart of cumulative quantity per type (current units shown beside)
- Top WTGs (kept)

## Phase 8 — Green theme

Update `src/index.css` HSL tokens:
- `--primary`: deep green (`142 50% 25%`)
- `--accent`: bright leaf green (`142 70% 42%`)
- `--success`: kept green
- `--warning`: amber (kept)
- `--overdue`: red (kept)
- Background: subtle green-tinted off-white

Header, FAB, badges, and chart fills inherit new tokens — no per-component color rewrites needed beyond a few accent references.

## Phase 9 — Migrate from localStorage

Replace `useWasteStore` with `useWasteEntries` hook using `@tanstack/react-query` + Supabase client. Old localStorage data ignored (fresh start).

## Technical notes

- Roles in separate `user_roles` table (per security rules), enum `app_role`
- Use `SECURITY DEFINER` functions for all role checks in RLS to prevent recursion
- Email validation via zod on auth forms
- First admin: after enabling Cloud, you (the user) sign up once, then we run a one-time SQL to grant you `admin` role on a default site so you can invite others

## Suggested build order

1. Enable Cloud, create schema + RLS + seed default site
2. Auth pages + ProtectedRoute + welcome page
3. Site context + site switcher
4. Migrate waste entries to Supabase + add category field + back arrow
5. Simplified batch disposal flow
6. Dashboard cumulative totals + green theme
7. Analytics upgrades
8. Admin-only invite flow

This will take several iterations — recommend approving and building in this order, testing each phase before moving on.

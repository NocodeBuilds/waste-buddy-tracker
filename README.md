# WasteBuddy

A mobile-first Progressive Web App for tracking hazardous and non-hazardous waste at industrial facilities. Built for compliance with India's Hazardous and Other Wastes (HOWM) Rules, 2016.

**Live features:**
- Multi-site waste tracking with role-based access
- 90-day compliance monitoring with overdue alerts
- Approval workflow for disposal batches
- Excel and Form 3 PDF exports with full filter options
- Photo evidence for waste entries
- PWA (installable, offline-capable)

**Stack:** React 18 · TypeScript · Vite · shadcn/ui · TanStack Query · Supabase (Auth + PostgreSQL + Storage + Edge Functions) · Recharts · jsPDF

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works for small fleets)

### 1. Install
```bash
npm install
```

### 2. Configure Supabase
Edit `src/integrations/supabase/client.ts` with your project URL and anon key.

Or set environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run database migrations
In Supabase SQL Editor, run the migrations in `supabase/migrations/` (or use the schema in ARCHITECTURE.md).

### 4. Deploy Edge Functions
```bash
supabase functions deploy bootstrap-admin
supabase functions deploy admin-manage-user
supabase functions deploy approve-disposal
```

### 5. Create Storage bucket
In Supabase Dashboard → Storage → Create bucket `waste-photos` (private).

### 6. Bootstrap first admin
Call the `bootstrap-admin` Edge Function with your email to create the first admin user.

### 7. Run locally
```bash
npm run dev
```

### 8. Build for production
```bash
npm run build
```
Output in `dist/` — deploy to any static host (Vercel, Netlify, Cloudflare Pages).

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run check` | Lint + typecheck |
| `npm run test` | Run Vitest tests |

---

## Project Structure

```
src/
├── components/         # UI components (tabs, dialogs, forms)
├── contexts/           # React contexts (Auth, Site)
├── hooks/              # React Query hooks + utilities
├── integrations/       # Supabase client + types
├── lib/                # Business logic, exports, image compression
├── pages/              # Route pages
├── pwa/                # Service worker registration
└── types/              # Shared TypeScript types

supabase/
└── functions/          # Edge Functions (Deno)
    ├── bootstrap-admin/
    ├── admin-manage-user/
    └── approve-disposal/
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full architecture details.

---

## How to Use

### Sign Up
1. Open the app → **Sign up** tab
2. Enter name, email, password
3. Confirm email (or skip if disabled)
4. Auto-logged in → see "Request Site Access" page

### Join a Site
1. Pick a site from the dropdown
2. Add a note (optional)
3. Submit → wait for admin approval

### Log a Waste Entry
1. Tap **+** (bottom nav)
2. Pick waste type → weight/count, date, activity, location, notes
3. Add photos (optional)
4. Submit → entry appears in inventory

### Request a Disposal
1. Open **Inventory** tab
2. Tap **Export** if needed, otherwise tap **Mark Quarterly Disposal**
3. Pick disposal date, add notes
4. Submit → batch created (pending)
5. Wait for manager/admin approval

### Approve a Disposal (Manager/Admin)
1. Open **Inventory** tab
2. Find the pending batch card
3. Tap **Approve** or **Reject** (with reason)

### Export Data
1. Open **Inventory** tab
2. Tap **Export** button (top right of "In storage by Category" section)
3. Pick format: Excel or PDF
4. Pick period, categories, waste types
5. Tap **Export** → file downloads

---

## Roles

| Role | Can do |
|---|---|
| **Member** | Log entries, submit disposal requests, export |
| **Manager** | All Member + approve/reject disposals |
| **Admin** | All Manager + invite users, approve access requests |

Roles are assigned per site. A user can be admin of one site and member of another.

---

## Data Model

Every waste entry is a permanent row in `waste_entries`. When disposed, the entry's `disposal_batch_id` is set to the batch's ID — nothing is deleted.

**Disposal workflow:**
```
Member submits → batch.status = 'pending'
  → entries stay in storage (disposal_batch_id is still null)
Manager/Admin approves (via Edge Function)
  → batch.status = 'approved', approved_by, approved_at
  → all unlinked entries on that site get linked to batch
  → entries disappear from "in storage" list
```

If a disposal is rejected, entries remain unlinked and reappear in storage.

See [`PRD.md`](./PRD.md) for the complete product spec.

---

## Disposal Approval (Edge Function)

The Edge Function `approve-disposal` enforces the approval workflow server-side:
- Verifies caller is manager or admin of the target site
- Only works on `pending` batches
- On approve: marks batch approved AND links all unlinked entries to the batch
- On reject: marks batch rejected with optional reason, entries stay unlinked

This prevents frontend tampering and ensures consistency.

---

## Exports

Two formats, both with full filter options:

**Excel** (multi-sheet workbook):
- Cover sheet with metadata
- Inventory sheet (detail rows)
- By Waste Type sheet (totals)
- By Location sheet (totals)

**PDF** (Form 3 format):
- HOWM Rules compliant
- One row per entry
- Total weight and volume footer
- Signature blocks

**Filter options:**
- Format: Excel or PDF
- Period: All Time, Specific Month, Custom Range, Financial Year, Specific Disposal Batch
- Waste Category: Multi-select (Hazardous, Non-Hazardous, E-Waste, Other)
- Waste Type: Multi-select, cascades from selected categories

---

## Storage Optimization

The free Supabase tier gives you 500MB. Photos are typically the largest data.

**Client-side compression:** every photo is compressed before upload:
- Downscaled to max 1200px on long edge
- Re-encoded as JPEG at 70% quality
- **~85% size reduction** (typical 2-4MB → 200-400KB)

If compression fails, the original is uploaded as a fallback.

**Estimated capacity:**
- ~150-250 entries with photos (uncompressed)
- **~1,200-2,500 entries with photos (compressed)**
- Tens of thousands of text-only entries

---

## PWA

The app is a Progressive Web App:
- Installable to home screen on mobile and desktop
- Offline-capable after first visit (service worker caches the shell)
- Works on any device with a modern browser

Install prompt appears automatically when conditions are met.

---

## Tech Highlights

- **TypeScript** for type safety across the codebase
- **TanStack Query** for server state caching and automatic invalidation
- **React Context** for auth and site state
- **shadcn/ui** for accessible, theme-aware components
- **Recharts** for responsive, interactive charts
- **jsPDF** + **jspdf-autotable** for PDF generation
- **Workbox** (via vite-plugin-pwa) for service worker

---

## Documentation

- [`PRD.md`](./PRD.md) — Product Requirements Document (features, user flows, data model)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Architecture, data flow, security, deployment

---

## License

MIT (or your preferred license — update as needed)

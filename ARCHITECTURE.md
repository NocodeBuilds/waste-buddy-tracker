# WasteBuddy — Architecture

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| UI library | shadcn/ui (Radix UI primitives + Tailwind CSS) |
| State management | React Context (Auth, Site) + TanStack Query (v5) |
| Routing | React Router v6 |
| Charts | Recharts |
| PDF generation | jsPDF + jspdf-autotable |
| Excel export | xlsx (SheetJS) |
| Image compression | Canvas API (createImageBitmap + toBlob) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Deployment | Vercel / Netlify / any static host |
| PWA | Workbox (via vite-plugin-pwa) |

## 2. Directory Structure

```
waste-buddy-tracker/
├── src/
│   ├── components/
│   │   ├── AdminTab.tsx              # Admin panel (users, sites, requests)
│   │   ├── AlertsPanel.tsx           # Overdue/warning alerts popover
│   │   ├── AnalyticsTab.tsx          # Charts, metrics, trends
│   │   ├── BottomNav.tsx             # Tab navigation (mobile)
│   │   ├── ComicBubble.tsx           # Animated info bubbles (dashboard)
│   │   ├── DashboardStats.tsx        # Home page: cards + compliance status
│   │   ├── EditWasteDialog.tsx       # Edit entry modal
│   │   ├── EntryPhotosButton.tsx     # Photo viewer for entries
│   │   ├── ErrorBoundary.tsx         # Error fallback
│   │   ├── ExportOptionsDialog.tsx   # Export filter dialog
│   │   ├── FuturisticDashboard.tsx   # Legacy dashboard (kept)
│   │   ├── InstallPrompt.tsx         # PWA install prompt
│   │   ├── MultiSelect.tsx           # Checkbox multi-select dropdown
│   │   ├── ProtectedRoute.tsx        # Auth guard
│   │   ├── RequestSiteAccess.tsx     # Site request flow for new users
│   │   ├── SettingsTab.tsx           # App settings
│   │   ├── SiteSwitcher.tsx          # Site dropdown in header
│   │   ├── WasteEntryForm.tsx        # New entry form (bottom sheet)
│   │   ├── WasteInventoryTable.tsx   # Inventory tab: table + filters + export
│   │   ├── dashboard/
│   │   │   └── DashboardCard.tsx     # Glass card wrapper
│   │   └── ui/                       # shadcn/ui components
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── popover.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── textarea.tsx
│   │       └── ...
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Session state + signOut
│   │   └── SiteContext.tsx           # Site list, current site, roles
│   ├── hooks/
│   │   ├── useAdminQueries.ts        # Admin-specific React Query hooks
│   │   ├── useEntryPhotos.ts         # Photo count query
│   │   ├── useLocalStorage.ts        # LocalStorage sync hook
│   │   ├── usePeriodState.ts         # Period filter state (analytics)
│   │   ├── useSiteLocations.ts       # Location list query
│   │   └── useWasteEntries.ts        # Core CRUD + disposal mutations
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts             # Supabase client (anon key)
│   │       └── types.ts              # Generated DB types
│   ├── lib/
│   │   ├── imageCompress.ts          # Client-side JPEG compression
│   │   ├── storageKeys.ts            # localStorage key constants
│   │   ├── utils.ts                  # cn() helper
│   │   ├── wasteExports.ts           # Excel + PDF export logic
│   │   └── wasteTypes.ts             # Waste catalogue, helpers, types
│   ├── pages/
│   │   ├── AdminAuth.tsx             # Admin PIN authentication
│   │   ├── Auth.tsx                  # Login / Signup / Reset password
│   │   ├── Index.tsx                 # Main app shell (all tabs)
│   │   ├── NotFound.tsx              # 404
│   │   └── ResetPassword.tsx         # Password reset page
│   ├── pwa/
│   │   └── registerSW.ts             # Service worker registration
│   ├── types/
│   │   └── index.ts                  # Shared TypeScript types
│   ├── App.tsx                       # Router setup
│   └── main.tsx                      # Entry point
├── supabase/
│   └── functions/
│       ├── admin-manage-user/        # Invite, role change, remove user
│       ├── approve-disposal/         # Approve/reject disposal batches
│       └── bootstrap-admin/          # One-time admin creation
├── dist/                             # Build output (Vite)
├── PRD.md
├── ARCHITECTURE.md
├── README.md
└── package.json
```

## 3. Authentication & Authorization

### Auth
- Supabase Auth (email/password)
- Session stored in memory via `onAuthStateChange` listener
- JWT token passed automatically by Supabase client

### Authorization
- **Row-Level Security (RLS)** on all tables
- Users see only data for sites they belong to (`user_sites` table)
- Roles stored in `user_roles` table (per user, per site)
- Edge functions verify caller identity via JWT, then check `user_roles` for authorization

### Permission Matrix

| Action | Member | Manager | Admin |
|---|---|---|---|
| Create waste entry | ✅ | ✅ | ✅ |
| View inventory | ✅ (own site) | ✅ (own site) | ✅ (any site) |
| Edit entry | ❌ | ✅ | ✅ |
| Delete entry | ❌ | ✅ | ✅ |
| Submit disposal | ✅ | ✅ | ✅ |
| Approve disposal | ❌ | ✅ | ✅ |
| Reject disposal | ❌ | ✅ | ✅ |
| Invite users | ❌ | ❌ | ✅ |
| Change roles | ❌ | ❌ | ✅ |
| Approve site access | ❌ | ❌ | ✅ |
| Export reports | ✅ | ✅ | ✅ |

## 4. Data Flow

### 4.1 Entry Creation
```
User fills form → WasteEntryForm
  → addEntry mutation (React Query)
    → INSERT waste_entries row
    → compressImages() on selected photos
    → For each photo: upload to Supabase Storage → INSERT waste_entry_photos row
  → Invalidate queries → UI refreshes
```

### 4.2 Disposal Approval
```
User submits disposal → createDisposalBatch mutation
  → INSERT disposal_batches (status: 'pending')
  → No entry linking yet

Manager/Admin clicks Approve
  → approveDisposalBatch mutation
    → invoke Edge Function (approve-disposal)
      → Verify JWT → Check user_roles (manager or admin)
      → UPDATE disposal_batches SET status = 'approved', approved_by, approved_at
      → UPDATE waste_entries SET disposal_batch_id = batch_id WHERE disposal_batch_id IS NULL
  → Invalidate queries → UI refreshes
```

### 4.3 Export
```
User clicks Export → ExportOptionsDialog opens
  → User selects format, period, category, waste type
  → handleExport callback
    → Filter entries locally (period + category + type)
    → Call export function (excel or pdf)
      → Generate file → Trigger browser download
```

## 5. Database Schema

```sql
-- Core tables (simplified)
sites (id, name, location, created_at)
profiles (id, email, full_name, created_at)
user_sites (user_id, site_id)           -- membership
user_roles (user_id, site_id, role)     -- admin/manager/member
site_access_requests (id, user_id, site_id, status, note, created_at)

waste_entries (
  id, site_id, waste_type_id, waste_category,
  weight_kg, piece_count, quantity (legacy),
  generated_date, activity_type, location, notes,
  created_by, created_at, updated_at,
  disposal_batch_id                      -- null = in storage
)

disposal_batches (
  id, site_id, disposed_date, disposed_by, notes,
  status (pending/approved/rejected),
  requested_at, approved_by, approved_at, rejection_reason
)

waste_entry_photos (
  id, waste_entry_id, site_id, storage_path, uploaded_by, created_at
)
```

## 6. State Management

| State | Scope | Implementation |
|---|---|---|
| Auth session | Global | React Context (AuthContext) |
| Current site, site list, roles | Global | React Context (SiteContext) |
| Waste entries, batches | Site-scoped | TanStack Query (`useWasteEntries`) |
| Admin queries | Site-scoped | TanStack Query (`useAdminQueries`) |
| UI state (filters, drawers, dialogs) | Local | useState in each component |
| Period filter | Tab-local | useState + useMemo in AnalyticsTab |
| Site preference | Persistent | localStorage (`hazwaste-current-site`) |

## 7. Caching Strategy

- **React Query** caches all server data with `queryKey` scoping (includes `siteId`)
- Cache invalidation on mutations (add/update/delete/approve)
- Queries are keyed by `siteId` — switching sites automatically loads new data
- Photos are not cached by React Query (fetched on demand via Supabase Storage)

## 8. Edge Functions

| Function | Purpose | Auth |
|---|---|---|
| `bootstrap-admin` | One-time admin creation for new projects | Bearer token |
| `admin-manage-user` | Invite user, change role, remove user | JWT + admin check |
| `approve-disposal` | Approve/reject disposal batches | JWT + manager/admin check |

All edge functions:
- Accept Bearer token in Authorization header
- Verify caller identity via `auth.getUser()`
- Check authorization via `user_roles` table
- Use service role key for admin operations
- Return JSON with appropriate HTTP status codes

## 9. Security

- RLS policies on all tables
- Service role key only used in Edge Functions (never in client)
- Site data isolated by `site_id` foreign key
- Role checks in both RLS policies and Edge Functions (defense in depth)
- Photos stored in private bucket, accessed via RLS-scoped queries
- CORS restricted to allowed origins in Edge Functions
- Input validation via Zod schemas (signup, login)

## 10. PWA

- Built with `vite-plugin-pwa` (Workbox)
- Precaching: all static assets (HTML, JS, CSS)
- Runtime caching: Supabase API calls (stale-while-revalidate)
- Install prompt component (detects `beforeinstallprompt` event)
- Works offline after first load (cached shell + data from React Query)

## 11. Deployment

### Prerequisites
- Supabase project (free tier minimum)
- Node.js 18+

### Build
```bash
npm install
npm run build
```

### Deploy
Upload `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages).

### Supabase Setup
1. Run migrations (SQL Editor):
   - Create tables, RLS policies, seed data
   - Add `status` columns to `disposal_batches`
2. Deploy Edge Functions:
   ```bash
   supabase functions deploy approve-disposal
   supabase functions deploy admin-manage-user
   supabase functions deploy bootstrap-admin
   ```
3. Create Storage bucket `waste-photos` (private)
4. Configure Auth settings (email redirect URLs, SMTP for emails)

## 12. Performance

| Metric | Target | Current |
|---|---|---|
| First load (cached) | <2s | ~1.5s on 4G |
| First load (uncached) | <3s | ~2.5s on 4G |
| Photo upload (compressed) | <5s | ~3s per photo |
| Chart render | <500ms | ~300ms |

## 13. Known Limitations

- No real-time updates (users must refresh to see others' changes)
- No push notifications for disposal requests
- Photos stored in Supabase Storage (not CDN-optimized)
- No bulk entry import
- No undo for accidental disposal approval (requires manual DB fix)

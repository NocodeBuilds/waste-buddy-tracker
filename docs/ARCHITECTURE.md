# Architecture

Comprehensive architecture documentation for Waste Buddy Tracker.

---

## System Overview

Waste Buddy Tracker is a client-side Progressive Web App backed by Supabase. The architecture prioritizes offline-first operation, real-time collaboration, and regulatory compliance tracking.

### Design Principles

1. **Offline-first**: All features work without network. Data syncs when reconnected.
2. **Security**: Supabase RLS enforces row-level access control. No client bypass possible.
3. **Progressive Enhancement**: Core functionality works everywhere. Enhanced features require modern browsers.
4. **Type Safety**: Full TypeScript coverage with strict checking.
5. **Performance**: Code-split bundles, image optimization, efficient caching.

---

## Data Layer

### Database Schema

```
profiles (extends auth.users)
  ├── id (UUID, FK to auth.users)
  ├── full_name
  ├── role (admin | operator | viewer)
  └── created_at

sites
  ├── id (UUID)
  ├── name
  ├── location
  ├── company_id (UUID)
  └── created_at

waste_types
  ├── id (UUID)
  ├── name
  ├── category
  ├── company_id (UUID)
  └── created_at

waste_entries
  ├── id (UUID)
  ├── company_id (UUID)
  ├── site_id (UUID)
  ├── waste_type_id (UUID)
  ├── created_by (UUID)
  ├── activity_type
  ├── weight_kg
  ├── disposal_date
  ├── batch_number
  ├── five_whys_data (JSONB)
  └── created_at

disposal_records
  ├── id (UUID)
  ├── company_id (UUID)
  ├── batch_number
  ├── disposal_date
  ├── transporter
  ├── facility
  ├── manifest_number
  ├── created_by (UUID)
  └── created_at

offline_queue
  ├── id (UUID)
  ├── user_id (UUID)
  ├── operation (insert | update | delete)
  ├── table_name
  ├── record_id
  ├── payload (JSONB)
  ├── created_at

companies
  ├── id (UUID)
  ├── name
  ├── slug (unique)
  └── created_at
```

### Row Level Security (RLS)

All tables have RLS policies enforcing:
- Users can only access their company's data
- Role-based write permissions (admin = full, operator = create/update, viewer = read-only)
- Row-level ownership for created_by tracking

### Realtime

Waste entries and disposal records use Supabase Realtime for:
- Live dashboard updates across team members
- Optimistic UI with conflict resolution

---

## Client Architecture

### State Management

```
┌─────────────────────────────────────────────┐
│              Presentation Layer             │
│  (React Components / shadcn/ui)             │
└───────────────────┬─────────────────────────┘
                    │ hooks
┌───────────────────▼─────────────────────────┐
│              Query Layer (TanStack Query)    │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Query Cache  │  │  Mutations + Optimistic│ │
│  │ + DevTools   │  │  Updates + Retry      │  │
│  └─────────────┘  └──────────────────────┘  │
└───────────────────┬─────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌──────────┐
   │Supabase │ │IndexedDB│ │Zustand   │
   │Client   │ │(Dexie)  │ │(UI State)│
   └─────────┘ └─────────┘ └──────────┘
```

### Zustand Stores

| Store | Purpose |
|---|---|
| `useUIStore` | Sidebar state, modals, loading indicators |
| `useWizardStore` | Setup wizard step tracking |
| `useThemeStore` | Theme preference (light/dark/system) |

### Query Strategy

- **Waste entries**: `useQuery` with infinite scroll pagination
- **Sites/WasteTypes**: `useQuery` with stale-while-revalidate
- **Create/Update**: `useMutation` with onSuccess invalidation
- **Offline**: Mutations queued to `offline_queue` table, retried on reconnect

---

## PWA Architecture

### Service Worker

```
Service Worker (Workbox)
├── Precaching (manifest.webmanifest, static assets)
├── Runtime Caching
│   ├── API requests → NetworkFirst (with cache fallback)
│   ├── Supabase → StaleWhileRevalidate
│   ├── Images → CacheFirst (30 days)
│   └── Fonts → CacheFirst (1 year)
└── Background Sync
    └── Process offline_queue on reconnect
```

### Caching Strategy

| Resource | Strategy | Duration |
|---|---|---|
| App Shell (HTML, JS, CSS) | Precache | Build time |
| Supabase API | NetworkFirst | 5 min cache |
| Images | CacheFirst | 30 days |
| Fonts | CacheFirst | 1 year |
| Manifest | Precache | Build time |

### Offline Data Flow

```
User Action (offline)
       │
       ▼
┌─────────────┐     ┌──────────────────┐
│  UI Layer   │────▶│  Dexie.js (IDB)  │
│  (optimistic │     │  + offline_queue  │
│   update)   │     └────────┬─────────┘
└─────────────┘              │
                             ▼
                    ┌────────────────┐
                    │ Background Sync│
                    │   (when online)│
                    └───────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │   Supabase      │
                   │   (replay ops)  │
                   └─────────────────┘
```

---

## Security

### Authentication

- Supabase Auth with email/password
- JWT tokens stored in memory (no localStorage)
- Automatic token refresh
- Session persisted across tabs via BroadcastChannel

### Authorization

- RLS policies on every table
- Role enforcement: `admin`, `operator`, `viewer`
- API routes validate JWT before processing

### Data Protection

- All data in transit: TLS 1.3 (via Supabase)
- All data at rest: encrypted (Supabase managed)
- No sensitive data in localStorage or IndexedDB (except encrypted queue)
- CSP headers prevent XSS

---

## Performance

### Bundle Optimization

- Route-based code splitting via dynamic imports
- Tree-shaking for unused exports
- Image optimization via Vite image assets
- Chunk size limit: 500KB warning threshold

### Rendering

- React 19 automatic batching
- `useMemo`/`useCallback` for expensive computations
- Virtualized lists for large datasets (planned)
- Image lazy loading with native `loading="lazy"`

### Metrics Targets

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |
| Bundle size (initial) | < 300KB gzipped |

---

## Deployment

### Environments

| Environment | Branch | URL |
|---|---|---|
| Production | `main` | `https://waste-buddy-tracker.vercel.app` |
| Preview | PR branches | `https://waste-buddy-tracker-git-*.vercel.app` |
| Development | local | `http://localhost:8080` |

### CI/CD Pipeline

```
Push to branch
       │
       ▼
┌─────────────┐
│ Lint + Type │
│   Check     │
└──────┬──────┘
       │ pass
       ▼
┌─────────────┐
│   Test      │
│  (Vitest)   │
└──────┬──────┘
       │ pass
       ▼
┌─────────────┐
│   Build     │
│  (Vite)     │
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
Staging   Production
(main)
```

---

## Monitoring

- Error tracking: Sentry (planned)
- Analytics: Vercel Analytics (built-in)
- Performance: Web Vitals monitoring
- Uptime: UptimeRobot / Vercel monitoring

---

## Future Architecture Considerations

1. **Edge Functions**: Move heavy validation to Supabase Edge Functions
2. **WebSockets**: Direct websocket for real-time (vs Supabase polling)
3. **Service Worker v2**: Explore new SW features as they stabilize
4. **WebAssembly**: Heavy calculations (e.g., CSV processing) in WASM
5. **Micro-frontends**: Consider if team size grows significantly

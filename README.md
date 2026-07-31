# Waste Buddy Tracker

> Production-grade PWA for waste tracking, compliance management, and analytics.

Waste Buddy Tracker is a full-featured Progressive Web App for recording, tracking, and managing waste generation across multiple sites. Built with React 19, TypeScript, Tailwind CSS, and Supabase — deployable on Vercel or any static host.

**Live:** [`https://waste-buddy-tracker.vercel.app`](https://waste-buddy-tracker.vercel.app)

![License: MIT](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [PWA Features](#pwa-features)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Development](#development)
- [Testing](#testing)
- [Tech Stack](#tech-stack)

---

## Features

### Core
| Feature | Description |
|---|---|
| **Multi-site Management** | Admin-managed sites with role-based access (Admin / Operator / Viewer) |
| **Waste Entry Logging** | Record type, quantity, activity, disposal details, site/location |
| **Activity Tracking** | Breakdown, Preventive, 5S, Other activities with metrics |
| **5 Whys Analysis** | Structured root cause analysis per waste record |
| **Disposal Management** | Batch disposal with full audit trail and batch numbering |
| **90-Day Compliance** | Automatic alerts for overdue waste (regulatory compliance) |
| **Reports & Export** | PDF reports (html2canvas), CSV export (papaparse) |
| **Analytics Dashboard** | Charts, trends, KPIs with Recharts |
| **Admin Panel** | User management, site management, audit log |

### PWA / Mobile
- **Offline-first** with IndexedDB (Dexie.js) + Background Sync
- **Push Notifications** for disposal reminders (Web Push API)
- **Install to Home Screen** on Android, iOS, and Desktop
- **Offline Indicator** with visual feedback
- **Service Worker** with cache-first and network-first strategies
- **iOS Splash Screens** for all device sizes

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/NocodeBuilds/waste-buddy-tracker.git
cd waste-buddy-tracker

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run database migrations
# Apply migrations in supabase/migrations/ via Supabase Dashboard or CLI

# 5. Start dev server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_APP_ENV` | No | Environment: `development`, `staging`, `production` |
| `VITE_APP_VERSION` | No | App version (defaults to package.json version) |
| `VITE_APP_NAME` | No | App display name (defaults to `Waste Buddy Tracker`) |

See [ENV.md](docs/ENV.md) for full details.

---

## PWA Features

### Installation

- **Desktop Chrome/Edge**: Install icon in address bar
- **Android Chrome**: Add to Home Screen via browser menu
- **iOS Safari**: Share → Add to Home Screen
- **macOS Safari**: File → Add to Dock

### Offline Support

When offline, all features work against local IndexedDB. Data syncs automatically when connection is restored via Background Sync API.

### Notifications

The app requests push notification permission on first load. Alerts include:
- 90-day disposal compliance reminders
- System notifications from admin

---

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

### High-Level

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ React 19    │  │ Tailwind CSS │  │ PWA Layer │ │
│  │ Components  │  │ shadcn/ui    │  │ SW + IDB  │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         └─────────────────┼──────────────┘         │
│                           │                       │
│  ┌────────────────────────▼───────────────────┐   │
│  │  State: React Query (TanStack) + Zustand    │   │
│  │  Offline: Dexie.js (IndexedDB)              │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (REST + RLS)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Supabase Backend                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ PostgreSQL  │  │ RLS Policies │  │ Auth       │ │
│  │ + RPC       │  │ Edge Fns    │  │ (email)    │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── AdminTab.tsx             # Admin dashboard
│   ├── AnalyticsTab.tsx         # Reports & charts
│   ├── AuthForm.tsx             # Login / signup
│   ├── ComplianceTab.tsx        # 90-day alerts
│   ├── DataManagementTab.tsx    # CSV export/import
│   ├── DisposalTab.tsx          # Batch disposal workflow
│   ├── Header.tsx               # App header with PWA install
│   ├── OfflineIndicator.tsx     # Network status badge
│   ├── SetupWizard.tsx          # Org/site initialization
│   ├── SWUpdatePrompt.tsx       # Service worker update banner
│   ├── UserManagementTab.tsx    # User CRUD
│   └── WasteForm.tsx            # Waste entry form
├── hooks/
│   ├── useAuth.ts               # Auth state + helpers
│   ├── useOnlineStatus.ts       # Online/offline detection
│   ├── usePushNotifications.ts  # Push subscription
│   ├── useSWUpdate.ts           # Service worker updates
│   └── useWaste.ts              # Waste queries/mutations
├── lib/
│   ├── config.ts                # Env-based config singleton
│   ├── db.ts                    # Supabase client
│   ├── idb.ts                   # Dexie (IndexedDB) schema
│   ├── sync.ts                  # Offline queue + Background Sync
│   ├── types.ts                 # Shared TypeScript types
│   └── utils.ts                 # Utility functions
├── App.tsx                      # Root layout + routing
├── main.tsx                     # Entry point (SW registration)
└── index.css                    # Global styles + Tailwind
```

---

## Configuration

The app uses a central configuration object from [lib/config.ts](src/lib/config.ts):

```typescript
import { APP_CONFIG } from "@/lib/config";
console.log(APP_CONFIG.name, APP_CONFIG.version, APP_CONFIG.isDev);
```

Environment-specific overrides are loaded at startup. In production, only `VITE_APP_*` prefixed variables are exposed.

---

## Deployment

See [DEPLOY.md](docs/DEPLOY.md) for full deployment guide.

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel → select the repo
3. Add environment variables in Vercel dashboard
4. Deploy

The `vercel.json` in the project root configures:
- SPA routing (all routes → index.html)
- Security headers (CSP, X-Frame-Options, etc.)
- Service Worker caching rules

### Other Hosts

Any static host works:
- Netlify: `netlify.toml` provided
- Cloudflare Pages: `_redirects` provided
- Docker: `Dockerfile` provided

---

## Development

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check
```

### Code Style

- TypeScript strict mode (noImplicitAny)
- ESLint + Prettier (if configured)
- Components: PascalCase `.tsx` files
- Hooks: `useXxx.ts`
- lib: camelCase `.ts` files

### Branching

- `main` — production (protected)
- `Revamp` — active development (this branch)
- Feature branches: `feature/description`

---

## Testing

```bash
npm run test              # Run tests (Vitest)
npm run test:ui           # Vitest UI
npm run test:coverage     # With coverage
```

### What's Tested

| Layer | Framework | Status |
|---|---|---|
| Unit tests | Vitest | In progress |
| Component tests | Vitest + Testing Library | In progress |
| E2E | Playwright | Planned |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 5 |
| **Styling** | Tailwind CSS 3 + shadcn/ui |
| **Backend** | Supabase (PostgreSQL + RLS + Auth) |
| **State** | TanStack Query v5 + Zustand |
| **Offline** | Dexie.js (IndexedDB) |
| **Charts** | Recharts |
| **PDF** | html2canvas |
| **CSV** | PapaParse |
| **PWA** | vite-plugin-pwa (Workbox) |
| **Deploy** | Vercel |
| **Lint** | ESLint |
| **Test** | Vitest |

---

## License

MIT — see [LICENSE](LICENSE)

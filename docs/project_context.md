# Project Context

## Application

Name:
Waste Buddy Tracker

Type:
Progressive Web Application (PWA)

Status:
Production application with active users.

Purpose:
Waste tracking, disposal management, collaboration, and regulatory compliance tracking.

---

# Core Architecture

Waste Buddy Tracker is a client-side offline-first PWA backed by Supabase.

Main principles:

- Offline-first operation
- Real-time collaboration
- Secure multi-company data separation
- Type-safe development
- Progressive enhancement

---

# Technology Stack

## Frontend

- React
- React 19
- TypeScript
- Vite
- shadcn/ui

## State Management

TanStack Query:
- Server state
- Data fetching
- Mutations
- Cache management

Zustand:
- UI state
- Wizard state
- Theme state

## Backend

Supabase:

Used for:

- Authentication
- Database
- Row Level Security
- Realtime updates

## Runtime

Bun

---

# Database Model

Main entities:

## companies

Multi-tenant organization records.

## profiles

Extends Supabase auth users.

Roles:

- admin
- operator
- viewer

## sites

Waste collection locations.

## waste_types

Waste categories.

## waste_entries

Main waste tracking records.

Contains:

- weight
- waste type
- activity
- disposal information
- five whys analysis

## disposal_records

Tracks disposal activities.

## offline_queue

Stores offline operations waiting for synchronization.

---

# Security Model

Security is enforced using:

- Supabase Authentication
- Row Level Security
- Role-based permissions

Rules:

- Users only access their company's data.
- Roles determine permissions.
- Created-by tracking is maintained.

---

# Offline Architecture

The application supports offline usage.

Flow:

User action

↓

IndexedDB / Dexie

↓

offline_queue

↓

Background synchronization

↓

Supabase

---

# PWA Features

Service worker provides:

- Asset precaching
- Runtime caching
- Offline support
- Background synchronization

Caching:

- App shell: precache
- API: NetworkFirst
- Supabase: StaleWhileRevalidate
- Images: CacheFirst

---

# Current Development Priorities

Focus areas:

1. Production stability
2. Security improvements
3. Performance optimization
4. Maintainability
5. Better testing coverage

---

# Deployment

Production:

Vercel

Environment:

main branch

Preview:

Pull request deployments

Development:

Local Vite server

---

# Important Constraints

Because users already depend on this application:

Avoid:

- Breaking changes
- Database migrations without review
- Authentication changes without testing
- Large rewrites

Prefer:

- Incremental improvements
- Feature branches
- Tested deployments

---

# Future Considerations

Potential improvements:

- Supabase Edge Functions
- Improved validation layer
- Advanced service worker capabilities
- WASM for heavy calculations
- Expanded testing coverage
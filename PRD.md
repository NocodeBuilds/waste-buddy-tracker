# WasteBuddy — Product Requirements Document

## 1. Overview

WasteBuddy (branded "Renew") is a mobile-first Progressive Web App (PWA) for tracking hazardous and non-hazardous waste generation, storage, and disposal at industrial facilities. It digitises compliance record-keeping required under India's Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 (HOWM Rules).

The app replaces paper-based waste registers with structured digital entries, automated compliance tracking, and exportable reports (Form 3 PDF, Excel manifests).

## 2. Problem Statement

Facilities that handle hazardous waste currently maintain physical registers. This leads to:
- Inconsistent record quality
- Missed disposal deadlines (90-day limit)
- Slow report generation during audits
- No visibility across multiple sites
- No approval workflow for disposal actions

## 3. Goals

| Goal | Metric |
|---|---|
| Zero data loss | All entries permanently stored |
| Compliance visibility | Clear overdue/warning/safe status per entry |
| Approval workflow | Disposal requires manager/admin sign-off |
| Multi-site support | Switch between sites within one account |
| Exportable reports | Excel and Form 3 PDF generation |
| Offline-ready | PWA with service worker caching |
| Photo evidence | Optional photo attachment per waste entry |

## 4. Non-Goals

- Backend API server (uses Supabase BaaS)
- Payment processing
- GPS/location tracking
- Real-time notifications (future enhancement)
- Multi-language support (English only for v1)

## 5. User Personas & Roles

### 5.1 Member (default)
- Logs waste generation entries
- Views their site's inventory and compliance status
- Submits disposal requests for approval
- Cannot approve disposals or manage users

### 5.2 Manager
- All Member capabilities
- Approves/rejects disposal requests
- Views site-wide analytics

### 5.3 Admin
- All Manager capabilities
- Invites new users to sites
- Assigns roles (admin/manager/member)
- Approves/rejects site access requests
- Manages users (bootstrap, role changes)

### 5.4 Global Admin (super-admin)
- Cross-site access
- Can manage any site from the Admin tab

## 6. Feature List by Module

### 6.1 Authentication
- Email/password signup with full name
- Email confirmation flow (Supabase Auth)
- Password reset
- Session persistence via AuthContext

### 6.2 Site Management
- New users request access to a site
- Admins approve/reject access requests
- Site switcher (when user belongs to multiple sites)
- Site-scoped data — every entry, batch, and role belongs to a site

### 6.3 Waste Entry (Logging)
- Select waste type (from predefined catalogue)
- Auto-detected category (hazardous / non-hazardous / e-waste / other)
- Weight (kg) and piece count
- Generation date, activity type (PM / BM / 5S / Other), location, notes
- Optional photo uploads (compressed client-side before upload)
- Entries stored with `disposal_batch_id = null` while in storage

### 6.4 Compliance Tracking
- 90-day disposal limit per entry
- Status badges: Safe (green), Warning (orange, ≥70 days), Overdue (red, ≥90 days)
- Dashboard summary by category (hazardous solids, non-hazardous solids, liquid, e-waste, battery, other)
- Next disposal due date calculated from oldest active entry
- Comic-style bubbles showing overdue/warning/safe breakdown

### 6.5 Disposal Workflow
- **Submit**: Member/Manager creates a disposal batch (status: pending). Entries remain unlinked.
- **Approve**: Manager/Admin approves → entries linked to batch, status → approved
- **Reject**: Manager/Admin rejects with reason → batch marked rejected, entries stay in storage
- **Manifest**: PDF export of any approved disposal batch

### 6.6 Inventory Table
- Filterable list: All / In Storage / Overdue / Disposed
- Period filter: All Time / Month / Custom Range / Financial Year
- In-storage summary by category (6 cards)
- In-storage breakdown by waste type (bar chart with category filter)
- Edit and delete actions (managers/admins only)
- Entry photos viewer

### 6.7 Analytics
- Key metrics: avg days to disposal, days to next disposal, generated weight/volume
- Category pie chart
- Aging bar chart (0-30d, 31-60d, 61-89d, ≥90d)
- 12-week generation trend (line chart)
- Top locations chart
- Recent disposals summary
- All charts scoped to selected period

### 6.8 Export System
- Single Export button → dialog with full filter options
- **Format**: Excel (.xlsx) or PDF
- **Period**: All Time / Specific Month / Custom Range / Financial Year / Specific Disposal Batch
- **Waste Category**: Multi-select (Hazardous, Non-Hazardous, E-Waste, Other)
- **Waste Type**: Multi-select, cascades from selected categories
- **Preview**: Shows entry count, total weight/volume before export

### 6.9 Admin Panel
- Site overview (entries, batches, users)
- User management: invite, change role, remove
- Site access request approval/rejection
- Bootstrap admin creation (one-time setup)

### 6.10 PWA
- Installable on mobile and desktop
- Service worker caching for offline use
- Install prompt component

## 7. Data Model

### Core Tables

| Table | Purpose |
|---|---|
| `waste_entries` | Every waste generation event. `disposal_batch_id` null = in storage, set = disposed |
| `disposal_batches` | Disposal events. `status`: pending/approved/rejected |
| `sites` | Facilities/locations (name, location) |
| `user_sites` | User-to-site membership |
| `user_roles` | Role per user per site (admin/manager/member) |
| `profiles` | User profile (full_name, created_at) |
| `site_access_requests` | Pending/approved/rejected site access requests |
| `waste_entry_photos` | Links entries to storage paths |

### Waste Type Catalogue (hardcoded)

| ID | Name | Category | Unit |
|---|---|---|---|
| waste-oil | Waste Oil | hazardous | litres |
| waste-chemical | Waste Chemical | hazardous | litres |
| waste-water | Waste Water | hazardous | litres |
| waste-gas | Waste Gas | hazardous | litres |
| liquid-chemical | Spent Liquid Chemical | hazardous | litres |
| any-liquid | Other Liquid Waste | hazardous | litres |
| used-batteries | Used Batteries | hazardous | kg |
| e-waste-general | E-Waste (General) | e_waste | kg |
| e-waste-pcb | E-Waste (PCBs) | e_waste | kg |
| biomedical | Biomedical Waste | other_wastes | kg |
| contaminated-rags | Contaminated Rags | other_wastes | kg |
| empty-drums | Empty Drums | other_wastes | kg |
| used-filters | Used Filters | other_wastes | kg |
| spent-catalyst | Spent Catalyst | non_hazardous | kg |
| plastic-waste | Plastic Waste | non_hazardous | kg |
| metal-scrap | Metal Scrap | non_hazardous | kg |
| paper-cardboard | Paper / Cardboard | non_hazardous | kg |
| wood-waste | Wood Waste | non_hazardous | kg |

## 8. User Flows

### 8.1 New User Onboarding
```
Sign up → (if email confirmed, auto-logged in) → No sites → Request Site Access
→ Pick site, add note → Submit → Admin notified → Admin approves → User sees dashboard
```

### 8.2 Waste Logging
```
Dashboard → + button → Fill form (type, weight, date, activity, location, notes, photos)
→ Submit → Entry appears in inventory with "Safe" status
```

### 8.3 Disposal
```
Member → Inventory tab → "Mark Quarterly Disposal" → Pick date, add notes → Submit
→ Batch created (pending) → Manager sees "Pending approval" badge → Approves
→ All unlinked entries linked to batch → Entries disappear from "in storage"
```

### 8.4 Export
```
Inventory tab → Export button → Dialog opens → Pick format, period, category, waste type
→ Preview summary → Export → File downloads
```

## 9. Technical Constraints

- Supabase free tier: 500MB database + 1GB storage + 2GB bandwidth
- Client-side image compression (max 1200px, JPEG 70% quality)
- ~85% size reduction on photos vs raw upload
- React Query for server state caching
- No backend server — all logic in client or Supabase Edge Functions

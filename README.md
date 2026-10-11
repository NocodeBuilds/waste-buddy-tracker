# WasteBuddy Enterprise Portal

[![PWA](https://img.shields.io/badge/PWA-Ready-10b981?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![Statutory Compliance](https://img.shields.io/badge/Compliance-CPCB%20HOWM%202016-f43f5e?style=flat-square)](https://cpcb.nic.in/)

**WasteBuddy** is a mission-critical, mobile-first Progressive Web App (PWA) engineered for real-time tracking, statutory compliance enforcement, and multi-facility environmental governance under India's **Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 (HOWM Rules)**.

Built specifically for high-reliability field and industrial environments (including wind farms, solar plants, and heavy manufacturing clusters), WasteBuddy eliminates compliance breaches, automates statutory return submissions, and bridges field technicians with executive regional coordinators.

---

## 📑 Table of Contents

1. [Key Features & Modules](#-key-features--modules)
2. [User Management & Single-Admin Security](#-user-management--single-admin-security)
3. [Statutory Compliance & Regulatory Return Suite](#-statutory-compliance--regulatory-return-suite)
4. [Predictive Waste Forecasting Engine](#-predictive-waste-forecasting-engine)
5. [Architecture & Zero-Lag Hydration](#-architecture--zero-lag-hydration)
6. [Technology Stack](#-technology-stack)
7. [Installation & Local Setup](#-installation--local-setup)
8. [Production Deployment & Edge Functions](#-production-deployment--edge-functions)
9. [Operational Workflows](#-operational-workflows)
10. [Documentation & Licenses](#-documentation--licenses)

---

## 🚀 Key Features & Modules

### 🌐 1. Regional Coordinator Dashboard ("All Facilities" View)
- **Consolidated Cluster Telemetry**: Aggregate inventory, statutory breaches, and hazardous storage volumes across all operational sites in a single view.
- **Compliance Radar**: Primary high-visibility stat card highlighting **Statutory Overdue Quantities (kg / L)** exceeding 90 days, alongside proactive warning counters (75–89 days).
- **Generation Drivers**: Instant breakdown attributing generation volumes to **Breakdown Maintenance (BM)**, **Preventive Maintenance (PM)**, or **5S Housekeeping**.
- **TSDF Pipeline**: Visualizes active waste pending authorized transport manifest dispatch.
- **Cross-Facility Scorecard**: Comparative performance table with status badges and **1-click facility drill-down**.

### 📱 2. Single-Site Futuristic Dashboard
- Real-time statutory gauge tracking 90-day storage clocks.
- Six-category visual breakdown cards: Hazardous Solids, Non-Hazardous Solids, Regulated Liquids, E-Waste, Batteries, and Other Regulated Wastes.
- Recent generation stream with thumbnail indicators, age chips, and activity markers.

### 📦 3. Mobile-Optimized Inventory Management
- **Fluid 2D Pan Table**: Full support for simultaneous vertical swipe scrolling and horizontal panning on mobile touch devices.
- **Comprehensive Filters**: Filter by facility, status (In Storage, Overdue, Disposed), and statutory periods (Month, Custom Date Range, Indian Financial Year).
- **Batching & Manifest Creation**: Group storage lots for quarterly transport with authorized TSDF handlers.
- **Client-Side Photo Compression**: Camera photos compressed directly via the HTML5 Canvas API by **~85%** before storage upload.

---

## 🛡️ User Management & Single-Admin Security

WasteBuddy enforces an uncompromised enterprise governance model designed to eliminate privilege sprawl:

```
                      ┌────────────────────────┐
                      │    Root Administrator  │ (Organization Governance)
                      └───────────┬────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
  ┌────────────────────────┐                    ┌────────────────────────┐
  │   Facility Manager     │                    │  Facility Operator /   │
  │ (Disposal Oversight)   │                    │     Field Member       │
  └────────────────────────┘                    └────────────────────────┘
```

### 1. Root-Admin Protection
- **No Self-Nomination**: The Root Admin cannot create additional admins or promote other users to admin status. The UI and Edge Functions only permit the assignment of **Member** and **Manager** roles.
- **Self-Demotion Lock**: Administrators are protected against accidental self-revocation.
- **Resilient Fallback**: Admin operations (role toggling, member removal, and request approvals) automatically fallback to direct authenticated Supabase database operations if Edge Functions encounter CORS or network boundaries.

### 2. High-Entropy Operator Provisioning
- **14-Character Password Generator**: Clicking **Generate** in the user creation dialogue uses cryptographic entropy (`crypto.getRandomValues`) to produce a password guaranteed to meet all statutory complexity rules (uppercase, lowercase, numbers, and special symbols).
- **Instant Clipboard Handover**: 1-click modal copies ready-to-use login credentials (URL, Site, Role, Email, Password) for direct handover to the employee.

### 3. Non-Breaking Sign-In Policy
- Password complexity (12+ characters, uppercase, digits) is enforced **only during account creation, admin bootstrap, and password reset**.
- Sign-in accepts legacy credentials with zero friction (`min: 1 char`), ensuring existing facility personnel are never locked out of the system.

### 4. Admin Credential Recovery
- If administrator credentials are misplaced, navigate to `/admin`, select **"Forgot password?"**, and enter the admin email.
- The administrator receives an email recovery link redirecting to `/reset-password` without requiring manual database intervention or data resets.

---

## 📜 Statutory Compliance & Regulatory Return Suite

WasteBuddy natively generates official, legal regulatory returns in accordance with India's CPCB / State Pollution Control Board (SPCB) guidelines:

| Document / Export | Regulatory Rule | Output Format | Description |
|---|---|---|---|
| **Form 3 Register** | Rule 6(5) & Rule 20(1) | **PDF** | Mandatory daily hazardous waste register detailing quantity, date, storage location, and authorized signatory blocks. |
| **Form 4 Annual Return** | Rule 20(2) | **PDF** | Statutory annual compliance return for Indian Financial Years (April 1 to March 31). |
| **Form 8 Container Labels** | Rule 17(1) | **PDF** | Standardized 100mm × 100mm yellow-and-red container hazard labels featuring UID, waste stream, handling warnings, and emergency contacts. Available in **Per-Entry** and **Consolidated Summary** modes. |
| **Form 10 Manifest** | Rule 19(1) | **PDF** | Official 7-copy movement manifest for hazardous waste transport to TSDF/coprocessing facilities. |
| **Multi-Sheet Manifest** | Internal Audit | **Excel (.xlsx)** | Multi-tab workbook with Cover Sheet, Inventory Detail, Totals by Waste Type, and Physical Location Attribution. |

---

## 🔮 Predictive Waste Forecasting Engine

Located in the **Analytics & Compliance** tab, the predictive forecast engine models future hazardous waste generation to prevent yard overflows and statutory storage breaches:

- **Algorithmic Forecasting**: Combines historical run rates, seasonality factors, and scheduled maintenance work orders to forecast 30, 60, and 90-day generation curves.
- **Interactive Simulation Sliders**: Adjust production and breakdown volume multipliers in real time to simulate peak maintenance shutdowns.
- **Threshold Warnings**: Automatically flags the projected calendar date when statutory limits or yard storage capacities will be exceeded.
- **Forecast Export**: Generates predictive forecast models directly to Excel for management review.

---

## ⚡ Architecture & Zero-Lag Hydration

```
[ User Action / Facility Switch ]
                 │
                 ▼
 ┌──────────────────────────────┐
 │ Check LocalStorage Cache     │ ──▶ [ Cache Hit ] ──▶ Instant Render UI (0ms)
 └──────────────┬───────────────┘
                │ [ Background Stale-While-Revalidate ]
                ▼
 ┌──────────────────────────────┐
 │ Supabase Query via RLS       │ ──▶ Silently Refresh Telemetry & Update Cache
 └──────────────────────────────┘
```

1. **Zero-Lag Facility Switching**: Powered by TanStack Query's `initialData` and `placeholderData: (prev) => prev`. Switching facilities paints cached local state instantaneously without tearing down the DOM or flashing full-page skeleton loaders.
2. **Bundle Chunk Splitting**: In `vite.config.ts`, heavy dependencies are extracted into dedicated chunks (`vendor-charts` ~444 kB, `vendor-export` ~911 kB, `vendor-motion` ~124 kB, `vendor-icons` ~32 kB), reducing the primary application bundle to **under 900 kB**.
3. **Session Role Caching**: User roles per facility are cached in `sessionStorage` to prevent asynchronous re-render stuttering during navigation.
4. **Photo Query Caching**: Configured with a 5-minute `staleTime` and 30-minute `gcTime` to prevent repetitive batch database scans across image tables.

---

## 🧰 Technology Stack

- **Frontend Core**: React 18, TypeScript, Vite 6 (SWC compiler)
- **Styling & UI**: Tailwind CSS v4, shadcn/ui, Radix UI Primitives, Lucide Icons
- **State & Sync**: TanStack Query v5 (`offlineFirst`), React Context
- **Document Compilers**: SheetJS (`xlsx`), jsPDF, `jspdf-autotable`
- **Data Visualization**: Recharts
- **Backend & Database**: Supabase (PostgreSQL 15, Auth, Storage, Edge Functions)
- **PWA Service Worker**: Workbox (`vite-plugin-pwa`)

---

## 💻 Installation & Local Setup

### Prerequisites
- Node.js 18 or higher
- npm 9+
- An active Supabase project

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/waste-buddy-tracker.git
cd waste-buddy-tracker
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### 3. Run Development Server
```bash
npm run dev
```
The app will be accessible at `http://localhost:8080`.

---

## 🚀 Production Deployment & Edge Functions

### 1. Build Production Bundle
```bash
npm run build
```
The optimized production bundle is output to `dist/` and can be deployed to Vercel, Netlify, Cloudflare Pages, or AWS S3.

### 2. Deploy Supabase Edge Functions
```bash
supabase functions deploy bootstrap-admin
supabase functions deploy admin-manage-user
supabase functions deploy approve-disposal
```

### 3. Storage Bucket Setup
Ensure a private bucket named `waste-photos` is created in Supabase Storage with appropriate RLS policies for authenticated users.

---

## 📋 Operational Workflows

### Daily Waste Generation Logging
1. Tap the **+** action button on the bottom navigation bar or desktop header.
2. Select the waste stream (auto-detects hazardous or non-hazardous category).
3. Input measured weight (kg) or volume (L), optional piece count, activity driver (PM / BM / 5S), and location tag.
4. Optionally capture photo evidence (automatically compressed on device).
5. Submit to append the record to the facility register.

### Quarterly Disposal Approval Pipeline
1. In the **Inventory** tab, select **Record Disposal**.
2. Select the disposal date and assign transport carrier / TSDF receiver notes.
3. Submit batch request (marked as `pending`).
4. A **Facility Manager** or **Root Admin** reviews the manifest details and taps **Approve** (linking storage lots to the manifest) or **Reject** (requiring audit justification).
5. Generate official **Form 10 Manifest PDF** for authorized vehicle transport.

---

## 📖 Documentation & Licenses

- **Product Requirements Document**: See [`PRD.md`](./PRD.md)
- **Technical Architecture Blueprint**: See [`ARCHITECTURE.md`](./ARCHITECTURE.md)

### License
Distributed under the **MIT License**.

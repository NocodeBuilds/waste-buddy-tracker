# WasteBuddy — Product Requirements Document (PRD)

**Document Version:** 2.0  
**Status:** Approved & Implemented  
**Domain:** Hazardous & Non-Hazardous Industrial Waste Regulatory Management  
**Target Standard:** India Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 (HOWM Rules)

---

## 1. Executive Summary & Product Vision

WasteBuddy is an offline-capable, mobile-first Progressive Web App (PWA) engineered for real-time tracking, statutory compliance auditing, and multi-facility governance of industrial waste generation, storage, and disposal.

It replaces fragile, paper-based Form 3 registers with an immutable digital lifecycle, continuous 90-day statutory aging telemetry, cluster-level regional coordinator visibility, and role-enforced disposal approval workflows.

---

## 2. Key Problem Statements & Core Solutions

| Legacy Industrial Problem | WasteBuddy Production Solution |
|---|---|
| **Statutory 90-Day Breaches**: Hazardous waste stored beyond 90 days violates CPCB/HOWM Rule 8 regulations, triggering severe regulatory penalties. | **Automated Compliance Radar**: Real-time statutory tracking with amber warnings (75–89 days) and red breach alerts (>90 days) highlighting exact overdue quantities (kg / L). |
| **Siloed Multi-Site Operations**: Regional environmental coordinators lack single-pane visibility across remote industrial wind/solar/manufacturing clusters. | **Regional Coordinator Dashboard**: Multi-site cumulative telemetry view with instant facility switching, cross-site scorecards, TSDF pipeline volumes, and drill-downs. |
| **Unauthorized Manifest Disposal**: Disposals logged without manifest verification or supervisor sign-off. | **Two-Phase Manifest Pipeline**: Operators request quarterly/batch disposals (`pending`); only designated Managers or Admins can review, approve, or reject with audit notes. |
| **Audit Preparation Bottlenecks**: Creating Form 3 regulatory returns manually takes days of manual transcription. | **1-Click Regulatory Exports**: Instant Form 3 PDF generation with legal tables, category subtotals, and signatures, plus multi-sheet Excel workbooks. |
| **Admin Privilege Abuse / Sprawl**: Sub-admins creating rogue administrators or locking out organization leadership. | **Single Root Admin Governance**: Non-transferable root admin model where operator provisioning is restricted to Member and Manager roles only. |
| **Field Connectivity Dead Zones**: Factory basements and wind farm substations have zero cellular connectivity. | **Offline-First PWA Architecture**: Local indexed storage queue, service worker caching, and automatic bidirectional synchronization upon reconnection. |

---

## 3. User Personas & Access Control Matrix

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

### 3.1 Personas

1. **Root Administrator**:
   - Manages facility creation and site location tags.
   - Provisions facility operators with auto-generated secure credentials.
   - Reviews and approves pending site access requests.
   - Monitors cluster-wide audit logs and statutory compliance.
   - Recovers access securely via `/admin` email password recovery.
2. **Facility Manager / Regional Coordinator**:
   - Oversees one or more facilities.
   - Accesses the **Regional Coordinator Dashboard** to audit cross-facility compliance radar and TSDF disposal pipelines.
   - Approves or rejects disposal batches with obligatory audit justification.
   - Edits or removes erroneous inventory lots before disposal.
3. **Facility Operator (Member)**:
   - Records generation events directly on mobile at the point of origin.
   - Captures piece count, weights/volumes, activity drivers (BM, PM, 5S), and photo evidence.
   - Initiates quarterly disposal requests for manager review.

### 3.2 Granular RBAC Matrix

| Capability / Module | Member | Manager | Root Admin |
|---|:---:|:---:|:---:|
| Log Waste Generation | ✅ | ✅ | ✅ |
| View Single-Site Inventory & Radar | ✅ | ✅ | ✅ |
| View Regional Coordinator Multi-Site Dashboard | ❌ | ✅ | ✅ |
| Edit / Delete Storage Lots | ❌ | ✅ | ✅ |
| Request Disposal Batch | ✅ | ✅ | ✅ |
| Approve / Reject Disposal Batches | ❌ | ✅ | ✅ |
| Export Form 3 PDF & Excel Manifests | ✅ | ✅ | ✅ |
| Approve Pending Site Access Requests | ❌ | ❌ | ✅ |
| Create / Provision Operator Accounts | ❌ | ❌ | ✅ |
| Configure Facilities & Location Tags | ❌ | ❌ | ✅ |
| View Full Audit Trail | ❌ | ❌ | ✅ |
| Grant Administrator Privileges | ❌ | ❌ | 🔒 *(Locked)* |

---

## 4. Functional Specification by Module

### 4.1 Authentication & Operator Onboarding
- **Sign-In Flow**: Flexible client authentication accepting legacy credentials without arbitrary client-side length blocks.
- **Admin Gateway (`/admin`)**: Dedicated root administrator gateway with bootstrap protection and self-service password recovery (`/reset-password`).
- **Account Provisioning**: Form with cryptographically secure 14-character password generator (enforcing upper, lower, numeric, and symbol rules) and 1-click clipboard credential handover.
- **Access Requests**: Self-service site join requests for newly registered staff, queueing for admin approval.

### 4.2 Regional Coordinator Dashboard ("All Facilities Mode")
- **Compliance Radar**: Primary stat highlighting **Statutory Quantity Overdue (kg / L)** with sub-warning metrics (75–89 days).
- **Active Storage KPI**: Total volume and solids in storage across all sites.
- **Generation Drivers**: Activity breakdown telemetry attributing generation to Breakdown Maintenance (BM), Preventive Maintenance (PM), or 5S Housekeeping.
- **TSDF Pipeline**: Volume of waste pending manager authorization or scheduled for off-site treatment.
- **Cross-Facility Scorecard**: Comparative table displaying compliance health, storage volumes, and 1-click drill-down to jump directly into any individual facility.

### 4.3 Single-Site Futuristic Dashboard
- Real-time gauge metrics for 90-day statutory aging.
- Statutory classification cards: Hazardous, Non-Hazardous, E-Waste, Battery, and Other Wastes.
- Recent generation stream with photo evidence indicators and age chips.

### 4.4 Inventory Management & Disposal Pipeline
- **Dual Unit Handling**: Simultaneous mathematical tracking of solid mass (kg) and liquid volume (Litres).
- **Multi-Filter Engine**: Filter by status (In Storage, Overdue, Disposed), period (All-Time, Specific Month, Financial Year, Custom Range), and facility.
- **Photo Evidence**: Client-side compressed photo capture (85% reduction) with cached count badges.
- **Batching Pipeline**: Multi-lot grouping for scheduled TSDF pickup.

### 4.5 Regulatory Reporting & Form 3 Export
- **Statutory Form 3 PDF**: Formatted strictly according to CPCB guidelines with facility details, category schedules, generation dates, and legal signature footers.
- **Comprehensive Excel Workbook**: Multi-sheet workbook including raw logs, waste-type breakdowns, and location attribution summaries.

---

## 5. Non-Functional Requirements & Performance SLAs

- **PWA Offline Resilience**: 100% core UI shell availability offline; background queue stores logs locally and auto-synchronizes on reconnect.
- **Zero-Lag Site Switching**: `initialData` and `placeholderData` caching ensures facility switching occurs in **0ms** without full-page skeleton flicker.
- **Bundle Optimization**: JS vendor chunk splitting maintains the main runtime bundle below `900 kB`, preventing thread lock on mobile devices.
- **Data Integrity**: Soft-link disposal architecture ensures historical logs are never deleted, providing an unbroken legal audit trail.

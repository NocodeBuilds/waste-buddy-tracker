# PWA remediation — 14 October 2026

This is a local security and reliability remediation, not a production deployment. No production accounts, passwords, memberships, role assignments or records were changed. Do not describe this release as risk-free: the live schema, storage objects, authentication configuration and hosting headers still require staging and rollout checks.

## Preservation and compatibility

- The new forward migration does not reset users, remove roles, or rewrite existing waste records. Historical reset migrations are now no-ops, retaining their migration versions. Historical duplicate DDL is replayable.
- Installations that lack disposal status columns receive `approved` for existing batches, preserving their completed state. New batches default to `pending`. Existing status values are retained when those columns already exist.
- Existing administrators remain administrators. Only new, unreviewed administrator grants are blocked; a locked transaction protects the last administrator. Managers and members keep their current role definitions.
- Archiving a facility preserves its records and memberships. Restore by setting `sites.archived_at` to null through a reviewed administrator/operator operation.
- Offline drafts migrate from localStorage to IndexedDB only after every draft is committed. Logout preserves the owner-scoped outbox and app shell. Device storage still needs to be retained until sync completes; it is not a server backup.
- Both public key environment names are accepted. The original app routes and main workflows are retained.

## Implemented changes mapped to the audit

| Audit area | Changes and verification focus |
|---|---|
| 1: embedded service credential | Bulk reset script disabled; embedded token and fixed password removed. Rotation and Git-history remediation are still operational requirements. |
| 2–6: privilege escalation/account management | Site creation requires an existing administrator. Public bootstrap retired. Existing-account password resets removed. Site access changes use an authenticated, locked SQL transaction. Browser fallback writes removed; direct role/membership writes revoked. |
| 7–9: disposal authorization and validation | Transactional request/decision RPCs; explicit same-site selection; second-person approval; direct status changes denied; positive finite measurements, integral counts, valid dates, bounded text and catalog/category matching. |
| 10–12: identity and privacy | Roles come from the database, not editable metadata. Profile email cannot be edited through the browser. Owner-scoped query keys/caches and query clearing on identity changes. Tracked CSV dumps reduced to headers; originals retained only in ignored `.private-audit-backup/`. |
| 13–16: disposal integrity | Pending batches remain in stock and alerts. Approval is atomic; no “all currently active entries” fallback. Approved evidence is immutable; pending evidence is locked until rejection. |
| 17–20: photos and offline writes | Validate photos before saving; durable entries plus blobs; stable IDs and replay verification; resumable uploads; expected-photo counts block disposal until upload completes; metadata deletion queues Storage API cleanup. |
| 21–24: offline lifecycle and paging | Preserve drafts through logout; owner-scoped offline site snapshots; one deduplicated sync coordinator with Web Locks; paginate inventory, batches, memberships and photo counts. |
| 25–27: service worker and signed media | One generated worker; explicit update prompt; no unconditional reload; retain app shell at logout; remove signed-photo caches; refresh active signed URLs before expiry. |
| 28–33: migrations/client/runtime | Destructive reset DML retired; replayable migration chain; approval schema included; real Supabase RPC restored; hook-order bugs repaired; typed client, queries, errors and exporters. |
| 34–37: errors and scope | Failed loads shown; mutations require an affected row; site responses protected from stale completion; disposal selection uses one actual facility; facility-specific reports and regional CSV facility labels. |
| 38–42: form/auth defects | Quoted CSV escaping and formula neutralization; retain failed form lines; revoke exact preview URLs; admin reset cooldown fixed; invitations use the email-sending API and never pretend `generateLink` sent mail. |
| 43–45: governance | Authenticated audit actors and additional audit triggers; pending-request profile visibility restricted to relevant administrators; paged site audit view; preserve facility data by archiving. |
| 46–48: dependencies/build/deployment | Compatible security updates, current official SheetJS package, unused CLI removal, lazy administrative/analytics/export modules, real hosting configuration and corrected environment/deployment guidance. See residual build advisory below. |
| 49–53: accessibility/tests/reporting/install/upload | Restore zoom; label primary controls; security, offline and synthetic browser tests plus CI; stop fabricating authorization IDs and recipient details; label forecasts as planning estimates; preserve shortcut intent; capture late install prompts; private bucket MIME/size policy. |

## Required rollout order

1. **Contain the exposed credential.** Treat the old service-role credential as compromised. Inventory its consumers, issue a replacement through Supabase, update server secrets, and invalidate the old credential. Do not blindly rotate a legacy JWT signing secret: it may invalidate active user sessions. Prefer Supabase's supported service-key migration path and verify continuity with a staging session first. Review provider logs for misuse. Removing a string from this checkout does not invalidate it.
2. **Back up and inspect staging.** Export schema and take a restorable backup/snapshot. Copy representative, anonymized legacy records and role combinations. Review migration history and existing column types, statuses, null weights, unusual catalog codes, orphan links, duplicate requests and photo metadata. The migration intentionally does not erase or silently “repair” historic evidence.
3. **Rehearse the forward migration.** Apply only pending migrations, using the provider's migration history. Never run `supabase db reset` against production; never replay already-applied historical migrations manually. Test single-admin, multi-admin, manager, member, rejected request, and mixed regional-role accounts. Assert user and role counts/assignments before and after.
4. **Coordinate database/functions/PWA.** The October migration adds RPCs and closes old direct mutation paths. Deploy the updated `admin-manage-user`, `invite-user`, `approve-disposal`, and `bootstrap-admin` handlers with the RPC-aware PWA in a controlled rollout. Older clients retain reading/logging, but their unsafe administrative fallback and empty “dispose all” requests are intentionally rejected. Ask users with old tabs to save work and accept the update before administrative/disposal changes. Do not claim seamless old-client governance compatibility.
5. **Storage cleanup.** Deploy `cleanup-photos` with JWT verification disabled for that endpoint only, since it uses a dedicated random `PHOTO_CLEANUP_SECRET`; keep the secret server-side. Invoke it from a trusted scheduler with `Authorization: Bearer <secret>`. Set exact `ALLOWED_ORIGINS` for browser functions. Verify failed jobs retain errors and retry. Existing orphan blobs are not automatically deleted; reconcile them against metadata and backups before a separately reviewed cleanup.
6. **Hosting and auth.** Configure the correct Supabase public URL/key, approved auth redirect URLs, private `waste-photos` bucket, email delivery and provider rate limits. Verify security headers on actual served HTML, SPA deep links, `sw.js` no-cache, and camera access. Custom Supabase domains need matching CSP `connect-src` settings. Run mobile installation/update/offline checks on actual Android and iOS devices.
7. **Canary and rollback.** Release to a small group first; monitor failed requests, pending outbox errors, approval failures, and cleanup job backlog. Prefer rolling forward for security fixes. A frontend rollback must keep the RPC-aware workflows; do not restore unsafe role writes, exposed keys, or destructive migrations. Database rollback requires a reviewed, data-preserving forward migration, not dropping tables/columns.

## Remaining verification and residual risks

- Production rotation, deployment, Git-history cleanup and live data reconciliation have not been performed. History cleanup requires coordinated handling of clones/forks and protected branches. `.env` contains public browser configuration; never add service secrets there.
- The upstream `braces` advisory affects the Tailwind 3 build dependency graph and has no published patched release. Fixed, repository-owned content globs do not accept PWA user input. Keep builds isolated, build only reviewed code, and do not expose the dev server publicly. Migrating Tailwind major versions changes CSS defaults and needs a dedicated visual compatibility review; it is not silently forced as an audit fix. [Upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Offline access cannot discover a server-side membership revocation until the device reconnects. Offline role snapshots do not grant governance privileges. Drafts are private to the signed-in account in the application, but browser storage is not encryption against someone with access to the device profile.
- Historical data that violates new rules needs an explicit reconciliation plan. The new validation applies to new/changed fields; records are not bulk-normalized or discarded. Legacy CSV files in Git history remain sensitive until history remediation is complete.
- Regulatory codes and storage limits retain the existing policy configuration. Forecasts are estimates. Missing permit numbers, recipients, emergency contacts and other filing details must be supplied and reviewed by the facility's EHS owner before statutory submission; no legal compliance certification is implied.
- Local PostgreSQL tests use PGlite with synthetic auth/storage schemas. They verify SQL, RLS and transaction behavior, not the hosted Supabase gateway, email provider, real object service or simultaneous independent database sessions. Staging remains required.

## Repeatable checks

Use Node 22.13 or newer and npm's committed lockfile. Run `npm ci`, `npm run check`, `npm test`, `npm run test:database`, `npm run build`, and `npm run test:pwa`. The new browser suite substitutes a synthetic backend and blocks external calls. Legacy browser suites require `E2E_ALLOW_MUTATIONS=true` and a disposable staging project because they may modify data.

Dependency distributions were checked against the [official SheetJS installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) and [Vitest 4 requirements](https://v4.vitest.dev/guide/). Re-run both full and production-only npm audits for release; do not suppress the known build advisory or represent it as patched.

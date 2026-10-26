# Verification - 19 October 2026

- Dispatch strict production build passed.
- Dispatch: 110 unit/component tests passed (11 files).
- Browser: three Chromium checks passed for login gate, mobile layout and invalid credential handling.
- Deployed preview rendered its login with no browser page errors. Real cross-origin request reached the bridge and received JSON authentication denial, proving CORS/transport connectivity without exposing private data.
- CISapp production build passed; 141 helper/financial regression tests passed (20 files).
- Firestore/Auth emulator: two service integration suites passed, including source financial idempotency/current-balance safety, operational evidence/delivery/fuel/shift/cash flow, role scopes and trusted account lifecycle.
- Client and trusted backend domain source parity checked.
- CISapp main remains `cd0d2bfe8e16d70c35d99d20b32894f15961d035`; work remains on dev. No main merge/push or live Hosting frontend replacement.

Real Admin password sign-in is for the account owner to verify. No production test receipts/customer/vehicle/driver records were seeded; the only initial account configuration links the existing user-created Delivery Auth login as Admin, without changing its password. The explicitly approved cross-project Auth role was granted to the backend service account, preserving other IAM bindings.

See [current dev guide](docs/phase2/CONNECTED-DEV.md) for preview URLs and operational limits. Signed-in UI tests use explicit mocked verified sessions; real server workflows run in isolated emulators rather than creating financial test transactions in the live ledger.

## Mobile interface update - 21 October 2026

All profiles now have phone bottom navigation with a More menu. Operational tables become labeled record cards below 600 px while keeping desktop tables. Forms use bottom sheets, single-column fields, 16 px inputs and larger touch controls; safe-area spacing keeps navigation clear of phone home indicators. Mobile browser coverage uses intercepted fictional Auth/backend fixtures, never real financial writes. Tested role layouts at 320, 390 and 768 px, including driver trip detail and the Admin vehicle form. Build, 110 unit/component tests and seven browser checks passed.

## Driver package-loading correction - 21 October 2026

A trip departing SHOP_A with an explicitly assigned SHOP_S delivery lost that job in the driver's shop-filtered workspace, causing "Record not found" on package loading. Driver operational projection now includes jobs referenced by authorised assigned trips and their invoice snapshots across originating shops; unrelated other-shop invoices remain excluded. Managers retain their shop scope. Missing cached delivery details now give a synchronisation instruction before any local loading mutation.

Verified: Firestore/Auth emulator regression includes cross-shop assignment, minimal projection, loading acknowledgement retries and persistence. Phone browser test confirms the actual dialog action and loaded state after reload using intercepted fictional requests. 111 unit/component tests and eight browser checks passed. A read-only in-memory dry run against the affected active trip also passed; no real loading status or financial record was changed by that check. Browser tests now use a dedicated preview port and refuse to reuse an unrelated existing server.

## Interface cleanup - 21 October 2026

Replaced the dashboard marketing hero with a compact overview and primary actions. Removed repeated workspace/storage banners, installation-only footer claims, redundant page introductions and workflow explanations. Connection status and pending work now use a short summary; reports and cash-calculation explanations remain available in expandable notes. Real-data preview context, approval confirmations, errors and essential financial distinctions are retained. Simplified form button labels and mobile table separators. Production build and all eight browser checks passed, including cross-shop driver loading and reload persistence. No backend/accounting changes.

## Delivery theme and action tiles - 21 October 2026

CISapp's invoice delivery dialog now uses the existing role-card purple/blue gradient, gold accents, dark fields and consistent card styling. Its delivery-request/collection screen uses themed summary tiles, request cards and status badges. Marking payload, financial calculations and approvals are unchanged. Dialog visual checks passed at 320/390/1280 px, including delivery toggle, Escape dismissal and no overflow, with no server writes.

Dispatch now has role-specific icon action tiles with real destinations and pending badges, luminous accent borders, driver action buttons, icon-based Admin settings tabs and direct vehicle/user settings shortcuts. The previous cleanup is retained: short labels, no decorative dead controls, and essential financial confirmations remain. Both production builds passed; Dispatch's 111 unit/component tests and nine browser checks passed, including vehicle deep-link navigation and driver loading persistence. Only dev Hosting previews are published; no backend or main/live frontend changes.

## Numeric entry correction - 23 October 2026

Shared numeric inputs retain a clearable text draft, accept explicit zero, and refresh external values. Wheel focus and hidden spinner controls prevent accidental fractional changes. Applied across collection/allocation amounts, fuel, odometer, package counts and numeric settings; optional coordinates remain unset when cleared. Exact integer-paise conversion and legitimate decimals are preserved. No historical records or financial calculations changed.

Verified production build and 115 unit/component tests. Browser coverage checks that entering 100 submits exactly 10000 paise and displays INR 100.00 after reload, and that a default settings zero can be cleared and replaced. Dev preview only; main/live unchanged.

## Manager route release - 23 October 2026

Added Release route directly to draft trip details for authorised Managers/Admins, using the existing audited backend routeAction operation and confirmation. Route Planner release remains available. Updated confirmation copy to describe connected synchronisation. Active, end-submitted and closed routes cannot be released again. Production build and all 12 browser checks passed, including Manager release and persisted Released status after reload with intercepted fictional requests. No real route was modified during testing.


## Weekly routes and CISapp invoice route selection - 23 October 2026

Admin can create reusable roads with ordered stops, available shops and flexible many-to-many weekday assignments. CISapp staff choose the route/stop when marking a saved invoice and see current weekly days and a suggested next date. The request retains trusted server snapshots; later schedule edits do not silently reschedule historical invoices/trips. Route Planner can filter matching requests and add them in stop order. Catalogue access and stale-save checks are server enforced and audited. No financial calculation or existing real business record was altered for testing.

Verified: Dispatch 119 tests, optional actual-CISapp-dialog integration plus regular tests 120, 14 browser workflows, CISapp 159 tests (56 environment-dependent skips), Functions Firestore emulator 13 passes (one Auth-dependent skip), both production builds and Functions build. See docs/phase2/WEEKLY-ROUTES.md for schema, usage and practical limits. Publication targets only dev Hosting channels and the previously approved dispatchBridge backend; main branches remain unchanged.

## CISapp visual theme alignment - 23 October 2026

Added src/cis-theme.css using CISapp's actual role-card gradient (#4a155f / #281247 / #081f4b), navy/purple navigation (#11185a / #1e2961 / #4c1d95), gold controls (#d4af37), white text and shared border/muted colours. Login, dashboards, compact icon tiles, tables/mobile cards, weekly routes, trip screens, forms, confirmations and mobile bottom navigation now use the same design. Status badges retain distinct success/warning/error colours; signatures keep a white evidence surface. Updated app title, favicon, installed-app icons and PWA chrome colours. No domain, backend or real business data changes.

Verified production build, all 14 browser workflows, and additional Admin/Manager/Driver layout checks at 320, 390, 768 and 1280 px. Inspected mobile Admin overview, Driver trip and desktop Admin table screenshots. Test data remained fictional/intercepted. Published Dispatch dev Hosting channel only; CISapp, backend and main/live frontend releases unchanged.

## Automatic credential-based sign-in - 23 October 2026

Removed the login Account selector. Email/password are tried against the two approved Firebase projects, preferring the last verified issuer in the browser session and otherwise Dispatch first. Credential mismatch or an unapproved Dispatch identity can proceed to the alternate issuer; successful access always requires the existing trusted identity endpoint. Identical authorised credentials in both projects follow that deterministic order. Network/backend outages, throttling and disabled accounts are not retried across projects. Rejected authenticated sessions are signed out; logout also clears the alternate cached Auth session. Passwords are cleared after sign-in attempts and are never stored by this routing helper.

Verified production build, 129 unit/component tests and all 15 browser workflows, including automatic CISapp fallback, persisted verified session after reload, hidden Account field, invalid credentials and ordinary Dispatch login. Browser credentials and backend calls were fictional/intercepted. Dev Hosting publication only; no backend, role, password, main or live Hosting changes.


## Login/reload and pull-down synchronisation; shop-based route release - 23 October 2026

Full workspace downloads now run at login/restored page load and explicit manual refresh. A touch pull from the top shows pull/release/updating feedback and synchronises in place. Normal scrolling, form inputs, signatures and dialogs are excluded. The existing Synchronise now button remains accessible. Minute/reconnect callbacks check identity only. Online operational actions flush evidence/commands and receive server acknowledgement without downloading the whole workspace; privileged approval/settings results still refresh explicitly. Offline queues retry on manual refresh, login/reload or another online save. Sync requests coalesce, lastSyncedAt is persisted, and in-flight snapshots cannot erase newly acknowledged local changes.

Verified Staff/Manager releases using the departure shop, including a trip ending at the other shop, and rejection of a destination-only Manager. Admin can release from either shop. Corrected effective Admin shop scope to always include SHOP_A and SHOP_S, including legacy Admin links saved with only one shop; Admin account forms reflect both protected assignments. Driver/custom capability restrictions remain.

Validation: production Dispatch build; 135 unit/component tests; 17 browser workflows, including timed identity checks with no workspace pull, reconnect without pull, pull-down, manual sync, browser reload and CISapp Staff release acknowledgement. Final affected browser checks passed after Admin settings changes. Functions Firestore emulator: 14 passed, one Auth-emulator-dependent test skipped; includes persisted Admin scope normalisation, destination-only Manager denial and existing payment/idempotency/cash regressions. Browser data is intercepted fiction, emulator project is demo-cis-dispatch, no real deliveries or payments were changed by testing. Deployment targets Dispatch dev Hosting and the approved dispatchBridge backend only. Main/live Hosting unchanged.

## Dispatch-only seven-day cleanup and user guide - 24 October 2026

Approved scope: delete completed Dispatch delivery detail/images after a week; do not delete CISapp data. Added a trusted Manager-closure timestamp and an hourly scheduled worker. Eligibility requires seven full days, Closed status, settled cash, reviewed/allocated collections, reviewed fuel/settled reimbursement and reconciled terminal deliveries. Unknown legacy closure times receive a new seven-day grace period. A durable PendingEvidence queue retries image/chunk deletion after interruption. Closed trips reject replacement image uploads.

Only Dispatch-owned operational/trip/evidence/retention/audit collections change. Original CISapp invoices, customers, payments, shop cash, partner points and dispatchDeliveryRequests remain exactly unchanged. Detail/photo/attempt data expires, while small report, mileage, financial and audit-metadata summaries remain. Package totals remain correct even across multiple attempts/trips. Unchanged source requests cannot recreate expired detail. Device caches remove server-expired photos on the next successful sync without losing active/pending work; offline devices and downloaded exports are outside immediate remote deletion control.

Production build passed. Dispatch: 141 unit/component tests; all 18 browser workflows verified across the full run and corrected targeted reruns, with final Driver/expired-detail checks passing. Functions Firestore emulator: 15 passed, one Auth-emulator-only test skipped. The retention test uses an isolated demo-cis-dispatch-retention database and verifies source documents unchanged, exact cutoff, legacy grace, pending-claim hold, chunk deletion and safe retry. No real customer record or delivery was used for tests.

Published approved dispatchBridge update and new cleanupClosedDispatch function from dev. Read-only Cloud Scheduler verification confirms ENABLED, every 60 minutes, Asia/Kolkata. Dispatch frontend publication targets the dev Hosting channel only. Main branches and live Hosting releases unchanged. Simple instructions and missing-job example: docs/USER-GUIDE.md; policy details: docs/phase2/DISPATCH-RETENTION.md.


## 24 October 2026 - guided trip closure and CashApp diesel

- Dispatch production build passed. Unit/component suite: all 150 tests passed across 17 files.
- All 20 Chromium browser workflows passed, including calculated diesel, optional pump, no-advance funding, scoped cash, newest-first multiple fuel decisions, return navigation, green ticks, final closure and reload.
- CashApp production build passed; all 50 tests passed. Fuel history uses the existing expense ledger and preserves paise in balances/display.
- Functions build passed. Firestore emulator: 16 passed, one Auth-emulator-only test skipped. Includes atomic CashApp expenses, concurrent idempotency, personal reimbursement timing, accounting failure rollback, no duplicate receipts and seven-day source isolation.
- No real test collections, fuel bills, invoices, customers or driver records were written. Only development Hosting previews are published. Main hashes remain unchanged.
- See docs/phase2/TRIP-CLOSING-FUEL.md for accounting timing, historical records and cleanup limits.

## 25 October 2026 - deployment completed

- Updated the approved dispatchBridge backend with confirmed collection snapshots, so cash review cannot leave stale pending collections blocking final closure.
- Re-ran the scoped cash/two-diesel/final-closure browser workflow successfully.
- Dispatch dev preview and CashApp dev preview both return HTTP 200 and serve their current build assets.
- Dispatch: https://delivery-28165--dev-wtgsuuyo.web.app
- CashApp: https://cashapp-a213f--dev-lwx80c61.web.app
- CISapp main remains cd0d2bfe8e16d70c35d99d20b32894f15961d035; CashApp main remains 7c764a780dbc7637305d37bd7d2edfcbf56c5eaa. No live Hosting frontend release was replaced.

## 26 October 2026 - simplified driver navigation and collection display history

Driver login and removed Home/Fuel links now open My trips. Driver navigation contains Trips, Collections, Cash and Sales with no More menu; trip diesel capture remains available. The driver collection list hides approved/rejected entries seven full days after their trusted claim decision timestamp, including after reload, while pending records and unknown decision dates remain visible. Manager/Admin history and all accounting data are retained.

Validation: production build passed; 22 focused role, decision-date and sync tests passed; all 23 browser workflows passed. Work remains on dev and the non-live preview pending production approval. No backend deployment or source accounting record deletion is required.

## 26 October 2026 - driver handover, photo retakes and supplied artwork

Driver handover is compact/centred; shift evidence is hidden from driver screens after submission and remains available to Manager/Admin. Browser workflow verified retaking both opening and closing photos, submitting the replacement photos, completing delivery, ending the shift and reloading without exposing submitted shift evidence. The three session unit tests passed, including artwork-only loading. Startup and saved-login browser checks passed with the supplied portrait splash on phone and desktop. App-icon PNG sizes are derived from the supplied square artwork; both full original images are preserved in public assets.

Production build passed. Changes are on dev and the non-live review preview; main/live release still requires approval.

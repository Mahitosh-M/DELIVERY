# Smart routes: architecture, implementation and review

## Verified baseline

Dispatch is a React 18 / TypeScript / Vite PWA, not a native Android application. Before this extension, Dexie account schema v3 stored isolated operational snapshots, evidence and stable-ID pending commands; this extension upgrades that schema to v4. `commands.ts` enforces operational transitions and is mirrored into CISapp Functions. Firebase Auth identities from the two existing projects are verified by the CISapp `dispatchBridge`. Privileged operations are validated again on the server. Frontend route hiding is not the permission boundary.

Weekly templates already use `dispatchRouteTemplates` through `dispatchRouteCatalog.ts`. CISapp `DeliveryDialog` and invoice entry select routes/days, then `markDelivery` creates a deterministic invoice-linked `dispatchDeliveryRequests` projection. `dispatchOperations` stores operational state and publishes assigned trips. Drivers receive scoped projections without purchase cost or profit. Collection approval posts through the existing receipt planner; approved diesel posts through `dispatchFuelCash` to Cashapp's existing Fuel category. Cash handover is custody, not another receipt.

No maps, geocoder, road router, native Navigation SDK, background-location bridge or remote notification provider is configured. Google billing is not configured; the user explicitly requires paid services to stay disabled. The December 2026 overdue policy and all financial posting code are outside this feature's mutation scope.

## Extension plan

1. Extend the existing weekly template with validated pins, stop kinds, endpoints, colour/code, schedule, reference metrics and lifecycle. Preserve old documents. Store immutable versions and audit changes. Offer the five supplied routes as drafts requiring Admin review; do not release trips or overwrite existing templates. Reuse SHOP_A/SHOP_S and the supplied coordinates.
2. Add confirmed customer delivery locations and per-invoice snapshots. Master updates require a separate authorised action. Missing locations may be queued at invoice save, but release requires confirmed coordinates.
3. Extend existing trip planning rather than introducing another trip system. Server-captured route versions and itinerary snapshots preserve released instructions. Retain independent jobs when grouping physical stops. Local suggestions preserve anchors and locks; geographic distances are not road distances.
4. Add an in-app map/itinerary with explicit foreground location consent and external Maps fallback. No continuous history by default. PWA GPS/map guidance is not native turn-by-turn navigation. A future Capacitor Android wrapper plus a native Google Navigation SDK bridge is the smallest compatible migration, requiring restricted credentials, billing and device testing.
5. Persist arrival reminders using existing commands/outbox. Only relevant customer stops qualify. Deduplicate by trip/itinerary/customer stop, retain acknowledgement, and never create calls, deliveries or receipts automatically. Live ETA alerts require a configured reliable provider; manual or geographic estimates must be labelled.
6. Add effective-dated cost assumptions and a Manager/Admin-only source-data report. Driver projections never contain actual purchase costs. Distinguish planned, completed and adjusted attribution; incomplete/returned goods without valuation must remain unallocated. Fuel purchases are spending, not measured consumption. Allocate daily overhead once; do not book accounting transactions from reports.

## Mapping, pricing and limitations

Leaflet can provide a lightweight map renderer using normal online OpenStreetMap tiles with visible attribution and normal HTTP caching. No tile prefetching, offline tile packs or service-worker tile caching. Saved coordinates and itinerary remain available offline. Location search initially searches saved data/coordinates; external geocoding requires a configured provider. Google URLs are parsed with a strict host allowlist; shortened or ambiguous links require manual review, not unrestricted server fetching.

Google's Navigation SDK is for Android/iOS; Maps JavaScript does not supply the native Navigation SDK. The official India price sheet currently lists separate free caps and rates: Dynamic Maps / Compute Routes Essentials 70,000 monthly events, then respectively $2.10 / $1.50 per 1,000 in the first paid tier; Navigation Requests 7,000 then $8 per 1,000. Eligibility, billing location and SKU rules apply. No paid API is enabled by this implementation. Check the current sheet and quotas before configuration.

Sources checked 2026-10-28: https://developers.google.com/maps/billing-and-pricing/pricing-india ; https://mapsplatform.google.com/maps-products/navigation-sdk/ ; https://operations.osmfoundation.org/policies/tiles/

## Migration, verification and rollback

Use optional backward-compatible fields, existing collection IDs, transaction revision checks, immutable template-version documents and account-cache upgrades. Existing completed/released snapshots must remain intact. Shared pure modules are mirrored and tested across repositories. New server endpoints must enforce role/shop scope and existing capabilities.

Run builds, unit/component tests, scoped backend emulator checks and browser workflows. Verify exact seed coordinates/order, URL safety, pin overrides, release scope, snapshot immutability, locked ordering, reminder deduplication/offline replay and finance regressions. Native turn-by-turn and background notifications remain blocked until native integration, credentials and physical-device verification are available.

Develop on `dev-smart-routes`. Do not change main/live apps or enable paid services for this new feature without a reviewed release. Rollback uses the prior frontend/backend commit while preserving additive fields, versions and financial history. Never delete new audit or financial records to roll back code.

## Implemented development extension

Both working copies are on `dev-smart-routes`: Dispatch at `D:/DELIVERY/cis-dispatch`, CISapp at `D:/DELIVERY/.release/cisapp`. The original `D:/CISapp` checkout and Cashapp source were not edited. No production data migration, route seed import, deployment, main merge or remote push has been performed for this extension.

| Phase | Main files and UI | Trusted services / storage | Status |
| --- | --- | --- | --- |
| Route templates | `route-management.tsx`, `weekly-routes.ts`, `route-seeds.ts`, `RouteMap.tsx`, `map-provider.ts` | `saveWeeklyRoute`, `routeHistory`, `seedWeeklyRoutes`, `confirmShopLocations` | Admin lifecycle, duplicate/archive, weekly calendar, interactive pins, saved-location search and reviewed URL import implemented. Five exact supplied drafts are available for explicit import. |
| Invoice pins | CISapp `DeliveryDialog.tsx`, `DeliveryLocationEditor.tsx`, `types.ts`, `financialDocuments.ts`, `delivery.css` | `invoiceDeliveryLocation`, `saveCustomerDeliveryLocation`, existing `markDelivery` | Confirmed per-invoice override, separate Admin master update, schedule and corridor warning. Invoice/same-day payment save order is preserved. Pending pins do not prevent invoice save. |
| Planning | `smart-routing.ts`, `trip-route-ui.tsx`, `routes-trips.tsx`, `commands.ts` | `dispatchSmartRoutes.ts`, existing idempotent `operation` | Trusted template capture, source-race rejection, confirmed-pin release gate, fixed anchors, manual order, constrained geographic suggestions, shared physical stops, driver/vehicle assignment, continuity exceptions. |
| Driver map | `driver-navigation.tsx`, `use-foreground-position.ts`, `navigation-provider.ts` | Assigned trip snapshots through existing scoped pull | Numbered in-app itinerary, next authorised destination/customer, foreground consent/GPS, mandatory loading visits and explicit external navigation fallback. Paid/native road navigation remains disabled. |
| Reminders | `smart-routing.ts`, driver navigation, existing command/outbox | `arrivalReminder`, `ackRoute`, local Dexie records | Manual arrival estimate, custom/default threshold, Call link, acknowledgement/dismissal and stable per-driver event IDs. No automatic reliable traffic ETA, background push or native notification guarantee. |
| Profitability | `route-costs.ts`, `route-profitability.tsx`, Planner budget | `routeCostSettings`, `saveRouteCostSettings`, `routeProfitability`, `dispatchTripValuation.ts` | Manager/Admin-only source invoice/cost lookup, estimates, closure snapshot versus current adjusted values, approved fuel spending, once-per-day overhead, charts, filters and CSV. Partial/multi-trip values are explicitly unallocated. |
| Offline / privacy | `data.ts`, `integration/live.ts`, `syncMerge.ts`, `retention.ts` | Existing operation acknowledgements, evidence APIs and scheduled Dispatch-only retention | Account DB migration v4, durable itinerary/reminder backups, pin-change review, driver acknowledgement and seven-day route/evidence redaction. Driver responses exclude Draft trips and financial costs. |

### Additive data changes

- `dispatchRouteTemplates`: optional modern fields; existing IDs and simple legacy templates remain readable. Activation/release of a modern plan requires confirmed endpoints and waypoints.
- `dispatchRouteTemplateVersions/{routeId}__{revision}`: immutable template history, including preservation of the previous legacy version on first edit.
- `dispatchRouteCodes/{code}`: transactional route-code reservation.
- Customer `deliveryLocation` and invoice/request `location`: validated coordinates and reminder/window/instruction metadata. The invoice snapshot is independent from the customer master. Staff cannot directly change customer-master coordinates in Firestore Rules.
- Existing operational trips: immutable released template snapshot, ordered physical itinerary, waypoint visits, amendment revision/acknowledgements, retained reporting identifiers/reference metrics/arrival targets.
- `dispatchRouteCostSettings`: immutable effective-dated assumptions, audited by actor and timestamp. Released trips retain the selected settings ID. Initial defaults remain clearly identified as supplied estimates.
- `dispatchTripValuations/{tripId}`: protected read-only invoice value/profit snapshot at verified closure. This is a reporting projection; it never creates an invoice, balance, payment, expense or customer credit.
- Existing operational state adds `arrivalReminders`. Account Dexie schema v4 supplies this optional array; backup format stays compatible with schema v2 operational aggregates. Connected outstanding balances may exceed original invoice value because of CISapp charges; local backups retain those balances without recomputing them.

New server collections remain denied to direct clients by the existing default-deny rules. Queries use single-field indexes; no new composite index is required. Authorisation remains role, capability, assignment and shop based on the server. Managers retain their existing source-shop scope; Admin handles mixed-shop planning. Foreign/unknown-shop invoice cost data is withheld from Manager reports.

The existing single operational Firestore aggregate still has an 800 KB safety limit. Large histories must be archived/partitioned before expanding fleet volume; this change does not silently replace that repository architecture.

### How to review the workflow

1. Use a development backend/environment when reviewing connected writes. The existing production backend does not yet expose these new actions. A frontend preview alone cannot activate backend features.
2. Admin: open **Route Management → Review initial routes**. Review the five routes and exact coordinates, then import the drafts. Apply the supplied shop coordinates separately if needed; existing shop contact/address/status fields are preserved.
3. Edit a draft. Confirm shop endpoints, ordered loading/transit/customer waypoints, colour, days, availability and reference metrics. Set lifecycle to **Active**, then save a new version. Named/shortened Google links need manual resolution; there is no remote geocoder.
4. Admin: **Route profitability → Cost settings**. Save effective-dated estimates if the supplied 15 km/L, ₹100/L, ₹500 working-day driver cost, 15% margin and ₹200 reserve need changing. These settings do not book expenses.
5. CISapp staff: save the actual invoice and its normal payment first. In **Delivery required**, select route/date, address, contact and packages. Select/confirm the map pin. A pending pin can be saved for later correction. Use the separate Admin button only when intentionally updating the master for future invoices.
6. Manager: **Route planner → Plan route**. Choose the weekly plan, date, van, primary driver and optional companion. Select eligible jobs. Review the map/order, locked stops, loading anchors and budget. Save the draft, then release it. A Manager can release from an assigned starting shop; Admin can release from either shop.
7. If release fails, check active template/version, matching scheduled date, confirmed customer pins, selected route waypoint, vehicle availability and overnight shop continuity. Wednesday/Sunday exceptional trips require an Admin explanation. Refresh and review a changed source/template before retrying.
8. Driver: open the assigned trip, record opening odometer/photo and confirm loading. Open **Route & navigation**. Review any changed itinerary, then confirm loading/transit waypoints in the authorised sequence. GPS is optional and foreground only. The map shows saved coordinates, not turn-by-turn road instructions.
9. While safely stopped, enter a manual arrival estimate at/below the customer's threshold to raise a reminder. Use **Call customer** explicitly; the app never calls automatically. Acknowledge/dismiss once. The event survives offline reload and is not raised again for that driver/route revision/physical stop.
10. Record each order's proof/outcome separately even when several orders share a physical stop. Record collections and amount-only diesel bills through the existing forms. Submit closing odometer/photo and shift report. Managers continue collection verification, physical cash handover, fuel approval/reimbursement and verified shift closure.
11. Review **Route profitability**. Planned uses assigned current invoice values; Completed uses the verified-closure source snapshot; Adjusted uses current authoritative invoice values. Approved diesel is spending, not fuel consumption. Cash collections are not added to sales. Shared-day overhead is allocated once before report filters.

For a pin changed after dispatch: the affected delivery pauses. The Manager's **Review latest source pin** action adopts only a confirmed trusted pin with an explanation and new driver acknowledgement. Completed stops cannot be rewritten. Customer/package/route/address changes require a broader dispatch review, rather than automatic adoption.

### Configuration and remaining blockers

Normal online OSM tiles are the default. Optional `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION` can select a properly licensed provider in each frontend. No Google credentials are needed for this development mode. There are no Google road, Places, matrix, optimisation or traffic requests. Saved-name/coordinate search and manual selection are available; address geocoding and shortened-link expansion are not connected.

True in-app turn-by-turn and reliable automatic 10-minute traffic reminders are **not complete**. The PWA has no native Navigation SDK bridge. The next implementation step requires a Capacitor Android shell for Dispatch, a maintained native Navigation SDK plugin/bridge, restricted Android/API credentials, billing/quotas, foreground-service/location disclosures and physical-device verification. Use provider ETA callbacks through `NavigationProvider`, reject stale/foreign itinerary ETA, and persist reminder events through the existing idempotent command service. System notifications remain browser dependent; in-app reminders work without granting notification permission. No background-location operation or automatic customer messaging is claimed.

Road reference distance/time excludes uncalculated customer detours and current traffic. Time windows are captured and protected during suggestions; without a road provider the planner cannot promise arrival-window feasibility. Partial deliveries/returns spanning trips need a reviewed operational valuation policy before assigning invoice profit between those trips. They currently remain flagged, rather than allocating invoice value by package count. Historical trips without a closure valuation display that value as unavailable.

### Verification and rollout

Verification logs are local ignored `.local` files in each working copy. Unit tests cover URL security/exact seeds, confirmed-pin gating, frozen snapshots, grouping, locked/window constraints, amendments, mandatory loading, reminder deduplication, foreground GPS cleanup, cost/break-even/daily allocations and offline backup recovery. Browser tests use intercepted fictional Auth/backend responses and mocked map tiles; they do not upload samples to Firebase or request map tiles from OSM.

Backend emulator checks use project `demo-cis-dispatch` on loopback Firestore/Auth only. Financial regression suites cover source invoice/payment invariance, receipt allocation/idempotency, external payment changes, PC/credit, Cashapp funding/reimbursement posting, physical custody, whole rupees and the unchanged December charge policy. Production Android, real road ETA, provider quota failure and native background-notification acceptance remain outstanding.

Local review commands from Dispatch: `npm.cmd install`, `npm.cmd run dev`, `npm.cmd test`, `npm.cmd run test:cis-ui`, `npm.cmd run build`, and `node node_modules/@playwright/test/cli.js test --grep "Smart route"`. The cross-app component checks expect the isolated CISapp worktree at `D:/DELIVERY/.release/cisapp`.

Before any future release, back up the operational aggregate/master settings and keep current hosting/backend release IDs. Review the Firestore rules and trusted bridge together, deploy to a development target, verify a real assigned account end to end, then request release approval. Old frontend rollback should preserve additive fields and immutable versions. Disable new menu entry points and use the previous backend/frontend release if necessary; do not delete audit, valuation or financial documents to roll back code.

### Verified results — 29 October 2026

| Check | Verified result |
| --- | --- |
| Dispatch production build | Passed, including PWA precache generation. Existing large-bundle warnings remain. |
| CISapp production build / Functions TypeScript build | Passed. Existing large-bundle warnings remain. |
| Dispatch full unit/component suite | 184 passed in the full run. Two additional planning-arrival/completed-stop tests passed in focused rechecks, giving 186 distinct passing tests; the final routing/shift/accounting recheck passed all 68 selected tests. |
| CISapp ordinary regression suite | 157 passed. Its 62 emulator-dependent tests were separately executed below. |
| Cross-app invoice entry / delivery pin component checks | 4 passed against the isolated CISapp worktree. |
| Backend Functions + Firestore/Auth emulators | 22 distinct checks passed across the full run and focused rechecks; the legacy optional-field serialization failure was fixed and rechecked. Includes existing receipt, credit, fuel, retention, overdue policy, account lifecycle and new route/report checks. |
| Firestore access / financial rules | 62 passed, including Staff master-pin restriction and server-only report/version collections. |
| New Playwright workflows | 3 passed: mobile Admin route import/save; driver denied-GPS/reminder/offline reload; desktop assumption entry/save. Screenshots were inspected and spacing/status/input-label defects corrected. |

Approved personal fuel may still be awaiting reimbursement. Reports count the approved trip purchase once; they do not imply that shop cash has already been paid or create a second expense when reimbursement is settled.

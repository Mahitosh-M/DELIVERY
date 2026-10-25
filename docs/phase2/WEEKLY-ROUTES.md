# Weekly routes and invoice delivery selection

Implemented on dev, 23 October 2026. No main branch merge or live Hosting publication.

## Admin

In Dispatch open Configuration > Routes. Add a route with a stable name, start and destination, authorised shops and ordered named stops. Add, remove or reorder stops using the arrow controls. Select any weekdays. A route can have several days and a day can have several routes. No selected day means unscheduled. Use the weekday tiles to review/filter the weekly plan. Edit a route to change the mapping or deactivate it. Deactivation preserves historical references; no destructive deletion of route history is provided.

## CISapp staff

After an invoice has been saved, open Mark for delivery (or Edit delivery). Choose Delivery route and optionally Route stop. The current catalogue displays the road and its weekly loading/dispatch days. A newly selected route suggests the next matching date, including today when applicable; staff may explicitly override the scheduled date. Verify address/contact/packages and save. Invoice amounts and payments are unchanged. Refresh Deliveries & collections to see current weekly routes and the selected route/dated delivery request.

The weekday plan is an expectation, not proof that goods have been loaded. Managers still create/release dated trips and drivers confirm actual loading. No recurring trip is silently created.

## Manager

Route Planner > Plan route > Weekly route filters ready deliveries by their CISapp route selection and date. Add matching deliveries in stop order uses the catalogue's ordered stops. Requests without a selected stop are kept last. Manual reordering remains available. Select vehicle, drivers, departure/arrival shops, save and release as usual. Custom trips remain supported. Named road stops are not automatically customer visits or fictitious deliveries.

## Persistence and permissions

New private collection: dispatchRouteTemplates/{routeId}. Fields: id, name, from, to, shopIds, ordered stops [{id,name}], days (Sunday=0 through Saturday=6), active, revision, updatedAt, updatedBy. Authenticated bridge actions routeCatalog and saveWeeklyRoute provide access. Drivers cannot read the catalogue; Managers/Staff read only routes available to their shops; Admin with manageSettings writes. Existing default-deny Firestore rules keep clients from directly reading/writing these documents.

Saves compare revision atomically and audit previous/new values. Concurrent stale edits fail with a refresh instruction. Invoice marking resolves the active route and stop on the server, ignores client-supplied names/days, and saves a route snapshot plus route revision to invoice.deliveryDetails and dispatchDeliveryRequests. Remapping a weekday does not rewrite existing invoice dates, released routes or delivery history. Staff see the current schedule when opening the picker; re-saving refreshes the snapshot. Assigned route changes require manager review. Dispatch jobs retain route/stop metadata; changes after assignment are flagged rather than overwriting driver work. Dated trips retain routeTemplateId through the trusted operational service.

Current practical limits: 500 named stops per reusable route; the existing trusted trip limit remains 60 operational stops. These are separate from weekly scheduling. Future exception calendars, cut-off times and holiday schedules are not implemented.

## Validation

- Dispatch: 119 unit/component tests; 14 browser workflows including route creation, reorder, weekday remapping, reload persistence, Manager release and route-filtered planning.
- Optional npm run test:cis-ui uses the sibling D:/CISapp checkout to render the actual invoice delivery dialog with mocked network access. Ordinary Dispatch unit tests do not require CISapp. Current combined run: 120 passed.
- CISapp: 159 passed, 56 environment-dependent tests skipped.
- Functions emulator: 13 passed, one Auth-emulator-dependent test skipped. Covers Admin-only edits, staff shop scope, concurrent stale saves, server-resolved invoice route snapshots, invalid stops, inactive routes, trip template retention and all existing payment/idempotency/cash tests.
- Both frontend production builds and Functions TypeScript build passed. Browser tests use fictional intercepted data; emulator tests require demo-cis-dispatch. No real invoice or route was created for testing.

Backend deployment updates only dispatchBridge. Both frontend deployments use dev Hosting channels.

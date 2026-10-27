# CIS Dispatch

Connected delivery operations for ASHOKA (`SHOP_A`, Maski) and SMPA (`SHOP_S`, Sindhanur). This development build uses real Firebase Authentication in `delivery-28165` and a trusted integration backend in `cisapp-236ab`. Invoices, payments, customer balances, credit and partner points remain authoritative in CISapp.

## Run

Use Node.js 22.12+ and the supplied public Firebase web configuration in `.env.local` (never commit private credentials).

```powershell
cd D:\DELIVERY\cis-dispatch
npm ci
npm run dev
```

```powershell
npm run build
npm test
npm run test:e2e
npm run preview
```

## Sign in and configure

The starting page asks only for email and password. It automatically checks the approved Dispatch and CISapp login systems, then opens the backend-verified profile and shop scope. Existing passwords are unchanged. The previously verified issuer is preferred within the browser session; otherwise Dispatch is tried first. If identical credentials have authorised accounts in both projects, that order determines the selected account. Rate limits, disabled accounts and connection failures stop sign-in rather than triggering another attempt.

Admin Configuration supports accounts (including drivers), custom restricted roles, shops, vehicles, fuel rounding preferences and private backup export. Create the actual van and driver accounts before planning a route. New accounts need an initial password of at least 12 characters; attaching an existing email preserves that account's password. Built-in roles, the last Admin, and records with history are protected. Deactivate historical accounts/vehicles instead of deleting them. Removing unused access retains the disabled Firebase Auth identity for traceability.

There are no example customers, drivers, vehicles, invoices or role-switching controls in the connected app. Fictional fixtures exist only under tests. The two real shop identifiers are configured; street addresses and coordinates require Admin entry.

## Connected operation

1. In the **CISapp dev preview**, save an invoice normally, then mark Delivery Required and enter verified delivery details. Opening balances cannot create jobs.
2. Synchronise Dispatch, prepare the route with the actual vehicle and driver accounts, and release it.
3. Driver signs in with their own account, starts the assigned shift with odometer evidence, confirms loading, and records outcomes, proof, collections, fuel and sales requests.
4. Manager verifies collections against current CISapp balances. Default allocation follows CISapp's opening-balance-first/oldest-first rules; allocations may be overridden. Approval creates source receipts once; credit/no collection creates none.
5. Review fuel, settle reimbursement separately, receive physical cash, review closing odometer and close the shift.

**A dev preview is not a separate accounting database. Deliberate manager approvals post to real CISapp data.** Digital evidence is not bank verification. Physical cash custody and handover never create a second receipt. Paid diesel uses CashApp's existing Fuel expense ledger: shop-funded claims post on approval, personal claims on confirmed reimbursement, with duplicate protection. Existing all-mode shop funds semantics are preserved.

## Persistence, evidence and offline work

The trusted backend validates roles, shop/assignment scope, state transitions and stable operation IDs. Operational records are shared through the backend; delivery photos, signatures and receipts are private, access-checked image chunks. IndexedDB is an account-specific cache and retry queue. Image uploads precede their referring command, and acknowledgements remove queued operations. No public evidence URLs or financial writes from drivers.

Previously created standalone browser data remains in its original database and is not imported, displayed or replayed into real accounts. Sign-out separates account workspaces. A previously verified Firebase session may open its own cached workspace offline for up to 24 hours; Driver work queues locally. Manager/Admin changes require connectivity. Reconnection rechecks access before processing queued work. Backend rejection remains visible under Connection & pending work; review it before discarding. Browser storage can be lost; export private backups and handle them securely.

## Verification and limits

See [connected dev guide](docs/phase2/CONNECTED-DEV.md) for deployed preview links, current validation and review steps. Frontend tests use explicit fictional fixtures, never real financial records. Backend tests use isolated Firestore/Auth emulators and cover scoped reads, role management, route/evidence persistence, delivery, collection posting retries, fuel, handover and closure.

The operational service currently stores a transactionally consistent workspace aggregate and stops safely below Firestore's document size limit (800 KB serialized state). Pagination/normalised archival is needed before sustained high-volume production rollout; rejected/unsent commands remain queued. Source projections also have explicit history limits. Evidence uses chunked Firestore documents, with higher read/write cost than a future private Storage adapter. The approved seven-day Dispatch-only retention policy is described in docs/phase2/DISPATCH-RETENTION.md. UI test coverage of signed-in roles uses mocked verified sessions; actual real-account sign-in must be checked by the account owner using their existing password.

Offline cache protection relies on the browser/OS account. Revocation takes effect on server requests; offline captures are revalidated and can be rejected later. GPS route ordering is geographic approximation, not road optimisation. Fuel efficiency remains unavailable until reliable full-fill data exists. No production financial test data is seeded. Do not deploy main/live Hosting or merge main without the user's approval.

## Integration boundaries

`src/integration/connection.ts` is the authenticated HTTP boundary; `session.tsx` gates the UI; `live.ts` handles evidence/outbox and authoritative refresh. `data.ts` provides versioned IndexedDB and account caches. Pure `domain.ts`, `commands.ts`, `rules.ts`, `emptyState.ts` and `integration/syncMerge.ts` are mirrored under CISapp `functions/src/dispatchDomain`; keep their copies identical when changing domain behaviour. `dispatchAdmin.ts`, `dispatchOperations.ts` and `dispatchBridge.ts` enforce server rules. CISapp financial helper imports remain authoritative. Credentials/service accounts never belong in the browser.

The shared dark UI lives in `src/styles.css` and `src/components/ui/saa-s-template.tsx`; signature surfaces stay white for readable proof. `components.json` and the `@/` alias prepare reusable UI primitives.


## Workspace refresh and route release

The full CISapp workspace downloads once after a successful sign-in or authenticated page reload. It does not download every minute or when internet reconnects. On touch devices, pull down at the top of a page and release to synchronise without reloading the page. Connection > Synchronise now remains available for mouse/keyboard users. Pulling inside inputs, evidence canvases, dialogs, navigation or while scrolled down does not trigger sync. Concurrent sync requests share one download.

Online operational saves still upload evidence/commands and wait for acknowledgement, without a full workspace download after each save. Offline work stays in the outbox and retries on the next online save, manual sync, or login/reload. Financial approvals and Admin configuration saves still refresh their authoritative result as part of that explicit action. Latest invoice balances continue to be checked on the server before posting payments. Background identity/revocation checks remain, but do not download invoice/workspace data. Last updated shows the last successfully applied workspace snapshot. A snapshot in flight cannot overwrite newer local changes.

CISapp Staff sign in as a shop-scoped Manager. Staff/Managers can create/release trips starting at an assigned shop, even if the destination is the other shop. They cannot release a trip merely because it ends at their shop. Admin can release trips starting at either SHOP_A (ASHOKA, Maski) or SHOP_S (SMPA, Sindhanur); Admin access always covers both shops. Drivers cannot release routes. Existing custom-role manageDispatch restrictions remain enforced. Reusable weekly route definitions remain an Admin configuration task.


## Simple user guide

See [CIS Dispatch: simple steps](docs/USER-GUIDE.md) for the complete three-box example, route release and missing-delivery checks. Completed Dispatch detail/images expire seven full days after Manager closure once outstanding operational settlements are resolved. An hourly scheduled worker removes only Dispatch detail and evidence; original CISapp invoices, customers, payments and delivery-request projections stay unchanged. Report summaries and financial/audit metadata remain. Device caches follow server-confirmed deletion on the next successful sync; offline devices and downloaded exports cannot be remotely erased.


Trip closing and CashApp diesel guide: [step-by-step workflow](docs/phase2/TRIP-CLOSING-FUEL.md).

App icon, responsive splash, packaging and launcher-cache guidance: [app artwork](docs/APP-ARTWORK.md).

# Connected dev review - 19 October 2026

- Dispatch preview: https://delivery-28165--dev-wtgsuuyo.web.app
- CISapp preview: https://cisapp-236ab--dev-2zxi4e08.web.app
- Previews expire 18 November 2026 unless renewed.
- Backend: https://asia-south1-cisapp-236ab.cloudfunctions.net/dispatchBridge

Use these **dev preview URLs**, not the existing live frontend URLs. Main branches and live Hosting channels were not changed. New Dispatch backend functions run in the existing CIS Firebase project by explicit user approval. No test receipts, customers, vehicles or drivers were created in the real backend.

## First review

1. Open Dispatch preview and enter the existing Admin email/password already created in Firebase. Account selection is automatic; there is no Account dropdown. That existing account is linked as the initial Admin; its password was not reset. Actual password sign-in must be verified by the account owner.
2. Open Configuration. Create the actual van and the two Driver accounts. Configure physical shop details: ASHOKA = Maski; SMPA = Sindhanur. No fictional vehicle/driver is preloaded.
3. Use the CISapp preview with an authorised CISapp login to mark a saved invoice for delivery. Financial invoice entry and same-day payment completion remain separate from subsequent marking. Opening balances are excluded.
4. Synchronise Dispatch, assign jobs to a route and release it. Drivers use their own accounts, assigned trips and proof capture.
5. Review collection allocations and independent digital verification before posting. **Approval posts to the real CISapp ledger. These previews are not accounting sandboxes.**
6. Review fuel and reimbursement separately; record physical cash handover, inspect odometer evidence and close the shift. Handover is custody movement and creates no additional customer receipt.

## What changed

Real Firebase login gates the application. No profile switching, seeded examples or local invoice creation is exposed. Account-specific IndexedDB preserves offline Driver work and evidence while the trusted backend persists operational changes. Stable command IDs, image hashes, source ledger validation and atomic transactions prevent duplicate posting and evidence replacement. Account/role/shop/vehicle/settings operations require authenticated Admin authority; scopes and permissions are enforced in the backend. Unused access can be removed; historical records must be deactivated. Built-in roles and the last Admin are protected.

The user explicitly approved granting the runtime service account `835565586103-compute@developer.gserviceaccount.com` the `roles/firebaseauth.admin` role in `delivery-28165`. This permits trusted account lifecycle operations; no Auth-management permission is given to browser clients. Other IAM bindings were preserved. Operational and identity collections remain private under existing CIS Firestore rules. Drivers receive minimal assigned operational projections, without purchase costs or gross profit.

Photos, signatures, odometer readings, fuel, shifts, sales requests and physical handovers now persist through the authenticated operational backend. Evidence is chunked privately in Firestore with assignment-checked access, rather than public download URLs. CashApp diesel now uses the existing expense ledger: shop-funded fuel posts at approval and personal fuel at confirmed reimbursement. Physical cash custody remains separate. See TRIP-CLOSING-FUEL.md.

## Verified

- Dispatch production build and strict TypeScript check.
- 110 Dispatch unit/component tests, including real login gating, role navigation, persistence, backup validation and live queue retry/concurrent-refresh behaviour.
- Three Chromium browser checks: private deep links gated at login, usable mobile layout, invalid credentials cannot open workspace. Hosted preview login also rendered with zero page errors.
- CISapp production build and 141 financial/helper regression tests.
- Two Firestore/Auth emulator integration suites covering source financial posting/credit/PC, stale balances, duplicate protection, scoped projections, server-side route/evidence/delivery/fuel/handover/closure, and account creation/update/disable/custom-role management.
- Real hosted-browser CORS request reaches the bridge and receives an authentication error without private data. This verifies transport; it does not claim successful real-password sign-in.

## Remaining limits before wider production rollout

- The operational workspace is a bounded transactional aggregate (safe stop at 800 KB); normalised archival/pagination is needed before sustained volume. Source projection limits are 200 trips and 1,000 requests/claims. Pending commands remain queued on rejection rather than disappearing.
- Driver cache is tied to browser/OS protection. Offline access requires an existing authenticated session verified within the preceding 24 hours. Server revocation/assignment checks are enforced on reconnect; rejected work requires review.
- Dispatch-only seven-day retention after Manager closure is approved and implemented; unsettled trips are held. See DISPATCH-RETENTION.md. Chunked Firestore evidence costs more operations than a private Storage implementation.
- Digital destination/verification remains a human policy, and CashApp fuel posting requires an initialized shop and a trusted Manager decision. UPI screenshots are not bank verification.
- Route suggestions are geographic estimates, not tested shortest-road routes. Actual physical addresses/GPS still require configuration.
- End-to-end signed-in workflows were tested through server emulator services and mocked verified UI sessions. The owner must verify the existing real Admin password login and real-device account workflows before main/live frontend approval.

See [README](../../README.md) for local commands and code boundaries. Earlier phase-two planning documents describe the pre-deployment baseline; this guide is the current operational status.


Latest trip review, optional notes, fuel calculation and CashApp changes: [TRIP-CLOSING-FUEL.md](TRIP-CLOSING-FUEL.md).

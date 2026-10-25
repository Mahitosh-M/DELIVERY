# Dispatch-only seven-day retention

User approved 24 October 2026: remove closed Dispatch delivery data/images after one week; do not delete CISapp data.

## Policy

Seven full 24-hour days start at trusted Manager closure (Trip.closedAt). The hourly Asia/Kolkata scheduled function cleanupClosedDispatch handles up to ten eligible trips and ten queued evidence purges per run. Trips lacking a trustworthy legacy closure timestamp get a full seven-day grace period from first observation. No device clock can trigger server deletion.

A trip must be Closed with reviewed odometer and confirmed cash handover. Non-zero physical cash variance, pending/unallocated collections, unreviewed fuel, pending reimbursement and unresolved/undelivered packages hold deletion. Rescheduled jobs referenced by the old trip also hold deletion while still unresolved.

## What changes

Only Dispatch-owned data is changed:

- dispatchOperationalState/main: remove addresses/contact/package instructions, detailed attempts, photo references and closed stop lists. Retain thin purgedAt summaries, archived package counts, original statuses, reference IDs, mileage, collections/fuel/cash records and audit event metadata. Operational delivery audit payloads are redacted; audit event IDs, actor/action/time remain.
- dispatchTrips/{id}: mark purgedAt, clear stop list, photo references and opening/end notes. Preserve mileage and cash summary/history for continuity and reporting.
- dispatchEvidence/{id} and its chunks: recursively delete all images associated with the eligible trip, including unused uploaded images for that trip.
- dispatchRetention/{id}: durable PendingEvidence/Complete progress marker. Retry interrupted deletion safely.
- dispatchAudit: append a retention event with counts and policy, no photo bytes.

Do not change or delete invoices, customers, payments, shopCash, advances, credit/partner-point data or dispatchDeliveryRequests. The scheduler has no writes to these collections. This is not an all-systems customer erasure policy: CISapp data is intentionally retained.

Expired job/trip summaries remain behind the scenes for report totals, odometer continuity and duplicate prevention, but disappear from ordinary delivery/route/trip screens. An old CISapp request cannot recreate expired Dispatch detail. Closed trips cannot accept replacement evidence uploads. No new financial receipt, refund or credit note is created by cleanup.

## Device data

Successful sync removes expired cached evidence atomically with applying the authoritative snapshot. Image metadata now carries tripId when uploaded/downloaded; old cached images are matched through their prior record references. Active and pending local work is preserved. Offline devices clear caches when they next successfully synchronise. Downloaded exports/backups are outside remote deletion control.

## Verification

Dispatch unit tests cover the exact cutoff, invalid timestamps, unresolved holds, idempotence, report/mileage preservation and accumulated package counts across trips. Sync tests cover cached-image removal and preventing resurrection from preserved source requests. Browser checks cover hidden expired detail and ordinary role workflows. The isolated Firestore emulator uses demo-cis-dispatch-retention and verifies source invoice/customer/payment/shop-cash/request/point documents remain exactly unchanged, deletes image chunks, and retries a partially completed purge. No real data was deleted by tests.

Publication: Dispatch dev Hosting only, plus approved dispatchBridge and cleanupClosedDispatch backend functions from dev. No main branch merge, no live Hosting publication, no CISapp frontend changes.

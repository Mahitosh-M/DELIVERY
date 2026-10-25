# Trip closing and CashApp diesel

Implemented on development branches, 24 October 2026. Main branches and live Hosting frontend releases are preserved.

## Driver

1. Open the active trip and tap Record diesel.
2. Enter litres and price per litre. The total calculates automatically to the nearest paise. Pump name is optional; receipt photo is required.
3. Without a shop advance, payment defaults to Personal. A shop-funded claim cannot exceed the advance remaining. Personal fuel does not reduce cash held for the shop.
4. Submit the closing odometer and photo at shift end. There is no extra returns checkbox. Record every failed or partial delivery accurately; the Manager must still reconcile actual returned packages.

## Manager or Admin

1. Open the submitted trip. The three closing steps appear first.
2. Tap Check cash. Only that trip appears. Review any pending collections using its link, then return to cash reconciliation.
3. Count the physical cash, tap Record physical handover, enter the amount and Confirm handover. Explanation is optional. A numerical shortage/excess remains in the audit and reports even with a blank note. You return to the trip and see a green tick after Firebase confirms.
4. Tap Check diesel. The newest pending diesel claim for this trip opens. Review it and confirm a decision; the review note is optional. You return to the trip.
5. Personal claims can be Approved with reimbursement left pending, or explicitly Approved & reimbursed when money has actually been paid. An approved pending claim offers Settle. Multiple bills must all be reviewed and reimbursements settled before the diesel step gets its green tick.
6. Reconcile failed/partial delivery packages. Review the odometer evidence and choose Verify & close shift. The final odometer review note remains required.

Request fuel clarification before confirming cash handover. After handover, the reviewed custody amount is locked; fuel decisions can approve or reject, but drivers cannot rewrite that cash spending.

## CashApp accounting

- The backend writes the existing `cashExpenses` ledger with category `fuel`, description `Diesel` plus vehicle/trip references, and updates the same shop's `shopCash` balance and expense total atomically.
- Shop-advance fuel posts on approval. Personal fuel posts when reimbursement is confirmed. Approval alone does not pretend the driver has been reimbursed.
- The advance is a custody record, not a second expense. Do not manually enter the same diesel again in CashApp.
- A deterministic expense ID and a durable `dispatchFuelPostings` marker prevent repeated deductions. A missing/corrected source expense is never automatically recreated. CashApp's existing administrative correction history remains available.
- The shop must already be initialized in CashApp. If posting fails, the decision stays pending without a green tick; Connection shows the error and retains its stable retry ID.
- Cash handover never creates another customer receipt. CISapp invoices, customers and customer payments are not deleted or rewritten by fuel posting.
- CashApp's Fuel tile opens the existing Fuel expense history. Monetary displays retain paise from calculated diesel bills; manual CashApp whole-rupee entry rules remain unchanged.

## Historical records and cleanup

Confirmed handovers and completed fuel reviews leave the default work lists. Use Show confirmed handovers or Fuel status All to inspect retained history. Closed trips are already hidden by default.

Fuel amounts, litres, source, decisions, odometer and cash summaries remain for analytics, reimbursement tracking and duplicate prevention. Images and detailed closed-delivery data follow the existing seven-day cleanup after Manager closure, with holds for unresolved cash/claims/returns. Nothing in this change deletes CISapp invoices or payments or CashApp's expense/audit history.

Older unposted open diesel claims incorrectly labelled Shop advance with zero advance are treated as personal funds, then corrected with an audit event at review/handover. Already confirmed custody and posted historical entries are preserved for explicit accounting review.

## Validation

Unit tests cover computed paise, no-advance handling, overspending prevention, optional notes with discrepancy recording, returns reconciliation and step completion. Browser workflows cover the driver form, two newest-first diesel decisions, automatic return navigation, green ticks, closing, reload persistence and hidden completed work. Firestore emulator tests verify atomic CashApp posting, duplicate/lost-response safety, personal reimbursement timing, protected customer receipts and retention isolation.

# Individual delivery loading — development only

The driver trip page replaces its one-button bulk loading action with a single row on each delivery: Loaded, Arrived, Delivered and Failed. Completed steps show green check circles. Loading an order changes only that order's status. Other customers' boxes remain unconfirmed. The trip header counts loaded deliveries.

Loaded records save loadedAt and loadedBy on each stop. New driver start commands select perDelivery loading mode; existing started trips and completed records keep their original meaning. The compatibility bulk-load command remains for older clients/trips but is refused for trips using the new mode.

The shared command engine checks assigned driver, active trip, itinerary acknowledgement, valid source/job/stop, individual loading and then arrival before recording a result. Loading can be confirmed for any assigned order; arrival/outcome retain the authorised itinerary order. Failure and rescheduling preserve returned-package reconciliation. Successful delivery still requires acknowledgement proof or a recorded manager exception. Partial and reschedule outcomes remain in the outcome form.

Existing durable operation IDs, account-scoped pending work and transactional state persistence are reused. Per-stop loading/arrival survive reopen and sync. Navigation can continue with individually loaded orders while other orders remain unloaded. An unfinished-stop manager exception is required before closing with orders left unloaded.

The pure domain, command engine and loading helpers are mirrored into CISapp Functions in its dev-smart-routes worktree. The trusted operation allowlist accepts loadDelivery. Deploy the matching Dispatch frontend and backend together when a separate release is approved; the existing live backend does not recognise this new command yet.

No invoice/payment accounting, receipts, PC, cash custody or fuel posting changes. Main, GitHub and production remain untouched for this task.

## Verification

- Dispatch suite: 196 checks passed; the additional new-start and targeted flow run passed 11 checks (including overlapping cases).
- Dispatch build and matching CISapp Functions build/type check passed.
- Isolated backend Firestore/Auth workflow: both tests passed, including two independent deliveries, arrival enforcement and duplicate-command idempotency.
- Chromium phone check (390px): selective loading, failed-outcome defaults, green completed circles, reload persistence and no horizontal overflow passed.
- Phone screenshot: test-results/per-delivery-steps-mobile.png.

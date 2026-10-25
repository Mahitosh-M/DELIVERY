# Current integration

See [connected dev review](docs/phase2/CONNECTED-DEV.md) and [Firebase connection](FIREBASE.md). Dispatch now uses real Firebase sign-in and a trusted CISapp backend for operational persistence and source invoice/payment integration. The earlier local-only Phase 1 description is superseded. Main/live frontend publishing remains subject to user review.

CustomerGateway, InvoiceGateway, PaymentGateway, DispatchRepository, EvidenceStorage, AuthProvider and SyncAdapter boundaries remain available in the source. The current authenticated transport is `src/integration/connection.ts`; `live.ts` implements stable-ID retries and account-specific evidence/outbox processing. Legacy standalone migration is review-only; old demo financial records are never automatically posted.

Cash custody is separate from receipts and source shop funds. CashApp diesel posting uses the existing cashExpenses and shopCash records in a trusted atomic transaction, once per fuel claim. Shop-funded approval and actual personal reimbursement are distinct posting triggers. Future changes must preserve CISapp financial helpers, current-balance checks and exactly-once receipt-side effects. Normalised operational archival and private Storage evidence are the next scaling work before wider rollout.

# Stage A: CISapp + Cashapp + CIS Dispatch integration audit

Status: local development audit, 18 October 2026. Financial integration is not approved or implemented by this report. No production database mutations, deployments, pushes, merges or main-branch changes were performed.

## Repository and deployment baseline

| Application | Checkout                 | Active development branch | Verified local baseline                                                                          |
| ----------- | ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------ |
| CISapp      | D:/CISapp                | dev                       | HEAD cd0d2bf, also local main; 8 pre-existing modified invoice/credit files                      |
| Cashapp     | D:/CashApp               | dev-phase2-integration    | HEAD 7c764a7, also local main; pre-existing environment/auth/input/UI/CI modifications preserved |
| Dispatch    | D:/DELIVERY/cis-dispatch | dev                       | Initial source remains uncommitted; origin Mahitosh-M/DELIVERY; nothing pushed                   |

Cashapp could not safely switch to its existing dev branch because src/services/authService.ts has conflicting local edits. The dedicated development branch preserves those edits. No existing edits were overwritten or stashed.

Read-only public Hosting checks returned HTTP 200. CISapp currently serves `/assets/index-BZUN4mKV.js`, while its existing local dist references `/assets/index-C9gSivFt.js`. Cashapp serves `/assets/index-DQ4FvQeS.js`, while local dist references `/assets/index-DHi-q5mL.js`. These differ; deployed source commits are **not verified** by these asset fingerprints. Subsequent authenticated read-only metadata checks are recorded below. Existing dist artifacts are not guaranteed to represent the current working tree.

CISapp's main-push workflow deploys live Hosting and its pull-request workflow deploys a preview. Cashapp's main-push workflow deploys live Hosting. Therefore no push/PR/merge/deploy action is part of this phase without the user's review and approval.

## Authenticated live metadata follow-up

An existing Firebase CLI account allowed scoped read-only checks. No credentials or raw customer records were printed or saved. The sanitised results are in LIVE-METADATA.json.

- CISapp default database exists in asia-south1 (FIRESTORE_NATIVE).
- The active Firestore ruleset matches D:/CISapp/firestore.rules after normalising line endings and trailing newline. Both SHA-256 fingerprints are 8c59fa08966f1e6e8d050725d7966b55b4bc17b87bfcbd3d1fcd909dfe505cac. Current rule findings therefore have deployed-policy evidence, not only source evidence.
- Deployed CISapp Functions metadata lists only deleteManagedUser in asia-south1, Node 22, gcfv2. No financial-posting function was found.
- One-document schema samples were read from users, customers, invoices, payments, shopCash, cashExpenses, cashExpenseCorrections and shopTransfers. Only field names/types and non-identifying enum/bool flags were retained. This is schema sampling, not a full ledger/reconciliation audit.
- The sampled live invoice lacks shopId/branchSystemVersion. Legacy shop assignment is a real migration issue; do not infer it from customer area or a display number.
- The sampled payment has split/allocation/advance/branch/cash effect fields. The shopCash sample uses double-valued balance/transfer totals alongside integer fields; do not assume all live monetary storage is integer paise or that UI whole-rupee constraints define every stored value.
- A limited UPI sample is legacy and lacks branch/cash-effect fields. No Bank Transfer sample was returned by the limited canonical-mode query. Neither observation establishes policy for all digital receipts; the current source/rules still permit their branch-funds effects.
- delivery-28165 database metadata returns HTTP 403, PERMISSION_DENIED with SERVICE_DISABLED. Firestore service/database setup needs confirmation before operational cloud connectivity. This response does not by itself establish which later IAM permissions will be available once the service is enabled.
- Storage rules remain unverified: the inspected release-list metadata did not produce a Storage policy body for this audit. Protected evidence upload must not be enabled based on assumptions about offer-image access.
- Hosted frontend bundles still differ from existing local dist artifacts. The medical-credit frontend deployment state is not proved by matching Firestore rules or listing Functions.

## Verified stacks and backend ownership

CISapp declares React 18.3, TypeScript 5.6, Vite 5.4, Firebase 12.15 and Capacitor 8.5. Its Firebase functions package targets Node 22 with firebase-admin 13.4 and firebase-functions 6.4. Package ranges describe checkout requirements, not independently verified production dependency versions.

Cashapp declares React 18.3, TypeScript 5.7, Vite 8.2, React Router 7.18 and Firebase 12.15. It has no backend Functions package or separately configured Firestore rules in this checkout.

**Both CISapp and Cashapp's actual .env.local public configuration points to `cisapp-236ab` for Auth and Firestore.** Cashapp Hosting defaults to `cashapp-a213f`; that Hosting project is not evidence of a separate accounting database. Cashapp's firebase.ts calls getFirestore on the CRM-configured app, and cashService reads the same payments/shopCash collections as CISapp.

Dispatch uses the separate `delivery-28165` Firebase app for SDK/account setup, but operational data, roles and evidence still live in Dexie/IndexedDB. Firebase sign-in does not currently replace demo role switching or establish operational cloud access.

Only public project identifiers were recorded; no API keys, passwords or administrative credentials are included in this report.

## CISapp source findings

### Identity and permissions

- `src/types.ts` defines Admin, Staff, customer and Medical roles. There is no existing Driver or Shop Manager role.
- Staff profiles carry one shopId. Admin has cross-shop UI access. Profiles are resolved through users records bound to Auth UID; Cashapp explicitly requires users/{uid}, active=true and Admin/Staff.
- CISapp rules permit team reads of full customers, invoices and payments across shops (`firestore.rules:2072-2103`). Branch write checks are more restrictive, but granting a driver Staff access would expose invoice cost/profit fields and unrelated records.
- No Dispatch driver must be granted Staff merely to access these collections. Restricted operational projections and server-side assignment checks are needed.
- The rules accept legacy lowercase admin in isAdmin, whereas backend deleteManagedUser and Cashapp's profile loader require Admin. Do not silently normalise or rewrite existing user roles during integration.

### Customers, addresses and invoices

- `customers/{id}` owns name, mobile, area, customerType, optional branchId, previousOutstandingAmount, advanceBalance and cached financial summaries.
- Customer branchId is SINDHANUR/MASKI, not a replacement for invoice/payment shopId. A customer need not be exclusively owned by one invoice shop.
- There is no verified navigable address/GPS field in the audited Customer interface. Do not treat area as a delivery address or overwrite customer records from local Dispatch contacts.
- `invoices/{id}` owns invoiceNumber, customerId, date, dueDate, totalSales, financial costs/profit and policy snapshots. No item-level medicine, quantity, inventory or inter-shop stock ledger was found in the audited invoice/type/service paths.
- Stable relationships must use document IDs. invoiceNumber is a display reference, not the integration key.
- `createInvoice` allocates an invoice counter, applies existing customer advance, writes an advance_application payment when needed and updates customer outstanding atomically (`firestoreService.ts:1567+`).
- The Invoices page creates a same-day receipt **after** createInvoice returns (`Invoices.tsx:447+`). A trigger on initial invoice creation could therefore export stale outstanding before the same-day receipt exists. There is no verified existing delivery-required/finalised marker.
- Use explicit Mark saved invoice for delivery after invoice/payment completion. Do not automatically dispatch all invoices or infer readiness from a time delay.
- Opening-balance invoices are identified by isOpeningBalance, invoiceType=opening_balance, or number prefix 0000-OPENING (`utils/openingBalance.ts`). They are receivable references, not delivery jobs.
- Invoice edits can change customer/value/date and refresh downstream data. Invoice deletion currently deletes linked payments, reverses their cash effects and restores advance effects within the established service workflow (`firestoreService.ts:1772+`). Integration must retain a tombstone/reconciliation event and preserve Dispatch attempts/POD rather than copying that deletion into operational history.

### Receipts, allocation and derived side effects

- `payments/{id}.amount` is money received in rupees; amountAppliedToInvoice plus cashDiscount reduces invoice outstanding. advanceCreatedAmount and advanceAppliedAmount are separate. paymentKind=advance_application contains zero new money and must never create a collection or another cash entry.
- `utils/openingBalance.ts` sorts opening balances before ordinary invoices, then date/number. `utils/paymentAllocation.ts::allocateReceiptOldestFirst` consumes the supplied ordered invoices, allocates cash/discount, and keeps eligible excess cash on the final receipt so the advance is traceable.
- Dispatch's local generic oldest-first allocation is not the authoritative production allocator and must not be used to post integrated receipts.
- `Payments.tsx:414+` creates split-group parts in a loop, each through a separate createPayment transaction. A network failure after part N is a partially posted group, not an atomic failure of all parts.
- `createPayment` creates a new random payment document ID each invocation; it has no source collection submission ID or request-idempotency result (`firestoreService.ts:2306+`). Calling it again after an ambiguous network response can create another receipt.
- Its advance eligibility check reads customer invoices/payments before the payment transaction. The transaction reads the customer and target invoice, updates customer summary/advance, creates a payment and updates shopCash. A trusted approval endpoint must revalidate current full allocation under concurrency, not trust a driver snapshot or frontend calculation.
- Monthly snapshot changes and PC awards run after the main transaction and return structured warnings. The Payments/Invoices pages then invoke derived credit/scoring refresh separately. A backend wrapper that only creates payment documents would omit these effects.
- PC posting uses a deterministic invoice ledger ID and immutable award policy. Existing edit/delete restrictions and advance-use guards must remain effective. Corrections cannot casually recalculate finalised awards.
- Cross-shop invoice selection is customer-based, while receipt shop controls where funds are credited. Preserve and test this distinction; do not automatically force invoice.shopId=receipt.shopId across legacy workflows.

### Existing backend and medical-credit changes

The only exported callable found in `functions/src/index.ts` is deleteManagedUser. No authoritative server payment-approval or Dispatch API exists in the audited backend entry point. Financial business logic currently runs through the browser Firebase service plus security rules.

The 8 pre-existing local files include the medical-customer 15-day term work. Local changes add medical fallback days in credit calculation/settings/invoice calculations and tests. Functions' standalone creditCalculation.ts does not contain matching medical logic and is not exported as a financial mutation API by index.ts. It must not be selected as a replacement financial implementation simply because it lives in functions/. Deployment of the medical changes remains unverified. Preserve these edits and establish parity/regression cases before extracting shared server financial code.

## Cashapp source findings

### Shared collections and cash policy

Cashapp reads `shopCash/{SHOP_A|SHOP_S}` and derives collection history from CISapp `payments` filtered by shopId and affectsShopCash=true. History uses cashSyncedAmount, not a separate Cashapp income record (`cashService.ts:486+`).

CISapp defaults branch receipt affectsShopCash to true. `utils/shops.ts::getNextCashSyncedAmount` excludes advance applications but does not exclude UPI, Bank Transfer, Cheque or Card. The source comment explicitly describes all real receipts as branch funds. This is a **current source-policy conflict with treating shopCash as physical cash-only**.

Therefore:

- Manager approval of an integrated receipt must use the existing authoritative funds effect once.
- Physical driver-to-manager handover must not create another payment or add another totalCollections increment.
- UPI/bank cannot increase driver cash custody even if the preserved shop-funds ledger currently includes them.
- A policy decision is required before changing existing digital-receipt behaviour or relabelling the financial ledger.

### Expenses, transfers and corrections

Verified collections: shopCash, cashExpenses, cashExpenseCorrections, shopTransfers, cashAdjustments, cashInitializations and payments.

- createExpense writes a cashExpenses audit record and decrements availableBalance/increments totalExpenses in the same batch.
- createTransfer writes shopTransfers and changes both shop summaries atomically within the same CISapp database. It represents inter-shop funds movement, not employee custody.
- initializeShopCash adds opening funds to an existing summary, rather than resetting prior receipts.
- Expense edits/deletes use cashExpenseCorrections and reverse/apply the difference. Transfer edits/deletes adjust both summaries; approved original records are not universally immutable. Dispatch links must detect corrections and retain integration audit references.
- Existing rules tie cash mutations to matching audit documents and getAfter values, including !exists checks for creation and immutable correction records. Replaying a fixed expense ID should be rejected by these rules; it is not a successful idempotent acknowledgement. Backend Admin SDK code must explicitly preserve these protections because it does not rely on client rule evaluation.
- Existing validators use exact allowed field lists. Adding sourceApp/sourceEventId directly to cashExpenses/payments without reviewing their validators can fail. Prefer a separate integration posting-link record committed with the authoritative mutation, or an explicitly versioned reviewed schema extension.
- Cashapp UI requires whole rupees; expense rules permit positive numbers, but some transfer-edit rules require integers. Dispatch uses integer paise. Reject unresolved fractional transfers/expenses at the boundary; do not silently round.
- No employee cash-advance, driver custody, reimbursement-payable or bank-account ledger is implemented by the audited Cashapp model. Do not represent an advance as an expense and then post the fuel bill as a second expense.
- Cashapp accounting labels include grossProfit/netCashResult derived from collections less purchase/expense outflows. They are cash-flow calculations, not evidence of a full accrual/general-ledger model. Do not add invented income, liabilities or full-business net-profit calculations.

## Dispatch source findings

- React 18/TypeScript/Vite/Dexie app with versioned state/evidence stores, schema v2 and repository/gateway contracts in src/data.ts.
- Local aggregate state holds shops, vehicles, users, customers, local invoice references, jobs, attempts, trips, collections, fuel, cash handovers, sales requests, audit and local outbox events.
- Customers and invoice references have nullable externalId fields. Their local IDs must remain stable when mappings are added.
- Operational money is integer paise; dates use Asia/Kolkata.
- Outbox events currently have Saved locally status and no complete remote command payload, authenticated owner, retry schedule or server acknowledgement. This is not a synchronisation engine.
- Local collection approval updates local reference balances. That operation must never be presented as a posted CISapp receipt after cloud mode is introduced.
- Firebase account sign-in is separate from local demo profiles. No current server-authenticated role enforcement or assigned-data cache isolation exists.
- POD/signatures and receipt photos are stored as IndexedDB data URLs; remote evidence paths, upload acknowledgements, retention and authenticated access still need implementation.
- App startup seeds fictional data. Not every record has an explicit demo-vs-real origin tag. A name prefix is not safe migration classification; require explicit per-record inclusion/exclusion plus verified authoritative mappings.
- Delivery attempts, partial returns, odometer corrections, shift closure and collection/fuel safeguards already have local tests and must be preserved.

## Field-by-field ownership and mapping

| Dispatch field / event               | Verified authoritative source                                        | Required mapping / treatment                                                       |
| ------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Customer externalId                  | CISapp customers document ID                                         | Explicit mapping; never name matching                                              |
| Customer name                        | customers.name                                                       | Read-only authorised projection                                                    |
| Primary phone                        | customers.mobile                                                     | Minimal assigned projection; other contacts manager-verified                       |
| Customer area                        | customers.area                                                       | Descriptive area only, not verified delivery address                               |
| Customer branch                      | customers.branchId                                                   | SINDHANUR/MASKI; distinct from receipt/invoice shop                                |
| Delivery address, GPS, landmark, PIN | No canonical source in audited customer schema                       | Verified Dispatch snapshot; no silent customer-master update                       |
| Invoice externalId                   | invoices document ID                                                 | Stable source key including source project                                         |
| Invoice number                       | invoices.invoiceNumber                                               | Display only                                                                       |
| Invoice originating shop             | invoices.shopId + branchSystemVersion                                | Legacy missing shop requires explicit review                                       |
| Invoice date/due                     | date, savedDueDate/dueDate and terms snapshot                        | Preserve authoritative terms; no Dispatch recalculation                            |
| Invoice amount snapshot              | invoices.totalSales                                                  | Rupees to paise exactly, never source cost/profit fields                           |
| Outstanding snapshot                 | Authoritative invoice/payment calculation                            | Backend calculated/revision-stamped; no customer total applied to a single invoice |
| Reference amount/outstanding         | Local demo reference                                                 | Not an authoritative financial source; no reverse upload                           |
| Packages / loading                   | Dispatch job/trip                                                    | Independent of financial invoice amount                                            |
| Delivery status / attempts / POD     | Dispatch                                                             | Separate from payment state; retain history on source cancellation                 |
| Receipt amount                       | payments.amount                                                      | Source rupees; exact conversion at boundary                                        |
| Applied invoice money                | amountAppliedToInvoice                                               | Do not substitute amount when excess is advance                                    |
| Discount                             | cashDiscount                                                         | Authoritative rules, not driver-created adjustment                                 |
| Advance                              | advanceCreatedAmount/advanceAppliedAmount + customers.advanceBalance | Reuse authoritative workflow; local excess is not a real advance                   |
| Receipt mode                         | Cash / UPI / Bank Transfer / other verified modes                    | Dispatch Bank transfer maps to Bank Transfer; Credit creates no receipt            |
| Split group                          | splitPaymentGroupId/TotalAmount/Part/Count                           | Preserve group lineage; operation result references all receipts                   |
| Receipt receiving shop               | payments.shopId                                                      | Distinct from invoice shop where existing workflow allows                          |
| Shop-funds effect                    | affectsShopCash/cashSyncedAmount + shopCash                          | Single authoritative update; no extra Cashapp income                               |
| Physical cash held / handover        | New Dispatch custody records                                         | No duplicate receipt/totalCollections entry                                        |
| Fuel approved cost                   | Dispatch submission/approval                                         | Not the same as cash settlement                                                    |
| Cash-funded expense posting          | cashExpenses + shopCash                                              | Exactly once; preserve existing Cashapp mutation/correction rules                  |
| Personal reimbursement payable       | No existing Cashapp payable model                                    | Dispatch pending settlement; accounting timing decision required                   |
| Reimbursement cash payout            | Verified Cashapp expense workflow, if approved                       | One cash outflow; never post the same bill twice                                   |
| Driver/manager identity              | Firebase issuer project + UID                                        | Explicit trusted link; do not equate equal emails or browser roles                 |
| Odometer / vehicle / routes          | Dispatch                                                             | Vehicle-based approved readings; no invented road-distance metric                  |
| Sales request                        | Dispatch                                                             | Manager inbox only until a verified CISapp request workflow is added               |
| Inter-shop stock                     | No audited authoritative inventory model                             | Out of financial/inventory automation until source is identified                   |

## Decisions and technical blockers

1. **Cash policy:** preserve shopCash as total shop funds with separate physical custody, or approve a versioned cash-only/digital-channel migration? Default proposal is preservation, but no financial behaviour will change without confirmation.
2. **Locations:** source getShopCode maps SHOP_A to MSK and SHOP_S to SND. This suggests ASHOKA=Maski, SMPA=Sindhanur, but physical location remains unconfirmed.
3. **Identity:** approve federated issuer+UID mappings to existing CISapp employees and separate driver identities; creating an Auth account alone does not approve an operational Admin role.
4. **Expenses:** confirm whole-rupee restrictions, reimbursement settlement timing and whether advances remain custody movements inside shop funds. No current employee-advance ledger exists.
5. **Cross-shop custody:** confirm how handover at a different shop is classified. A mixed-source trip cannot safely become one blind shopTransfer amount.
6. **Live verification:** deployed Firestore rules/Functions and limited live schema samples are now verified as described above. Full ledger consistency, evidence rules, legacy coverage, actual role-link records and deployment source parity still require further controlled verification. Public Hosting fingerprints are insufficient.
7. **No current trusted receipt API:** extracting/parity-testing financial services is necessary before enabling integrated approvals; a direct browser-to-payments adapter is not acceptable.
8. **Evidence and retention:** approve Storage access model, retention, device cache policy and logout handling before production driver use.

## Baseline tests executed locally

- CISapp: 138 pure financial/utility tests passed across 19 files (`npx vitest run src/utils`). Emulator rules tests were deliberately excluded; no production calls were needed.
- Cashapp: 50 local tests passed across 6 files (`npm test`).
- Dispatch: 66 tests passed across 5 files (`npm test`).
- Total baseline: 254 tests passed. These are not integrated, emulator security or live end-to-end acceptance results.

## Stage gate

Stage A establishes the facts above. Stage B architecture and new contracts may be prepared locally on development branches. Financial stages D/E must remain disabled while cash ownership/timing is unresolved. No completion claim for the connected system is made. Main branches and live applications remain unchanged.

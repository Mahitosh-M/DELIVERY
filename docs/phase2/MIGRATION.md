# Controlled migration dry run

This is implemented development tooling, not an importer. It reads existing files and prints a review report. It has no Firebase/network API and cannot post receipts, expenses, handovers or customer-master changes.

## Run (Node 24 or newer)

```powershell
cd D:\DELIVERY\cis-dispatch
node scripts/phase2-dry-run.mjs --help
node scripts/phase2-dry-run.mjs --backup dispatch-backup.json --manifest migration-manifest.json --catalog authority-catalog.json
```

Use Admin > Configuration > Backup & storage in the existing app to export a full version-2 backup including evidence. Keep that original backup unchanged and privately stored. Reports contain legacy IDs and mapping information; treat them as business records.

The tool prints JSON to stdout. Redirect it to a **new** review file if desired; it never overwrites input files. The tool rejects files above 100 MB and includes SHA-256 hashes of the exact input file contents in its output.

## Manifest

Start from `manifest.example.json`. Choose a stable unique installationId once and retain it for retries. For every selected record add a classification key `entityKind:legacyId` with `demo`, `operational` or `review`. Missing classification means review. The tool never infers legitimacy from a name, date or demo-like ID.

Supported entity kinds: shops, users, vehicles, customers, invoices, jobs, trips, attempts, collections, fuels, salesRequests and evidence.

Mappings:

- customerMap: local customer ID to an existing authoritative CISapp customer document ID.
- invoiceMap: local reference ID to an existing authoritative CISapp invoice document ID. Customer and shop must match the reviewed authority catalog.
- identityMap: local user ID to an approved `{projectId, uid}` identity. The catalog must confirm active status and matching operational role. Equal emails or equal UID strings in separate Firebase projects are not identity proof.

Example snippets below are placeholders, not real records or employee provisioning instructions:

```json
{
  "version": 1,
  "installationId": "office-device-01",
  "classifications": {
    "customers:LOCAL_CUSTOMER_ID": "operational",
    "invoices:LOCAL_REFERENCE_ID": "operational",
    "jobs:LOCAL_JOB_ID": "review",
    "users:LOCAL_USER_ID": "review"
  },
  "customerMap": { "LOCAL_CUSTOMER_ID": "VERIFIED_CIS_CUSTOMER_ID" },
  "invoiceMap": { "LOCAL_REFERENCE_ID": "VERIFIED_CIS_INVOICE_ID" },
  "identityMap": {}
}
```

Do not classify unknown history as demo just to remove warnings. Excluding a required dependency prevents dependent operational records from being considered mapped. Multiple local people/customers/references mapping to the same authority identity are flagged for explicit merge review, not silently collapsed.

## Authority catalog

`catalog.example.json` is intentionally empty. A future authenticated authority export must provide:

```json
{
  "projectId": "cisapp-236ab",
  "exportedAt": "2026-10-18T00:00:00Z",
  "customers": [{ "id": "VERIFIED_CIS_CUSTOMER_ID" }],
  "invoices": [{
    "id": "VERIFIED_CIS_INVOICE_ID",
    "customerId": "VERIFIED_CIS_CUSTOMER_ID",
    "shopId": "SHOP_A"
  }],
  "principals": [{
    "projectId": "delivery-28165",
    "uid": "VERIFIED_DRIVER_UID",
    "role": "DRIVER",
    "active": true
  }]
}
```

Optional opening-balance fields (invoiceType, isOpeningBalance and invoiceNumber) are used to block accidental delivery migration. The catalog is a review input; the current tool does not cryptographically authenticate it and therefore **never grants production authorisation**. The real migration executor must revalidate live authority records and approved identities server-side.

## Report interpretation

- skip_demo: explicitly excluded from the proposed migration. The original source remains unchanged.
- needs_review: classification, mapping, evidence or dependency is missing/conflicting.
- mapped_for_review: deterministic candidate mapping, **not approved or imported**.
- productionAuthorised=false, financialWrites=0, sourceMasterWrites=0 always describe this tool's read-only execution.

Customer/invoice/user targets use existing authority references. Other candidate operational/evidence IDs are deterministic from installation ID, entity kind and legacy ID. This is a planning key; the future executor still needs transactional mapping records and source hashes to be resumable safely.

Historical locally approved collections and fuel remain operational provenance, never commands to recreate old money. Original audit/outbox metadata stays in the unchanged backup; Saved locally audit stubs must not be replayed as payment commands.

The source proof images/signatures are validated as image data URLs and referenced by ID; the report does not print image bodies. Upload integrity, protected object storage, retention, cache encryption and the resumable importer are later work, not capabilities of this dry run.

## Implemented tests

`tests/integration-migration.test.ts` verifies explicit classification, repeatability, input immutability, wrong mappings, opening-balance exclusion, excluded dependency propagation, inactive identity mappings, historical approval non-posting, duplicate IDs, encoded mapping keys and the real Node CLI.

`tests/integration-contracts.test.ts` verifies stable invoice keys, field redaction, explicit readiness, opening-balance variants, shop/customer mappings, issuer-separated identities, driver assignment, revoked mappings, exact currency conversion, Credit handling and required authority receipt acknowledgement.

# Firebase connection

Dispatch uses real email/password Authentication in `delivery-28165`. The current backend is the authenticated `dispatchBridge` HTTPS function in `cisapp-236ab`; customer invoices, payments, credit and partner points remain authoritative there. No browser Firebase Admin credential or service-account key is present.

Use the dev previews and steps in [Connected dev review](docs/phase2/CONNECTED-DEV.md). Existing CISapp Admin/Manager accounts can alternatively authenticate against the CIS project. Backend token verification includes revocation and checks approved role/shop/assignment records on every request. Custom roles restrict base capabilities; they cannot create a more privileged role.

The user-approved runtime service account has Firebase Authentication Admin in the Delivery project for trusted user creation/update/disable/revocation. Identity links, settings, operational state, approval logs and evidence are in private CIS Firestore collections. Drivers never directly write source payment documents. Do not enable broad Firestore rules to fix a failed sign-in. The retired standalone diagnostics panel is not part of navigation.

Environment web-app configuration is public Firebase SDK configuration. Keep `.env.local` private to the workspace, and never put service-account credentials or passwords in `VITE_*` variables. `.env.example` describes optional configuration. `VITE_CISAPP_URL` controls the matching CISapp dev-preview links.

Operational Driver changes use an account-specific IndexedDB queue with stable IDs and server acknowledgements. Privileged approval and settings actions need connectivity. No seeded users or demo claims are imported. Browser storage can be lost; private backups require careful handling.

Backend deployment and dev preview publication were authorised; main/live frontend deployment still requires the user's separate review and approval.

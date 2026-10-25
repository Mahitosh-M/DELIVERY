import type { AppState, Evidence } from "../domain";
export type MigrationKind =
  | "shops"
  | "users"
  | "vehicles"
  | "customers"
  | "invoices"
  | "jobs"
  | "trips"
  | "attempts"
  | "collections"
  | "fuels"
  | "salesRequests"
  | "evidence";
export interface MigrationPrincipal {
  projectId: "cisapp-236ab" | "delivery-28165";
  uid: string;
  role: "ADMIN" | "MANAGER" | "DRIVER";
  active: boolean;
}
export interface MigrationManifest {
  version: 1;
  installationId: string;
  classifications: Record<string, "demo" | "operational" | "review">;
  customerMap: Record<string, string>;
  invoiceMap: Record<string, string>;
  identityMap: Record<string, { projectId: string; uid: string }>;
}
export interface AuthorityCatalog {
  projectId: "cisapp-236ab";
  exportedAt: string;
  customers: { id: string }[];
  invoices: {
    id: string;
    customerId: string;
    shopId: "SHOP_A" | "SHOP_S";
    invoiceType?: string;
    isOpeningBalance?: boolean;
    invoiceNumber?: string;
  }[];
  principals: MigrationPrincipal[];
}
export interface MigrationItem {
  kind: MigrationKind;
  legacyId: string;
  targetId: string | null;
  status: "skip_demo" | "needs_review" | "mapped_for_review";
  reasons: string[];
  dependencies: string[];
}
export interface MigrationReport {
  version: 1;
  installationId: string;
  dryRun: true;
  productionAuthorised: false;
  financialWrites: 0;
  sourceMasterWrites: 0;
  items: MigrationItem[];
  summary: {
    skip_demo: number;
    needs_review: number;
    mapped_for_review: number;
  };
  retainedLocalMetadata: { auditEntries: number; outboxEvents: number };
  warnings: string[];
}
const kinds: MigrationKind[] = [
  "shops",
  "users",
  "vehicles",
  "customers",
  "invoices",
  "jobs",
  "trips",
  "attempts",
  "collections",
  "fuels",
  "salesRequests",
  "evidence",
];
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function key(kind: string, id: string) {
  return `${kind}:${id}`;
}
function own<T>(map: Record<string, T>, id: string): T | undefined {
  return Object.hasOwn(map, id) ? map[id] : undefined;
}
export function migrationId(
  installationId: string,
  kind: MigrationKind,
  legacyId: string,
) {
  return `${encodeURIComponent(installationId)}:${kind}:${encodeURIComponent(legacyId)}`;
}
/** Builds a report only. Supplied catalog/manifest are review inputs, not production authorisation. */
export function dryRunMigration(
  backup: unknown,
  manifest: MigrationManifest,
  catalog: AuthorityCatalog,
): MigrationReport {
  requireValue(
    manifest?.version === 1 &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(manifest.installationId),
    "Manifest v1 and a stable installationId are required",
  );
  requireValue(
    manifest.classifications &&
      manifest.customerMap &&
      manifest.invoiceMap &&
      manifest.identityMap,
    "Complete explicit mapping manifest required",
  );
  requireValue(
    catalog?.projectId === "cisapp-236ab" &&
      Array.isArray(catalog.customers) &&
      Array.isArray(catalog.invoices) &&
      Array.isArray(catalog.principals) &&
      !Number.isNaN(Date.parse(catalog.exportedAt)),
    "Valid authoritative review catalog required",
  );
  const b = backup as {
    format?: string;
    version?: number;
    state?: AppState;
    evidence?: Evidence[];
  };
  requireValue(
    b?.format === "cis-dispatch-backup" &&
      b.version === 2 &&
      b.state?.schemaVersion === 2 &&
      Array.isArray(b.evidence),
    "Supported full Dispatch v2 backup required",
  );
  const state = b.state;
  const source = { ...state, evidence: b.evidence };
  const items: MigrationItem[] = [];
  for (const kind of kinds) {
    const rows = source[kind] as { id: string }[];
    requireValue(Array.isArray(rows), `Missing source ${kind}`);
    const seen = new Set<string>();
    for (const row of rows) {
      requireValue(
        row &&
          typeof row.id === "string" &&
          row.id.length > 0 &&
          !seen.has(row.id),
        `Invalid/duplicate ${kind} ID`,
      );
      seen.add(row.id);
      const classification = own(manifest.classifications, key(kind, row.id));
      items.push({
        kind,
        legacyId: row.id,
        targetId:
          classification === "operational"
            ? migrationId(manifest.installationId, kind, row.id)
            : null,
        status:
          classification === "demo"
            ? "skip_demo"
            : classification === "operational"
              ? "mapped_for_review"
              : "needs_review",
        reasons:
          classification === "operational" || classification === "demo"
            ? []
            : ["Explicit record classification required"],
        dependencies: [],
      });
    }
  }
  const byKey = new Map(items.map((i) => [key(i.kind, i.legacyId), i]));
  const item = (kind: MigrationKind, id: string) => byKey.get(key(kind, id))!;
  const block = (i: MigrationItem, reason: string) => {
    i.status = "needs_review";
    if (!i.reasons.includes(reason)) i.reasons.push(reason);
  };
  const dependency = (
    i: MigrationItem,
    kind: MigrationKind,
    id: string | null | undefined,
  ) => {
    if (!id) {
      block(i, `Missing ${kind} reference`);
      return;
    }
    const k = key(kind, id);
    i.dependencies.push(k);
    if (!byKey.has(k)) block(i, `Missing source dependency ${k}`);
  };
  for (const i of items.filter((i) => i.status === "mapped_for_review")) {
    switch (i.kind) {
      case "shops":
        if (!["SHOP_A", "SHOP_S"].includes(i.legacyId))
          block(i, "Additional shop needs an approved authority mapping");
        else i.targetId = i.legacyId;
        break;
      case "users": {
        const local = state.users.find((u) => u.id === i.legacyId)!;
        const map = own(manifest.identityMap, i.legacyId);
        const principal =
          map &&
          catalog.principals.find(
            (p) => p.projectId === map.projectId && p.uid === map.uid,
          );
        if (!principal || !principal.active || principal.role !== local.role)
          block(
            i,
            "Missing active approved issuer/UID/role mapping; no account will be created",
          );
        else
          i.targetId = `${principal.projectId}:${encodeURIComponent(principal.uid)}`;
        for (const shop of local.shopIds) dependency(i, "shops", shop);
        break;
      }
      case "vehicles":
        dependency(
          i,
          "shops",
          state.vehicles.find((v) => v.id === i.legacyId)!.homeShopId,
        );
        break;
      case "customers": {
        const target = own(manifest.customerMap, i.legacyId);
        if (!target || !catalog.customers.some((c) => c.id === target))
          block(
            i,
            "Explicit existing CISapp customer mapping required; no name matching or master write",
          );
        else i.targetId = target;
        break;
      }
      case "invoices": {
        const local = state.invoices.find((r) => r.id === i.legacyId)!;
        const target = own(manifest.invoiceMap, i.legacyId);
        const invoice = target && catalog.invoices.find((r) => r.id === target);
        if (
          !invoice ||
          invoice.customerId !== own(manifest.customerMap, local.customerId) ||
          invoice.shopId !== local.shopId
        )
          block(
            i,
            "Authoritative invoice/customer/shop mapping missing or conflicting",
          );
        else i.targetId = invoice.id;
        dependency(i, "customers", local.customerId);
        dependency(i, "shops", local.shopId);
        break;
      }
      case "jobs": {
        const j = state.jobs.find((j) => j.id === i.legacyId)!;
        dependency(i, "invoices", j.invoiceId);
        dependency(i, "customers", j.customerId);
        dependency(i, "shops", j.shopId);
        if (j.tripId) dependency(i, "trips", j.tripId);
        if (!j.address?.trim() || !j.phone?.trim())
          block(i, "Verified delivery snapshot required");
        const mapped = own(manifest.invoiceMap, j.invoiceId);
        const inv = catalog.invoices.find((x) => x.id === mapped);
        if (
          inv &&
          (inv.isOpeningBalance ||
            inv.invoiceType === "opening_balance" ||
            inv.invoiceNumber?.startsWith("0000-OPENING"))
        )
          block(i, "Opening-balance invoice must not become a delivery");
        break;
      }
      case "trips": {
        const t = state.trips.find((t) => t.id === i.legacyId)!;
        dependency(i, "shops", t.startShopId);
        dependency(i, "shops", t.endShopId);
        dependency(i, "vehicles", t.vehicleId);
        dependency(i, "users", t.primaryDriverId);
        if (t.companionId) dependency(i, "users", t.companionId);
        for (const st of t.stops) {
          dependency(i, "customers", st.customerId);
          if (st.jobId) dependency(i, "jobs", st.jobId);
        }
        for (const id of [t.openingPhoto, t.closingPhoto])
          if (id) dependency(i, "evidence", id);
        break;
      }
      case "attempts": {
        const a = state.attempts.find((a) => a.id === i.legacyId)!;
        dependency(i, "jobs", a.jobId);
        dependency(i, "trips", a.tripId);
        dependency(i, "users", a.actorId);
        if (a.evidenceId) dependency(i, "evidence", a.evidenceId);
        break;
      }
      case "collections": {
        const c = state.collections.find((c) => c.id === i.legacyId)!;
        dependency(i, "trips", c.tripId);
        dependency(i, "users", c.driverId);
        dependency(i, "customers", c.customerId);
        dependency(i, "shops", c.shopId);
        for (const id of c.invoiceIds) dependency(i, "invoices", id);
        if (c.evidenceId) dependency(i, "evidence", c.evidenceId);
        i.reasons.push(
          "Historical operational claim only; local approval is not a CISapp receipt and cannot trigger posting",
        );
        break;
      }
      case "fuels": {
        const f = state.fuels.find((f) => f.id === i.legacyId)!;
        dependency(i, "trips", f.tripId);
        dependency(i, "vehicles", f.vehicleId);
        dependency(i, "users", f.driverId);
        dependency(i, "shops", f.shopId);
        dependency(i, "evidence", f.receiptId);
        i.reasons.push(
          "Historical expense evidence only; no Cashapp expense or reimbursement replay",
        );
        break;
      }
      case "salesRequests": {
        const r = state.salesRequests.find((r) => r.id === i.legacyId)!;
        dependency(i, "trips", r.tripId);
        dependency(i, "users", r.driverId);
        dependency(i, "shops", r.shopId);
        if (r.customerId) dependency(i, "customers", r.customerId);
        break;
      }
      case "evidence": {
        const e = b.evidence!.find((e) => e.id === i.legacyId)!;
        if (
          typeof e.dataUrl !== "string" ||
          !/^data:image\/(png|jpeg|webp);base64,/.test(e.dataUrl) ||
          e.dataUrl.length > 4_000_000
        )
          block(i, "Evidence is missing, invalid or oversized");
        dependency(i, "users", e.actorId);
        break;
      }
    }
  }
  // Propagate unavailable dependencies to a fixed point; do not drop legitimate records silently.
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of items.filter((x) => x.status === "mapped_for_review"))
      for (const dep of i.dependencies) {
        const target = byKey.get(dep);
        if (!target || target.status !== "mapped_for_review") {
          block(i, `Dependency requires review or is excluded: ${dep}`);
          changed = true;
          break;
        }
      }
  }
  for (const kind of ["customers", "invoices", "users"] as MigrationKind[]) {
    const targets = new Map<string, MigrationItem[]>();
    for (const i of items.filter(
      (x) => x.kind === kind && x.status === "mapped_for_review" && x.targetId,
    )) {
      const list = targets.get(i.targetId!) ?? [];
      list.push(i);
      targets.set(i.targetId!, list);
    }
    for (const list of targets.values())
      if (list.length > 1)
        for (const i of list)
          block(
            i,
            "Multiple local records map to the same authority identity; explicit merge review required",
          );
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const i of items.filter((x) => x.status === "mapped_for_review"))
      if (
        i.dependencies.some((d) => byKey.get(d)?.status !== "mapped_for_review")
      ) {
        block(i, "A referenced mapping needs merge/review");
        changed = true;
      }
  }
  const summary = { skip_demo: 0, needs_review: 0, mapped_for_review: 0 };
  for (const i of items) summary[i.status]++;
  return {
    version: 1,
    installationId: manifest.installationId,
    dryRun: true,
    productionAuthorised: false,
    financialWrites: 0,
    sourceMasterWrites: 0,
    items,
    summary,
    retainedLocalMetadata: {
      auditEntries: state.audit?.length ?? 0,
      outboxEvents: state.outbox?.length ?? 0,
    },
    warnings: [
      "Review inputs are not cryptographically verified or production authorisation.",
      "No network requests, imports, financial postings or source-master updates were performed.",
      "Keep the original backup unchanged; audit/outbox metadata is retained there and must not be replayed as financial commands.",
      "Every mapped candidate still requires authorised migration review and evidence integrity verification.",
    ],
  };
}

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seed } from "./fixtures/seed";
import {
  dryRunMigration,
  migrationId,
  type MigrationManifest,
  type AuthorityCatalog,
  type MigrationKind,
} from "../src/integration/migration";
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
function fixture() {
  const state = seed();
  state.shops = [state.shops[0]];
  state.users = state.users.filter(
    (u) => u.id === "admin" || u.id === "driver-1",
  );
  for (const u of state.users) u.shopIds = ["SHOP_A"];
  state.customers = [state.customers[0]];
  state.invoices = [state.invoices[0]];
  state.jobs = [state.jobs[0]];
  state.trips = [];
  state.attempts = [];
  state.collections = [];
  state.fuels = [];
  state.salesRequests = [];
  const backup = {
    format: "cis-dispatch-backup",
    version: 2,
    state,
    evidence: [],
  };
  const manifest: MigrationManifest = {
    version: 1,
    installationId: "test-device-1",
    classifications: {},
    customerMap: { "customer-1": "cis-customer-1" },
    invoiceMap: { "invoice-1": "cis-invoice-1" },
    identityMap: {
      admin: { projectId: "cisapp-236ab", uid: "cis-admin" },
      "driver-1": { projectId: "delivery-28165", uid: "delivery-driver" },
    },
  };
  const catalog: AuthorityCatalog = {
    projectId: "cisapp-236ab",
    exportedAt: "2026-10-18T10:00:00Z",
    customers: [{ id: "cis-customer-1" }],
    invoices: [
      { id: "cis-invoice-1", customerId: "cis-customer-1", shopId: "SHOP_A" },
    ],
    principals: [
      {
        projectId: "cisapp-236ab",
        uid: "cis-admin",
        role: "ADMIN",
        active: true,
      },
      {
        projectId: "delivery-28165",
        uid: "delivery-driver",
        role: "DRIVER",
        active: true,
      },
    ],
  };
  return { backup, manifest, catalog };
}
function classify(
  f: ReturnType<typeof fixture>,
  value: "operational" | "demo",
) {
  for (const kind of kinds) {
    const rows = kind === "evidence" ? f.backup.evidence : f.backup.state[kind];
    for (const row of rows)
      f.manifest.classifications[kind + ":" + row.id] = value;
  }
}
describe("Read-only migration planning", () => {
  it("defaults every record to review without guessing from demo names", () => {
    const f = fixture();
    const report = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(report.summary.mapped_for_review).toBe(0);
    expect(report.summary.needs_review).toBeGreaterThan(0);
  });
  it("explicitly excludes demo records without deleting them", () => {
    const f = fixture();
    classify(f, "demo");
    const before = JSON.stringify(f.backup);
    const report = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(report.summary.needs_review).toBe(0);
    expect(report.summary.skip_demo).toBe(report.items.length);
    expect(JSON.stringify(f.backup)).toBe(before);
  });
  it("maps only explicitly classified records with existing authority references", () => {
    const f = fixture();
    classify(f, "operational");
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(r.summary.needs_review).toBe(0);
    expect(r.items.find((i) => i.kind === "invoices")?.targetId).toBe(
      "cis-invoice-1",
    );
    expect(r.sourceMasterWrites).toBe(0);
    expect(r.financialWrites).toBe(0);
    expect(r.productionAuthorised).toBe(false);
  });
  it("is deterministic and repeat-safe without altering inputs", () => {
    const f = fixture();
    classify(f, "operational");
    const before = JSON.stringify(f);
    expect(dryRunMigration(f.backup, f.manifest, f.catalog)).toEqual(
      dryRunMigration(f.backup, f.manifest, f.catalog),
    );
    expect(JSON.stringify(f)).toBe(before);
  });
  it("never matches customers by name", () => {
    const f = fixture();
    classify(f, "operational");
    f.manifest.customerMap = {};
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(r.items.find((i) => i.kind === "customers")?.status).toBe(
      "needs_review",
    );
    expect(r.items.find((i) => i.kind === "jobs")?.status).toBe("needs_review");
  });
  it("blocks wrong authoritative customer/shop mapping", () => {
    const f = fixture();
    classify(f, "operational");
    f.catalog.invoices[0].shopId = "SHOP_S";
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(r.items.find((i) => i.kind === "invoices")?.status).toBe(
      "needs_review",
    );
  });
  it("excludes opening-balance deliveries while retaining review records", () => {
    const f = fixture();
    classify(f, "operational");
    f.catalog.invoices[0].isOpeningBalance = true;
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(r.items.find((i) => i.kind === "jobs")?.reasons.join(" ")).toMatch(
      /Opening-balance/,
    );
  });
  it("propagates excluded dependencies rather than dropping linked operations", () => {
    const f = fixture();
    classify(f, "operational");
    f.manifest.classifications["customers:customer-1"] = "demo";
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(r.items.find((i) => i.kind === "jobs")?.status).toBe("needs_review");
  });
  it("does not promote an Auth account without an approved active role mapping", () => {
    const f = fixture();
    classify(f, "operational");
    f.catalog.principals[1].active = false;
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(
      r.items.find((i) => i.kind === "users" && i.legacyId === "driver-1")
        ?.status,
    ).toBe("needs_review");
  });
  it("flags historical local-approved collections as non-posting provenance", () => {
    const f = fixture();
    const source = seed().collections[0];
    f.backup.state.collections.push({
      ...source,
      id: "legacy-claim",
      tripId: "unmapped-trip",
      customerId: "customer-1",
      invoiceIds: ["invoice-1"],
      status: "Approved",
    });
    classify(f, "operational");
    const r = dryRunMigration(f.backup, f.manifest, f.catalog);
    expect(
      r.items.find((i) => i.kind === "collections")?.reasons.join(" "),
    ).toContain("cannot trigger posting");
    expect(r.financialWrites).toBe(0);
  });
  it("blocks duplicate legacy IDs and unsupported source versions", () => {
    const f = fixture();
    f.backup.state.customers.push(f.backup.state.customers[0]);
    expect(() => dryRunMigration(f.backup, f.manifest, f.catalog)).toThrow(
      /duplicate/,
    );
    expect(() =>
      dryRunMigration({ ...f.backup, version: 99 }, f.manifest, f.catalog),
    ).toThrow(/Supported/);
  });
  it("encodes stable legacy mapping identifiers without path injection", () => {
    expect(migrationId("test", "jobs", "a/b")).not.toContain("/");
    expect(migrationId("test", "jobs", "a/b")).not.toBe(
      migrationId("test", "jobs", "a%2Fb"),
    );
  });
  it("runs the real Node CLI without network or source mutation", async () => {
    const f = fixture();
    classify(f, "operational");
    const dir = await mkdtemp(join(tmpdir(), "cis-dispatch-dry-run-"));
    try {
      const names = ["backup", "manifest", "catalog"];
      const values = [f.backup, f.manifest, f.catalog];
      const paths = names.map((n) => join(dir, n + ".json"));
      for (let i = 0; i < paths.length; i++)
        await writeFile(paths[i], JSON.stringify(values[i]));
      const before = await readFile(paths[0], "utf8");
      const result = spawnSync(
        process.execPath,
        [
          resolve("scripts/phase2-dry-run.mjs"),
          "--backup",
          paths[0],
          "--manifest",
          paths[1],
          "--catalog",
          paths[2],
        ],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.dryRun).toBe(true);
      expect(report.financialWrites).toBe(0);
      expect(report.inputHashes.backup).toHaveLength(64);
      expect(await readFile(paths[0], "utf8")).toBe(before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

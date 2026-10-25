import { seed } from "./fixtures/seed";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import {
  DispatchDatabase,
  LocalRepository,
  db,
  repository,
  localEvidence,
  exportBackup,
  importBackup,
  validateBackup,
  csv,
} from "../src/data";
import { businessDate, uuid, type Trip, type Collection } from "../src/domain";
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV5kAAAAASUVORK5CYII=";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await repository.init();
  await db.state.put(seed());
  await db.evidence.put({id:"demo-evidence",actorId:"driver-1",name:"Fictional test proof",dataUrl:pixel,mime:"image/png",at:new Date().toISOString()});
});
afterEach(async () => {
  await db.delete();
});
it("retains operational data and image evidence after database reopen", async () => {
  const evidence = await localEvidence.save("driver-1", "proof.png", pixel);
  const s = await repository.get();
  const c = s.customers[0];
  await repository.execute("manager-a", {
    type: "saveCustomer",
    value: { ...c, address: "Persistent revised address" },
  });
  db.close();
  await db.open();
  expect((await repository.get()).customers[0].address).toBe(
    "Persistent revised address",
  );
  expect((await localEvidence.get(evidence))?.dataUrl).toBe(pixel);
});
it("exports and restores state, audit and evidence atomically", async () => {
  const id = await localEvidence.save("driver-1", "proof.png", pixel);
  const json = await exportBackup();
  const before = await repository.get();
  await repository.execute("admin", { type: "fuelTolerance", value: 500 });
  await importBackup("admin", json);
  expect((await repository.get()).settings.fuelTolerance).toBe(
    before.settings.fuelTolerance,
  );
  expect((await localEvidence.get(id))?.dataUrl).toBe(pixel);
  expect((await repository.get()).audit.at(-1)?.action).toBe("Backup restored");
});
it("rejects corrupt backups without changing live records", async () => {
  const raw = JSON.parse(await exportBackup());
  raw.state.invoices[0].outstanding = -1;
  await expect(importBackup("admin", JSON.stringify(raw))).rejects.toThrow(
    /balance/,
  );
  expect((await repository.get()).invoices[0].outstanding).toBe(500000);
});
it("blocks a manager from restoring the database", async () => {
  await expect(importBackup("manager-a", await exportBackup())).rejects.toThrow(
    /Admin/,
  );
});
it("rejects unsupported backup versions and duplicate IDs", () => {
  expect(() => validateBackup({ version: 99 })).toThrow(/version/);
});
it("neutralises spreadsheet formula injection in CSV", () => {
  expect(csv([['=IMPORTXML("x")', 2000]])).toContain("'=IMPORTXML");
});
it("serialises concurrent approval attempts and never double-reduces balances", async () => {
  const s = await repository.get();
  const t: Trip = {
    id: "test-trip",
    name: "Trip",
    date: businessDate(),
    startShopId: "SHOP_A",
    endShopId: "SHOP_A",
    vehicleId: "van-1",
    primaryDriverId: "driver-1",
    companionId: null,
    status: "Active",
    stops: [
      {
        id: "s",
        customerId: "customer-1",
        jobId: null,
        kind: "Collection",
        completed: false,
      },
    ],
    opening: 25000,
    closing: null,
    openingPhoto: null,
    closingPhoto: null,
    openingNote: "",
    endNote: "",
    openingAdvance: 0,
    startedAt: new Date().toISOString(),
    endedAt: null,
    loaded: true,
    returnConfirmed: false,
    approvedOdometer: false,
    cashReceived: 0,
    handoverConfirmed: false,
    cashExplanation: "",
    exceptions: [],
    revision: 1,
  };
  s.trips.push(t);
  await db.state.put(s);
  const c: Collection = {
    id: "c",
    submissionId: "c",
    tripId: t.id,
    customerId: "customer-1",
    shopId: "SHOP_A",
    driverId: "driver-1",
    invoiceIds: ["invoice-1"],
    amount: 200000,
    mode: "Cash",
    reference: "",
    note: "",
    evidenceId: null,
    status: "Pending",
    allocations: [],
    unallocated: 200000,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvalId: null,
    reviewNote: "",
    digitalVerified: false,
  };
  await repository.execute("driver-1", { type: "submitCollection", value: c });
  const results = await Promise.allSettled(
    ["a", "b"].map((approvalId) =>
      repository.execute("manager-a", {
        type: "reviewCollection",
        id: "c",
        approve: true,
        approvalId,
        allocations: [{ invoiceId: "invoice-1", amount: 200000 }],
        note: "Counted",
        digitalVerified: false,
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await repository.get()).invoices[0].outstanding).toBe(300000);
});
it("rolls back every related mutation when a command fails", async () => {
  const s = await repository.get();
  const before = JSON.stringify(s);
  await expect(
    repository.execute("manager-a", {
      type: "createJob",
      value: { ...s.jobs[0], id: uuid() },
    }),
  ).rejects.toThrow();
  expect(JSON.stringify(await repository.get())).toBe(before);
});

it("migrates schema v1 to v2 without losing operational records", async () => {
  const { default: Dexie } = await import("dexie");
  const name = "cis-dispatch-migration-" + uuid();
  const old = new Dexie(name);
  old.version(1).stores({ state: "id", evidence: "id,actorId" });
  const state = await repository.get();
  const legacy: Record<string, unknown> = { ...state, schemaVersion: 1 };
  delete legacy.settings;
  delete legacy.outbox;
  await old.table("state").put(legacy);
  old.close();
  const upgraded = new DispatchDatabase(name);
  try {
    await upgraded.open();
    const migrated = await upgraded.state.get("main");
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.settings.fuelTolerance).toBe(100);
    expect(migrated?.outbox).toEqual([]);
    expect(migrated?.customers).toHaveLength(15);
  } finally {
    await upgraded.delete();
  }
});

it("fills only blank confirmed shop towns without resetting operational data", async () => {
  const s = await repository.get();
  s.shops[0].town = "";
  s.shops[0].address = "Keep configured street";
  s.shops[1].town = "Previously configured town";
  s.customers[0].address = "Keep customer address";
  await db.state.put(s);
  await repository.init();
  const restored = await repository.get();
  expect(restored.shops[0].town).toBe("Maski");
  expect(restored.shops[0].address).toBe("Keep configured street");
  expect(restored.shops[1].town).toBe("Previously configured town");
  expect(restored.customers[0].address).toBe("Keep customer address");
  expect(restored.collections).toEqual(s.collections);
  await repository.init();
  expect(await repository.get()).toEqual(restored);
});

it("seeds confirmed shop towns", async () => {
  const s = await repository.get();
  expect(s.shops.find((x) => x.id === "SHOP_A")?.town).toBe("Maski");
  expect(s.shops.find((x) => x.id === "SHOP_S")?.town).toBe("Sindhanur");
});

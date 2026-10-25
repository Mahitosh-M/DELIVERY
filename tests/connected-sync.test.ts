import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { seed } from "./fixtures/seed";
import { db, repository } from "../src/data";
import {
  mergeCloudSnapshot,
  pushConnectedCollections,
  type CloudSnapshot,
} from "../src/integration/sync";
import { bridge } from "../src/integration/connection";
import { applyCommand } from "../src/commands";
vi.mock("../src/integration/connection", () => ({ bridge: vi.fn() }));
const identity = {
  uid: "real-driver",
  issuer: "delivery-28165" as const,
  actorId: "linked-driver",
  role: "DRIVER" as const,
  shopIds: ["SHOP_A"],
  name: "Linked fictional driver",
};
function cloud(): CloudSnapshot {
  return {
    identity,
    serverAt: "2026-10-19T10:00:00Z",
    drivers: [],
    claims: [],
    customers: [
      {
        id: "real-customer",
        name: "Fictional Pharmacy 01",
        phone: "0000000000",
        area: "Area",
        invoices: [
          {
            id: "real-invoice",
            number: "CIS-001",
            date: "2026-10-19",
            due: "2026-10-19",
            amount: 250000,
            outstanding: 250000,
            shopId: "SHOP_A",
            opening: false,
          },
        ],
      },
    ],
    requests: [
      {
        id: "real-invoice",
        sourceInvoiceId: "real-invoice",
        sourceCustomerId: "real-customer",
        invoiceNumber: "CIS-001",
        customerName: "Fictional Pharmacy 01",
        shopId: "SHOP_A",
        sourceRevision: 1,
        scheduledDate: "2026-10-19",
        address: "Verified address",
        contact: "0000000000",
        packages: 2,
        instructions: "",
        active: true,
        tripId: "published-trip",
      },
    ],
    trips: [
      {
        id: "published-trip",
        name: "Connected route",
        date: "2026-10-19",
        startShopId: "SHOP_A",
        endShopId: "SHOP_S",
        vehicleId: "van-1",
        primaryDriverId: identity.actorId,
        companionId: null,
        status: "Released",
        openingAdvance: 0,
        revision: 1,
        stops: [
          {
            id: "real-stop",
            kind: "Delivery",
            customerId: "real-customer",
            jobId: "real-invoice",
            completed: false,
          },
        ],
      },
    ],
  };
}
beforeEach(async () => {
  await db.delete();
  await db.open();
  await repository.init();
  vi.mocked(bridge).mockReset();
});
afterEach(async () => {
  await db.delete();
});
describe("Connected local persistence and financial separation", () => {
  it("imports stable external IDs without matching customer names or duplicating jobs on retry", () => {
    const s = seed(),
      initial = s.customers.length;
    const demo = structuredClone(s.customers[0]);
    mergeCloudSnapshot(s, cloud());
    mergeCloudSnapshot(s, cloud());
    expect(s.customers).toHaveLength(initial + 1);
    expect(s.customers.find((c) => c.id === demo.id)).toEqual(demo);
    expect(s.jobs.filter((j) => j.id === "cis-job:real-invoice")).toHaveLength(
      1,
    );
    expect(
      s.invoices.find((i) => i.externalId === "real-invoice")?.outstanding,
    ).toBe(250000);
  });
  it("retains offline trip progress and flags post-assignment source changes", () => {
    const s = seed();
    mergeCloudSnapshot(s, cloud());
    const trip = s.trips.find((t) => t.id === "published-trip")!;
    trip.status = "Active";
    trip.opening = 25000;
    const job = s.jobs.find((j) => j.id === "cis-job:real-invoice")!;
    job.remaining = 1;
    job.status = "Partial";
    const remote = cloud();
    remote.requests[0].packages = 4;
    mergeCloudSnapshot(s, remote);
    expect(trip.status).toBe("Active");
    expect(trip.opening).toBe(25000);
    expect(job.remaining).toBe(1);
    expect(job.packages).toBe(2);
    expect(s.integration?.conflicts.join(" ")).toMatch(
      /source details changed/,
    );
  });
  it("blocks local approval of connected claims instead of changing authoritative balances", () => {
    const s = seed();
    mergeCloudSnapshot(s, cloud());
    const template = s.collections[0];
    const claim = {
      ...template,
      id: "local-claim",
      tripId: "published-trip",
      customerId: "cis-customer:real-customer",
      invoiceIds: ["cis-invoice:real-invoice"],
      shopId: "SHOP_A",
      driverId: identity.actorId,
      status: "Pending" as const,
    };
    s.collections.push(claim);
    expect(() =>
      applyCommand(
        s,
        s.users.find((u) => u.id === "manager-a")!,
        {
          type: "reviewCollection",
          id: claim.id,
          approve: true,
          approvalId: "test",
          note: "Verified",
          digitalVerified: false,
          allocations: [],
        },
        () => true,
      ),
    ).toThrow(/CISapp/);
    expect(
      s.invoices.find((i) => i.id === "cis-invoice:real-invoice")?.outstanding,
    ).toBe(250000);
  });
  it("keeps failed submissions durable, retries stable IDs, ignores demo and already approved local collections", async () => {
    const s = await repository.get();
    mergeCloudSnapshot(s, cloud());
    const template = s.collections[0];
    const claim = {
      ...template,
      id: "local-claim",
      submissionId: "stable-submission",
      tripId: "published-trip",
      customerId: "cis-customer:real-customer",
      invoiceIds: ["cis-invoice:real-invoice"],
      shopId: "SHOP_A",
      driverId: identity.actorId,
      status: "Pending" as const,
      amount: 200000,
      mode: "Cash" as const,
    };
    s.collections.push(claim);
    s.collections.push({
      ...claim,
      id: "already-approved",
      status: "Approved",
    });
    await db.state.put(s);
    vi.mocked(bridge)
      .mockResolvedValueOnce(identity)
      .mockRejectedValueOnce(new Error("Offline"));
    await expect(pushConnectedCollections("delivery-28165")).rejects.toThrow(
      "Offline",
    );
    db.close();
    await db.open();
    expect(
      (await repository.get()).collections.find((c) => c.id === claim.id)
        ?.status,
    ).toBe("Pending");
    vi.mocked(bridge).mockReset();
    vi.mocked(bridge)
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce({ id: "cloud-claim", status: "Pending" })
      .mockResolvedValueOnce(cloud());
    expect(await pushConnectedCollections("delivery-28165")).toBe(1);
    const submitCalls = vi
      .mocked(bridge)
      .mock.calls.filter((c) => c[1] === "submitCollection");
    expect(submitCalls).toHaveLength(1);
    expect(submitCalls[0][2]).toMatchObject({
      submissionId: "stable-submission",
      amount: 200000,
      customerId: "real-customer",
    });
    expect(
      (await repository.get()).integration?.collectionLinks[claim.id].cloudId,
    ).toBe("cloud-claim");
  });
  it("uses acknowledged posted amounts, preserves full physical cash and refreshed server balances", () => {
    const s = seed();
    const remote = cloud();
    mergeCloudSnapshot(s, remote);
    const template = s.collections[0];
    s.collections.push({
      ...template,
      id: "claim",
      submissionId: "claim-submission",
      customerId: "cis-customer:real-customer",
      driverId: identity.actorId,
      amount: 200000,
      status: "Pending",
    });
    remote.customers[0].invoices[0].outstanding = 0;
    remote.claims = [
      {
        id: "remote",
        localId: "claim",
        submissionId: "claim-submission",
        tripId: "published-trip",
        customerId: "real-customer",
        shopId: "SHOP_A",
        actorId: identity.actorId,
        amount: 200000,
        mode: "Cash",
        reference: "",
        note: "",
        collectedAt: remote.serverAt,
        status: "Posted",
        postedAmount: 150000,
        unallocated: 50000,
        receiptIds: ["receipt-1"],
      },
    ];
    mergeCloudSnapshot(s, remote);
    expect(s.collections.find((c) => c.id === "claim")).toMatchObject({
      status: "Approved",
      amount: 200000,
      unallocated: 50000,
    });
    expect(s.integration?.collectionLinks.claim.postedAmount).toBe(150000);
    expect(
      s.invoices.find((i) => i.externalId === "real-invoice")?.outstanding,
    ).toBe(0);
  });
});

it("imports another device collection once for manager review without creating local receipts", () => {
  const s = seed(),
    remote = cloud();
  remote.identity = {
    uid: "manager-uid",
    issuer: "cisapp-236ab",
    actorId: "real-manager",
    role: "MANAGER",
    shopIds: ["SHOP_A"],
    name: "Real manager",
  };
  remote.claims = [
    {
      id: "server-claim",
      localId: "other-device-id",
      submissionId: "device-submission",
      tripId: "published-trip",
      customerId: "real-customer",
      shopId: "SHOP_A",
      actorId: "linked-driver",
      amount: 200000,
      mode: "Cash",
      status: "Pending",
      reference: "",
      note: "Reported cash",
      collectedAt: remote.serverAt,
    },
  ];
  mergeCloudSnapshot(s, remote);
  mergeCloudSnapshot(s, remote);
  expect(
    s.collections.filter((c) => c.id === "cloud-collection:server-claim"),
  ).toHaveLength(1);
  expect(
    s.collections.find((c) => c.id === "cloud-collection:server-claim"),
  ).toMatchObject({ amount: 200000, status: "Pending" });
  expect(
    s.invoices.find((i) => i.externalId === "real-invoice")?.outstanding,
  ).toBe(250000);
});

it("adopts a newer released route but never overwrites a driver route after departure", () => {
  const s = seed(),
    remote = cloud();
  mergeCloudSnapshot(s, remote);
  remote.trips[0].revision = 2;
  remote.trips[0].name = "Manager revised route";
  mergeCloudSnapshot(s, remote);
  const t = s.trips.find((t) => t.id === "published-trip")!;
  expect(t.name).toBe("Manager revised route");
  expect(t.revision).toBe(2);
  t.status = "Active";
  t.startedAt = "2026-10-19T10:00:00Z";
  t.opening = 25000;
  remote.trips[0].revision = 3;
  remote.trips[0].name = "Changed after departure";
  mergeCloudSnapshot(s, remote);
  expect(t.name).toBe("Manager revised route");
  expect(t.opening).toBe(25000);
  expect(s.integration?.conflicts.join(" ")).toMatch(
    /changed after local departure/,
  );
  expect(
    s.jobs.find((j) => j.id === "cis-job:real-invoice")?.sourceBlocked,
  ).toMatch(/Route changed/);
});


it('retains route and stop snapshots and flags route changes after assignment',()=>{
 const s=seed(),remote=cloud();Object.assign(remote.requests[0],{routeId:'weekly-1',routeName:'Route 1',routeDays:[1,3],routeStopId:'stop-1',routeStopName:'Middle road'});
 mergeCloudSnapshot(s,remote);const job=s.jobs.find(j=>j.id==='cis-job:real-invoice')!;expect(job.routeName).toBe('Route 1');expect(job.routeDays).toEqual([1,3]);expect(job.routeStopName).toBe('Middle road');
 remote.requests[0].routeId='weekly-2';mergeCloudSnapshot(s,remote);expect(job.routeId).toBe('weekly-1');expect(job.sourceBlocked).toContain('changed');
});

it('does not recreate expired Dispatch detail from preserved CISapp request data',()=>{const s=seed(),remote=cloud();mergeCloudSnapshot(s,remote);const job=s.jobs.find(j=>j.id==='cis-job:real-invoice')!;job.purgedAt='2026-10-08T00:00:00Z';job.address='';job.phone='';remote.requests[0].address='Preserved CISapp address';mergeCloudSnapshot(s,remote);expect(job.address).toBe('');expect(job.phone).toBe('');expect(remote.requests[0].address).toBe('Preserved CISapp address');});

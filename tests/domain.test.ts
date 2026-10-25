import { beforeEach, describe, it, expect } from "vitest";
import { seed } from "./fixtures/seed";
import { applyCommand, type Command, defaultAllocation } from "../src/commands";
import {
  paise,
  businessDate,
  type AppState,
  type Trip,
  type Collection,
  type Fuel,
} from "../src/domain";
import {
  allocateOldest,
  cashSummary,
  distance,
  fuelEfficiency,
} from "../src/rules";
let s: AppState;
const manager = "manager-a",
  driver = "driver-1";
function run(actorId: string, c: Command) {
  applyCommand(
    s,
    s.users.find((u) => u.id === actorId)!,
    c,
    (id) => id === "proof",
  );
}
function trip(id = "trip-1"): Trip {
  return {
    id,
    name: "Test route",
    date: businessDate(),
    startShopId: "SHOP_A",
    endShopId: "SHOP_S",
    vehicleId: "van-1",
    primaryDriverId: driver,
    companionId: "driver-2",
    status: "Draft",
    stops: [
      {
        id: "stop-1",
        kind: "Delivery",
        customerId: "customer-1",
        jobId: "job-1",
        completed: false,
      },
    ],
    opening: null,
    closing: null,
    openingPhoto: null,
    closingPhoto: null,
    openingNote: "",
    endNote: "",
    openingAdvance: 100000,
    startedAt: null,
    endedAt: null,
    loaded: false,
    returnConfirmed: false,
    approvedOdometer: false,
    cashReceived: 0,
    handoverConfirmed: false,
    cashExplanation: "",
    exceptions: [],
    revision: 0,
  };
}
function prepared() {
  run(manager, { type: "saveTrip", value: trip() });
  run(manager, {
    type: "routeAction",
    id: "trip-1",
    action: "Release",
    note: "Reviewed",
  });
  run(driver, {
    type: "startTrip",
    id: "trip-1",
    opening: 25000,
    photo: "proof",
    note: "",
  });
  run(driver, { type: "load", id: "trip-1" });
  return s.trips.find((t) => t.id === "trip-1")!;
}
function collection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: "c1",
    submissionId: "c1",
    tripId: "trip-1",
    customerId: "customer-1",
    shopId: "SHOP_A",
    driverId: driver,
    invoiceIds: ["invoice-old", "invoice-1"],
    amount: 200000,
    mode: "Cash",
    reference: "",
    note: "Cash received",
    evidenceId: null,
    status: "Pending",
    allocations: [],
    unallocated: 200000,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvalId: null,
    reviewNote: "",
    digitalVerified: false,
    ...overrides,
  };
}
function fuel(overrides: Partial<Fuel> = {}): Fuel {
  return {
    id: "f1",
    tripId: "trip-1",
    vehicleId: "van-1",
    driverId: driver,
    shopId: "SHOP_A",
    at: new Date().toISOString(),
    litres: 5,
    rate: 10000,
    amount: 50000,
    pump: "Demo pump",
    odometer: 25020,
    receiptId: "proof",
    source: "Shop advance",
    status: "Submitted",
    reimbursement: "Not applicable",
    reviewNote: "",
    settledAt: null,
    fullTank: false,
    ...overrides,
  };
}
beforeEach(() => {
  s = seed();
});
describe("Money and dates", () => {
  it("uses exact paise for decimal inputs", () => {
    expect(paise("2000.01")).toBe(200001);
    expect(paise("0.10")).toBe(10);
  });
  it("rejects precision and negative values", () => {
    expect(() => paise("1.001")).toThrow();
    expect(() => paise("-1")).toThrow();
  });
  it("uses India calendar boundaries", () => {
    expect(businessDate(new Date("2026-01-01T20:00:00Z"))).toBe("2026-01-02");
  });
});
describe("Delivery lifecycle", () => {
  it("creates a job from a saved reference", () => {
    const j = {
      ...s.jobs[0],
      id: "new-job",
      invoiceId: "invoice-11",
      customerId: "customer-11",
      packages: 4,
    };
    run(manager, { type: "createJob", value: j });
    expect(s.jobs.at(-1)?.remaining).toBe(4);
  });
  it("prevents duplicate active delivery", () => {
    expect(() =>
      run(manager, {
        type: "createJob",
        value: { ...s.jobs[0], id: "duplicate" },
      }),
    ).toThrow(/active delivery/);
  });
  it("assigns a delivery to a trip with two drivers", () => {
    run(manager, { type: "saveTrip", value: trip() });
    expect(s.jobs[0].status).toBe("Assigned");
    expect(s.trips[0].companionId).toBe("driver-2");
  });
  it("requires loading before an outcome", () => {
    prepared();
    s.trips.find((t) => t.id === "trip-1")!.loaded = false;
    expect(() =>
      run(driver, {
        type: "delivery",
        id: "job-1",
        outcome: "Delivered",
        delivered: 3,
        reason: "",
        note: "",
        evidenceId: "proof",
      }),
    ).toThrow(/loading/);
  });
  it("completes with proof and preserves invoice amount", () => {
    prepared();
    const amount = s.invoices[0].amount;
    run(driver, {
      type: "delivery",
      id: "job-1",
      outcome: "Delivered",
      delivered: 3,
      reason: "",
      note: "Acknowledged",
      evidenceId: "proof",
    });
    expect(s.jobs[0].status).toBe("Delivered");
    expect(s.jobs[0].remaining).toBe(0);
    expect(s.invoices[0].amount).toBe(amount);
    expect(s.attempts.at(-1)?.evidenceId).toBe("proof");
  });
  it("requires proof or a reviewed exception", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "delivery",
        id: "job-1",
        outcome: "Delivered",
        delivered: 3,
        reason: "",
        note: "",
        evidenceId: null,
      }),
    ).toThrow(/acknowledgement/);
  });
  it("records partial delivery without reducing reference amount", () => {
    prepared();
    run(driver, {
      type: "delivery",
      id: "job-1",
      outcome: "Partial",
      delivered: 1,
      reason: "",
      note: "2 returned",
      evidenceId: "proof",
    });
    expect(s.jobs[0].remaining).toBe(2);
    expect(s.jobs[0].returnsReconciled).toBe(false);
    expect(s.invoices[0].amount).toBe(500000);
  });
  it("requires a note for Other failure", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "delivery",
        id: "job-1",
        outcome: "Failed",
        delivered: 0,
        reason: "Other",
        note: "",
        evidenceId: null,
      }),
    ).toThrow(/note/);
  });
  it("records failure and reschedules after return reconciliation", () => {
    const t = prepared();
    run(driver, {
      type: "delivery",
      id: "job-1",
      outcome: "Failed",
      delivered: 0,
      reason: "Customer closed",
      note: "",
      evidenceId: null,
    });
    run(manager, {
      type: "jobAction",
      id: "job-1",
      action: "Reconcile returns",
      note: "Packages received",
    });
    run(driver, {
      type: "endTrip",
      id: t.id,
      closing: 25030,
      photo: "proof",
      returns: true,
      note: "",
    });
    run(manager, { type: "handover", id: t.id, amount: 100000, note: "" });
    run(manager, { type: "closeTrip", id: t.id, note: "Verified" });
    run(manager, {
      type: "jobAction",
      id: "job-1",
      action: "Reschedule",
      date: "2026-12-01",
      note: "Customer reopened",
    });
    expect(s.jobs[0].status).toBe("Ready");
    expect(s.jobs[0].tripId).toBeNull();
    expect(
      s.attempts.some(
        (a) => a.jobId === "job-1" && a.reason === "Customer closed",
      ),
    ).toBe(true);
  });
  it("cannot replay a completed delivery", () => {
    prepared();
    const c: Command = {
      type: "delivery",
      id: "job-1",
      outcome: "Delivered",
      delivered: 3,
      reason: "",
      note: "",
      evidenceId: "proof",
    };
    run(driver, c);
    expect(() => run(driver, c)).toThrow(/already completed/);
  });
});
describe("Trips and odometer", () => {
  it("prevents overlapping active vehicle shifts", () => {
    prepared();
    const second = trip("trip-2");
    second.stops = [
      {
        id: "stop2",
        kind: "Collection",
        customerId: "customer-1",
        jobId: null,
        completed: false,
      },
    ];
    run(manager, { type: "saveTrip", value: second });
    run(manager, {
      type: "routeAction",
      id: "trip-2",
      action: "Release",
      note: "Reviewed",
    });
    expect(() =>
      run(driver, {
        type: "startTrip",
        id: "trip-2",
        opening: 25000,
        photo: "proof",
        note: "",
      }),
    ).toThrow(/active shift/);
  });
  it("warns about discontinuity through required explanation", () => {
    run(manager, { type: "saveTrip", value: trip() });
    run(manager, {
      type: "routeAction",
      id: "trip-1",
      action: "Release",
      note: "Reviewed",
    });
    expect(() =>
      run(driver, {
        type: "startTrip",
        id: "trip-1",
        opening: 25001,
        photo: "proof",
        note: "",
      }),
    ).toThrow(/continuity/);
  });
  it("requires an authorised exception for missing photo", () => {
    run(manager, { type: "saveTrip", value: trip() });
    run(manager, {
      type: "routeAction",
      id: "trip-1",
      action: "Release",
      note: "Reviewed",
    });
    expect(() =>
      run(driver, {
        type: "startTrip",
        id: "trip-1",
        opening: 25000,
        photo: null,
        note: "",
      }),
    ).toThrow(/photograph/);
    run(manager, {
      type: "exception",
      id: "trip-1",
      note: "Opening photo: Camera failure verified in person",
    });
    run(driver, {
      type: "startTrip",
      id: "trip-1",
      opening: 25000,
      photo: null,
      note: "",
    });
    expect(s.trips.find((t) => t.id === "trip-1")?.status).toBe("Active");
  });
  it("rejects closing below opening", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "endTrip",
        id: "trip-1",
        closing: 24999,
        photo: "proof",
        returns: true,
        note: "",
      }),
    ).toThrow(/below opening/);
  });
  it("supports a reviewed driver and custody handover", () => {
    prepared();
    run(manager, {
      type: "changeDriver",
      id: "trip-1",
      driverId: "driver-2",
      companionId: "driver-1",
      note: "Vehicle and ?1000 advance transferred in person",
    });
    expect(s.trips.find((t) => t.id === "trip-1")?.primaryDriverId).toBe(
      "driver-2",
    );
    expect(s.audit.at(-1)?.action).toMatch(/custody/);
  });
  it("requires all stops completed or an exception", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "endTrip",
        id: "trip-1",
        closing: 25050,
        photo: "proof",
        returns: true,
        note: "",
      }),
    ).toThrow(/Complete stops/);
  });
});
describe("Collections", () => {
  it("submits cash and previews oldest-first including older invoices", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    expect(s.invoices.find((i) => i.id === "invoice-old")!.outstanding).toBe(
      300000,
    );
    expect(defaultAllocation(s, s.collections.at(-1)!)).toEqual([
      { invoiceId: "invoice-old", amount: 200000 },
    ]);
  });
  it("supports split allocation", () => {
    expect(allocateOldest(s, "customer-1", 400000)).toEqual([
      { invoiceId: "invoice-old", amount: 300000 },
      { invoiceId: "invoice-1", amount: 100000 },
    ]);
  });
  it("approves once with a stable operation identifier", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    const c: Command = {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "approve1",
      allocations: [{ invoiceId: "invoice-old", amount: 200000 }],
      note: "Counted cash",
      digitalVerified: false,
    };
    run(manager, c);
    run(manager, c);
    expect(s.invoices.find((i) => i.id === "invoice-old")!.outstanding).toBe(
      100000,
    );
    expect(
      s.audit.filter((a) => a.action === "Collection approved locally"),
    ).toHaveLength(1);
  });
  it("does not duplicate submission retries", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    run(driver, { type: "submitCollection", value: collection() });
    expect(s.collections.filter((c) => c.id === "c1")).toHaveLength(1);
  });
  it("supports manager override", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "a",
      allocations: [{ invoiceId: "invoice-1", amount: 200000 }],
      note: "Customer requested current invoice allocation",
      digitalVerified: false,
    });
    expect(s.invoices[0].outstanding).toBe(300000);
    expect(s.invoices.find((i) => i.id === "invoice-old")?.outstanding).toBe(
      300000,
    );
  });
  it("revalidates latest outstanding", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    s.invoices.find((i) => i.id === "invoice-old")!.outstanding = 10000;
    expect(() =>
      run(manager, {
        type: "reviewCollection",
        id: "c1",
        approve: true,
        approvalId: "a",
        allocations: [{ invoiceId: "invoice-old", amount: 200000 }],
        note: "Verify",
        digitalVerified: false,
      }),
    ).toThrow(/latest outstanding/);
  });
  it("holds excess unallocated", () => {
    prepared();
    run(driver, {
      type: "submitCollection",
      value: collection({ amount: 900000 }),
    });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "a",
      allocations: [
        { invoiceId: "invoice-old", amount: 300000 },
        { invoiceId: "invoice-1", amount: 500000 },
      ],
      note: "Excess held for review",
      digitalVerified: false,
    });
    expect(s.collections.at(-1)?.unallocated).toBe(100000);
    expect(s.invoices[0].outstanding).toBe(0);
  });
  it("requires digital verification for UPI", () => {
    prepared();
    run(driver, {
      type: "submitCollection",
      value: collection({ mode: "UPI", reference: "DEMO-123" }),
    });
    expect(() =>
      run(manager, {
        type: "reviewCollection",
        id: "c1",
        approve: true,
        approvalId: "a",
        allocations: [],
        note: "Screenshot only",
        digitalVerified: false,
      }),
    ).toThrow(/independent/);
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "a",
      allocations: [],
      note: "Bank record independently checked",
      digitalVerified: true,
    });
    expect(s.collections.at(-1)?.digitalVerified).toBe(true);
  });
  it("rejects a claim without changing balances", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: false,
      approvalId: "a",
      allocations: [],
      note: "Payment not received",
      digitalVerified: false,
    });
    expect(s.collections.at(-1)?.status).toBe("Rejected");
    expect(s.invoices[0].outstanding).toBe(500000);
  });
  it("credit creates no receipt or allocation", () => {
    prepared();
    run(driver, {
      type: "submitCollection",
      value: collection({
        mode: "Credit",
        amount: 0,
        note: "Approved credit requested",
      }),
    });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "a",
      allocations: [],
      note: "Credit authorised",
      digitalVerified: false,
    });
    expect(s.collections.at(-1)?.amount).toBe(0);
    expect(s.collections.at(-1)?.allocations).toEqual([]);
    expect(
      cashSummary(s, s.trips.find((t) => t.id === "trip-1")!).expected,
    ).toBe(100000);
  });
  it("rejects money attached to credit", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "submitCollection",
        value: collection({ mode: "Credit" }),
      }),
    ).toThrow(/zero amount/);
  });
  it("driver cannot approve own claim or another shop manager approve", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    const c: Command = {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "a",
      allocations: [],
      note: "review",
      digitalVerified: false,
    };
    expect(() => run(driver, c)).toThrow(/Manager/);
    expect(() => run("manager-s", c)).toThrow(/Manager/);
  });
});
describe("Fuel and cash integrity", () => {
  it("validates litres · rate", () => {
    prepared();
    expect(() =>
      run(driver, { type: "submitFuel", value: fuel({ amount: 99999 }) }),
    ).toThrow(/match bill/);
  });
  it("requires a persisted receipt", () => {
    prepared();
    expect(() =>
      run(driver, {
        type: "submitFuel",
        value: fuel({ receiptId: "missing" }),
      }),
    ).toThrow(/Receipt/);
  });
  it("counts shop-cash expense once", () => {
    const t = prepared();
    run(driver, { type: "submitFuel", value: fuel() });
    run(driver, { type: "submitFuel", value: fuel() });
    run(manager, {
      type: "reviewFuel",
      id: "f1",
      action: "Approve",
      note: "Receipt checked",
    });
    expect(cashSummary(s, t).expected).toBe(50000);
    expect(() =>
      run(manager, {
        type: "reviewFuel",
        id: "f1",
        action: "Approve",
        note: "Retry",
      }),
    ).toThrow(/already reviewed/);
  });
  it("personal reimbursement does not reduce cash custody", () => {
    const t = prepared();
    run(driver, { type: "submitFuel", value: fuel({ source: "Personal" }) });
    run(manager, {
      type: "reviewFuel",
      id: "f1",
      action: "Approve",
      note: "Valid",
    });
    expect(cashSummary(s, t).expected).toBe(100000);
    expect(s.fuels.at(-1)?.reimbursement).toBe("Pending");
    run(manager, {
      type: "reviewFuel",
      id: "f1",
      action: "Settle",
      note: "Paid personal reimbursement",
    });
    expect(s.fuels.at(-1)?.reimbursement).toBe("Settled");
    expect(
      s.fuels
        .filter((f) => f.id === "f1" && f.status === "Approved")
        .reduce((n, f) => n + f.amount, 0),
    ).toBe(50000);
  });
  it("does not infer fuel efficiency from purchases alone", () => {
    prepared();
    run(driver, { type: "submitFuel", value: fuel() });
    run(manager, {
      type: "reviewFuel",
      id: "f1",
      action: "Approve",
      note: "Valid",
    });
    expect(fuelEfficiency(s, "van-1")).toBeNull();
  });
  it("records discrepancy without creating another collection", () => {
    const t = prepared();
    run(driver, {
      type: "delivery",
      id: "job-1",
      outcome: "Delivered",
      delivered: 3,
      reason: "",
      note: "",
      evidenceId: "proof",
    });
    run(driver, { type: "submitCollection", value: collection() });
    run(driver, {
      type: "endTrip",
      id: t.id,
      closing: 25060,
      photo: "proof",
      returns: true,
      note: "",
    });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "cash-review",
      allocations: [{ invoiceId: "invoice-old", amount: 200000 }],
      note: "Cash counted",
      digitalVerified: false,
    });
    const count = s.collections.length;
    run(manager, {type:"handover",id:t.id,amount:290000,note:""});
    expect(t.cashReviewedExpected).toBe(300000);
    expect(t.cashExplanation).toBe("");
    expect(s.collections.length).toBe(count);
    expect(cashSummary(s, t).difference).toBe(-10000);
  });
});
it("completes dispatch ? collection ? fuel ? handover ? reviewed closure", () => {
  const t = prepared();
  run(driver, {
    type: "delivery",
    id: "job-1",
    outcome: "Delivered",
    delivered: 3,
    reason: "",
    note: "Signed",
    evidenceId: "proof",
  });
  run(driver, { type: "submitCollection", value: collection() });
  run(driver, { type: "submitFuel", value: fuel() });
  run(driver, {
    type: "endTrip",
    id: t.id,
    closing: 25100,
    photo: "proof",
    returns: true,
    note: "All stops completed",
  });
  run(manager, {
    type: "reviewCollection",
    id: "c1",
    approve: true,
    approvalId: "a",
    allocations: [{ invoiceId: "invoice-old", amount: 200000 }],
    note: "Cash verified",
    digitalVerified: false,
  });
  run(manager, { type: "handover", id: t.id, amount: 250000, note: "" });
  run(manager, {
    type: "reviewFuel",
    id: "f1",
    action: "Approve",
    note: "Receipt checked",
  });
  run(manager, {
    type: "closeTrip",
    id: t.id,
    note: "Odometer and cash reviewed",
  });
  expect(t.status).toBe("Closed");
  expect(distance(t)).toBe(100);
  expect(cashSummary(s, t).difference).toBe(0);
  expect(() =>
    run(manager, { type: "closeTrip", id: t.id, note: "retry" }),
  ).toThrow(/awaiting closure/);
  expect(s.jobs[0].status).toBe("Delivered");
  expect(s.audit.length).toBeGreaterThan(10);
});

describe("Reviewed corrections and clarification recovery", () => {
  it("appends an approved odometer correction and retains original readings", () => {
    const t = s.trips.find((t) => t.id === "historical-demo")!;
    run(manager, {
      type: "correctOdometer",
      id: t.id,
      opening: 24900,
      closing: 24990,
      note: "Original closing digit misread; photo reviewed",
    });
    expect(t.closing).toBe(25000);
    expect(t.corrections).toHaveLength(1);
    expect(distance(t)).toBe(90);
    expect(s.audit.at(-1)?.action).toMatch(/original readings retained/);
  });
  it("rejects a driver attempt to correct approved history", () => {
    expect(() =>
      run(driver, {
        type: "correctOdometer",
        id: "historical-demo",
        opening: 24900,
        closing: 24990,
        note: "Driver cannot approve",
      }),
    ).toThrow(/Manager/);
  });
  it("lets a driver respond to fuel clarification without duplicating expense", () => {
    prepared();
    run(driver, { type: "submitFuel", value: fuel() });
    run(manager, {
      type: "reviewFuel",
      id: "f1",
      action: "Clarification",
      note: "Please correct pump details",
    });
    run(driver, {
      type: "submitFuel",
      value: fuel({ pump: "Corrected demo pump" }),
    });
    expect(s.fuels.filter((f) => f.id === "f1")).toHaveLength(1);
    expect(s.fuels.find((f) => f.id === "f1")?.pump).toBe(
      "Corrected demo pump",
    );
    expect(s.fuels.find((f) => f.id === "f1")?.status).toBe("Submitted");
  });
  it("does not allow an approval identifier to allocate twice through a second submission", () => {
    prepared();
    run(driver, { type: "submitCollection", value: collection() });
    run(manager, {
      type: "reviewCollection",
      id: "c1",
      approve: true,
      approvalId: "shared-id",
      allocations: [],
      note: "Reviewed",
      digitalVerified: false,
    });
    run(driver, {
      type: "submitCollection",
      value: collection({ id: "c2", submissionId: "c2" }),
    });
    expect(() =>
      run(manager, {
        type: "reviewCollection",
        id: "c2",
        approve: true,
        approvalId: "shared-id",
        allocations: [],
        note: "Reused operation identifier",
        digitalVerified: false,
      }),
    ).toThrow(/identifier/);
  });
});

it('missing downloaded job gives a sync instruction without partially confirming loading',()=>{s=seed();const t={...trip('missing-details'),status:'Active' as const};s.trips.push(t);s.jobs=s.jobs.filter(j=>j.id!=='job-1');expect(()=>run(driver,{type:'load',id:t.id})).toThrow(/synchronise/i);expect(t.loaded).toBe(false);});

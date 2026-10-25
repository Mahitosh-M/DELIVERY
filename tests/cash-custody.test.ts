import { describe, it, expect } from "vitest";
import { seed } from "./fixtures/seed";
import { cashSummary } from "../src/rules";

describe("physical cash custody is independent of financial review", () => {
  it("keeps rejected cash and shop-advance spending in custody, excludes digital and personal payments", () => {
    const s = seed();
    const t = s.trips[0];
    t.openingAdvance = 100000;
    t.cashReceived = 0;
    t.handoverConfirmed = false;
    const collection = s.collections[0];
    const fuel = s.fuels[0];
    s.collections = [
      {
        ...collection,
        id: "cash",
        tripId: t.id,
        mode: "Cash",
        amount: 200000,
        status: "Rejected",
      },
      {
        ...collection,
        id: "upi",
        tripId: t.id,
        mode: "UPI",
        amount: 900000,
        status: "Approved",
      },
      {
        ...collection,
        id: "bank",
        tripId: t.id,
        mode: "Bank transfer",
        amount: 800000,
        status: "Approved",
      },
    ];
    s.fuels = [
      {
        ...fuel,
        id: "advance",
        tripId: t.id,
        source: "Shop advance",
        amount: 50000,
        status: "Rejected",
      },
      {
        ...fuel,
        id: "personal",
        tripId: t.id,
        source: "Personal",
        amount: 75000,
        status: "Approved",
      },
    ];
    expect(cashSummary(s, t)).toMatchObject({
      expected: 250000,
      held: 250000,
      approvedCash: 0,
      rejectedCash: 200000,
      rejectedSpending: 50000,
    });
    s.collections[0].status = "Approved";
    s.fuels[0].status = "Approved";
    expect(cashSummary(s, t)).toMatchObject({
      expected: 250000,
      approvedCash: 200000,
    });
    t.cashReceived = 240000;
    t.handoverConfirmed = true;
    expect(cashSummary(s, t)).toMatchObject({
      held: 10000,
      difference: -10000,
      reported: 200000,
    });
  });
});

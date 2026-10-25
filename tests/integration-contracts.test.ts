import { describe, it, expect } from "vitest";
import {
  createDeliveryProjection,
  deliveryKey,
  principalKey,
  assertManagerScope,
  assertAssignedDriver,
  rupeesToPaiseExact,
  cashappWholeRupees,
  cisPaymentMode,
  confirmedReceiptPosting,
  type SourceInvoice,
  type VerifiedIdentity,
  type DeliveryIntentInput,
} from "../src/integration/contracts";
const manager: VerifiedIdentity = {
  principal: { projectId: "cisapp-236ab", uid: "manager-uid" },
  role: "MANAGER",
  shopIds: ["SHOP_A"],
  active: true,
  mappingRevision: 1,
};
const invoice: SourceInvoice = {
  id: "invoice-doc-1",
  invoiceNumber: "INV-001",
  customerId: "customer-doc-1",
  shopId: "SHOP_A",
  branchSystemVersion: 1,
  date: "2026-10-18",
};
const customer = {
  id: "customer-doc-1",
  name: "Fictional Medical",
  mobile: "0000000000",
  area: "Area is not an address",
};
const intent: DeliveryIntentInput = {
  explicitlyRequested: true,
  financialWorkflowComplete: true,
  scheduledDate: "2026-10-18",
  verifiedAddress: "Verified demo delivery address",
  contact: "0000000000",
  packages: 3,
  instructions: "Keep dry",
  sourceRevision: 1,
};
describe("Audited CIS integration boundary", () => {
  it("uses one deterministic delivery key for repeated invoice requests", () => {
    expect(
      createDeliveryProjection(invoice, customer, intent, manager).id,
    ).toBe(
      createDeliveryProjection(
        invoice,
        customer,
        { ...intent, sourceRevision: 2 },
        manager,
      ).id,
    );
    expect(deliveryKey(invoice.id)).toContain("cisapp-236ab");
  });
  it("does not export cost, profit or unrelated customer fields", () => {
    const source = {
      ...invoice,
      totalCost: 123,
      totalProfit: 456,
      totalSales: 1000,
    };
    const result = createDeliveryProjection(
      source,
      { ...customer, advanceBalance: 99 },
      intent,
      manager,
    );
    expect(result).not.toHaveProperty("totalCost");
    expect(result).not.toHaveProperty("totalProfit");
    expect(result).not.toHaveProperty("totalSales");
    expect(result).not.toHaveProperty("advanceBalance");
  });
  it("requires explicit opt-in after the complete source save workflow", () => {
    expect(() =>
      createDeliveryProjection(
        invoice,
        customer,
        { ...intent, explicitlyRequested: false },
        manager,
      ),
    ).toThrow(/opt-in/);
    expect(() =>
      createDeliveryProjection(
        invoice,
        customer,
        { ...intent, financialWorkflowComplete: false },
        manager,
      ),
    ).toThrow(/completion/);
  });
  it.each([
    { isOpeningBalance: true },
    { invoiceType: "opening_balance" },
    { invoiceNumber: "0000-OPENING-ABC" },
  ])("excludes every audited opening-balance representation", (extra) => {
    expect(() =>
      createDeliveryProjection(
        { ...invoice, ...extra },
        customer,
        intent,
        manager,
      ),
    ).toThrow(/Opening balances/);
  });
  it("rejects ambiguous legacy shops", () => {
    expect(() =>
      createDeliveryProjection(
        { ...invoice, shopId: undefined },
        customer,
        intent,
        manager,
      ),
    ).toThrow(/shop/);
    expect(() =>
      createDeliveryProjection(
        { ...invoice, branchSystemVersion: undefined },
        customer,
        intent,
        manager,
      ),
    ).toThrow(/Legacy/);
  });
  it("does not infer the address from customer.area", () => {
    expect(() =>
      createDeliveryProjection(
        invoice,
        customer,
        { ...intent, verifiedAddress: "" },
        manager,
      ),
    ).toThrow(/not a fallback/);
  });
  it("checks current actor shop and source customer mappings", () => {
    expect(() =>
      createDeliveryProjection(
        { ...invoice, shopId: "SHOP_S" },
        customer,
        intent,
        manager,
      ),
    ).toThrow(/Manager/);
    expect(() =>
      createDeliveryProjection(
        invoice,
        { ...customer, id: "another" },
        intent,
        manager,
      ),
    ).toThrow(/mapping mismatch/);
  });
  it("separates equal UIDs in different Firebase projects", () => {
    expect(principalKey({ projectId: "delivery-28165", uid: "same" })).not.toBe(
      principalKey({ projectId: "cisapp-236ab", uid: "same" }),
    );
  });
  it("requires the correct assigned driver principal", () => {
    const driver: VerifiedIdentity = {
      ...manager,
      principal: { projectId: "delivery-28165", uid: "driver" },
      role: "DRIVER",
    };
    expect(() =>
      assertAssignedDriver(
        driver,
        [{ projectId: "cisapp-236ab", uid: "driver" }],
        "SHOP_A",
      ),
    ).toThrow(/not assigned/);
    expect(() =>
      assertAssignedDriver(driver, [driver.principal], "SHOP_A"),
    ).not.toThrow();
    expect(() => assertManagerScope(driver, "SHOP_A")).toThrow();
  });
  it("blocks revoked identity mappings", () => {
    expect(() =>
      assertManagerScope({ ...manager, active: false }, "SHOP_A"),
    ).toThrow(/active/);
  });
  it("converts existing rupee values exactly without silently rounding extra precision", () => {
    expect(rupeesToPaiseExact(2000.25)).toBe(200025);
    expect(rupeesToPaiseExact(0.1 + 0.2)).toBe(30);
    expect(() => rupeesToPaiseExact(1.001)).toThrow(/precision/);
    expect(() => cashappWholeRupees(10001)).toThrow(/no rounding/);
    expect(cashappWholeRupees(200000)).toBe(2000);
  });
  it("maps verified modes and never turns credit into a receipt", () => {
    expect(cisPaymentMode("Bank transfer")).toBe("Bank Transfer");
    expect(cisPaymentMode("Credit")).toBeNull();
  });
  it("requires matching server receipt acknowledgement before posted status", () => {
    const ack = {
      eventId: "event-1",
      operationId: "operation-1",
      authorityProjectId: "cisapp-236ab" as const,
      receiptIds: ["receipt-1"],
      acknowledgedAt: "2026-10-18T10:00:00Z",
    };
    expect(confirmedReceiptPosting("event-1", ack)).toBe("posted");
    expect(() => confirmedReceiptPosting("other", ack)).toThrow(
      /does not match/,
    );
    expect(() =>
      confirmedReceiptPosting("event-1", { ...ack, receiptIds: [] }),
    ).toThrow(/receipt/);
  });
});

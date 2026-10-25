/** Audited Phase 2 contracts. These do not connect to a backend or post money. */
export const CIS_PROJECT = "cisapp-236ab" as const;
export const DISPATCH_PROJECT = "delivery-28165" as const;
export type IntegrationShop = "SHOP_A" | "SHOP_S";
export type OperationalRole = "ADMIN" | "MANAGER" | "DRIVER";
export interface Principal {
  projectId: typeof CIS_PROJECT | typeof DISPATCH_PROJECT;
  uid: string;
}
export interface VerifiedIdentity {
  principal: Principal;
  role: OperationalRole;
  shopIds: IntegrationShop[];
  active: boolean;
  mappingRevision: number;
}
export interface SourceCustomer {
  id: string;
  name: string;
  mobile: string;
  area: string;
}
export interface SourceInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  shopId?: IntegrationShop;
  branchSystemVersion?: number;
  invoiceType?: string;
  isOpeningBalance?: boolean;
  recordStatus?: string;
  date: string;
  updatedAt?: string;
}
export interface DeliveryIntentInput {
  explicitlyRequested: boolean;
  financialWorkflowComplete: boolean;
  scheduledDate: string;
  verifiedAddress: string;
  contact: string;
  packages: number;
  instructions: string;
  sourceRevision: number;
}
export interface DeliveryProjection {
  schemaVersion: 1;
  id: string;
  sourceProjectId: typeof CIS_PROJECT;
  sourceInvoiceId: string;
  sourceCustomerId: string;
  sourceInvoiceNumber: string;
  shopId: IntegrationShop;
  sourceRevision: number;
  scheduledDate: string;
  addressSnapshot: string;
  contactSnapshot: string;
  packageCount: number;
  instructions: string;
  customerName: string;
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("/") &&
    !/[\u0000-\u001f]/.test(value)
  );
}
export function deliveryKey(invoiceId: string) {
  ensure(validId(invoiceId), "Invalid authoritative invoice document ID");
  return `${CIS_PROJECT}:delivery:v1:${encodeURIComponent(invoiceId)}`;
}
export function principalKey(principal: Principal) {
  ensure(
    [CIS_PROJECT, DISPATCH_PROJECT].includes(principal.projectId),
    "Unapproved identity issuer",
  );
  ensure(validId(principal.uid), "Invalid Firebase UID");
  return `${principal.projectId}:${encodeURIComponent(principal.uid)}`;
}
export function assertManagerScope(
  identity: VerifiedIdentity,
  shop: IntegrationShop,
) {
  principalKey(identity.principal);
  ensure(shop === "SHOP_A" || shop === "SHOP_S", "Invalid shop");
  ensure(
    identity.active &&
      Number.isSafeInteger(identity.mappingRevision) &&
      identity.mappingRevision > 0,
    "Current verified active identity mapping required",
  );
  ensure(
    identity.role === "ADMIN" ||
      (identity.role === "MANAGER" && identity.shopIds.includes(shop)),
    "Manager access to this shop is required",
  );
}
export function assertAssignedDriver(
  identity: VerifiedIdentity,
  assigned: Principal[],
  shop: IntegrationShop,
) {
  principalKey(identity.principal);
  ensure(
    identity.active &&
      Number.isSafeInteger(identity.mappingRevision) &&
      identity.mappingRevision > 0 &&
      identity.role === "DRIVER" &&
      identity.shopIds.includes(shop),
    "Verified driver scope required",
  );
  ensure(
    assigned.some((p) => principalKey(p) === principalKey(identity.principal)),
    "Driver is not assigned",
  );
}
export function createDeliveryProjection(
  invoice: SourceInvoice,
  customer: SourceCustomer,
  intent: DeliveryIntentInput,
  identity: VerifiedIdentity,
): DeliveryProjection {
  ensure(
    intent.explicitlyRequested && intent.financialWorkflowComplete,
    "Explicit opt-in after invoice and same-day payment completion is required",
  );
  ensure(
    !invoice.isOpeningBalance &&
      invoice.invoiceType !== "opening_balance" &&
      !invoice.invoiceNumber.startsWith("0000-OPENING"),
    "Opening balances are not dispatchable",
  );
  ensure(
    invoice.shopId === "SHOP_A" || invoice.shopId === "SHOP_S",
    "Missing or ambiguous authoritative shop",
  );
  ensure(
    invoice.branchSystemVersion === 1,
    "Legacy invoice shop requires review",
  );
  assertManagerScope(identity, invoice.shopId);
  ensure(
    validId(customer.id) && invoice.customerId === customer.id,
    "Invoice/customer mapping mismatch",
  );
  ensure(
    !/^(cancelled|canceled|deleted|void)$/i.test(invoice.recordStatus ?? ""),
    "Invoice is not eligible",
  );
  ensure(
    /^\d{4}-\d{2}-\d{2}$/.test(intent.scheduledDate) &&
      new Date(intent.scheduledDate + "T00:00:00Z")
        .toISOString()
        .slice(0, 10) === intent.scheduledDate,
    "Valid schedule required",
  );
  ensure(
    intent.verifiedAddress.trim().length >= 5 &&
      intent.contact.trim().length > 0,
    "Verified delivery address and contact required; customer area is not a fallback",
  );
  ensure(
    Number.isSafeInteger(intent.packages) && intent.packages > 0,
    "Positive whole package count required",
  );
  ensure(
    Number.isSafeInteger(intent.sourceRevision) && intent.sourceRevision > 0,
    "Backend source revision required",
  );
  return {
    schemaVersion: 1,
    id: deliveryKey(invoice.id),
    sourceProjectId: CIS_PROJECT,
    sourceInvoiceId: invoice.id,
    sourceCustomerId: customer.id,
    sourceInvoiceNumber: invoice.invoiceNumber,
    shopId: invoice.shopId,
    sourceRevision: intent.sourceRevision,
    scheduledDate: intent.scheduledDate,
    addressSnapshot: intent.verifiedAddress.trim(),
    contactSnapshot: intent.contact.trim(),
    packageCount: intent.packages,
    instructions: intent.instructions,
    customerName: customer.name,
  };
}
export function rupeesToPaiseExact(rupees: number) {
  ensure(Number.isFinite(rupees) && rupees >= 0, "Invalid rupee amount");
  const scaled = rupees * 100;
  const result = Math.round(scaled);
  ensure(
    Number.isSafeInteger(result) && Math.abs(scaled - result) < 1e-6,
    "Rupee amount has unsupported precision",
  );
  return result;
}
export function cashappWholeRupees(paise: number) {
  ensure(Number.isSafeInteger(paise) && paise >= 0, "Integer paise required");
  ensure(
    paise % 100 === 0,
    "Fractional Cashapp amounts require an approved precision policy; no rounding performed",
  );
  return paise / 100;
}
export function cisPaymentMode(
  mode: "Cash" | "UPI" | "Bank transfer" | "Credit",
): "Cash" | "UPI" | "Bank Transfer" | null {
  return mode === "Credit"
    ? null
    : mode === "Bank transfer"
      ? "Bank Transfer"
      : mode;
}
export type PostingStatus =
  | "local_only"
  | "pending_review"
  | "approved_not_posted"
  | "posting"
  | "posted"
  | "failed"
  | "conflicted"
  | "blocked";
export interface PostingAcknowledgement {
  eventId: string;
  operationId: string;
  authorityProjectId: typeof CIS_PROJECT;
  receiptIds: string[];
  acknowledgedAt: string;
}
export function confirmedReceiptPosting(
  eventId: string,
  ack: PostingAcknowledgement,
): PostingStatus {
  ensure(
    ack.eventId === eventId && ack.authorityProjectId === CIS_PROJECT,
    "Acknowledgement does not match the authority/event",
  );
  ensure(
    validId(ack.operationId) &&
      ack.receiptIds.length > 0 &&
      ack.receiptIds.every(validId),
    "Authoritative receipt references required",
  );
  ensure(
    !Number.isNaN(Date.parse(ack.acknowledgedAt)),
    "Server acknowledgement timestamp required",
  );
  return "posted";
}
export type IntegrationCommand =
  | {
      kind: "RequestDelivery";
      idempotencyKey: string;
      expectedRevision: number;
      invoiceId: string;
      intent: DeliveryIntentInput;
    }
  | {
      kind: "SubmitDeliveryAttempt";
      eventId: string;
      jobId: string;
      expectedRevision: number;
      deliveredPackages: number;
      evidenceIds: string[];
    }
  | {
      kind: "SubmitCollection";
      submissionId: string;
      customerId: string;
      amountPaise: number;
      mode: "Cash" | "UPI" | "Bank Transfer";
      invoiceIds: string[];
    }
  | {
      kind: "ApproveCollection";
      approvalId: string;
      submissionId: string;
      expectedRevision: number;
      allocationOverride: { invoiceId: string; amountPaise: number }[];
    }
  | {
      kind: "ConfirmCustodyHandover";
      handoverId: string;
      tripId: string;
      actualPaise: number;
      discrepancyReason: string;
    };
export interface AuthorityGateway {
  readonly sourceProjectId: typeof CIS_PROJECT;
  submit(
    command: IntegrationCommand,
  ): Promise<{
    operationId: string;
    status: PostingStatus;
    serverRevision: number;
    receiptIds: string[];
  }>;
  queryOperation(
    idempotencyKey: string,
  ): Promise<{
    operationId: string;
    status: PostingStatus;
    receiptIds: string[];
  } | null>;
}

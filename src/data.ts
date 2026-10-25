import Dexie, { type Table } from "dexie";
import type {
  AppState,
  Evidence,
  Snapshot,
  User,
  Customer,
  InvoiceReference,
  Collection,
} from "./domain";
import { uuid, now } from "./domain";
import { emptyState } from "./emptyState";
import { applyCommand, type Command } from "./commands";
import { assert, audit } from "./rules";
export interface DispatchRepository {
  get(): Promise<AppState>;
  execute(actorId: string, command: Command): Promise<void>;
}
export interface CustomerGateway {
  list(): Promise<Customer[]>;
}
export interface InvoiceGateway {
  list(): Promise<InvoiceReference[]>;
}
export interface PaymentGateway {
  approve(
    actorId: string,
    command: Extract<Command, { type: "reviewCollection" }>,
  ): Promise<void>;
}
export interface CashLedgerGateway {
  handover(
    actorId: string,
    tripId: string,
    amount: number,
    note: string,
  ): Promise<void>;
}
export interface EvidenceStorage {
  save(actorId: string, name: string, dataUrl: string): Promise<string>;
  get(id: string): Promise<Evidence | undefined>;
}
export interface AuthProvider {
  getDemoUser(id: string): Promise<User | undefined>;
}
export interface SyncAdapter {
  mode: "local";
  pendingCount(): Promise<number>;
}
export class DispatchDatabase extends Dexie {
  state!: Table<AppState, string>;
  evidence!: Table<Evidence, string>;
  pending!: Table<PendingCommand,string>;
  session!: Table<{id:string;identity:unknown;validatedAt:string;lastSyncedAt?:string},string>;
  constructor(name = "cis-dispatch") {
    super(name);
    this.version(3).stores({state:"id",evidence:"id,actorId,at",pending:"id,capturedAt",session:"id"});
    this.version(1).stores({ state: "id", evidence: "id,actorId" });
    this.version(2)
      .stores({ state: "id", evidence: "id,actorId,at" })
      .upgrade(async (tx) => {
        await tx
          .table("state")
          .toCollection()
          .modify((s: AppState) => {
            s.schemaVersion = 2;
            s.outbox ??= [];
            s.settings ??= { fuelTolerance: 100 };
          });
      });
  }
}
export let db = new DispatchDatabase("cis-dispatch-locked");
export let activeIssuer: "cisapp-236ab" | "delivery-28165" | null = null;
export interface PendingCommand {applyAfterAck?:boolean;id:string;actorId:string;capturedAt:string;command:Command;error?:string;}
export class LocalRepository implements DispatchRepository {
  constructor(public database: DispatchDatabase = db) {}
  async get() {
    const state = await this.database.state.get("main");
    assert(state, "Local database is not initialised");
    return state;
  }
  async init() {
    await this.database.transaction(
      "rw",
      this.database.state,
      this.database.evidence,
      async () => {
        const existing = await this.database.state.get("main");
        if (!existing) {
          await this.database.state.add(emptyState());
        } else {
          // Apply confirmed towns only to previously unconfigured shops.
          let changed = false;
          for (const shop of existing.shops) {
            const town =
              shop.id === "SHOP_A"
                ? "Maski"
                : shop.id === "SHOP_S"
                  ? "Sindhanur"
                  : null;
            if (town && !shop.town.trim()) {
              shop.town = town;
              changed = true;
            }
          }
          if (changed) await this.database.state.put(existing);
        }
      },
    );
  }
  async execute(actorId: string, command: Command) {
    await this.database.transaction(
      "rw",
      this.database.state,
      this.database.evidence,
      this.database.pending,
      async () => {
        const state = await this.get();
        const actor = state.users.find((u) => u.id === actorId);
        assert(actor, "Signed-in user not found");
        const evidence = new Set(
          (await this.database.evidence.toArray()).map((e) => e.id),
        );
        applyCommand(state, actor, command, (id) => !!id && evidence.has(id));
        await this.database.state.put(state);
        if(activeIssuer)await this.database.pending.add({id:uuid(),actorId,capturedAt:now(),command:structuredClone(command)});
      },
    );
  }
}
export let repository = new LocalRepository();
export async function openAccountWorkspace(issuer: "cisapp-236ab" | "delivery-28165", uid: string) {
  db.close(); activeIssuer=issuer; db=new DispatchDatabase("cis-dispatch-account-"+issuer+"-"+uid); repository=new LocalRepository(db); await repository.init();
}
export const localEvidence: EvidenceStorage = {
  async save(actorId, name, dataUrl) {
    assert(
      /^data:image\/(png|jpeg|webp);base64,/.test(dataUrl),
      "PNG, JPEG or WebP evidence required",
    );
    assert(
      dataUrl.length < 4_000_000,
      "Evidence too large; use an image below 3 MB",
    );
    const id = uuid();
    await db.evidence.add({
      id,
      actorId,
      name,
      dataUrl,
      mime: dataUrl.slice(5, dataUrl.indexOf(";")),
      at: now(),
    });
    return id;
  },
  async get(id) { const cached=await db.evidence.get(id);if(cached||!activeIssuer||!navigator.onLine)return cached;const {bridge}=await import("./integration/connection");const value=await bridge<Evidence>(activeIssuer,"getEvidence",{id});await db.evidence.put(value);return value; },
};
export const customers: CustomerGateway = {
  list: async () => (await repository.get()).customers,
};
export const invoices: InvoiceGateway = {
  list: async () => (await repository.get()).invoices,
};
export const payments: PaymentGateway = {
  approve: (actorId, command) => repository.execute(actorId, command),
};
export const cashLedger: CashLedgerGateway = {
  handover: (actorId, tripId, amount, note) =>
    repository.execute(actorId, { type: "handover", id: tripId, amount, note }),
};
export const auth: AuthProvider = {
  getDemoUser: async (id) =>
    (await repository.get()).users.find((u) => u.id === id && u.active),
};
export const sync: SyncAdapter = {
  mode: "local",
  pendingCount: async () => (await repository.get()).outbox.length,
};
export async function exportBackup(): Promise<string> {
  return db.transaction("r", db.state, db.evidence, async () =>
    JSON.stringify({
      format: "cis-dispatch-backup",
      version: 2,
      exportedAt: now(),
      state: await repository.get(),
      evidence: await db.evidence.toArray(),
    }),
  );
}
export function validateBackup(input: unknown): Snapshot {
  assert(input && typeof input === "object", "Invalid backup");
  const x = input as Record<string, unknown>;
  assert(
    x.format === "cis-dispatch-backup" && x.version === 2,
    "Unsupported backup format / version",
  );
  assert(
    x.state && typeof x.state === "object" && Array.isArray(x.evidence),
    "Incomplete backup",
  );
  const state = x.state as AppState;
  assert(
    state.id === "main" && state.schemaVersion === 2,
    "Unsupported database schema",
  );
  for (const key of [
    "users",
    "shops",
    "vehicles",
    "customers",
    "invoices",
    "jobs",
    "attempts",
    "trips",
    "collections",
    "fuels",
    "salesRequests",
    "audit",
    "outbox",
  ] as const) {
    assert(Array.isArray(state[key]), `Missing ${key}`);
    const ids = new Set<string>();
    for (const entry of state[key]) {
      assert(
        entry && typeof entry.id === "string" && !ids.has(entry.id),
        `Invalid or duplicate ${key} ID`,
      );
      ids.add(entry.id);
    }
  }
  assert(
    state.users.some((u) => u.role === "ADMIN" && u.active),
    "Active Admin required",
  );
  assert(
    state.settings &&
      Number.isSafeInteger(state.settings.fuelTolerance) &&
      state.settings.fuelTolerance >= 0,
    "Invalid settings",
  );
  const has = (items: { id: string }[], id: string) =>
    items.some((i) => i.id === id);
  for (const i of state.invoices) {
    assert(
      has(state.customers, i.customerId) && has(state.shops, i.shopId),
      "Broken invoice reference",
    );
    assert(
      Number.isSafeInteger(i.amount) &&
        Number.isSafeInteger(i.outstanding) &&
        i.outstanding >= 0 &&
        i.outstanding <= i.amount,
      "Invalid reference balance",
    );
  }
  for (const j of state.jobs) {
    assert(
      has(state.invoices, j.invoiceId) &&
        has(state.customers, j.customerId) &&
        has(state.shops, j.shopId),
      "Broken delivery reference",
    );
    assert(
      Number.isInteger(j.remaining) &&
        j.remaining >= 0 &&
        j.remaining <= j.packages,
      "Invalid package count",
    );
  }
  const evidence = x.evidence as Evidence[];
  assert(
    evidence.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.dataUrl === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/.test(e.dataUrl) &&
        e.dataUrl.length < 4_000_000,
    ),
    "Invalid image evidence",
  );
  assert(
    new Set(evidence.map((e) => e.id)).size === evidence.length,
    "Duplicate evidence ID",
  );
  const ev = new Set(evidence.map((e) => e.id));
  for (const t of state.trips) {
    assert(
      has(state.vehicles, t.vehicleId) &&
        has(state.shops, t.startShopId) &&
        has(state.shops, t.endShopId) &&
        has(state.users, t.primaryDriverId),
      "Broken trip reference",
    );
    assert(
      t.stops.every(
        (st) =>
          has(state.customers, st.customerId) &&
          (!st.jobId || has(state.jobs, st.jobId)),
      ),
      "Broken trip stop",
    );
    for (const id of [t.openingPhoto, t.closingPhoto])
      if (id) assert(ev.has(id), "Missing odometer evidence");
  }
  for (const a of state.attempts)
    if (a.evidenceId) assert(ev.has(a.evidenceId), "Missing delivery evidence");
  for (const f of state.fuels) {
    assert(
      has(state.trips, f.tripId) && ev.has(f.receiptId),
      "Broken fuel / evidence reference",
    );
    assert(
      Number.isSafeInteger(f.amount) && f.amount > 0,
      "Invalid fuel amount",
    );
  }
  for (const c of state.collections) {
    assert(
      has(state.customers, c.customerId) &&
        has(state.shops, c.shopId) &&
        Number.isSafeInteger(c.amount) &&
        c.amount >= 0,
      "Invalid collection",
    );
    if (c.evidenceId)
      assert(ev.has(c.evidenceId), "Missing collection evidence");
    assert(
      c.allocations.every(
        (a) =>
          has(state.invoices, a.invoiceId) &&
          Number.isSafeInteger(a.amount) &&
          a.amount > 0,
      ),
      "Broken allocation",
    );
  }
  return { state, evidence };
}
export async function importBackup(actorId: string, json: string) {
  assert(json.length < 100_000_000, "Backup exceeds 100 MB");
  const backup = validateBackup(JSON.parse(json));
  await db.transaction("rw", db.state, db.evidence, async () => {
    const current = await repository.get();
    const actor = current.users.find((u) => u.id === actorId);
    assert(actor?.role === "ADMIN", "Admin required");
    const restoredActor =
      backup.state.users.find((u) => u.id === actorId) ??
      backup.state.users.find((u) => u.role === "ADMIN" && u.active)!;
    audit(
      backup.state,
      restoredActor,
      "database",
      "main",
      "Backup restored",
      null,
      { previousRecords: current.audit.length },
    );
    await db.evidence.clear();
    await db.evidence.bulkPut(backup.evidence);
    await db.state.put(backup.state);
  });
}
export function download(
  name: string,
  body: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replace(/"/g, '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function localCollectionTotal(rows: Collection[]) {
  return rows
    .filter((c) => c.status === "Approved" && c.mode !== "Credit")
    .reduce((n, c) => n + c.amount, 0);
}

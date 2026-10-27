import {collectionOnDriverScreen} from './collectionVisibility';
import {NumberInput} from "./components/ui/number-input";
import {ResponsiveTable} from "./components/ui/responsive-table";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, CheckCircle, Wallet, Receipt, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useApp } from "./context";
import {
  Badge,
  Empty,
  Modal,
  Form,
  Field,
  EvidenceInput,
  EvidenceLink,
  Search,
} from "./ui";
import {
  uuid,
  now,
  businessDate,
  money,
  paise,
  fuelBill,
  timestamp,
  type Trip,
  type Collection,
  type CollectionMode,
  type Fuel,
  type SalesRequest,
  type Allocation,
} from "./domain";
import { allocateOldest, cashSummary, visibleCollections, fuelSource, fuelNeedsReview, advanceRemaining } from "./rules";
import { defaultAllocation } from "./commands";
export function CollectionForm({
  trip,
  initialCustomer,
  onClose,
}: {
  trip: Trip;
  initialCustomer: string | null;
  onClose: () => void;
}) {
  const { state, user, act } = useApp();
  const [id] = useState(uuid());
  const available = state.customers.filter((c) =>
    trip.stops.some((st) => st.customerId === c.id),
  );
  const [customerId, setCustomer] = useState(
    initialCustomer ?? available[0]?.id ?? "",
  );
  const [shopId, setShop] = useState(trip.startShopId);
  const references = state.invoices.filter(
    (i) =>
      i.customerId === customerId && i.shopId === shopId && i.outstanding > 0,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const ids = selected.length ? selected : references.map((i) => i.id);
  const [mode, setMode] = useState<CollectionMode>("Cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  let preview: Allocation[] = [];
  try {
    preview = allocateOldest(
      state,
      customerId,
      mode === "Credit" ? 0 : paise(amount || "0"),
      ids,
    );
  } catch {}
  return (
    <Modal title="Record customer collection" onClose={onClose}>
      <Form
        label="Submit for manager review"
        onSubmit={async () => {
          await act({
            type: "submitCollection",
            value: {
              id,
              submissionId: id,
              tripId: trip.id,
              customerId,
              shopId,
              driverId: user.id,
              invoiceIds: ids,
              amount: mode === "Credit" ? 0 : paise(amount),
              mode,
              reference,
              note,
              evidenceId: evidence,
              status: "Pending",
              allocations: [],
              unallocated: 0,
              createdAt: now(),
              approvedAt: null,
              approvalId: null,
              reviewNote: "",
              digitalVerified: false,
            },
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Customer">
            <select
              value={customerId}
              onChange={(e) => {
                setCustomer(e.target.value);
                setSelected([]);
              }}
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference shop">
            <select
              value={shopId}
              onChange={(e) => {
                setShop(e.target.value);
                setSelected([]);
              }}
            >
              {state.shops
                .filter(
                  (s) =>
                    s.id === trip.startShopId ||
                    trip.stops.some(
                      (st) =>
                        state.jobs.find((j) => j.id === st.jobId)?.shopId ===
                        s.id,
                    ),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Collection mode">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as CollectionMode)}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank transfer</option>
              <option value="Credit">Approved credit / no collection</option>
            </select>
          </Field>
          {mode !== "Credit" && (
            <Field label="Amount received (₹)">
              <NumberInput
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          )}
          {["UPI", "Bank transfer"].includes(mode) && (
            <Field label="Payment reference">
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          )}
        </div>
        <h3>Relevant CISapp invoices</h3>
        <small className="muted">
          All selected by default; deselect to choose a subset. Oldest-first
          preview only.
        </small>
        {references.map((i) => (
          <label className="select-row" key={i.id}>
            <input
              type="checkbox"
              checked={ids.includes(i.id)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...ids, i.id]
                  : ids.filter((x) => x !== i.id);
                setSelected(next.length ? next : ["none"]);
              }}
            />
            <span className="grow">
              {i.number}
              <small>{i.date}</small>
            </span>
            <strong>{money(i.outstanding)}</strong>
          </label>
        ))}
        {!references.length && (
          <Empty>No outstanding references for this customer and shop.</Empty>
        )}
        <div className="summary-box">
          <strong>Allocation preview</strong>
          {preview.map((a) => (
            <p key={a.invoiceId}>
              {state.invoices.find((i) => i.id === a.invoiceId)?.number}
              <span>{money(a.amount)}</span>
            </p>
          ))}
          {mode === "Credit" && (
            <p>Credit records no money and creates no receipt.</p>
          )}
        </div>
        <Field label="Remarks / credit authorisation note">
          <textarea
            required={mode === "Credit"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {mode !== "Credit" && (
          <EvidenceInput
            label="Optional collection evidence"
            value={evidence}
            onChange={setEvidence}
          />
        )}
        <p className="notice">
          Pending manager verification. No bank or CISapp balance is updated.
        </p>
      </Form>
    </Modal>
  );
}
export function CollectionsPage() {
  const { state, user } = useApp();
  const [params] = useSearchParams();
  const tripId = params.get("tripId");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [review, setReview] = useState<string | null>(null);
  const [screenTime, setScreenTime] = useState(Date.now);
  useEffect(() => {
    const tick = () => setScreenTime(Date.now());
    const timer = window.setInterval(tick, 60000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const rows = visibleCollections(state, user).filter(
    (c) =>
      (user.role !== "DRIVER" || collectionOnDriverScreen(state, c, screenTime)) &&
      (!tripId || c.tripId === tripId) &&
      (status === "All" || c.status === status) &&
      `${state.customers.find((x) => x.id === c.customerId)?.name} ${c.reference}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selectedReview = rows.find(c => c.id === review);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>
            {user.role === "DRIVER" ? "My collections" : "Collection review"}
          </h1>
          
        </div>
      </div>
      {tripId && <Link className="secondary" to={params.get("return") === "cash" ? `/cash?tripId=${encodeURIComponent(tripId)}` : `/trips/${tripId}`}>{params.get("return") === "cash" ? "Back to cash reconciliation" : "Back to trip"}</Link>}
      <div className="notice">
        Digital evidence is not bank verification. Credit is
        not money received.
      </div>
      <div className="panel">
        <div className="toolbar">
          <Search value={query} onChange={setQuery} />
          <select
            aria-label="Collection status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["All", "Pending", "Approved", "Rejected"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Customer / recorded</th>
                <th>Mode</th>
                <th>Amount received</th>
                <th>Unallocated</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>
                      {state.customers.find((x) => x.id === c.customerId)?.name}
                    </strong>
                    <small>{timestamp(c.createdAt)}</small>
                  </td>
                  <td>
                    {c.mode === "Credit" ? "Credit / no receipt" : c.mode}
                  </td>
                  <td>{money(c.amount)}</td>
                  <td>{money(c.unallocated)}</td>
                  <td>
                    <Badge>{c.status}</Badge>
                  </td>
                  <td>
                    <button className="link" onClick={() => setReview(c.id)}>
                      {user.role !== "DRIVER" && c.status === "Pending"
                        ? "Review"
                        : "Details"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          {!rows.length && <Empty />}
        </div>
      </div>
      {selectedReview && (
        <CollectionReview
          value={selectedReview}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}
function CollectionReview({
  value: c,
  onClose,
}: {
  value: Collection;
  onClose: () => void;
}) {
  const { state, user, act } = useApp();
  const [approvalId] = useState(uuid());
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>(
    defaultAllocation(state, c),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      defaultAllocation(state, c).map((a) => [
        a.invoiceId,
        String(a.amount / 100),
      ]),
    ),
  );
  const refs = state.invoices.filter(
    (i) => i.customerId === c.customerId && i.shopId === c.shopId,
  );
  const connected = c.customerId.startsWith("cis-customer:");
  const pending =
    c.status === "Pending" && user.role !== "DRIVER";
  return (
    <Modal
      title={pending ? "Verify & allocate collection" : "Collection details"}
      onClose={onClose}
    >
      <div className="detail-card">
        <h3>{state.customers.find((x) => x.id === c.customerId)?.name}</h3>
        <p>
          {c.mode} · {money(c.amount)} · <Badge>{c.status}</Badge>
        </p>
        <p>Reference: {c.reference || "·"}</p>
        <p>{c.note}</p>
        <EvidenceLink id={c.evidenceId} expired={!!state.trips.find(t=>t.id===c.tripId)?.purgedAt} />
      </div>
      {connected && (
        <p className="notice">
          Approval posts to the CISapp ledger after current-balance and permission checks. Cash handover is a separate custody event.
        </p>
      )}
      {pending ? (
        <Form
          label={approve ? "Approve and post to CISapp" : "Reject claim"}
          onSubmit={async () => {
            const actual =
              approve && c.mode !== "Credit"
                ? Object.entries(amounts)
                    .filter(([, amount]) => amount !== "" && paise(amount) > 0)
                    .map(([invoiceId, amount]) => ({
                      invoiceId,
                      amount: paise(amount),
                    }))
                : [];
            await act({
              type: "reviewCollection",
              id: c.id,
              approve,
              approvalId,
              allocations: actual,
              note,
              digitalVerified: verified,
            });
            onClose();
          }}
        >
          <Field label="Review decision">
            <select
              value={String(approve)}
              onChange={(e) => setApprove(e.target.value === "true")}
            >
              <option value="true">Approve</option>
              <option value="false">Reject</option>
            </select>
          </Field>
          {approve && c.mode !== "Credit" && (
            <>
              <div className="flex-between">
                <h3>Manager allocation override</h3>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    const a = defaultAllocation(state, c);
                    setAllocations(a);
                    setAmounts(
                      Object.fromEntries(
                        a.map((x) => [x.invoiceId, String(x.amount / 100)]),
                      ),
                    );
                  }}
                >
                  Reset oldest-first
                </button>
              </div>
              <p className="muted text-xs">
                Current CISapp balances are checked atomically on approval.
              </p>
              {refs.map((i) => (
                <div className="allocation" key={i.id}>
                  <span>
                    {i.number}
                    <small>Outstanding {money(i.outstanding)}</small>
                  </span>
                  <Field label={`Allocate to ${i.number} (₹)`}>
                    <NumberInput
                      aria-label={`Allocate ${i.number}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[i.id] ?? ""}
                      onChange={(e) =>
                        setAmounts({ ...amounts, [i.id]: e.target.value })
                      }
                    />
                  </Field>
                </div>
              ))}
              <small className="muted">
                Any excess remains unallocated for review, not a customer
                advance.
              </small>
            </>
          )}
          {approve && ["UPI", "Bank transfer"].includes(c.mode) && (
            <label className="check">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              I independently verified the digital payment manually. A
              screenshot alone is insufficient.
            </label>
          )}
          <Field label="Verification / rejection note">
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <p className="notice">
            Confirm this decision. Approval creates CISapp receipts; rejection creates no receipt.
          </p>
        </Form>
      ) : (
        <>
          <div className="summary-box">
            {c.allocations.map((a) => (
              <p key={a.invoiceId}>
                {state.invoices.find((i) => i.id === a.invoiceId)?.number}
                <span>{money(a.amount)}</span>
              </p>
            ))}
            <p>
              Unallocated<span>{money(c.unallocated)}</span>
            </p>
          </div>
          <p>{c.reviewNote}</p>
        </>
      )}
    </Modal>
  );
}
export function FuelForm({
  trip,
  onClose,
  existing,
}: {
  trip: Trip;
  onClose: () => void;
  existing?: Fuel;
}) {
  const { state, user, act } = useApp();
  const [id] = useState(existing?.id ?? uuid());
  const [litres, setLitres] = useState(existing ? String(existing.litres) : "");
  const [rate, setRate] = useState(existing ? String(existing.rate / 100) : "");
  const remainingAdvance = advanceRemaining(state, trip, existing?.id);
  let bill = 0;
  try { if (litres && rate) bill = fuelBill(litres, paise(rate)); } catch { /* Incomplete input. */ }
  const [pump, setPump] = useState(existing?.pump ?? "");
  const [date, setDate] = useState(
    new Date(Date.parse(existing?.at ?? now()) + 330 * 60000)
      .toISOString()
      .slice(0, 16),
  );
  const [odometer, setOdometer] = useState(
    existing?.odometer !== null && existing?.odometer !== undefined
      ? String(existing.odometer)
      : "",
  );
  const [receipt, setReceipt] = useState<string | null>(
    existing?.receiptId ?? null,
  );
  const [source, setSource] = useState<Fuel["source"]>(
    existing ? fuelSource(state, existing) : remainingAdvance > 0 ? "Shop advance" : "Personal",
  );
  const [full, setFull] = useState(existing?.fullTank ?? false);
  return (
    <Modal title="Record diesel purchase" onClose={onClose}>
      <Form
        label="Submit fuel claim"
        onSubmit={async () => {
          await act({
            type: "submitFuel",
            value: {
              id,
              tripId: trip.id,
              vehicleId: trip.vehicleId,
              driverId: user.id,
              shopId: trip.startShopId,
              at: new Date(date + "+05:30").toISOString(),
              litres: Number(litres),
              rate: paise(rate),
              amount: fuelBill(litres, paise(rate)),
              pump,
              odometer: odometer === "" ? null : Number(odometer),
              receiptId: receipt ?? "",
              source,
              status: "Submitted",
              reimbursement:
                source === "Personal" ? "Pending" : "Not applicable",
              reviewNote: "",
              settledAt: null,
              fullTank: full,
            },
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Purchase time (Asia/Kolkata)">
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Litres purchased">
            <NumberInput
              type="number"
              min="0.01"
              step="0.01"
              required
              value={litres}
              onChange={(e) => setLitres(e.target.value)}
            />
          </Field>
          <Field label="Price per litre (₹)">
            <NumberInput
              type="number"
              min="0.01"
              step="0.01"
              required
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field label="Total bill (₹)">
            <NumberInput
              type="number"
              min="0.01"
              step="0.01"
              required
              value={bill ? (bill / 100).toFixed(2) : ""}
              readOnly
              aria-describedby="fuel-total-help"
            />
          </Field>
          <Field label="Pump name (optional)">
            <input value={pump} onChange={(e) => setPump(e.target.value)} />
          </Field>
          <Field label="Odometer at fill (optional)">
            <NumberInput
              type="number"
              min={trip.opening ?? 0}
              step="1"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
            />
          </Field>
          <Field label="Payment source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as Fuel["source"])}
            >
              <option disabled={remainingAdvance <= 0}>Shop advance</option>
              <option>Personal</option>
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={full}
              onChange={(e) => setFull(e.target.checked)}
            />
            Verified full-tank fill
          </label>
        </div>
        <p className="muted" id="fuel-total-help">Total bill is calculated from litres × price per litre.</p>
        {remainingAdvance <= 0 && <p className="notice">No shop advance remains. Use personal funds; reimbursement is reviewed separately.</p>}
        <EvidenceInput
          label="Diesel receipt photograph"
          value={receipt}
          onChange={setReceipt}
        />
        <p className="notice">
          Purchased fuel is not necessarily consumed today. Personal
          reimbursement is settled separately.
        </p>
      </Form>
    </Modal>
  );
}
export function FuelPage() {
  const { state, user } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get("tripId");
  const [status, setStatus] = useState(params.get("history") === "1" ? "All" : "Needs review");
  const [selected, setSelected] = useState<string | null>(params.get("review"));
  const rows = state.fuels.filter(
    (f) =>
      (user.role === "ADMIN" ||
        (user.role === "DRIVER"
          ? f.driverId === user.id
          : user.shopIds.includes(f.shopId))) &&
      (!tripId || f.tripId === tripId) &&
      (status === "All" || (status === "Needs review" ? fuelNeedsReview(f) : f.status === status || f.reimbursement === status)),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>
            {user.role === "DRIVER"
              ? "My diesel claims"
              : "Fuel & reimbursements"}
          </h1>
          <p>
            Purchased litres, approved expense and separate reimbursement
            settlement.
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar">
          <h3>{tripId ? "Diesel for this trip" : "Diesel purchase ledger"}</h3>
          {tripId && <Link className="secondary" to={`/trips/${tripId}`}>Back to trip</Link>}
          <select
            aria-label="Fuel status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "Needs review",
              "All",
              "Submitted",
              "Approved",
              "Rejected",
              "Clarification",
              "Pending",
              "Settled",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Vehicle / date</th>
                <th>Litres</th>
                <th>Bill</th>
                <th>Paid from</th>
                <th>Approval</th>
                <th>Reimbursement</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>
                      {
                        state.vehicles.find((v) => v.id === f.vehicleId)
                          ?.registration
                      }
                    </strong>
                    <small>{timestamp(f.at)}</small>
                  </td>
                  <td>{f.litres.toFixed(2)} L</td>
                  <td>{money(f.amount)}</td>
                  <td>{f.source}</td>
                  <td>
                    <Badge>{f.status}</Badge>
                  </td>
                  <td>
                    <Badge>{f.reimbursement}</Badge>
                  </td>
                  <td>
                    <button className="link" onClick={() => setSelected(f.id)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          {!rows.length && (
            <Empty>Drivers can record fuel from an active trip.</Empty>
          )}
        </div>
      </div>
      {selected && rows.some(f => f.id === selected) && (
        <FuelReview
          fuel={state.fuels.find((f) => f.id === selected)!}
          onClose={() => setSelected(null)}
          onDecision={() => { setSelected(null); if (tripId) navigate(`/trips/${tripId}`); }}
        />
      )}
    </>
  );
}
function FuelReview({ fuel: f, onClose, onDecision }: { fuel: Fuel; onClose: () => void; onDecision: () => void }) {
  const { user, act, state } = useApp();
  const [respond, setRespond] = useState(false);
  const [action, setAction] = useState<
    "Approve" | "Approve & reimburse" | "Reject" | "Clarification" | "Settle"
  >(f.status === "Approved" ? "Settle" : "Approve");
  const [note, setNote] = useState("");
  const source = fuelSource(state, f);
  const handedOver = !!state.trips.find(t => t.id === f.tripId)?.handoverConfirmed;
  const reviewable =
    user.role !== "DRIVER" &&
    (user.role === "ADMIN" || user.shopIds.includes(f.shopId)) &&
    (["Submitted", "Clarification"].includes(f.status) ||
      (f.status === "Approved" && f.reimbursement === "Pending"));
  if (respond)
    return (
      <FuelForm
        trip={state.trips.find((t) => t.id === f.tripId)!}
        existing={f}
        onClose={onClose}
      />
    );
  return (
    <Modal title="Fuel claim review" onClose={onClose}>
      <div className="detail-card">
        <h3>{f.pump || "Diesel purchase"}</h3>
        <p>
          {f.litres} L × {money(f.rate)} = {money(f.amount)}
        </p>
        <p>
          {source} · {f.status} · {f.reimbursement}
        </p>
        <EvidenceLink id={f.receiptId} label="Fuel receipt" expired={!!state.trips.find(t=>t.id===f.tripId)?.purgedAt} />
        <p>{f.reviewNote}</p>
        {user.role === "DRIVER" && f.status === "Clarification" && (
          <button className="primary" onClick={() => setRespond(true)}>
            Respond & resubmit
          </button>
        )}
      </div>
      {reviewable && (
        <Form
          label="Confirm fuel decision"
          onSubmit={async () => {
            await act({ type: "reviewFuel", id: f.id, action, note });
            onDecision();
          }}
        >
          <Field label="Decision">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
            >
              {(f.status === "Approved"
                ? ["Settle"]
                : ["Approve", ...(source === "Personal" ? ["Approve & reimburse"] : []), "Reject", ...(!handedOver ? ["Clarification"] : [])]
              ).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Review / settlement note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <p className="notice">
            {action === "Settle" || action === "Approve & reimburse"
              ? "Confirm reimbursement has been physically paid. CashApp will record one Diesel expense under Fuel."
              : source === "Personal" ? "Approval keeps reimbursement pending. CashApp is deducted when reimbursement is confirmed."
              : "Approval posts one Diesel expense to CashApp under Fuel."}
          </p>
        </Form>
      )}
    </Modal>
  );
}
export function CashPage() {
  const { state, user, act } = useApp();
  const [params] = useSearchParams();
  const tripId = params.get("tripId");
  const navigate = useNavigate();
  const [history, setHistory] = useState(params.get("history") === "1");
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const rows = state.trips.filter(
    (t) =>
      t.status !== "Draft" &&
      t.status !== "Cancelled" &&
      !t.purgedAt && (!tripId || t.id === tripId) && (history || !t.handoverConfirmed) &&
      (user.role === "ADMIN" ||
        (user.role === "DRIVER"
          ? t.primaryDriverId === user.id
          : user.shopIds.includes(t.startShopId))),
  );
  const trip = state.trips.find((t) => t.id === selected);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{user.role === "DRIVER" ? "Cash with driver" : "Cash reconciliation"}</h1>
          <p>
            Physical custody and handover. Separate from customer collections.
          </p>
        </div>
      </div>
      <div className="toolbar">
        {tripId && <Link className="secondary" to={`/trips/${tripId}`}>Back to trip</Link>}
        <label className="check"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Show confirmed handovers</label>
      </div>
      <details className="help-note"><summary>How cash is calculated</summary><p>
        Expected physical cash = opening advance + all reported cash collections
        - reported spending from shop advances. Rejection does not reverse a
        physical cash movement. UPI, bank transfers and personal fuel payments
        do not enter this custody total. Shared shop funds remain separate.
      </p></details>
      <div className="card-grid">
        {rows.map((t) => {
          const c = cashSummary(state, t);
          return (
            <div className="panel p-5 cash-record" key={t.id}>
              <div className="flex-between cash-record-heading">
                <h3>{t.name}</h3>
                <Badge>
                  {t.handoverConfirmed ? "Handover confirmed" : t.status}
                </Badge>
              </div>
              <small>
                {t.date} · Custodian:{" "}
                {state.users.find((u) => u.id === t.primaryDriverId)?.name}
              </small>
              <div className="cash-record-balance">
                <Wallet size={24} aria-hidden="true" />
                <div>
                  <span>Cash with driver</span>
                  <strong className={c.held < 0 ? "cash-outflow" : "cash-inflow"}>{money(c.held)}</strong>
                </div>
              </div>
              <div className="summary-box">
                <p>
                  <span>Opening advance</span><strong>{money(c.advance)}</strong>
                </p>
                <p className="cash-inflow">
                  <span className="cash-record-label"><ArrowDownLeft size={16} aria-hidden="true" />Cash collections reported</span><strong>{money(c.reported)}</strong>
                </p>
                <p className="cash-outflow">
                  <span className="cash-record-label"><ArrowUpRight size={16} aria-hidden="true" />Cash expenses reported</span><strong>{money(c.spent > 0 ? -c.spent : 0)}</strong>
                </p>
                <p className="total">
                  <span>Expected handover</span><strong>{money(c.expected)}</strong>
                </p>
                <p>
                  <span>Physically received</span><strong>{money(c.received)}</strong>
                </p>
                <p className="cash-inflow">
                  <span>Approved cash collections</span><strong>{money(c.approvedCash)}</strong>
                </p>
                {(c.rejectedCash > 0 || c.rejectedSpending > 0) && (
                  <p className="notice">
                    Rejected cash claims {money(c.rejectedCash)}; rejected cash
                    spending {money(c.rejectedSpending)}. Physical settlement
                    requires investigation and a recorded explanation.
                  </p>
                )}
                {t.handoverConfirmed && (
                  <p>
                    <span>Shortage / excess</span><strong>{money(c.difference)}</strong>
                  </p>
                )}
              </div>
              {t.cashExplanation && (
                <p className="notice">{t.cashExplanation}</p>
              )}
              <div className="actions">
                {user.role !== "DRIVER" && state.collections.some(c => c.tripId === t.id && c.status === "Pending") && <Link className="secondary" to={`/collections?tripId=${encodeURIComponent(t.id)}&return=cash`}>Review pending collections</Link>}
                {user.role !== "DRIVER" &&
                  t.status === "End submitted" &&
                  !t.handoverConfirmed && (
                    <button
                      className="primary"
                      onClick={() => {
                        setSelected(t.id);
                        setAmount(String(Math.max(0, c.expected) / 100));
                        setNote("");
                      }}
                    >
                      Record physical handover
                    </button>
                  )}
                <Link className="link" to={`/trips/${t.id}`}>
                  View shift
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {!rows.length && <Empty>No cash-custody shifts for this profile.</Empty>}
      {trip && (
        <Modal
          title="Confirm physical cash handover"
          onClose={() => setSelected(null)}
        >
          <Form
            label="Confirm handover"
            onSubmit={async () => {
              await act({
                type: "handover",
                id: trip.id,
                amount: paise(amount),
                note,
              });
              setSelected(null);
              if (tripId) navigate(`/trips/${trip.id}`);
            }}
          >
            <p className="notice">
              Expected {money(cashSummary(state, trip).expected)}. This records
              custody transfer, not a second customer receipt.
            </p>
            <Field label="Cash physically received (₹)">
              <NumberInput
                required
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Explanation / pending settlement (optional)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function SalesForm({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  const { state, user, act } = useApp();
  const [customer, setCustomer] = useState(trip.stops[0]?.customerId ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(
    state.customers.find((c) => c.id === customer)?.phone ?? "",
  );
  const [area, setArea] = useState("");
  const [products, setProducts] = useState("");
  const [date, setDate] = useState(businessDate());
  const [notes, setNotes] = useState("");
  return (
    <Modal title="New sales order request" onClose={onClose}>
      <Form
        label="Submit sales request"
        onSubmit={async () => {
          await act({
            type: "submitSales",
            value: {
              id: uuid(),
              tripId: trip.id,
              shopId: trip.startShopId,
              driverId: user.id,
              customerId: customer || null,
              leadName: name,
              phone,
              area,
              products,
              date,
              notes,
              status: "Submitted",
              decision: "",
              createdAt: now(),
            },
          });
          onClose();
        }}
      >
        <Field label="Customer or new lead">
          <select
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setPhone(
                state.customers.find((c) => c.id === e.target.value)?.phone ??
                  "",
              );
            }}
          >
            <option value="">New lead</option>
            {state.customers
              .filter((c) => trip.stops.some((st) => st.customerId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        {!customer && (
          <Field label="Lead / shop name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        )}
        <div className="form-grid">
          <Field label="Contact">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Area">
            <input value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label="Requested delivery date">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Requested products and quantities">
          <textarea
            required
            value={products}
            onChange={(e) => setProducts(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="notice">
          A request for review only. No invoice, confirmed order or accounting
          entry is created.
        </p>
      </Form>
    </Modal>
  );
}
export function SalesPage() {
  const { state, user, act } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<SalesRequest["status"]>("Under review");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("All");
  const rows = state.salesRequests.filter(
    (r) =>
      (user.role === "ADMIN" ||
        (user.role === "DRIVER"
          ? r.driverId === user.id
          : user.shopIds.includes(r.shopId))) &&
      (filter === "All" || r.status === filter),
  );
  const r = state.salesRequests.find((r) => r.id === selected);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Sales requests</h1>
          
        </div>
        <select
          aria-label="Request status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "All",
            "Submitted",
            "Under review",
            "Accepted",
            "Rejected",
            "Converted externally",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="card-grid">
        {rows.map((r) => (
          <div className="panel p-5" key={r.id}>
            <div className="flex-between">
              <h3>
                {state.customers.find((c) => c.id === r.customerId)?.name ??
                  r.leadName}
              </h3>
              <Badge>{r.status}</Badge>
            </div>
            <p>{r.products}</p>
            <small>
              {r.phone} · Requested {r.date}
            </small>
            <p className="muted">{r.notes}</p>
            <p>{r.decision}</p>
            {user.role !== "DRIVER" &&
              !["Rejected", "Converted externally"].includes(r.status) && (
                <button
                  className="secondary"
                  onClick={() => {
                    setSelected(r.id);
                    setStatus(
                      r.status === "Accepted"
                        ? "Converted externally"
                        : "Under review",
                    );
                    setNote("");
                  }}
                >
                  Review request
                </button>
              )}
          </div>
        ))}
      </div>
      {!rows.length && (
        <Empty>Drivers can submit requests from active trips.</Empty>
      )}
      {r && (
        <Modal title="Review sales request" onClose={() => setSelected(null)}>
          <Form
            label="Record decision"
            onSubmit={async () => {
              await act({ type: "reviewSales", id: r.id, status, note });
              setSelected(null);
            }}
          >
            <Field label="Decision">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as SalesRequest["status"])
                }
              >
                {(r.status === "Accepted"
                  ? ["Converted externally"]
                  : r.status === "Under review"
                    ? ["Accepted", "Rejected"]
                    : ["Under review", "Accepted", "Rejected"]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Decision note">
              <textarea
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}

import {useSession} from './integration/session';
import {bridge} from './integration/connection';
import {routeDays,nextRouteDate,type WeeklyRoute} from './weekly-routes';
import {NumberInput} from "./components/ui/number-input";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Gauge, PackageCheck, Wallet, Fuel, ClipboardList, Flag,
  Plus,
  ArrowUp,
  ArrowDown,
  MapPin,
  Phone,
  Navigation,
  Truck,
  Check,
  ChevronRight,
} from "lucide-react";
import { useApp } from "./context";
import {
  Badge,
  Empty,
  Modal,
  Field,
  Form,
  EvidenceInput,
  EvidenceLink,
  Confirm,
} from "./ui";
import {
  businessDate,
  uuid,
  money,
  paise,
  type Trip,
  type Stop,
  type DeliveryJob,
} from "./domain";
import { cashSummary, approvedReadings, closingSteps } from "./rules";
import { CollectionForm, FuelForm, SalesForm } from "./operations";
export const freshTrip = (
  shopId: string,
  vehicleId: string,
  driverId: string,
): Trip => ({
  id: uuid(),
  name: "Daily delivery route",
  date: businessDate(),
  startShopId: shopId,
  endShopId: shopId,
  vehicleId,
  primaryDriverId: driverId,
  companionId: null,
  status: "Draft",
  stops: [],
  opening: null,
  closing: null,
  openingPhoto: null,
  closingPhoto: null,
  openingNote: "",
  endNote: "",
  openingAdvance: 0,
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
});
export function RoutesPage() {
  const { state, user, act } = useApp();
  const [edit, setEdit] = useState<Trip | null>(null);
  const [date, setDate] = useState(businessDate());
  const [release, setRelease] = useState<Trip | null>(null);
  const trips = state.trips.filter(t=>!t.purgedAt).filter(
    (t) =>
      (user.role === "ADMIN" || user.shopIds.includes(t.startShopId)) &&
      (!date || t.date === date),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Route planner</h1>
          <p>Plan the day. Assign responsibility. Release a clear route.</p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEdit(
              freshTrip(
                user.shopIds[0],
                state.vehicles.find((v) => v.active)?.id ?? "",
                state.users.find((u) => u.role === "DRIVER" && u.active)?.id ??
                  "",
              ),
            )
          }
        >
          <Plus size={17} /> Plan route
        </button>
      </div>
      <div className="notice">
        Manual stop order is authoritative. Geographic suggestions are
        straight-line estimates, not road distances.
      </div>
      <div className="toolbar">
        <Field label="Scheduled date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <button className="secondary" onClick={() => setDate("")}>
          All dates
        </button>
      </div>
      <div className="card-grid">
        {trips.map((t) => (
          <div className="panel route-card" key={t.id}>
            <div className="flex-between">
              <Badge>{t.status}</Badge>
              <span className="muted">{t.date}</span>
            </div>
            <h3>{t.name}</h3>
            <p>
              {state.shops.find((s) => s.id === t.startShopId)?.name} &rarr;{" "}
              {state.shops.find((s) => s.id === t.endShopId)?.name}
            </p>
            <div className="route-meta">
              <Truck size={17} />
              {state.vehicles.find((v) => v.id === t.vehicleId)?.registration}
            </div>
            <p>
              {state.users.find((u) => u.id === t.primaryDriverId)?.name}
              {t.companionId ? " + companion" : ""}
            </p>
            <div className="flex-between">
              <strong>{t.stops.length} stops</strong>
              <div className="actions">
                {["Draft", "Released"].includes(t.status) && (
                  <button
                    className="secondary"
                    onClick={() => setEdit(structuredClone(t))}
                  >
                    Edit route
                  </button>
                )}
                {t.status === "Draft" && (
                  <button className="primary" onClick={() => setRelease(t)}>
                    Release
                  </button>
                )}
                <Link className="link" to={`/trips/${t.id}`}>
                  View <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!trips.length && (
        <Empty>
          No routes scheduled. Select ready deliveries to build a route.
        </Empty>
      )}
      {edit && <RouteEditor initial={edit} onClose={() => setEdit(null)} />}
      {release && (
        <Confirm
          title="Approve and release route"
          description="The route will be available to assigned drivers after synchronisation. Review the vehicle, drivers and stops before releasing."
          onClose={() => setRelease(null)}
          onConfirm={() =>
            act({
              type: "routeAction",
              id: release.id,
              action: "Release",
              note: "Route reviewed and released by manager",
            })
          }
        />
      )}
    </>
  );
}
function RouteEditor({
  initial,
  onClose,
}: {
  initial: Trip;
  onClose: () => void;
}) {
  const { state, user, act, notify } = useApp();
  const {identity}=useSession();
  const [catalog,setCatalog]=useState<WeeklyRoute[]>([]),[catalogError,setCatalogError]=useState('');
  useEffect(()=>{let live=true;void bridge<{routes:WeeklyRoute[]}>(identity.issuer,'routeCatalog').then(result=>{if(live)setCatalog(result.routes);}).catch(e=>{if(live)setCatalogError((e as Error).message);});return()=>{live=false;};},[identity.uid]);
  const [t, set] = useState(initial);
  const [customerId, setCustomer] = useState(state.customers[0]?.id ?? "");
  const [kind, setKind] = useState<"Collection" | "Sales visit">("Collection");
  const [advance, setAdvance] = useState(String(t.openingAdvance / 100));
  const drivers = state.users.filter(
    (u) => u.role === "DRIVER" && u.active && u.shopIds.includes(t.startShopId),
  );
  const available = state.jobs.filter(
    (j) =>
      (j.status === "Ready" ||
        (j.tripId === t.id && j.status === "Assigned")) &&
      j.date === t.date &&
      (!t.routeTemplateId || j.routeId === t.routeTemplateId) &&
      (user.role === "ADMIN" || user.shopIds.includes(j.shopId)),
  );
  function toggle(j: DeliveryJob) {
    set({
      ...t,
      stops: t.stops.some((st) => st.jobId === j.id)
        ? t.stops.filter((st) => st.jobId !== j.id)
        : [
            ...t.stops,
            {
              id: uuid(),
              kind: "Delivery",
              customerId: j.customerId,
              jobId: j.id,
              completed: false,
            },
          ],
    });
  }
  function move(index: number, offset: number) {
    const stops = [...t.stops];
    [stops[index], stops[index + offset]] = [
      stops[index + offset],
      stops[index],
    ];
    set({ ...t, stops });
  }
  function suggest() {
    const shop = state.shops.find((s) => s.id === t.startShopId)!;
    if (shop.lat === undefined || shop.lng === undefined) {
      notify(
        "Configure starting shop coordinates before suggesting a geographic order.",
        true,
      );
      return;
    }
    let lat = shop.lat,
      lng = shop.lng;
    const pending = t.stops.filter((st) => {
      const c = state.customers.find((c) => c.id === st.customerId)!;
      return c.lat !== undefined && c.lng !== undefined;
    });
    const missing = t.stops.filter((st) => !pending.includes(st));
    const ordered: Stop[] = [];
    while (pending.length) {
      pending.sort((a, b) => {
        const ca = state.customers.find((c) => c.id === a.customerId)!,
          cb = state.customers.find((c) => c.id === b.customerId)!;
        return (
          (ca.lat! - lat) ** 2 +
          (ca.lng! - lng) ** 2 -
          ((cb.lat! - lat) ** 2 + (cb.lng! - lng) ** 2)
        );
      });
      const next = pending.shift()!;
      ordered.push(next);
      const c = state.customers.find((c) => c.id === next.customerId)!;
      lat = c.lat!;
      lng = c.lng!;
    }
    set({ ...t, stops: [...ordered, ...missing] });
    notify(
      `Approximate geographic order applied. ${missing.length} stops without coordinates kept at end; review manually.`,
    );
  }
  return (
    <Modal
      title={initial.revision ? "Edit route" : "Plan a delivery route"}
      wide
      onClose={onClose}
    >
      <Form
        label="Save route draft"
        onSubmit={async () => {
          await act({
            type: "saveTrip",
            value: { ...t, openingAdvance: paise(advance) },
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Weekly route">
            <select value={t.routeTemplateId??''} onChange={e=>{const route=catalog.find(r=>r.id===e.target.value);set({...t,routeTemplateId:route?.id,name:route?.name??t.name,date:route?nextRouteDate(route.days,t.date)??t.date:t.date,stops:[]});}}>
              <option value="">Custom / all deliveries</option>
              {t.routeTemplateId&&!catalog.some(r=>r.id===t.routeTemplateId)&&<option value={t.routeTemplateId}>Saved route</option>}
              {catalog.filter(r=>r.active||r.id===t.routeTemplateId).map(r=><option key={r.id} value={r.id}>{r.name} ({routeDays(r)})</option>)}
            </select>
          </Field>
          {catalogError&&<p role="alert" className="notice">Weekly routes unavailable: {catalogError}</p>}
          {catalog.find(r=>r.id===t.routeTemplateId)&&<div className="summary-box"><strong>{catalog.find(r=>r.id===t.routeTemplateId)!.from} ? {catalog.find(r=>r.id===t.routeTemplateId)!.to}</strong><p>{catalog.find(r=>r.id===t.routeTemplateId)!.stops.map(s=>s.name).join(' ? ')}</p><small>Selected-route deliveries are shown below. Weekly schedules do not create or release trips automatically.</small></div>}
          <Field label="Route name">
            <input
              required
              value={t.name}
              onChange={(e) => set({ ...t, name: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              required
              value={t.date}
              onChange={(e) => set({ ...t, date: e.target.value, stops: [] })}
            />
          </Field>
          <Field label="Starting shop">
            <select
              value={t.startShopId}
              onChange={(e) =>
                set({ ...t, startShopId: e.target.value, stops: [] })
              }
            >
              {state.shops
                .filter(
                  (s) =>
                    s.active &&
                    (user.role === "ADMIN" || user.shopIds.includes(s.id)),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Ending shop">
            <select
              value={t.endShopId}
              onChange={(e) => set({ ...t, endShopId: e.target.value })}
            >
              {state.shops
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Vehicle">
            <select
              value={t.vehicleId}
              onChange={(e) => set({ ...t, vehicleId: e.target.value })}
            >
              {state.vehicles
                .filter((v) => v.active)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Primary responsible driver">
            <select
              value={t.primaryDriverId}
              onChange={(e) => set({ ...t, primaryDriverId: e.target.value })}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accompanying driver">
            <select
              value={t.companionId ?? ""}
              onChange={(e) =>
                set({ ...t, companionId: e.target.value || null })
              }
            >
              <option value="">None</option>
              {drivers
                .filter((d) => d.id !== t.primaryDriverId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Opening shop cash advance (₹)">
            <NumberInput
              type="number"
              min="0"
              step="0.01"
              required
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
            />
          </Field>
        </div>
        <div className="split">
          <section>
            <h3>Available deliveries</h3>
            {t.routeTemplateId&&available.length>0&&<button type="button" className="secondary" onClick={()=>{
              const route=catalog.find(r=>r.id===t.routeTemplateId);
              const jobs=[...available].sort((a,b)=>{const rank=(id:string|null|undefined)=>{const index=route?.stops.findIndex(s=>s.id===id)??-1;return index<0?Number.MAX_SAFE_INTEGER:index;};return rank(a.routeStopId)-rank(b.routeStopId);});
              set({...t,stops:jobs.map(j=>t.stops.find(st=>st.jobId===j.id)??{id:uuid(),kind:'Delivery' as const,customerId:j.customerId,jobId:j.id,completed:false}).concat(t.stops.filter(st=>st.kind!=='Delivery'))});
            }}>Add matching deliveries in stop order</button>}

            {available.map((j) => (
              <label className="select-row" key={j.id}>
                <input
                  type="checkbox"
                  checked={t.stops.some((st) => st.jobId === j.id)}
                  onChange={() => toggle(j)}
                />
                <span>
                  <strong>
                    {state.customers.find((c) => c.id === j.customerId)?.name}
                  </strong>
                  <small>
                    {j.routeStopName&&`${j.routeStopName} / `}{j.remaining} packages ·{" "}
                    {state.invoices.find((i) => i.id === j.invoiceId)?.number}
                  </small>
                </span>
              </label>
            ))}
            {!available.length && <Empty>No ready jobs for this date.</Empty>}
            <h3 className="mt-4">Add a non-delivery stop</h3>
            <Field label="Customer">
              <select
                value={customerId}
                onChange={(e) => setCustomer(e.target.value)}
              >
                {state.customers
                  .filter(
                    (c) =>
                      c.active &&
                      (user.role === "ADMIN" ||
                        !state.invoices.some((i) => i.customerId === c.id) ||
                        state.invoices.some(
                          (i) =>
                            i.customerId === c.id &&
                            user.shopIds.includes(i.shopId),
                        )),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Visit type">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option>Collection</option>
                <option>Sales visit</option>
              </select>
            </Field>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                set({
                  ...t,
                  stops: [
                    ...t.stops,
                    {
                      id: uuid(),
                      kind,
                      customerId,
                      jobId: null,
                      completed: false,
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Add stop
            </button>
          </section>
          <section>
            <div className="flex-between">
              <h3>Stop order · {t.stops.length}</h3>
              <button type="button" className="link" onClick={suggest}>
                Suggest order
              </button>
            </div>
            <small className="muted">
              Approximate coordinate-based order, no road-distance estimate.
            </small>
            {t.stops.map((st, i) => (
              <div className="stop-order" key={st.id}>
                <span className="stop-number">{i + 1}</span>
                <div className="grow">
                  <strong>
                    {state.customers.find((c) => c.id === st.customerId)?.name}
                  </strong>
                  <small>{st.kind}</small>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move stop ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move stop ${i + 1} down`}
                  disabled={i === t.stops.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    set({ ...t, stops: t.stops.filter((x) => x.id !== st.id) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </section>
        </div>
      </Form>
    </Modal>
  );
}
export function TripsPage() {
  const { state, user } = useApp();
  const [all, setAll] = useState(false);
  const rows = state.trips.filter(t=>!t.purgedAt)
    .filter((t) =>
      user.role === "DRIVER"
        ? [t.primaryDriverId, t.companionId].includes(user.id) &&
          t.status !== "Draft"
        : user.role === "ADMIN" || user.shopIds.includes(t.startShopId),
    )
    .filter((t) => all || !["Closed", "Cancelled"].includes(t.status));
  return (
    <>
      <div className="page-title">
        <div>
          <h1>
            {user.role === "DRIVER" ? "My trips" : "Trips & shift review"}
          </h1>
          <p>
            {user.role === "DRIVER"
              ? "Your assigned vehicle, stops and shift checklist."
              : "Review vehicle activity, evidence and driver responsibility."}
          </p>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />{" "}
          Include history
        </label>
      </div>
      <div className="card-grid">
        {rows.map((t) => (
          <Link
            to={`/trips/${t.id}`}
            className="panel route-card block-link"
            key={t.id}
          >
            <div className="flex-between">
              <Badge>{t.status}</Badge>
              <span className="muted">{t.date}</span>
            </div>
            <h3>{t.name}</h3>
            <p>
              {state.vehicles.find((v) => v.id === t.vehicleId)?.registration} ·{" "}
              {state.users.find((u) => u.id === t.primaryDriverId)?.name}
            </p>
            <p>
              {state.shops.find((s) => s.id === t.startShopId)?.name} &rarr;{" "}
              {state.shops.find((s) => s.id === t.endShopId)?.name}
            </p>
            <div className="progress">
              <div
                style={{
                  width: `${t.stops.length ? (t.stops.filter((st) => st.completed).length / t.stops.length) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex-between">
              <small>
                {t.stops.filter((st) => st.completed).length} / {t.stops.length}{" "}
                stops complete
              </small>
              <ChevronRight size={18} />
            </div>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <Empty>
          No assigned trips. A manager can plan and release a route.
        </Empty>
      )}
    </>
  );
}
export function TripDetail() {
  const { id } = useParams();
  const { state, user, act, notify } = useApp();
  const t = state.trips.find((t) => t.id === id);
  const [modal, setModal] = useState<string | null>(null);
  const [job, setJob] = useState<DeliveryJob | null>(null);
  const [stopCustomer, setStopCustomer] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [driverId, setDriver] = useState("");
  const [companion, setCompanion] = useState("");
  const [correctedOpening, setCorrectedOpening] = useState(0);
  const [correctedClosing, setCorrectedClosing] = useState(0);
  if (!t) return <Empty>Trip not found.</Empty>;
  if(t.purgedAt)return <Empty>Closed delivery details and images were removed after seven days. Financial and report summaries are retained.</Empty>;
  const allowed =
    user.role === "ADMIN" ||
    (user.role === "DRIVER"
      ? [t.primaryDriverId, t.companionId].includes(user.id) &&
        t.status !== "Draft"
      : user.shopIds.includes(t.startShopId));
  if (!allowed)
    return <Empty>This trip is not assigned to your account.</Empty>;
  const isDriver = user.role === "DRIVER";
  const cash = cashSummary(state, t);
  const steps = closingSteps(state, t);
  const custodian = state.users.find((u) => u.id === t.primaryDriverId)?.name;
  const perform = (fn: () => Promise<void>) => void fn().catch(() => {});
  return (
    <>
      <div className="page-title">
        <div>
          <Link to="/trips" className="eyebrow">
            &larr; ALL TRIPS
          </Link>
          <h1>{t.name}</h1>
          <p>
            {t.date} ·{" "}
            {state.vehicles.find((v) => v.id === t.vehicleId)?.registration} ·{" "}
            <Badge>{t.status}</Badge>
          </p>
        </div>
        <div className="actions">
          {!isDriver &&
            !["Closed", "Cancelled", "End submitted"].includes(t.status) && (
              <button
                className="secondary"
                onClick={() => {
                  setDriver(t.primaryDriverId);
                  setCompanion(t.companionId ?? "");
                  setNote("");
                  setModal("driver");
                }}
              >
                Change drivers
              </button>
            )}
          {!isDriver && !["Closed", "Cancelled"].includes(t.status) && (
            <button
              className="secondary"
              onClick={() => {
                setNote("");
                setModal("exception");
              }}
            >
              Authorise exception
            </button>
          )}
        </div>
      </div>
      {!isDriver && t.status === "End submitted" && (
        <section className="panel closing-workflow" aria-label="Shift closing steps">
          <h3>Finish this shift</h3>
          <div className="closing-grid">
            <div className={"closing-step " + (steps.cashDone ? "done" : "")}>
              <span className="step-marker">{steps.cashDone ? <Check aria-label="Cash completed"/> : "1"}</span>
              <h4>Cash reconciliation</h4>
              <p>{steps.cashDone ? "Physical handover confirmed" : `${steps.pendingCollections ? `${steps.pendingCollections} collections need review. ` : ""}Count cash and confirm handover.`}</p>
              <Link className="secondary" to={`/cash?tripId=${encodeURIComponent(t.id)}${steps.cashDone ? "&history=1" : ""}`}>{steps.cashDone ? "View handover" : "Check cash"}</Link>
            </div>
            <div className={"closing-step " + (steps.fuelDone ? "done" : "")}>
              <span className="step-marker">{steps.fuelDone ? <Check aria-label="Diesel completed"/> : "2"}</span>
              <h4>Diesel review</h4>
              <p>{!steps.fuels.length ? "No diesel entered for this trip" : steps.fuelDone ? "Diesel decisions and reimbursements complete" : "Review the latest pending claim and any reimbursement."}</p>
              {!!steps.fuels.length && (steps.cashDone
                ? <Link className="secondary" to={`/fuel?tripId=${encodeURIComponent(t.id)}${steps.pendingFuel ? `&review=${encodeURIComponent(steps.pendingFuel.id)}` : "&history=1"}`}>Check diesel</Link>
                : <button className="secondary" disabled>Check diesel</button>)}
            </div>
            <div className="closing-step">
              <span className="step-marker">3</span><h4>Verify & close shift</h4>
              <p>{steps.returns ? `${steps.returns} jobs need returned-package reconciliation.` : "Review odometer evidence and close the shift."}</p>
              <button className="primary" disabled={!steps.ready} onClick={() => {setNote("");setModal("close");}}>Verify & close shift</button>
            </div>
          </div>
          {steps.pendingCollections > 0 && <Link className="link" to={`/collections?tripId=${encodeURIComponent(t.id)}`}>Review this trip’s collections</Link>}
        </section>
      )}
      <div className="trip-banner">
        <div>
          <span className="eyebrow">SHOP HANDOVER</span>
          <h2>
            {state.shops.find((s) => s.id === t.startShopId)?.name}{" "}
            <span>&rarr;</span>{" "}
            {state.shops.find((s) => s.id === t.endShopId)?.name}
          </h2>
          <p>Primary driver & cash custodian: {custodian}</p>
          {t.companionId && (
            <p>
              Accompanying:{" "}
              {state.users.find((u) => u.id === t.companionId)?.name}
            </p>
          )}
        </div>
        <div className="trip-stat">
          <strong>
            {t.stops.filter((st) => st.completed).length}
            <span>/{t.stops.length}</span>
          </strong>
          <p>stops complete</p>
        </div>
      </div>
      <div className="metric-grid compact">
        <div className="metric">
          <small>Opening odometer</small>
          <strong>{t.opening ?? "Not started"}</strong>
        </div>
        <div className="metric">
          <small>Closing odometer</small>
          <strong>{t.closing ?? "Not submitted"}</strong>
        </div>
        <div className="metric">
          <small>
            {t.approvedOdometer ? "Approved" : "Submitted"} distance
          </small>
          <strong>
            {t.opening !== null && t.closing !== null
              ? `${t.closing - t.opening} km`
              : "·"}
          </strong>
        </div>
        {!isDriver && (
          <div className="metric">
            <small>Expected physical cash</small>
            <strong>{money(cash.expected)}</strong>
          </div>
        )}
      </div>
      <div className={"actions wrap mb-5 " + (isDriver ? "driver-action-grid" : "")}>
        {!isDriver && t.status === "Draft" && (
          <button className="primary" onClick={() => setModal("release")}>
            <Truck size={23} aria-hidden="true"/> Release route
          </button>
        )}
        {!isDriver && t.status === "Closed" && (
          <button
            className="secondary"
            onClick={() => {
              const r = approvedReadings(t);
              setCorrectedOpening(r.opening ?? 0);
              setCorrectedClosing(r.closing ?? 0);
              setNote("");
              setModal("correct");
            }}
          >
            Record odometer correction
          </button>
        )}
        {isDriver && t.status === "Released" && (
          <button className="primary" onClick={() => setModal("start")}>
            <Gauge size={23} aria-hidden="true"/> Start shift
          </button>
        )}
        {isDriver && t.status === "Active" && !t.loaded && (
          <button className="primary" onClick={() => setModal("load")}>
            <PackageCheck size={23} aria-hidden="true"/> Confirm packages loaded
          </button>
        )}
        {isDriver && t.status === "Active" && (
          <>
            <button
              className="secondary"
              onClick={() => {
                setStopCustomer(null);
                setModal("collection");
              }}
            >
              <Wallet size={23} aria-hidden="true"/> Record collection
            </button>
            <button className="secondary" onClick={() => setModal("fuel")}>
              <Fuel size={23} aria-hidden="true"/> Record diesel
            </button>
            <button className="secondary" onClick={() => setModal("sales")}>
              <ClipboardList size={23} aria-hidden="true"/> Sales request
            </button>
            <button className="primary" onClick={() => setModal("end")}>
              <Flag size={23} aria-hidden="true"/> Submit shift end
            </button>
          </>
        )}
      </div>
      <div className="split main-split">
        <section className="panel">
          <div className="panel-heading">
            <h3>Ordered stops</h3>
            <span className="muted">
              {t.loaded ? "Packages loaded" : "Loading not confirmed"}
            </span>
          </div>
          {t.stops.map((st, i) => {
            const c = state.customers.find((c) => c.id === st.customerId)!;
            const j = st.jobId
              ? state.jobs.find((j) => j.id === st.jobId)
              : null;
            const address = j?.address ?? c.address;
            return (
              <div className="stop-card" key={st.id}>
                <span className={"stop-number " + (st.completed ? "done" : "")}>
                  {st.completed ? <Check size={17} /> : i + 1}
                </span>
                <div className="grow">
                  <div className="flex-between">
                    <h3>{c.name}</h3>
                    <Badge>
                      {j?.status ?? (st.completed ? "Completed" : st.kind)}
                    </Badge>
                  </div>
                  <p>{address}</p>
                  <small>
                    {j
                      ? `${state.invoices.find((inv) => inv.id === j.invoiceId)?.number} · ${j.remaining} / ${j.packages} packages remaining`
                      : st.kind}
                  </small>
                  {j && <p className="muted">{j.instructions}</p>}
                  {j?.sourceBlocked && (
                    <p role="alert" className="notice">
                      Delivery paused: {j.sourceBlocked}
                    </p>
                  )}
                  <div className="actions wrap mt-3">
                    <a
                      className="secondary small"
                      href={`tel:${j?.phone ?? c.phone}`}
                    >
                      <Phone size={14} /> Call
                    </a>
                    <a
                      className="secondary small"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.lat !== undefined && c.lng !== undefined ? `${c.lat},${c.lng}` : address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={14} /> Navigate
                    </a>
                    {isDriver &&
                      t.status === "Active" &&
                      t.loaded &&
                      !st.completed && (
                        <>
                          {!st.arrivedAt && (
                            <button
                              className="secondary small"
                              onClick={() =>
                                perform(() =>
                                  act({
                                    type: "arrive",
                                    tripId: t.id,
                                    stopId: st.id,
                                  }),
                                )
                              }
                            >
                              Arrived
                            </button>
                          )}
                          {j ? (
                            <button
                              className="primary small"
                              onClick={() => setJob(j)}
                            >
                              Record outcome
                            </button>
                          ) : (
                            <button
                              className="primary small"
                              onClick={() =>
                                perform(() =>
                                  act({
                                    type: "visitDone",
                                    tripId: t.id,
                                    stopId: st.id,
                                  }),
                                )
                              }
                            >
                              Complete visit
                            </button>
                          )}
                        </>
                      )}
                    {isDriver && t.status === "Active" && (
                      <button
                        className="link"
                        onClick={() => {
                          setStopCustomer(c.id);
                          setModal("collection");
                        }}
                      >
                        Collect payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        <aside>
          <div className="panel p-5">
            <h3>Shift evidence</h3>
            {t.corrections?.map((c) => (
              <p className="notice" key={c.id}>
                Approved correction: {c.opening} &rarr; {c.closing} km. {c.note}
              </p>
            ))}
            <p>
              <EvidenceLink
                id={t.openingPhoto}
                label="Opening odometer photo"
              />
            </p>
            <p>
              <EvidenceLink
                id={t.closingPhoto}
                label="Closing odometer photo"
              />
            </p>
            <p className="muted">
              {t.openingNote} {t.endNote}
            </p>
          </div>
          {t.exceptions.length > 0 && (
            <div className="panel p-5 mt-4">
              <h3>Approved exceptions</h3>
              {t.exceptions.map((x, i) => (
                <p key={i} className="notice">
                  {x}
                </p>
              ))}
            </div>
          )}
          <div className="panel p-5 mt-4">
            <h3>Delivery attempt evidence</h3>
            {state.attempts
              .filter((a) => a.tripId === t.id)
              .map((a) => (
                <div className="timeline-item" key={a.id}>
                  <strong>
                    {a.outcome} · {a.delivered} packages
                  </strong>
                  <small>
                    {
                      state.customers.find(
                        (c) =>
                          c.id ===
                          state.jobs.find((j) => j.id === a.jobId)?.customerId,
                      )?.name
                    }
                  </small>
                  <EvidenceLink
                    id={a.evidenceId}
                    label="Delivery acknowledgement"
                  />
                </div>
              ))}
          </div>
        </aside>
      </div>
      {modal === "release" && (
        <Confirm
          title="Approve and release route"
          description="The route will be available to assigned drivers after synchronisation. Review the vehicle, drivers and stops before releasing."
          onClose={() => setModal(null)}
          onConfirm={() => act({type: "routeAction", id: t.id, action: "Release", note: "Route reviewed and released by manager"})}
        />
      )}
      {modal === "start" && (
        <OdometerForm trip={t} ending={false} onClose={() => setModal(null)} />
      )}
      {modal === "end" && (
        <OdometerForm trip={t} ending onClose={() => setModal(null)} />
      )}
      {modal === "load" && (
        <Confirm
          title="Confirm packages loaded"
          description="Confirm the assigned packages have been checked and loaded into this vehicle."
          onClose={() => setModal(null)}
          onConfirm={() => act({ type: "load", id: t.id })}
        />
      )}
      {modal === "collection" && (
        <CollectionForm
          trip={t}
          initialCustomer={stopCustomer}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "fuel" && <FuelForm trip={t} onClose={() => setModal(null)} />}
      {modal === "sales" && (
        <SalesForm trip={t} onClose={() => setModal(null)} />
      )}
      {job && (
        <DeliveryOutcome
          job={state.jobs.find((j) => j.id === job.id)!}
          onClose={() => setJob(null)}
        />
      )}
      {["driver", "exception", "close", "correct"].includes(modal ?? "") && (
        <Modal
          title={
            modal === "driver"
              ? "Driver & custody handover"
              : modal === "exception"
                ? "Authorise a controlled exception"
                : modal === "correct"
                  ? "Approved odometer correction"
                  : "Verify odometer & close shift"
          }
          onClose={() => setModal(null)}
        >
          <Form
            label="Confirm reviewed action"
            onSubmit={async () => {
              if (modal === "driver")
                await act({
                  type: "changeDriver",
                  id: t.id,
                  driverId,
                  companionId: companion || null,
                  note,
                });
              if (modal === "exception")
                await act({ type: "exception", id: t.id, note });
              if (modal === "correct")
                await act({
                  type: "correctOdometer",
                  id: t.id,
                  opening: correctedOpening,
                  closing: correctedClosing,
                  note,
                });
              if (modal === "close")
                await act({ type: "closeTrip", id: t.id, note });
              setModal(null);
            }}
          >
            {modal === "correct" && (
              <>
                <p className="notice">
                  Original readings remain in history. Reports use the latest
                  approved correction.
                </p>
                <Field label="Corrected opening">
                  <NumberInput
                    type="number"
                    min="0"
                    step="1"
                    value={correctedOpening}
                    onChange={(e) =>
                      setCorrectedOpening(Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Corrected closing">
                  <NumberInput
                    type="number"
                    min="0"
                    step="1"
                    value={correctedClosing}
                    onChange={(e) =>
                      setCorrectedClosing(Number(e.target.value))
                    }
                  />
                </Field>
              </>
            )}
            {modal === "driver" && (
              <>
                <Field label="Primary driver / cash custodian">
                  <select
                    value={driverId}
                    onChange={(e) => setDriver(e.target.value)}
                  >
                    {state.users
                      .filter((u) => u.role === "DRIVER" && u.active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Accompanying driver">
                  <select
                    value={companion}
                    onChange={(e) => setCompanion(e.target.value)}
                  >
                    <option value="">None</option>
                    {state.users
                      .filter(
                        (u) =>
                          u.role === "DRIVER" && u.active && u.id !== driverId,
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <p className="notice">
                  Review odometer and transfer physical custody of expected cash{" "}
                  {money(cash.expected)}. The note records the handover.
                </p>
              </>
            )}
            {modal === "exception" && (
              <p className="notice">
                Start the note with: Opening photo:, Closing photo:, Unfinished
                stops:, Settlement:, or Proof JOB_ID:. Record the reason. Job
                IDs:{" "}
                {t.stops
                  .filter((st) => st.jobId)
                  .map((st) => st.jobId)
                  .join(", ")}
              </p>
            )}
            {modal === "close" && (
              <p className="notice">
                Confirm odometer evidence, package reconciliation, claim review
                and cash handover. Approved distance:{" "}
                {(t.closing ?? 0) - (t.opening ?? 0)} km.
              </p>
            )}
            <Field label="Review / exception / handover note">
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
function OdometerForm({
  trip,
  ending,
  onClose,
}: {
  trip: Trip;
  ending: boolean;
  onClose: () => void;
}) {
  const { state, act } = useApp();
  const previous = state.trips
    .filter((t) => t.vehicleId === trip.vehicleId && t.status === "Closed")
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0];
  const baseline =
    (previous ? approvedReadings(previous).closing : null) ??
    state.vehicles.find((v) => v.id === trip.vehicleId)!.baseline;
  const [reading, setReading] = useState(
    ending ? (trip.opening ?? baseline) : baseline,
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <Modal
      title={ending ? "Submit end-of-shift report" : "Start vehicle shift"}
      onClose={onClose}
    >
      <Form
        label={ending ? "Submit shift end" : "Start shift"}
        onSubmit={async () => {
          await act(
            ending
              ? {
                  type: "endTrip",
                  id: trip.id,
                  closing: reading,
                  photo,
                  note,
                }
              : {
                  type: "startTrip",
                  id: trip.id,
                  opening: reading,
                  photo,
                  note,
                },
          );
          onClose();
        }}
      >
        <p className="notice">
          {ending
            ? `Opening reading: ${trip.opening} km`
            : `Previous approved baseline: ${baseline} km`}
          . Vehicle:{" "}
          {state.vehicles.find((v) => v.id === trip.vehicleId)?.registration}.
        </p>
        <Field
          label={ending ? "Closing odometer (km)" : "Opening odometer (km)"}
        >
          <NumberInput
            required
            type="number"
            step="1"
            min="0"
            value={reading}
            onChange={(e) => setReading(Number(e.target.value))}
          />
        </Field>
        <EvidenceInput
          label={
            ending
              ? "Closing odometer photograph"
              : "Opening odometer photograph"
          }
          value={photo}
          onChange={setPhoto}
        />
        <Field label="Continuity explanation / shift notes">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="muted text-xs">
          Missing required evidence needs an explicit manager exception.
        </p>
      </Form>
    </Modal>
  );
}
function DeliveryOutcome({
  job,
  onClose,
}: {
  job: DeliveryJob;
  onClose: () => void;
}) {
  const { act } = useApp();
  const [outcome, setOutcome] = useState<
    "Delivered" | "Partial" | "Failed" | "Reschedule requested"
  >("Delivered");
  const [delivered, setDelivered] = useState(job.remaining);
  const [reason, setReason] = useState("Customer closed");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [location, setLocation] = useState<string>();
  const { notify } = useApp();
  return (
    <Modal title="Record delivery outcome" onClose={onClose}>
      <Form
        label="Save delivery outcome"
        onSubmit={async () => {
          await act({
            type: "delivery",
            id: job.id,
            outcome,
            delivered,
            reason: ["Failed", "Reschedule requested"].includes(outcome)
              ? reason
              : "",
            note,
            evidenceId: proof,
            location,
          });
          onClose();
        }}
      >
        <Field label="Outcome">
          <select
            value={outcome}
            onChange={(e) => {
              const next = e.target.value as typeof outcome;
              setOutcome(next);
              setDelivered(
                next === "Delivered"
                  ? job.remaining
                  : next === "Partial"
                    ? 1
                    : 0,
              );
            }}
          >
            {["Delivered", "Partial", "Failed", "Reschedule requested"].map(
              (o) => (
                <option key={o}>{o}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Packages delivered this attempt">
          <NumberInput
            type="number"
            min="0"
            max={job.remaining}
            required
            value={delivered}
            onChange={(e) => setDelivered(Number(e.target.value))}
          />
        </Field>
        {["Failed", "Reschedule requested"].includes(outcome) && (
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                "Customer closed",
                "Customer unavailable",
                "Incorrect location",
                "Delivery refused",
                "Damaged package",
                "Missing package",
                "Other",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        )}
        {delivered > 0 && (
          <EvidenceInput
            label="Customer signature or acknowledged document"
            value={proof}
            onChange={setProof}
            signature
          />
        )}
        <Field label="Notes / goods returned">
          <textarea
            value={note}
            required={
              reason === "Other" &&
              ["Failed", "Reschedule requested"].includes(outcome)
            }
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (!navigator.geolocation) {
              notify("Location is not available on this device.", true);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                setLocation(`${p.coords.latitude},${p.coords.longitude}`);
                notify("Location captured locally");
              },
              () =>
                notify("Location unavailable or permission declined.", true),
            );
          }}
        >
          <MapPin size={14} />{" "}
          {location ? "Location captured" : "Add optional location"}
        </button>
        <p className="muted text-xs">
          Remaining packages require manager reconciliation. Invoice values are
          not changed.
        </p>
      </Form>
    </Modal>
  );
}

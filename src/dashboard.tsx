import {ActionTiles} from "./components/ui/action-tiles";
import {Users,Settings2,ClipboardList} from "lucide-react";
import {ResponsiveTable} from "./components/ui/responsive-table";
import SaaSTemplate from "./components/ui/saa-s-template";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  PackageCheck,
  Truck,
  Wallet,
  Fuel,
  ArrowUpRight,
  Clock,
  Route,
  Download,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useApp } from "./context";
import { businessDate, money, type Trip } from "./domain";
import { Badge, Empty, Field } from "./ui";
import { reportData, type Filters } from "./analytics";
import { cashSummary, distance, fuelEfficiency } from "./rules";
import { csv, download } from "./data";
export function Dashboard() {
  const { state, user } = useApp();
  const today = businessDate();
  if (user.role === "DRIVER") return <DriverHome />;
  const r = reportData(state, user, {
    from: today,
    to: today,
    shop: "",
    driver: "",
    vehicle: "",
  });
  const own = (shop: string) =>
    user.role === "ADMIN" || user.shopIds.includes(shop);
  const pendingCollections = state.collections.filter(
    (c) => own(c.shopId) && c.status === "Pending",
  );
  const pendingFuel = state.fuels.filter(
    (f) => own(f.shopId) && ["Submitted", "Clarification"].includes(f.status),
  );
  const unassigned = state.jobs.filter(
    (j) => own(j.shopId) && j.status === "Ready",
  );
  const exceptions = state.trips.filter(
    (t) => own(t.startShopId) && t.status === "End submitted",
  );
  const attention = [
    {
      label: "Deliveries awaiting assignment",
      count: unassigned.length,
      to: "/deliveries",
      icon: PackageCheck,
    },
    {
      label: "Collections awaiting verification",
      count: pendingCollections.length,
      to: "/collections",
      icon: Wallet,
    },
    {
      label: "Diesel bills awaiting review",
      count: pendingFuel.length,
      to: "/fuel",
      icon: Fuel,
    },
    {
      label: "Shift reports awaiting closure",
      count: exceptions.length,
      to: "/trips",
      icon: Clock,
    },
    {
      label: "Sales requests awaiting review",
      count: state.salesRequests.filter(
        (x) =>
          own(x.shopId) && ["Submitted", "Under review"].includes(x.status),
      ).length,
      to: "/sales",
      icon: Activity,
    },
    {
      label: "Pending personal reimbursements",
      count: state.fuels.filter(
        (x) =>
          own(x.shopId) &&
          x.status === "Approved" &&
          x.reimbursement === "Pending",
      ).length,
      to: "/fuel",
      icon: Wallet,
    },
  ];
  return (
    <>
      <SaaSTemplate scope={user.role === 'ADMIN' ? 'All shops' : user.shopIds.map(id => state.shops.find(s => s.id === id)?.name).join(', ')} pending={unassigned.length} date={new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())} />
      <ActionTiles items={[
        {label:'Plan routes',to:'/routes',icon:Route,tone:'violet'},
        {label:'Delivery jobs',to:'/deliveries',icon:PackageCheck,tone:'cyan',count:unassigned.length},
        {label:'Collections',to:'/collections',icon:Wallet,tone:'green',count:pendingCollections.length},
        {label:'Cash handover',to:'/cash',icon:Wallet,tone:'amber'},
        {label:'Fuel review',to:'/fuel',icon:Fuel,tone:'cyan',count:pendingFuel.length},
        {label:'Reports',to:'/reports',icon:Activity,tone:'violet'},
        ...(user.role==='ADMIN'?[{label:'Team & roles',to:'/settings?tab=Users',icon:Users,tone:'violet' as const},{label:'Vehicles',to:'/settings?tab=Vehicles',icon:Truck,tone:'cyan' as const}]:[])
      ]}/>
      <div className="metric-grid">
        <Metric
          label="Scheduled deliveries"
          value={String(r.jobs.length)}
          detail={`${r.completed} completed today`}
          icon={<PackageCheck size={21} />}
        />
        <Metric
          label="Active trips"
          value={String(r.trips.filter((t) => t.status === "Active").length)}
          detail={`${state.vehicles.filter((v) => v.active).length} active vehicle(s)`}
          icon={<Truck size={21} />}
        />
        <Metric
          label="Approved collections"
          value={money(r.approved)}
          detail={`${money(r.pending)} awaiting review`}
          icon={<Wallet size={21} />}
        />
        <Metric
          label="Approved distance"
          value={`${r.km} km`}
          detail="From verified odometer records"
          icon={<Route size={21} />}
        />
      </div>
      <div className="split dashboard-split">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Today's routes</h3>

            </div>
            <Link to="/trips" className="link">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {r.trips.length ? (
            r.trips.map((t) => <TripRow key={t.id} trip={t} />)
          ) : (
            <Empty>
              No trips scheduled today.
              <br />
              <Link to="/routes" className="link mt-3">
                Build your first route
              </Link>
            </Empty>
          )}

        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>Needs attention</h3>
            <Badge>{attention.reduce((n, a) => n + a.count, 0)} items</Badge>
          </div>
          {attention.map((a) => (
            <Link className="attention-row" to={a.to} key={a.label}>
              <span className="attention-icon">
                <a.icon size={18} />
              </span>
              <span className="grow">{a.label}</span>
              <strong>{a.count}</strong>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric">
      <div className="flex-between">
        <small>{label}</small>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
function TripRow({ trip: t }: { trip: Trip }) {
  const { state } = useApp();
  return (
    <Link to={`/trips/${t.id}`} className="trip-row">
      <span className="vehicle-icon">
        <Truck size={21} />
      </span>
      <div className="grow">
        <strong>{t.name}</strong>
        <small>
          {state.shops.find((s) => s.id === t.startShopId)?.name} &rarr;{" "}
          {state.shops.find((s) => s.id === t.endShopId)?.name} ·{" "}
          {state.users.find((u) => u.id === t.primaryDriverId)?.name}
        </small>
      </div>
      <span>
        {t.stops.filter((st) => st.completed).length}/{t.stops.length} stops
      </span>
      <Badge>{t.status}</Badge>
    </Link>
  );
}
function DriverHome() {
  const { state, user } = useApp();
  const today = businessDate();
  const trips = state.trips.filter(t=>!t.purgedAt).filter(
    (t) =>
      [t.primaryDriverId, t.companionId].includes(user.id) &&
      !["Draft", "Cancelled"].includes(t.status) &&
      t.date === today,
  );
  const t =
    trips.find((x) => x.status === "Active") ??
    trips.find((x) => x.status === "Released") ??
    trips[0];
  const collections = state.collections.filter(
    (c) => c.driverId === user.id && c.status === "Pending",
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DRIVER WORKSPACE · {today}</span>
          <h1>Ready for the road.</h1>
          <p>{user.name} · Your assigned work on this device.</p>
        </div>
      </div>
      <ActionTiles label="Driver quick actions" items={[
        {label:'My trip',to:t?`/trips/${t.id}`:'/trips',icon:Truck,tone:'violet'},
        {label:'Collections',to:'/collections',icon:Wallet,tone:'green',count:collections.length},
        {label:'Diesel',to:'/fuel',icon:Fuel,tone:'cyan'},
        {label:'Sales requests',to:'/sales',icon:ClipboardList,tone:'amber'}
      ]}/>
      {t ? (
        <>
          <div className="trip-banner">
            <div>
              <Badge>{t.status}</Badge>
              <h2>{t.name}</h2>
              <p>
                {state.vehicles.find((v) => v.id === t.vehicleId)?.registration}{" "}
                · {state.shops.find((s) => s.id === t.startShopId)?.name} &rarr;{" "}
                {state.shops.find((s) => s.id === t.endShopId)?.name}
              </p>
              <Link className="primary light mt-4" to={`/trips/${t.id}`}>
                {t.status === "Released"
                  ? "Begin trip"
                  : "Resume / review trip"}{" "}
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="trip-stat">
              <strong>
                {t.stops.filter((st) => st.completed).length}
                <span>/{t.stops.length}</span>
              </strong>
              <p>completed stops</p>
            </div>
          </div>
          <div className="metric-grid compact">
            <Metric
              label="Pending delivery stops"
              value={String(
                t.stops.filter((st) => st.kind === "Delivery" && !st.completed)
                  .length,
              )}
              detail="Assigned to this trip"
              icon={<PackageCheck size={20} />}
            />
            <Metric
              label="Opening odometer"
              value={t.opening === null ? "Required" : `${t.opening} km`}
              detail={
                t.openingPhoto
                  ? "Photo saved locally"
                  : "Photo / exception required"
              }
              icon={<Truck size={20} />}
            />
            <Metric
              label="My pending collections"
              value={String(collections.length)}
              detail="Awaiting manager review"
              icon={<Wallet size={20} />}
            />
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h3>Today's assigned trips</h3>
            </div>
            {trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </div>
        </>
      ) : (
        <Empty>
          No trips assigned for today. Your manager will release your route here.
        </Empty>
      )}
    </>
  );
}
export function ReportsPage() {
  const { state, user } = useApp();
  const [f, set] = useState<Filters>({
    from: "",
    to: "",
    shop: "",
    driver: "",
    vehicle: "",
  });
  const r = reportData(state, user, f);
  const period = (kind: "day" | "week" | "month") => {
    const to = businessDate();
    const date = new Date(to + "T00:00:00+05:30");
    if (kind === "week") date.setUTCDate(date.getUTCDate() - 6);
    if (kind === "month") date.setUTCDate(date.getUTCDate() - 29);
    set({ ...f, from: businessDate(date), to });
  };
  const driverRows = state.users
    .filter((u) => u.role === "DRIVER")
    .map((u) => {
      const trips = r.trips.filter((t) => t.primaryDriverId === u.id);
      const jobs = r.jobs.filter((j) => trips.some((t) => t.id === j.tripId));
      return {
        name: u.name,
        km: trips.reduce((n, t) => n + distance(t), 0),
        completed: jobs.filter((j) => j.status === "Delivered").length,
        trips: trips.length,
      };
    });
  function exportCsv() {
    download(
      `cis-dispatch-report-${businessDate()}.csv`,
      csv([
        [
          "CIS Dispatch LOCAL OPERATIONAL REPORT",
          "Not verified CISapp financial data",
        ],
        ["From", f.from || "All"],
        ["To", f.to || "All"],
        ["Metric", "Value"],
        ["Scheduled jobs", r.jobs.length],
        ["Completed jobs", r.completed],
        ["Approved distance km", r.km],
        ["Approved fuel INR", r.cost / 100],
        ["Recorded collections INR", r.recorded / 100],
        ["Approved collections INR", r.approved / 100],
        ["Physical cash handed over INR", r.handed / 100],
        ["Reference value delivered INR", r.deliveredValue / 100],
        ["CISapp reference outstanding INR", r.outstanding / 100],
        [],
        [
          "Customer",
          "Invoice reference",
          "Schedule",
          "Status",
          "Remaining packages",
        ],
        ...r.jobs.map((j) => [
          state.customers.find((c) => c.id === j.customerId)?.name ?? "",
          state.invoices.find((i) => i.id === j.invoiceId)?.number ?? "",
          j.date,
          j.status,
          j.remaining,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Operations analytics</h1>
          <p>Connected operational activity and verified collections.</p>
        </div>
        <button className="primary" onClick={exportCsv}>
          <Download size={16} /> Export CSV
        </button>
      </div>
      <div className="panel filters">
        <Field label="From">
          <input
            type="date"
            value={f.from}
            onChange={(e) => set({ ...f, from: e.target.value })}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            min={f.from}
            value={f.to}
            onChange={(e) => set({ ...f, to: e.target.value })}
          />
        </Field>
        <Field label="Shop">
          <select
            value={f.shop}
            onChange={(e) => set({ ...f, shop: e.target.value })}
          >
            <option value="">All authorised shops</option>
            {state.shops
              .filter(
                (s) => user.role === "ADMIN" || user.shopIds.includes(s.id),
              )
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Primary driver / claim actor">
          <select
            value={f.driver}
            onChange={(e) => set({ ...f, driver: e.target.value })}
          >
            <option value="">All drivers</option>
            {state.users
              .filter((u) => u.role === "DRIVER")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Vehicle">
          <select
            value={f.vehicle}
            onChange={(e) => set({ ...f, vehicle: e.target.value })}
          >
            <option value="">All vehicles</option>
            {state.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration}
              </option>
            ))}
          </select>
        </Field>
        <div className="actions">
          <button className="secondary" onClick={() => period("day")}>
            Today
          </button>
          <button className="secondary" onClick={() => period("week")}>
            7 days
          </button>
          <button className="secondary" onClick={() => period("month")}>
            30 days
          </button>
        </div>
      </div>
      <details className="help-note"><summary>About these figures</summary><p>
        Jobs use scheduled dates; collections use recorded dates; fuel uses
        purchase dates; shifts use trip dates. Distance is approved odometer
        distance. Driver distance is attributed to the current primary driver,
        not divided between driver-change segments. Outstanding is the current
        balance for selected shops, independent of date, driver and vehicle
        filters.
      </p></details>
      <div className="metric-grid">
        <Metric
          label="Delivery completion"
          value={`${r.jobs.length ? Math.round((r.completed / r.jobs.length) * 100) : 0}%`}
          detail={`${r.completed} / ${r.jobs.length} scheduled jobs`}
          icon={<PackageCheck size={20} />}
        />
        <Metric
          label="Approved distance"
          value={`${r.km} km`}
          detail={`${r.trips.filter((t) => t.startedAt).length} started trips`}
          icon={<Route size={20} />}
        />
        <Metric
          label="Approved fuel cost"
          value={money(r.cost)}
          detail={`${r.fuels
            .filter((x) => x.status === "Approved")
            .reduce((n, x) => n + x.litres, 0)
            .toFixed(2)} litres purchased`}
          icon={<Fuel size={20} />}
        />
        <Metric
          label="Fuel cost / km"
          value={r.km ? money(Math.round(r.cost / r.km)) : "Insufficient data"}
          detail="Period expense / approved period km"
          icon={<Wallet size={20} />}
        />
      </div>
      <div className="metric-grid">
        <div className="metric">
          <small>Failed / partial jobs</small>
          <strong>
            {r.jobs.filter((j) => j.status === "Failed").length} /{" "}
            {r.jobs.filter((j) => j.status === "Partial").length}
          </strong>
          <p>Separate current job outcomes</p>
        </div>
        <div className="metric">
          <small>Pending delivery jobs</small>
          <strong>
            {
              r.jobs.filter(
                (j) => !["Delivered", "Cancelled"].includes(j.status),
              ).length
            }
          </strong>
          <p>Undelivered scheduled jobs</p>
        </div>
        <div className="metric">
          <small>Vehicle utilisation</small>
          <strong>
            {
              new Set(
                r.trips
                  .filter((t) => t.startedAt)
                  .map((t) => t.vehicleId + "|" + t.date),
              ).size
            }{" "}
            vehicle-days
          </strong>
          <p>Distinct vehicle / date pairs with a started shift</p>
        </div>
        <div className="metric">
          <small>Sales requests / exceptions</small>
          <strong>
            {
              state.salesRequests.filter((q) =>
                r.trips.some((t) => t.id === q.tripId),
              ).length
            }{" "}
            / {r.trips.reduce((n, t) => n + t.exceptions.length, 0)}
          </strong>
          <p>Requests received / approved exceptions on selected trips</p>
        </div>
      </div>
      <div className="split">
        <div className="panel p-5">
          <h3>Delivery outcomes by schedule</h3>
          {r.days.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    isAnimationActive={false}
                    dataKey="completed"
                    name="Completed"
                    fill="#1d6655"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="failed"
                    name="Failed / partial"
                    fill="#d4a247"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>
        <div className="panel p-5">
          <h3>Customer collection ledger</h3>
          <div className="summary-box">
            <p>
              Reported by drivers<span>{money(r.recorded)}</span>
            </p>
            <p>
              Awaiting verification<span>{money(r.pending)}</span>
            </p>
            <p>
              Approved CISapp receipts<span>{money(r.approved)}</span>
            </p>
            <p>
              Physical cash handed over<span>{money(r.handed)}</span>
            </p>
            <p>
              Digital manually verified
              <span>
                {money(
                  r.collections
                    .filter((c) => c.digitalVerified && c.status === "Approved")
                    .reduce((n, c) => n + c.amount, 0),
                )}
              </span>
            </p>
            <p>
              Pending reimbursements<span>{money(r.reimbursements)}</span>
            </p>
            <p>
              Cash shortage / excess
              <span>
                {money(
                  r.trips
                    .filter((t) => t.handoverConfirmed)
                    .reduce((n, t) => n + cashSummary(state, t).difference, 0),
                )}
              </span>
            </p>
            <p>
              Unreconciled expected cash
              <span>
                {money(
                  r.trips
                    .filter((t) => !t.handoverConfirmed)
                    .reduce((n, t) => n + cashSummary(state, t).expected, 0),
                )}
              </span>
            </p>
          </div>
        </div>
      </div>
      <div className="metric-grid mt-5">
        <div className="metric">
          <small>Reference value delivered</small>
          <strong>{money(r.deliveredValue)}</strong>
          <p>Full delivered jobs only · CISapp invoices</p>
        </div>
        <div className="metric">
          <small>CISapp outstanding snapshot</small>
          <strong>{money(r.outstanding)}</strong>
          <p>Selected shops · latest CISapp balances</p>
        </div>
        <div className="metric">
          <small>Packages delivered</small>
          <strong>{r.packages}</strong>
          <p>All attempts for scheduled cohort</p>
        </div>
        <div className="metric">
          <small>Fuel expense / completed job</small>
          <strong>
            {r.completed
              ? money(Math.round(r.cost / r.completed))
              : "Insufficient data"}
          </strong>
          <p>Period fuel expense only</p>
        </div>
      </div>
      <div className="split mt-5">
        <div className="panel p-5">
          <h3>Driver activity · primary attribution</h3>
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Trips</th>
                <th>Completed</th>
                <th>km</th>
              </tr>
            </thead>
            <tbody>
              {driverRows.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.trips}</td>
                  <td>{d.completed}</td>
                  <td>{d.km}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
        <div className="panel p-5">
          <h3>Vehicle and route costs</h3>
          {state.vehicles
            .filter((v) => !f.vehicle || v.id === f.vehicle)
            .map((v) => {
              const efficiency = fuelEfficiency(state, v.id);
              return (
                <div key={v.id} className="summary-box">
                  <strong>{v.registration}</strong>
                  <p>
                    Expected mileage<span>{v.expectedMileage} km/L</span>
                  </p>
                  <p>
                    Measured fill-to-fill efficiency
                    <span>
                      {efficiency
                        ? `${efficiency.toFixed(2)} km/L`
                        : "Insufficient data"}
                    </span>
                  </p>
                  <p className="muted text-xs">
                    Measured efficiency uses all approved fill history, not only
                    the filtered period.
                  </p>
                </div>
              );
            })}
          {r.trips.map((t) => (
            <p className="flex-between" key={t.id}>
              <span>{t.name}</span>
              <strong>
                {money(
                  r.fuels
                    .filter((x) => x.tripId === t.id && x.status === "Approved")
                    .reduce((n, x) => n + x.amount, 0),
                )}
              </strong>
            </p>
          ))}
        </div>
      </div>
      <div className="panel mt-5">
        <div className="panel-heading">
          <h3>Customer delivery history</h3>
          <span className="muted">Filtered scheduled jobs</span>
        </div>
        <div className="table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Customer / reference</th>
                <th>Date</th>
                <th>Status</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {r.jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    {state.customers.find((c) => c.id === j.customerId)?.name}
                    <small>
                      {state.invoices.find((i) => i.id === j.invoiceId)?.number}
                    </small>
                  </td>
                  <td>{j.date}</td>
                  <td>
                    <Badge>{j.status}</Badge>
                  </td>
                  <td>{j.remaining}</td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      </div>
    </>
  );
}

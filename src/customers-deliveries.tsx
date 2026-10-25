import {ResponsiveTable} from "./components/ui/responsive-table";
import {CISAPP_URL} from "./integration/connection";
import { useState } from "react";
import { useApp } from "./context";
import { Badge, Empty, Modal, Field, Form, Search } from "./ui";
import {
  uuid,
  businessDate,
  money,
  now,
  paise,
  type Customer,
  type InvoiceReference,
  type DeliveryJob,
} from "./domain";
import { Plus, MapPin, Phone } from "lucide-react";
export function CustomersPage() {
  const { state, user, act } = useApp();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Customers");
  const allowed = state.invoices.filter(
    (i) => user.role === "ADMIN" || user.shopIds.includes(i.shopId),
  );
  const customers = state.customers.filter(
    (c) =>
      (user.role === "ADMIN" ||
        !state.invoices.some((i) => i.customerId === c.id) ||
        allowed.some((i) => i.customerId === c.id)) &&
      `${c.name} ${c.area} ${c.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Customers & references</h1>
          
        </div>
        <a className="primary" href={`${CISAPP_URL}/invoices`} target="_blank" rel="noreferrer">Open CISapp invoices</a>
      </div>
      
      <div className="panel">
        <div className="toolbar">
          <div className="tabs">
            {["Customers", "Invoice references"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Search value={query} onChange={setQuery} />
        </div>
        {tab === "Customers" ? (
          <div className="table-wrap">
            <ResponsiveTable>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Delivery address</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small>{c.area}</small>
                    </td>
                    <td>{c.phone}</td>
                    <td>
                      {c.address}
                      <small>
                        {c.landmark} {c.pin}
                      </small>
                    </td>
                    <td>
                      <Badge>{c.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
            {!customers.length && <Empty />}
          </div>
        ) : (
          <div className="table-wrap">
            <ResponsiveTable>
              <thead>
                <tr>
                  <th>Reference / date</th>
                  <th>Customer</th>
                  <th>Shop</th>
                  <th>Value</th>
                  <th>CISapp outstanding</th>
                </tr>
              </thead>
              <tbody>
                {allowed
                  .filter((i) =>
                    `${i.number} ${state.customers.find((c) => c.id === i.customerId)?.name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.number}</strong>
                        <small>{i.date}</small>
                      </td>
                      <td>
                        {
                          state.customers.find((c) => c.id === i.customerId)
                            ?.name
                        }
                      </td>
                      <td>
                        {state.shops.find((s) => s.id === i.shopId)?.name}
                      </td>
                      <td>{money(i.amount)}</td>
                      <td>{money(i.outstanding)}</td>
                    </tr>
                  ))}
              </tbody>
            </ResponsiveTable>
          </div>
        )}
      </div>
    </>
  );
}
export function DeliveriesPage() {
  const { state, user } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [selected, setSelected] = useState<string | null>(null);
  const jobs = state.jobs.filter(j=>!j.purgedAt).filter(
    (j) =>
      (user.role === "ADMIN" || user.shopIds.includes(j.shopId)) &&
      (status === "All statuses" || j.status === status) &&
      `${state.customers.find((c) => c.id === j.customerId)?.name} ${state.invoices.find((i) => i.id === j.invoiceId)?.number}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Delivery jobs</h1>
          
        </div>
        <a className="primary" href={`${CISAPP_URL}/invoices`} target="_blank" rel="noreferrer">Mark delivery in CISapp</a>
      </div>
      <div className="panel">
        <div className="toolbar">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Search customer or invoice..."
          />
          <select
            aria-label="Delivery status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "All statuses",
              "Pending",
              "Ready",
              "Assigned",
              "Out for delivery",
              "Partial",
              "Delivered",
              "Failed",
              "Cancelled",
              "Returned pending",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Customer / invoice</th>
                <th>Schedule</th>
                <th>Shop</th>
                <th>Packages left</th>
                <th>Priority</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <strong>
                      {state.customers.find((c) => c.id === j.customerId)?.name}
                    </strong>
                    <small>
                      {state.invoices.find((i) => i.id === j.invoiceId)?.number}
                    </small>
                  </td>
                  <td>{j.date}{j.routeName&&<small>{j.routeName}{j.routeStopName?` / ${j.routeStopName}`:""}</small>}</td>
                  <td>{state.shops.find((s) => s.id === j.shopId)?.name}</td>
                  <td>
                    {j.remaining} / {j.packages}
                  </td>
                  <td>
                    <Badge>{j.priority}</Badge>
                  </td>
                  <td>
                    <Badge>
                      {j.sourceBlocked ? "Source review required" : j.status}
                    </Badge>
                  </td>
                  <td>
                    <button className="link" onClick={() => setSelected(j.id)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          {!jobs.length && (
            <Empty>Mark a saved invoice for delivery in CISapp, then synchronise.</Empty>
          )}
        </div>
      </div>
      {selected && (
        <JobReview id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function JobReview({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, act } = useApp();
  const j = state.jobs.find((j) => j.id === id)!;
  const [action, setAction] = useState<
    "Reschedule" | "Cancel" | "Reconcile returns"
  >("Reschedule");
  const [date, setDate] = useState(businessDate());
  const [note, setNote] = useState("");
  return (
    <Modal title="Delivery history & reconciliation" onClose={onClose}>
      <div className="detail-card">
        <h3>{state.customers.find((c) => c.id === j.customerId)?.name}</h3>
        <Badge>{j.status}</Badge>
        <p>
          <MapPin size={14} />
          {j.address}
        </p>
        <p>
          <Phone size={14} />
          {j.phone}
        </p>
        <p>
          {j.remaining} of {j.packages} packages remaining ·{" "}
          {j.returnsReconciled
            ? "Returns reconciled"
            : "Returns awaiting review"}
        </p>
      </div>
      {state.attempts
        .filter((a) => a.jobId === id)
        .map((a) => (
          <div className="timeline-item" key={a.id}>
            <strong>
              {a.outcome} · {a.delivered} packages
            </strong>
            <small>
              {a.at} · {a.reason} {a.note}
            </small>
          </div>
        ))}
      {!["Delivered", "Cancelled"].includes(j.status) && (
        <Form
          label="Apply reviewed action"
          onSubmit={async () => {
            await act({ type: "jobAction", id, action, date, note });
            onClose();
          }}
        >
          <Field label="Action">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
            >
              <option>Reschedule</option>
              <option>Reconcile returns</option>
              <option>Cancel</option>
            </select>
          </Field>
          {action === "Reschedule" && (
            <Field label="New delivery date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          )}
          <Field label="Review / correction reason">
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <p className="muted text-xs">
            Cancellation is recorded in history. Rescheduling retains previous
            attempts.
          </p>
        </Form>
      )}
    </Modal>
  );
}

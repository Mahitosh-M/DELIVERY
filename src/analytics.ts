import type { AppState, User } from "./domain";
import { businessDate } from "./domain";
import { distance } from "./rules";
export interface Filters {
  from: string;
  to: string;
  shop: string;
  driver: string;
  vehicle: string;
}
export function reportData(s: AppState, u: User, f: Filters) {
  const inDate = (date: string) => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : businessDate(new Date(date));
    return (!f.from || day >= f.from) && (!f.to || day <= f.to);
  };
  const shop = (id: string) =>
    (u.role === "ADMIN" || u.shopIds.includes(id)) &&
    (!f.shop || id === f.shop);
  const tripMatch = (id: string) => {
    const t = s.trips.find((t) => t.id === id);
    return (
      (!f.driver || t?.primaryDriverId === f.driver) &&
      (!f.vehicle || t?.vehicleId === f.vehicle)
    );
  };
  const trips = s.trips.filter(
    (t) => shop(t.startShopId) && inDate(t.date) && tripMatch(t.id),
  );
  const jobs = s.jobs.filter(
    (j) => shop(j.shopId) && inDate(j.date) && tripMatch(j.tripId ?? ""),
  );
  const collections = s.collections.filter(
    (c) =>
      shop(c.shopId) &&
      inDate(c.createdAt) &&
      (!f.driver || c.driverId === f.driver) &&
      (!f.vehicle ||
        s.trips.find((t) => t.id === c.tripId)?.vehicleId === f.vehicle),
  );
  const fuels = s.fuels.filter(
    (x) =>
      shop(x.shopId) &&
      inDate(x.at) &&
      (!f.driver || x.driverId === f.driver) &&
      (!f.vehicle || x.vehicleId === f.vehicle),
  );
  const approvedFuel = fuels.filter((x) => x.status === "Approved");
  const km = trips.reduce((n, t) => n + distance(t), 0);
  const cost = approvedFuel.reduce((n, x) => n + x.amount, 0);
  const completed = jobs.filter((j) => j.status === "Delivered").length;
  const approved = collections
    .filter((c) => c.status === "Approved" && c.mode !== "Credit")
    .reduce(
      (n, c) =>
        n + (s.integration?.collectionLinks[c.id]?.postedAmount ?? c.amount),
      0,
    );
  const recorded = collections
    .filter((c) => c.mode !== "Credit")
    .reduce((n, c) => n + c.amount, 0);
  const handed = trips
    .filter((t) => t.handoverConfirmed)
    .reduce((n, t) => n + t.cashReceived, 0);
  const outstanding = s.invoices
    .filter((i) => shop(i.shopId))
    .reduce((n, i) => n + i.outstanding, 0);
  const deliveredValue = jobs
    .filter((j) => j.status === "Delivered")
    .reduce(
      (n, j) => n + (s.invoices.find((i) => i.id === j.invoiceId)?.amount ?? 0),
      0,
    );
  const packages = jobs.reduce(
    (n, j) =>
      n +
      ((j.deliveredPackages ?? 0) + s.attempts
        .filter((a) => a.jobId === j.id)
        .reduce((x, a) => x + a.delivered, 0)),
    0,
  );
  const pending = collections
    .filter((c) => c.status === "Pending")
    .reduce((n, c) => n + c.amount, 0);
  const reimbursements = approvedFuel
    .filter((x) => x.reimbursement === "Pending")
    .reduce((n, x) => n + x.amount, 0);
  const days: Record<
    string,
    {
      date: string;
      completed: number;
      failed: number;
      km: number;
      fuel: number;
    }
  > = {};
  for (const j of jobs) {
    days[j.date] ??= { date: j.date, completed: 0, failed: 0, km: 0, fuel: 0 };
    if (j.status === "Delivered") days[j.date].completed++;
    if (["Failed", "Partial"].includes(j.status)) days[j.date].failed++;
  }
  for (const t of trips) {
    days[t.date] ??= { date: t.date, completed: 0, failed: 0, km: 0, fuel: 0 };
    days[t.date].km += distance(t);
  }
  for (const x of approvedFuel) {
    const date = businessDate(new Date(x.at));
    days[date] ??= { date, completed: 0, failed: 0, km: 0, fuel: 0 };
    days[date].fuel += x.amount / 100;
  }
  return {
    trips,
    jobs,
    collections,
    fuels,
    km,
    cost,
    completed,
    approved,
    recorded,
    handed,
    outstanding,
    deliveredValue,
    packages,
    pending,
    reimbursements,
    days: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

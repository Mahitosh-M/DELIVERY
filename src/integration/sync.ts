import type { AppState, Trip, User } from "../domain";
import { now } from "../domain";
import { db, repository } from "../data";
import { bridge, type ConnectedIdentity, type Issuer } from "./connection";
import { mergeCloudSnapshot, type CloudSnapshot } from "./syncMerge";
export { mergeCloudSnapshot, type CloudSnapshot } from "./syncMerge";
export async function pullConnected(issuer: Issuer) {
  const cloud = await bridge<CloudSnapshot>(issuer, "pull");
  await db.transaction("rw", db.state, async () => {
    const s = await repository.get();
    mergeCloudSnapshot(s, cloud);
    await db.state.put(s);
  });
  return cloud.identity;
}
export async function publishConnectedTrip(issuer: Issuer, tripId: string) {
  const s = await repository.get(),
    t = s.trips.find((t) => t.id === tripId);
  if (!t) throw new Error("Trip not found");
  const stops = t.stops.map((st) => {
    const c = s.customers.find((c) => c.id === st.customerId);
    const j = st.jobId ? s.jobs.find((j) => j.id === st.jobId) : null;
    const i = j ? s.invoices.find((i) => i.id === j.invoiceId) : null;
    if (
      !c?.externalId ||
      (st.jobId && (!j?.id.startsWith("cis-job:") || !i?.externalId))
    )
      throw new Error(
        "Only explicitly connected CISapp customers/deliveries may be published. Demo records are never uploaded.",
      );
    return { ...st, customerId: c.externalId, jobId: i?.externalId ?? null };
  });
  await bridge(issuer, "publishTrip", {
    ...t,
    stops,
    vehicle: s.vehicles.find((v) => v.id === t.vehicleId),
  });
  await pullConnected(issuer);
}
/** Stable submission IDs survive reloads; acknowledged claims are never posted from this client. */
export async function pushConnectedCollections(issuer: Issuer) {
  const identity = await bridge<ConnectedIdentity>(issuer, "identity");
  const s = await repository.get();
  let sent = 0;
  for (const c of s.collections) {
    if (
      c.status !== "Pending" ||
      c.driverId !== identity.actorId ||
      !s.integration?.publishedTripIds.includes(c.tripId) ||
      s.integration.collectionLinks[c.id]
    )
      continue;
    const customer = s.customers.find((x) => x.id === c.customerId);
    if (!customer?.externalId) continue;
    const ack = await bridge<{ id: string; status: string }>(
      issuer,
      "submitCollection",
      {
        localId: c.id,
        submissionId: c.submissionId,
        tripId: c.tripId,
        customerId: customer.externalId,
        amount: c.amount,
        mode: c.mode,
        reference: c.reference,
        note: c.note,
        collectedAt: c.createdAt,
        invoiceIds: c.invoiceIds
          .map((id) => s.invoices.find((i) => i.id === id)?.externalId)
          .filter((id): id is string => !!id),
      },
    );
    await db.transaction("rw", db.state, async () => {
      const current = await repository.get();
      if (!current.integration) throw new Error("Pull connected data first");
      current.integration.collectionLinks[c.id] = {
        cloudId: ack.id,
        status: ack.status,
        postedAmount: 0,
        receiptIds: [],
        unallocated: c.amount,
      };
      await db.state.put(current);
    });
    sent++;
  }
  await pullConnected(issuer);
  return sent;
}
import { approvedReadings } from "../rules";
export async function closeConnectedTrip(
  issuer: Issuer,
  tripId: string,
  note: string,
) {
  const s = await repository.get(),
    t = s.trips.find((t) => t.id === tripId);
  if (!t || t.status !== "Closed" || !t.approvedOdometer)
    throw new Error(
      "Complete local manager reconciliation and shift review first",
    );
  const r = approvedReadings(t);
  await bridge(issuer, "closeRouteAssignment", {
    id: t.id,
    note,
    opening: r.opening,
    closing: r.closing,
    reviewedLocalEvidence: true,
  });
  await pullConnected(issuer);
}

import type {AppState,Collection} from './domain';
export const COLLECTION_SCREEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export interface CollectionDecisionClaim {
  id: string;
  actorId: string;
  submissionId: string;
  status: string;
  reviewedAt?: unknown;
  postedAt?: unknown;
}
function validDate(value: unknown): string | undefined {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}
/** Display metadata only: never changes the ledger, allocations, receipts or cash. */
export function applyCollectionDecisionDates(next: AppState, claims: CollectionDecisionClaim[], previous?: AppState) {
  for (const c of next.collections) {
    const link = next.integration?.collectionLinks[c.id];
    if (!link) continue;
    const claim = claims.find(v => v.id === link.cloudId && v.actorId === c.driverId && v.submissionId === c.submissionId);
    const matches = claim && (c.status === 'Rejected' ? claim.status === 'Rejected' : c.status === 'Approved' && ['Posted', 'Credit authorised'].includes(claim.status));
    const old = previous?.integration?.collectionLinks[c.id];
    const prior = old?.cloudId === link.cloudId && old.status === link.status ? validDate(old.reviewedAt) : undefined;
    const decided = matches ? validDate(claim.reviewedAt) ?? validDate(claim.postedAt) : undefined;
    if (c.status !== 'Pending' && (decided || prior)) link.reviewedAt = decided ?? prior;
  }
}
export function collectionDecisionAt(s: AppState, c: Collection): string | undefined {
  if (c.status === 'Pending') return undefined;
  const link = s.integration?.collectionLinks[c.id];
  // Connected approvedAt may be the old backend's pull time. Use the actual claim decision instead.
  if (link) return validDate(link.reviewedAt);
  if (c.status === 'Approved') {
    const approved = validDate(c.approvedAt);
    if (approved) return approved;
  }
  const action = c.status === 'Approved' ? 'Collection approved locally' : 'Collection rejected';
  return s.audit.filter(a => a.entityType === 'collection' && a.entityId === c.id && a.action === action)
    .map(a => validDate(a.at)).filter((at): at is string => !!at).sort().at(-1);
}
export function collectionOnDriverScreen(s: AppState, c: Collection, at = Date.now()): boolean {
  const decided = collectionDecisionAt(s, c);
  return !decided || !Number.isFinite(at) || at - Date.parse(decided) < COLLECTION_SCREEN_RETENTION_MS;
}

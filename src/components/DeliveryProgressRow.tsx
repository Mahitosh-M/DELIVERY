import { Check } from 'lucide-react';
import type { DeliveryJob, Stop, Trip } from '../domain';
import { isDeliveryLoaded } from '../delivery-progress';

export function DeliveryProgressRow({ trip, stop, job, busy, routeReady = true, onLoad, onArrive, onOutcome }: {
  trip: Trip; stop: Stop; job: DeliveryJob; busy?: boolean; routeReady?: boolean;
  onLoad: () => void; onArrive: () => void; onOutcome: (outcome: 'Delivered' | 'Failed') => void;
}) {
  const loaded = isDeliveryLoaded(trip, stop), arrived = !!stop.arrivedAt;
  const blocked = busy || trip.status !== 'Active' || !!job.sourceBlocked;
  const delivered = stop.completed && ['Delivered', 'Partial'].includes(job.status);
  const failed = stop.completed && ['Failed', 'Returned pending'].includes(job.status);
  const circle = (done: boolean, step: number) => <span className={'delivery-progress-circle' + (done ? ' is-complete' : '')}>{done ? <Check size={15} aria-hidden="true"/> : step}</span>;
  return <div className="delivery-progress-row" role="group" aria-label="Delivery steps">
    <button type="button" className="delivery-progress-step" disabled={blocked || loaded || stop.completed} onClick={onLoad} aria-label={loaded ? 'Loaded — completed' : 'Mark this delivery loaded'}>
      {circle(loaded, 1)}<span>Loaded</span>
    </button>
    <button type="button" className="delivery-progress-step" disabled={blocked || !loaded || arrived || stop.completed || !routeReady} onClick={onArrive} aria-label={arrived ? 'Arrived — completed' : 'Mark arrival for this delivery'}>
      {circle(arrived, 2)}<span>Arrived</span>
    </button>
    <button type="button" className="delivery-progress-step" disabled={blocked || !loaded || !arrived || stop.completed || !routeReady} onClick={() => onOutcome('Delivered')} aria-label={delivered ? 'Delivered — completed' : 'Record delivery'}>
      {circle(delivered, 3)}<span>{job.status === 'Partial' ? 'Partial' : 'Delivered'}</span>
    </button>
    <button type="button" className="delivery-progress-step" disabled={blocked || !loaded || !arrived || stop.completed || !routeReady} onClick={() => onOutcome('Failed')} aria-label={failed ? 'Failed — recorded' : 'Record failed delivery'}>
      {circle(failed, 3)}<span>{job.status === 'Returned pending' ? 'Reschedule' : 'Failed'}</span>
    </button>
  </div>;
}

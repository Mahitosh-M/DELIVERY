import { afterEach, expect, it } from 'vitest';
import { seed } from './fixtures/seed';
import type { Trip } from '../src/domain';
import { applyCommand, type Command } from '../src/commands';
import { isDeliveryLoaded } from '../src/delivery-progress';
import { db, repository } from '../src/data';
function setup() {
  const state=seed();const trip:Trip={...structuredClone(state.trips[0]),id:'load-two',status:'Active' as const,loadingMode:'perDelivery' as const,loaded:false,opening:25000,stops:[
    {id:'first',kind:'Delivery' as const,jobId:'job-1',customerId:'customer-1',completed:false},
    {id:'second',kind:'Delivery' as const,jobId:'job-3',customerId:'customer-3',completed:false}
  ]};
  delete trip.routeSnapshot;
  state.trips.push(trip);
  for(const stop of trip.stops){const job=state.jobs.find(j=>j.id===stop.jobId)!;job.tripId=trip.id;job.status='Assigned';}
  const run=(command:Command,who=trip.primaryDriverId)=>applyCommand(state,state.users.find(u=>u.id===who)!,command,id=>id==='proof');
  const load=(stopId:string)=>run({type:'loadDelivery',tripId:trip.id,stopId});
  const arrive=(stopId:string)=>run({type:'arrive',tripId:trip.id,stopId});
  const outcome=(id:string,result:'Delivered'|'Failed'='Delivered')=>run({type:'delivery',id,outcome:result,delivered:result==='Failed'?0:state.jobs.find(j=>j.id===id)!.remaining,reason:result==='Failed'?'Customer closed':'',note:'',evidenceId:result==='Failed'?null:'proof'});
  return{state,trip,run,load,arrive,outcome};
}
it('loads only the selected customer order and allows its arrival while another order is unloaded',()=>{
  const {state,trip,load,arrive}=setup();load('second');
  expect(isDeliveryLoaded(trip,trip.stops[0])).toBe(false);expect(isDeliveryLoaded(trip,trip.stops[1])).toBe(true);expect(trip.loaded).toBe(false);
  expect(state.jobs.find(j=>j.id==='job-1')!.status).toBe('Assigned');
  expect(state.jobs.find(j=>j.id==='job-3')!.status).toBe('Out for delivery');
  arrive('second');expect(trip.stops[1]).toHaveProperty('arrivedAt');
  load('first');expect(trip.loaded).toBe(true);
});
it('requires independent loading and arrival before either delivery outcome',()=>{
  const {load,arrive,outcome}=setup();
  expect(()=>arrive('first')).toThrow(/loading/);expect(()=>outcome('job-1')).toThrow(/loading/);
  load('first');expect(()=>outcome('job-1')).toThrow(/arrival/);
  expect(()=>outcome('job-3','Failed')).toThrow(/loading/);
  arrive('first');expect(()=>outcome('job-1')).not.toThrow();
});
it('records failed delivery without changing invoices or creating receipts',()=>{
  const {state,trip,load,arrive,outcome}=setup();const invoices=structuredClone(state.invoices),collections=structuredClone(state.collections);
  load('first');arrive('first');outcome('job-1','Failed');
  expect(trip.stops[0].completed).toBe(true);expect(state.jobs.find(j=>j.id==='job-1')!.status).toBe('Failed');
  expect(state.invoices).toEqual(invoices);expect(state.collections).toEqual(collections);
});
it('rejects legacy bulk loading for new per-delivery trips, unauthorized drivers and duplicate loading',()=>{
  const {trip,run,load}=setup();
  expect(()=>run({type:'load',id:trip.id})).toThrow(/separately/);
  expect(()=>run({type:'loadDelivery',tripId:trip.id,stopId:'first'},'admin')).toThrow();
  load('first');expect(()=>load('first')).toThrow(/already/);
});
it('rejects missing, blocked and foreign stops without marking anything loaded',()=>{
  const {state,trip,load}=setup();
  expect(()=>load('foreign')).toThrow();state.jobs.find(j=>j.id==='job-1')!.sourceBlocked='Changed source';
  expect(()=>load('first')).toThrow(/Changed source/);expect(trip.stops[0]).not.toHaveProperty('loadedAt');
  state.jobs=state.jobs.filter(j=>j.id!=='job-3');expect(()=>load('second')).toThrow(/Synchronise/);expect(trip.loaded).toBe(false);
});
it('preserves old loaded trips and requires individual confirmation for old unloaded trips',()=>{
  const {trip,load}=setup();delete trip.loadingMode;trip.loaded=true;
  expect(isDeliveryLoaded(trip,trip.stops[0])).toBe(true);
  trip.loaded=false;load('second');expect(trip.loadingMode).toBe('perDelivery');expect(isDeliveryLoaded(trip,trip.stops[0])).toBe(false);
});
it('persists an individual load and arrival through database reopen',async()=>{
  await db.delete();await db.open();await repository.init();
  const {state,trip}=setup();await db.state.put(state);
  await repository.execute(trip.primaryDriverId,{type:'loadDelivery',tripId:trip.id,stopId:'second'});
  await repository.execute(trip.primaryDriverId,{type:'arrive',tripId:trip.id,stopId:'second'});
  db.close();await db.open();
  const restored=(await repository.get()).trips.find(t=>t.id===trip.id)!;
  expect(restored.stops[1]).toHaveProperty('loadedAt');expect(restored.stops[1]).toHaveProperty('arrivedAt');
  expect(isDeliveryLoaded(restored,restored.stops[0])).toBe(false);
});
afterEach(async()=>{await db.delete();});

it('opts new driver shifts into per-delivery loading while legacy start commands remain compatible',()=>{
 const {state,trip,run}=setup();state.trips=[trip];trip.status='Released';trip.opening=null;
 delete (trip as {loadingMode?:string}).loadingMode;
 run({type:'startTrip',id:trip.id,opening:state.vehicles.find(v=>v.id===trip.vehicleId)!.baseline,photo:'proof',note:'',perDeliveryLoading:true});
 expect(trip.loadingMode).toBe('perDelivery');expect(trip.loaded).toBe(false);
 expect(()=>run({type:'load',id:trip.id})).toThrow(/separately/);
});

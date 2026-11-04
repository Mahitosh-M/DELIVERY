import {describe,it,expect} from 'vitest';
import {seed} from './fixtures/seed';
import {applyCommand,type Command} from '../src/commands';
import {buildTripRoute,suggestConstrainedStops,reminderCandidate,nextItineraryPoint,plannedArrival,completedDeliveryStops} from '../src/smart-routing';
import {initialRouteTemplates} from '../src/route-seeds';
import {DEFAULT_ROUTE_COSTS,estimatedRouteCost,validateRouteCosts,settingsForDate,allocateRouteOverhead} from '../src/route-costs';
import {navigationProvider,usableEta} from '../src/navigation-provider';
import {expireDeliveryDetails} from '../src/retention';
import type {Trip} from '../src/domain';
function setup(){
 const s=seed(),trip:Trip={...structuredClone(s.trips[0]),id:'smart-trip',date:'2026-11-02',startShopId:'SHOP_A',endShopId:'SHOP_S',status:'Draft',opening:null,closing:null,startedAt:null,endedAt:null,loaded:false,revision:0,stops:[{id:'st-1',kind:'Delivery',jobId:'job-1',customerId:'customer-1',completed:false},{id:'st-2',kind:'Delivery',jobId:'job-3',customerId:'customer-3',completed:false}]};
 s.trips.push(trip);s.jobs[0].tripId=trip.id;s.jobs[2].tripId=trip.id;
 const run=(c:Command,who='manager-a')=>applyCommand(s,s.users.find(u=>u.id===who)!,c,()=>true);
 return{s,trip,run};
}
describe('released itineraries and constraints',()=>{
 it('requires confirmed pins and respects an explicit pending invoice override',()=>{
  const {s,trip,run}=setup();s.jobs[0].location=null;
  expect(()=>run({type:'routeAction',id:trip.id,action:'Release',note:'Reviewed'})).toThrow(/pin/);
  s.jobs[0].location={lat:15.96,lng:76.65,confirmed:true};run({type:'routeAction',id:trip.id,action:'Release',note:'Reviewed'});expect(trip.status).toBe('Released');
 });
 it('freezes template versions and customer pins without modifying invoices',()=>{
  const {s,trip}=setup(),route=initialRouteTemplates()[0],before=JSON.stringify(s.invoices);
  trip.startShopId=trip.endShopId='SHOP_S';trip.stops=trip.stops.slice(0,1);s.jobs[0].routeStopId=route.stops[1].id;
  const snapshot=buildTripRoute(s,trip,route,'2026-11-02T01:00:00Z'),old=snapshot.points.find(p=>p.customerId)!;
  route.name='Changed';route.stops[1].lat=0;s.customers[0].location!.lat=0;
  expect(snapshot.template?.name).not.toBe('Changed');expect(snapshot.points[1].lat).toBe(15.9606429);expect(old.lat).toBe(15.96);expect(JSON.stringify(s.invoices)).toBe(before);
 });
 it('groups consecutive orders at one pin and keeps separate job identities',()=>{
  const {s,trip}=setup();s.jobs.push({...s.jobs[0],id:'same-place-job'});trip.stops.splice(1,0,{...trip.stops[0],id:'same-place-stop',jobId:'same-place-job'});
  let snap=buildTripRoute(s,trip,null,'2026-11-02T00:00:00Z');expect(snap.points[1].stopIds).toEqual(['st-1','same-place-stop']);expect(trip.stops).toHaveLength(3);
  trip.stops.push({...trip.stops[0],id:'return-visit'});snap=buildTripRoute(s,trip,null,'2026-11-02T00:00:00Z');expect(snap.points.filter(p=>p.customerId==='customer-1')).toHaveLength(2);
 });
 it('preserves mandatory anchors, locks and customer time windows during suggestions',()=>{
  const {s,trip}=setup(),route=initialRouteTemplates()[0];trip.startShopId=trip.endShopId='SHOP_S';
  s.jobs[0].routeStopId=route.stops[2].id;s.jobs[2].routeStopId=route.stops[1].id;
  expect(()=>buildTripRoute(s,trip,route,'2026-11-02')).toThrow(/mandatory/);
  expect(suggestConstrainedStops(s,trip,route).map(st=>st.id)).toEqual(['st-2','st-1']);
  trip.stops[0].locked=true;expect(()=>suggestConstrainedStops(s,trip,route)).toThrow(/Locked/);
  trip.stops[0].locked=false;s.customers[0].location!.timeWindow={from:'09:00',to:'10:00'};expect(()=>suggestConstrainedStops(s,trip,route)).toThrow(/window/);
 });
 it('requires audited active amendments and driver acknowledgement',()=>{
  const {trip,run}=setup();run({type:'routeAction',id:trip.id,action:'Release',note:'Reviewed'});trip.status='Active';trip.loaded=true;trip.visitedWaypoints=[trip.routeSnapshot!.points[0].id];
  run({type:'amendStops',id:trip.id,stopIds:['st-2','st-1'],revision:trip.revision,note:'Customer visit changed'});
  expect(trip.routeSnapshot!.revision).toBe(2);expect(trip.pendingRouteAcknowledgements).toContain('driver-1');
  expect(()=>run({type:'arrive',tripId:trip.id,stopId:'st-2'},'driver-1')).toThrow(/updated/);
  run({type:'ackRoute',id:trip.id,revision:2},'driver-1');run({type:'arrive',tripId:trip.id,stopId:'st-2'},'driver-1');
  trip.stops[0].completed=true;expect(()=>run({type:'amendStops',id:trip.id,stopIds:['st-1','st-2'],revision:trip.revision,note:'Try moving complete'})).toThrow(/Completed/);
 });
 it('records mandatory loading before allowing a customer stop',()=>{
  const {s,trip,run}=setup(),route=initialRouteTemplates()[0];trip.stops=trip.stops.slice(0,1);s.jobs[0].routeStopId=route.stops[1].id;trip.routeSnapshot=buildTripRoute(s,trip,route,'2026-11-02');trip.status='Active';trip.loaded=true;trip.visitedWaypoints=[route.stops[0].id];
  expect(nextItineraryPoint(trip)?.kind).toBe('Loading');expect(()=>run({type:'arrive',tripId:trip.id,stopId:'st-1'},'driver-1')).toThrow(/authorised/);
  run({type:'visitWaypoint',tripId:trip.id,pointId:route.stops[1].id,revision:trip.routeSnapshot.revision},'driver-1');expect(nextItineraryPoint(trip)?.customerId).toBe('customer-1');
 });
 it('reviews a changed remaining pin and protects completed history',()=>{
  const {s,trip,run}=setup();trip.routeSnapshot=buildTripRoute(s,trip,null,'2026-11-02');trip.status='Active';s.jobs[0].sourceBlocked='Changed';
  run({type:'reviewLocation',id:'job-1',revision:0,note:'Alternate entrance confirmed',location:{lat:15.95,lng:76.65,confirmed:true}});
  expect(s.jobs[0].sourceBlocked).toBeUndefined();expect(trip.routeSnapshot.points[1].lat).toBe(15.95);expect(trip.pendingRouteAcknowledgements).toContain('driver-1');
  trip.stops[0].completed=true;expect(()=>run({type:'reviewLocation',id:'job-1',revision:1,note:'Old delivery',location:{lat:0,lng:0,confirmed:true}})).toThrow(/historical/);
 });
 it('removes customer route details and reminders from retained summaries',()=>{
  const {s,trip,run}=setup();run({type:'routeAction',id:trip.id,action:'Release',note:'Reviewed'});trip.status='Active';trip.loaded=true;s.arrivalReminders=[reminderCandidate(trip,[],5,'Manual','2026-11-02','driver-1')!];
  expireDeliveryDetails(s,new Set([trip.id]),'2026-11-10');expect(trip.routeSnapshot).toBeUndefined();expect(s.arrivalReminders).toHaveLength(0);expect(JSON.stringify(s.audit)).not.toContain('customer-1-15.960000');expect(trip.reportingInvoiceIds).toBeDefined();
 });
});
describe('arrival events and honest provider capabilities',()=>{
 it('uses custom thresholds, deduplicates across restarts and respects completion and opt out',()=>{
  const {s,trip}=setup();trip.routeSnapshot=buildTripRoute(s,trip,null,'2026-11-02');trip.status='Active';trip.loaded=true;
  expect(reminderCandidate(trip,[],11,'Provider','2026-11-02','driver-1')).toBeNull();const first=reminderCandidate(trip,[],10,'Provider','2026-11-02','driver-1')!;expect(first).toBeTruthy();
  expect(reminderCandidate(structuredClone(trip),[structuredClone(first)],9,'Provider','2026-11-02','driver-1')).toBeNull();
  trip.routeSnapshot.points[1].location!.reminderMinutes=5;expect(reminderCandidate(trip,[],6,'Manual','2026-11-02','driver-1')).toBeNull();
  trip.stops[0].completed=true;expect(reminderCandidate(trip,[],5,'Manual','2026-11-02','driver-1')?.pointId).not.toBe(first.pointId);
  trip.routeSnapshot.points[2].location!.alertsEnabled=false;expect(reminderCandidate(trip,[],5,'Manual','2026-11-02','driver-1')).toBeNull();trip.status='Closed';expect(reminderCandidate(trip,[],0,'Provider','2026-11-02','driver-1')).toBeNull();
 });
 it('rejects stale or unrelated ETA and supplies no fake road guidance',async()=>{
  const eta={pointId:'a',routeRevision:1,minutes:9,expiresAt:'2026-11-02T10:01:00Z',source:'Provider' as const};
  expect(usableEta(eta,'a',1,'2026-11-02T10:00:00Z')).toBe(eta);expect(usableEta(eta,'a',2,'2026-11-02T10:00:00Z')).toBeNull();expect(usableEta(eta,'a',1,'2026-11-02T10:02:00Z')).toBeNull();
  expect(navigationProvider.capabilities.turnByTurn).toBe(false);expect(await navigationProvider.eta('a',{lat:0,lng:0},1)).toBeNull();
 });
});
describe('operating estimates',()=>{
 it('excludes failed and partial visits from the completed-delivery cost denominator',()=>{
  const {s,trip}=setup();trip.routeSnapshot=buildTripRoute(s,trip,null,'2026-11-02');trip.stops.forEach(st=>{st.completed=true;});s.jobs[0].status='Failed';s.jobs[2].status='Partial';expect(completedDeliveryStops(s,trip)).toBe(0);s.jobs[0].status='Delivered';expect(completedDeliveryStops(s,trip)).toBe(1);
 });
 it('labels planning arrival from supplied driving time and stop duration without inventing traffic ETA',()=>{
  const {s,trip}=setup(),route=initialRouteTemplates()[0];trip.stops=trip.stops.slice(0,1);s.jobs[0].routeStopId=route.stops[1].id;
  expect(plannedArrival(buildTripRoute(s,trip,route,'2026-11-02'))).toBe('10:57');expect(plannedArrival(buildTripRoute(s,trip,null,'2026-11-02'))).toBeNull();
 });
 it('allocates daily overhead once before filtering and counts an optional second driver by policy',()=>{
  const {trip}=setup(),active={...trip,id:'active',startedAt:'2026-11-02T02:00:00Z'},draft={...trip,id:'draft'};
  const cost=allocateRouteOverhead([draft,active],()=>DEFAULT_ROUTE_COSTS);expect(cost.get('active')).toEqual({driver:50000,reserve:20000});expect(cost.get('draft')).toEqual({driver:0,reserve:0});
  const crew=allocateRouteOverhead([active,{...active,id:'later'}],()=>({...DEFAULT_ROUTE_COSTS,driverPolicy:'driver_day',reservePolicy:'trip'}));expect(crew.get('active')).toEqual({driver:100000,reserve:20000});expect(crew.get('later')).toEqual({driver:0,reserve:20000});
 });
 it('uses sales margin, whole rupees and accurate break-even sales',()=>{
  const r=estimatedRouteCost(132,1000000,DEFAULT_ROUTE_COSTS,50000,20000);expect(r.estimatedLitres).toBe(8.8);expect(r.estimatedFuel).toBe(88000);expect(r.estimatedExpense).toBe(158000);expect(r.estimatedGrossProfit).toBe(150000);expect(r.estimatedContribution).toBe(-8000);expect(r.breakEvenSales).toBe(1053400);expect(estimatedRouteCost(null,10000,DEFAULT_ROUTE_COSTS,0,0).estimatedFuel).toBeNull();
 });
 it('validates and selects effective-dated assumptions',()=>{
  const next={...DEFAULT_ROUTE_COSTS,id:'next',effectiveDate:'2026-12-01',driverDaily:60000};expect(settingsForDate([next],'2026-11-30').id).toBe('default');expect(settingsForDate([next],'2026-12-01').id).toBe('next');
  expect(()=>validateRouteCosts({...next,driverDaily:60001})).toThrow(/whole/);expect(()=>validateRouteCosts({...next,marginBasisPoints:0})).toThrow(/Margin/);expect(()=>validateRouteCosts({...next,effectiveDate:'2026-02-30'})).toThrow();
 });
});

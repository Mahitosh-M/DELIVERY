import {useEffect,useState} from 'react';
import {useApp} from './context';
import {RouteMap} from './components/RouteMap';
import {buildTripRoute} from './smart-routing';
import {validPoint} from './route-geo';
import type {Trip} from './domain';
import type {WeeklyRoute} from './weekly-routes';
import {Modal,Field,Form} from './ui';
import {useSession} from './integration/session';
import {bridge} from './integration/connection';
import {DEFAULT_ROUTE_COSTS,settingsForDate,estimatedRouteCost,type RouteCostSettings} from './route-costs';
import {money} from './domain';
function PlannerBudget({trip,route}:{trip:Trip;route?:WeeklyRoute|null}){
 const {state}=useApp(),{identity}=useSession(),[costs,setCosts]=useState<RouteCostSettings[]>([]),[costError,setCostError]=useState('');
 useEffect(()=>{let active=true;void bridge<{settings:RouteCostSettings[]}>(identity.issuer,'routeCostSettings').then(r=>{if(active)setCosts(r.settings);}).catch(()=>{if(active)setCostError('Connected cost settings unavailable; showing the initial supplied assumptions.');});return()=>{active=false;};},[identity.uid]);
 const settings=trip.routeCostSettingsId==='default'?DEFAULT_ROUTE_COSTS:costs.find(c=>c.id===trip.routeCostSettingsId)??settingsForDate(costs,trip.date),ids=new Set(trip.stops.flatMap(st=>{const job=state.jobs.find(j=>j.id===st.jobId);return job?[job.invoiceId]:[];}));
 const sales=state.invoices.filter(i=>ids.has(i.id)).reduce((n,i)=>n+i.amount,0),budget=estimatedRouteCost(route?.referenceKm??null,sales,settings,settings.driverDaily*(settings.driverPolicy==='driver_day'&&trip.companionId?2:1),settings.reserve);
 return <section className="summary-box"><strong>Estimated route budget</strong><p>Assigned invoice value: {money(sales)} · estimated sales margin: {settings.marginBasisPoints/100}%</p><p>Fuel: {budget.estimatedFuel===null?'Route reference km required':money(budget.estimatedFuel)} · total trip expense: {budget.estimatedExpense===null?'Unavailable':money(budget.estimatedExpense)}</p><p>Estimated contribution: {budget.estimatedContribution===null?'Unavailable':money(budget.estimatedContribution)} · break-even sales: {budget.breakEvenSales===null?'Unavailable':money(budget.breakEvenSales)}</p><small>Planning reserves a full working-day overhead. Reporting allocates shared-day costs once. Fuel reference excludes uncalculated customer detours.</small>{costError&&<p role="status">{costError}</p>}</section>;
}
export function PlannerRoutePreview({trip,route}:{trip:Trip;route?:WeeklyRoute|null}){
 const {state}=useApp();let snapshot,error='';try{snapshot=buildTripRoute(state,trip,route??null,new Date().toISOString());}catch(e){error=(e as Error).message;}
 const points=snapshot?.points??route?.stops.filter(validPoint).map(s=>({...s,lat:s.lat!,lng:s.lng!}))??[];
 const packages=trip.stops.reduce((n,st)=>n+(state.jobs.find(j=>j.id===st.jobId)?.remaining??0),0),minutes=route?.referenceMinutes;
 const departure=(route?.departure??'08:00').split(':').map(Number),total=minutes===undefined?null:departure[0]*60+departure[1]+minutes+(snapshot?.points.reduce((n,p)=>n+p.durationMinutes,0)??0);
 const arrival=total===null?null:`${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}${total>=1440?' next day':''}`;
 return <section className="panel smart-panel"><h3>Planned itinerary</h3><div className="stats"><div className="summary-box"><strong>{trip.stops.length}</strong><small>Orders / visits</small></div><div className="summary-box"><strong>{packages}</strong><small>Packages</small></div><div className="summary-box"><strong>{snapshot?.points.filter(p=>p.customerId).length??'—'}</strong><small>Physical customer stops</small></div></div><RouteMap points={points} colour={route?.colour}/>{error&&<p className="notice" role="alert">{error}. Save a draft while locations are being confirmed.</p>}{route?.referenceKm!==undefined&&<p>Template reference: {route.referenceKm} road km, {route.referenceMinutes} driving minutes. Additional customer detours are not calculated.</p>}{arrival&&<p>Planning arrival: <strong>{arrival}</strong> · target {route?.targetArrival??'17:00'}. Based on supplied driving time and stop durations, without live traffic.</p>}<PlannerBudget trip={trip} route={route}/><small>Time-window stops stay fixed during suggestions. Road routing / traffic ETA is not configured.</small></section>;
}
export function ActiveRouteAmend({trip}:{trip:Trip}){
 const {state,user,act}=useApp(),[open,setOpen]=useState(false),[order,setOrder]=useState<string[]>([]),[note,setNote]=useState('');
 if(user.role==='DRIVER'||trip.status!=='Active')return null;
 function move(index:number,offset:number){const next=[...order];[next[index],next[index+offset]]=[next[index+offset],next[index]];setOrder(next);}
 return <><button onClick={()=>{setOrder(trip.stops.map(st=>st.id));setNote('');setOpen(true);}}>Amend remaining stop order</button>{open&&<Modal title="Review active itinerary amendment" onClose={()=>setOpen(false)}><p>All deliveries remain assigned. Completed and locked stops cannot move. Drivers must acknowledge the new itinerary.</p><Form label="Confirm audited amendment" onSubmit={async()=>{await act({type:'amendStops',id:trip.id,stopIds:order,note,revision:trip.revision});setOpen(false);}}>{order.map((id,index)=>{const stop=trip.stops.find(st=>st.id===id)!;return <div className="weekly-stop" key={id}><span>{index+1}. {state.customers.find(c=>c.id===stop.customerId)?.name??stop.customerId}</span><button type="button" disabled={index===0||stop.completed||stop.locked||trip.stops.find(st=>st.id===order[index-1])?.completed||trip.stops.find(st=>st.id===order[index-1])?.locked} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===order.length-1||stop.completed||stop.locked||trip.stops.find(st=>st.id===order[index+1])?.completed||trip.stops.find(st=>st.id===order[index+1])?.locked} onClick={()=>move(index,1)}>↓</button></div>;})}<Field label="Amendment explanation"><textarea required value={note} onChange={e=>setNote(e.target.value)}/></Field></Form></Modal>}</>;
}


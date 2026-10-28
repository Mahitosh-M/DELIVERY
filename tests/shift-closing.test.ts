import {describe,it,expect} from 'vitest';
import {seed} from './fixtures/seed';
import {applyCommand,type Command} from '../src/commands';
import {fuelBill,type Fuel} from '../src/domain';
import {cashSummary,closingSteps} from '../src/rules';

function fixture(advance=0) {
 const s=seed(),t=s.trips[0];
 Object.assign(t,{status:'Active',opening:25000,closing:null,openingAdvance:advance,loaded:true,handoverConfirmed:false,cashReceived:0,approvedOdometer:false,stops:[],exceptions:[]});
 s.collections=[];s.fuels=[];s.jobs=[];
 const f:Fuel={...seed().fuels[0],id:'new-fuel',tripId:t.id,source:'Shop advance',status:'Submitted',reimbursement:'Not applicable',litres:5,rate:10000,amount:50000,odometer:25020,receiptId:'proof',pump:''};
 const run=(role:'DRIVER'|'MANAGER',c:Command)=>applyCommand(s,s.users.find(u=>u.role===role)!,c,()=>true);
 return {s,t,f,run};
}
describe('guided shift closing and fuel funding',()=>{
 it('calculates fuel in paise with final rounding and rejects unsupported precision',()=>{
  expect(fuelBill('10.25',9599)).toBe(98400);
  expect(fuelBill('20',10000)).toBe(200000);
  expect(()=>fuelBill('1.001',10000)).toThrow();
 });
 it('rejects a hand-edited bill even one paise away from the calculated amount',()=>{
  const {f,run}=fixture(50000);expect(()=>run('DRIVER',{type:'submitFuel',value:{...f,amount:50001}})).toThrow(/match bill|whole rupee/);
 });
 it('uses personal funds without an advance, even with an outdated driver form',()=>{
  const {s,t,f,run}=fixture();run('DRIVER',{type:'submitFuel',value:{...f,cashExpenseId:'spoofed-posting'}});
  expect(s.fuels[0]).toMatchObject({source:'Personal',reimbursement:'Pending',pump:''});
  expect(s.fuels[0].cashExpenseId).toBeUndefined();
  expect(cashSummary(s,t).expected).toBe(0);
 });
 it('prevents spending more shop advance than was actually issued',()=>{
  const {s,t,f,run}=fixture(50000);run('DRIVER',{type:'submitFuel',value:f});
  expect(()=>run('DRIVER',{type:'submitFuel',value:{...f,id:'second'}})).toThrow(/Not enough shop advance/);
  run('DRIVER',{type:'submitFuel',value:{...f,id:'personal',source:'Personal'}});
  expect(cashSummary(s,t).expected).toBe(0);
 });
 it('corrects old unfunded open claims with audit; preserves confirmed historical custody',()=>{
  const {s,t,f,run}=fixture();s.fuels=[f];t.status='End submitted';
  expect(cashSummary(s,t).expected).toBe(0);
  run('MANAGER',{type:'reviewFuel',id:f.id,action:'Approve',note:''});
  expect(f.source).toBe('Personal');expect(f.reimbursement).toBe('Pending');
  expect(s.audit.some(a=>a.action==='Unfunded shop claim corrected to personal funds')).toBe(true);
  t.handoverConfirmed=true;f.source='Shop advance';
  expect(cashSummary(s,t).expected).toBe(-50000);
 });
 it('submits shift end without a returns checkbox and keeps actual package reconciliation mandatory',()=>{
  const {s,t,run}=fixture();s.jobs=[{...seed().jobs[0],tripId:t.id,returnsReconciled:false}];
  run('DRIVER',{type:'endTrip',id:t.id,closing:25040,photo:'proof',note:''});
  expect(t.status).toBe('End submitted');expect(t.returnConfirmed).toBe(false);
  run('MANAGER',{type:'handover',id:t.id,amount:0,note:''});
  expect(()=>run('MANAGER',{type:'closeTrip',id:t.id,note:'Odometer checked'})).toThrow(/Reconcile returned/);
 });
 it('records a numeric discrepancy without requiring prose or duplicating collections',()=>{
  const {s,t,run}=fixture(50000);t.status='End submitted';t.closing=25040;
  run('MANAGER',{type:'handover',id:t.id,amount:49000,note:''});
  expect(cashSummary(s,t).difference).toBe(-1000);expect(s.collections).toHaveLength(0);
  run('MANAGER',{type:'closeTrip',id:t.id,note:'Verified closing photo'});
  expect(t.status).toBe('Closed');
 });
 it('tracks cash, newest diesel and final closure independently, with explicit paid reimbursement',()=>{
  const {s,t,f,run}=fixture();run('DRIVER',{type:'submitFuel',value:f});
  run('DRIVER',{type:'endTrip',id:t.id,closing:25040,photo:'proof',note:''});
  expect(closingSteps(s,t)).toMatchObject({cashDone:false,fuelDone:false,ready:false});
  run('MANAGER',{type:'handover',id:t.id,amount:0,note:''});
  run('MANAGER',{type:'reviewFuel',id:f.id,action:'Approve & reimburse',note:''});
  expect(closingSteps(s,t)).toMatchObject({cashDone:true,fuelDone:true,ready:true});
  expect(s.fuels[0].reimbursement).toBe('Settled');
  run('MANAGER',{type:'closeTrip',id:t.id,note:'Verified odometer'});
  expect(t.status).toBe('Closed');
 });
});

describe('amount-only diesel',()=>{
 it('stores the entered amount and required receipt with unknown calculation inputs',()=>{const {s,f,run}=fixture();run('DRIVER',{type:'submitFuel',value:{...f,litres:null,rate:null,amount:98400,odometer:null,fullTank:false}});expect(s.fuels[0]).toMatchObject({amount:98400,litres:null,rate:null,entryMode:'bill_amount',source:'Personal'});});
 it('rejects a fractional manual bill',()=>{const {f,run}=fixture();expect(()=>run('DRIVER',{type:'submitFuel',value:{...f,litres:null,rate:null,amount:98420}})).toThrow(/whole rupee/);});
});

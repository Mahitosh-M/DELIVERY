import {applyCollectionDecisionDates,type CollectionDecisionClaim} from '../collectionVisibility';
import {type Command} from '../commands';
import {uuid,now,type Trip,type Fuel,type Audit,type Collection} from '../domain';
import {tripEvidenceIds} from '../retention';
﻿import { db,repository,localEvidence,activeIssuer,type PendingCommand } from '../data';
import { bridge,type ConnectedIdentity,type Issuer } from './connection';
import type {AppState} from '../domain';
const syncing=new Map<string,Promise<void>>();
function commandTrip(state:AppState,c:Record<string,any>){return c.tripId??c.value?.tripId??(c.type==='delivery'?state.jobs.find(j=>j.id===c.id)?.tripId:state.trips.some(t=>t.id===c.id)?c.id:null);}
export async function refreshWorkspace(identity:ConnectedIdentity){
 const currentDb=db,before=JSON.stringify(await currentDb.state.get('main'));
 const result=await bridge<{operational:AppState;claims?:CollectionDecisionClaim[]}>(identity.issuer,'pull');
 if(!result.operational)throw new Error('The connected backend did not return a verified workspace');
 if(db!==currentDb)throw new Error('Account changed while synchronising');
 await currentDb.transaction('rw',currentDb.state,currentDb.session,currentDb.pending,currentDb.evidence,async()=>{
  const previous=await currentDb.session.get('identity');
  const unchanged=JSON.stringify(await currentDb.state.get('main'))===before;
  const canReplace=await currentDb.pending.count()===0&&unchanged;
  if(canReplace){
   const previousState=await currentDb.state.get('main');
   applyCollectionDecisionDates(result.operational,result.claims??[],previousState);
   const expired=new Set(result.operational.trips.filter(t=>!!t.purgedAt).map(t=>t.id));
   const ids=new Set(previousState?tripEvidenceIds(previousState,expired):[]);
   for(const image of await currentDb.evidence.toArray())if(image.tripId&&expired.has(image.tripId))ids.add(image.id);
   if(ids.size)await currentDb.evidence.bulkDelete([...ids]);
   await currentDb.state.put(result.operational);
  }
  await currentDb.session.put({id:'identity',identity,validatedAt:new Date().toISOString(),...(canReplace?{lastSyncedAt:new Date().toISOString()}:previous?.lastSyncedAt?{lastSyncedAt:previous.lastSyncedAt}:{})});
 });
}
export async function flushPending(identity:ConnectedIdentity){const key=identity.issuer+':'+identity.uid;const existing=syncing.get(key);if(existing)return existing;const accountDb=db;const running=(async()=>{for(;;){const batch=await accountDb.pending.orderBy('capturedAt').toArray();if(!batch.length)break;for(const pending of batch){if(pending.actorId!==identity.actorId)throw new Error('Pending work belongs to a different account');try{const state=await accountDb.state.get('main');if(!state)throw new Error('Account cache unavailable');const c=pending.command as Record<string,any>,tripId=commandTrip(state,c);for(const id of [c.photo,c.evidenceId,c.value?.receiptId,c.value?.evidenceId].filter(Boolean)){const evidence=await accountDb.evidence.get(id);if(!evidence)throw new Error('Required evidence is not present on this device');await accountDb.evidence.update(id,{tripId});await bridge(identity.issuer,'putEvidence',{...evidence,tripId});}const result=await bridge<{reviewed?:{trip?:Trip;fuels:Fuel[];collections?:Collection[];audit:Audit[]}}>(identity.issuer,'operation',{id:pending.id,actorId:identity.actorId,capturedAt:pending.capturedAt,command:pending.command});
if(pending.applyAfterAck && !result?.reviewed)throw new Error('Server did not confirm this review. Update the backend and retry safely.');
await accountDb.transaction('rw',accountDb.state,accountDb.pending,async()=>{
 if(pending.applyAfterAck && result.reviewed){const current=(await accountDb.state.get('main'))!;
  const reviewed=result.reviewed;if(reviewed.trip){const n=current.trips.findIndex(t=>t.id===reviewed.trip!.id);if(n>=0)current.trips[n]=reviewed.trip;}
  for(const fuel of reviewed.fuels){const n=current.fuels.findIndex(f=>f.id===fuel.id);if(n>=0)current.fuels[n]=fuel;}
  for(const collection of reviewed.collections??[]){const n=current.collections.findIndex(c=>c.id===collection.id);if(n>=0)current.collections[n]=collection;}
  for(const event of reviewed.audit)if(!current.audit.some(a=>a.id===event.id))current.audit.push(event);
  await accountDb.state.put(current);
 }
 await accountDb.pending.delete(pending.id);
});}catch(error){await accountDb.pending.update(pending.id,{error:(error as Error).message});throw error;}}}})().finally(()=>{syncing.delete(key);});syncing.set(key,running);return running;}
const fullSyncs=new Map<string,Promise<void>>();
export async function syncWorkspace(identity:ConnectedIdentity){const key=identity.issuer+':'+identity.uid;const existing=fullSyncs.get(key);if(existing)return existing;const running=(async()=>{await flushPending(identity);await refreshWorkspace(identity);})().finally(()=>fullSyncs.delete(key));fullSyncs.set(key,running);return running;}

// Privileged reviews appear only after a trusted server confirmation.
// A durable ID survives a lost response without repeating a financial posting.
export async function executeReviewed(identity:ConnectedIdentity, command:Command) {
 if(identity.role==='DRIVER')throw new Error('Manager review required');
 const accountDb=db;
 const pending=(await accountDb.pending.toArray()).find(p=>p.actorId===identity.actorId && p.applyAfterAck && JSON.stringify(p.command)===JSON.stringify(command));
 if(!pending){
  await flushPending(identity);
  await accountDb.pending.add({id:uuid(),actorId:identity.actorId,capturedAt:now(),command:structuredClone(command),applyAfterAck:true});
 }
 await flushPending(identity);
}

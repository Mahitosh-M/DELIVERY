import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {seed} from './fixtures/seed';
const network=vi.hoisted(()=>({bridge:vi.fn()}));vi.mock('../src/integration/connection',()=>network);
import {db,openAccountWorkspace} from '../src/data';
import {flushPending,refreshWorkspace,syncWorkspace,executeReviewed} from '../src/integration/live';
const identity={issuer:'delivery-28165' as const,uid:'test-live-driver',actorId:'driver-1',role:'DRIVER' as const,shopIds:['SHOP_A'],name:'Fictional driver'};
beforeEach(async()=>{await openAccountWorkspace(identity.issuer,identity.uid);await db.pending.clear();await db.state.put(seed());network.bridge.mockReset();});
afterEach(async()=>{await db.delete();});
it('retries the same operation ID and retains rejected pending work',async()=>{await db.pending.put({id:'stable-command',actorId:identity.actorId,capturedAt:'2026-10-19T10:00:00Z',command:{type:'load',id:'trip-test'}});network.bridge.mockRejectedValueOnce(new Error('Connection interrupted'));await expect(flushPending(identity)).rejects.toThrow(/interrupted/);expect((await db.pending.get('stable-command'))?.error).toContain('interrupted');network.bridge.mockResolvedValue({id:'stable-command',status:'Acknowledged'});await flushPending(identity);expect(network.bridge.mock.calls[0][2].id).toBe(network.bridge.mock.calls[1][2].id);expect(await db.pending.count()).toBe(0);});
it('does not replace optimistic cached work during a concurrent refresh',async()=>{const current=seed();current.settings.fuelTolerance=500;await db.state.put(current);await db.pending.put({id:'pending',actorId:identity.actorId,capturedAt:'2026-10-19T10:00:00Z',command:{type:'load',id:'trip-test'}});network.bridge.mockResolvedValue({operational:seed()});await refreshWorkspace(identity);expect((await db.state.get('main'))?.settings.fuelTolerance).toBe(500);expect(await db.pending.count()).toBe(1);});
it('never submits another account\'s pending operation',async()=>{await db.pending.put({id:'other-account',actorId:'another-driver',capturedAt:'2026-10-19T10:00:00Z',command:{type:'load',id:'trip-test'}});await expect(flushPending(identity)).rejects.toThrow(/different account/);expect(network.bridge).not.toHaveBeenCalled();});
it('uploads evidence before its referring operation, and acknowledges only after both succeed',async()=>{await db.evidence.put({id:'private-photo',actorId:identity.actorId,name:'Fictional proof',mime:'image/png',at:'2026-10-19T10:00:00Z',dataUrl:'data:image/png;base64,test-fixture'});await db.pending.put({id:'start-with-proof',actorId:identity.actorId,capturedAt:'2026-10-19T10:00:00Z',command:{type:'startTrip',id:'trip-test',opening:100,photo:'private-photo',note:''}});network.bridge.mockResolvedValue({status:'Acknowledged'});await flushPending(identity);expect(network.bridge.mock.calls.map(c=>c[1])).toEqual(['putEvidence','operation']);expect(await db.pending.count()).toBe(0);expect(await db.evidence.get('private-photo')).toBeDefined();});


it('coalesces concurrent full sync requests into one workspace download',async()=>{network.bridge.mockResolvedValue({operational:seed()});await Promise.all([syncWorkspace(identity),syncWorkspace(identity)]);expect(network.bridge.mock.calls.map(c=>c[1])).toEqual(['pull']);expect((await db.session.get('identity'))?.lastSyncedAt).toBeDefined();});
it('does not overwrite a change acknowledged while a download was in flight',async()=>{network.bridge.mockImplementationOnce(async()=>{const current=(await db.state.get('main'))!;current.settings.fuelTolerance=777;await db.state.put(current);return{operational:seed()};});await refreshWorkspace(identity);expect((await db.state.get('main'))?.settings.fuelTolerance).toBe(777);});

it('removes server-expired cached photos while keeping evidence for active or pending work',async()=>{const before=seed(),trip=before.trips[0];trip.openingPhoto='old-photo';await db.state.put(before);await db.evidence.bulkPut([{id:'old-photo',actorId:identity.actorId,name:'Old',mime:'image/png',at:'2026-10-01',dataUrl:'data:image/png;base64,old'},{id:'active-photo',actorId:identity.actorId,name:'Current',mime:'image/png',at:'2026-10-08',dataUrl:'data:image/png;base64,active'}]);const remote=structuredClone(before);remote.trips[0].purgedAt='2026-10-08T06:00:00Z';remote.trips[0].openingPhoto=null;network.bridge.mockResolvedValue({operational:remote});await refreshWorkspace(identity);expect(await db.evidence.get('old-photo')).toBeUndefined();expect(await db.evidence.get('active-photo')).toBeDefined();});

it('never marks manager review complete without server confirmation and retries its stable ID',async()=>{
 const manager={...identity,actorId:'manager-a',role:'MANAGER' as const};
 const initial=(await db.state.get('main'))!;const trip=initial.trips[0];trip.handoverConfirmed=false;trip.status='End submitted';await db.state.put(initial);
 const command={type:'handover' as const,id:trip.id,amount:0,note:''};
 network.bridge.mockResolvedValueOnce({status:'Acknowledged'});
 await expect(executeReviewed(manager,command)).rejects.toThrow(/Server did not confirm/);
 expect((await db.state.get('main'))!.trips[0].handoverConfirmed).toBe(false);
 const pending=(await db.pending.toArray())[0];
 network.bridge.mockResolvedValueOnce({reviewed:{trip:{...trip,handoverConfirmed:true},fuels:[],collections:initial.collections.map(c=>({...c,status:'Approved'})),audit:[]}});
 await executeReviewed(manager,command);
 expect(network.bridge.mock.calls[1][2].id).toBe(pending.id);
 expect((await db.state.get('main'))!.trips[0].handoverConfirmed).toBe(true);
 expect((await db.state.get('main'))!.collections.every(c=>c.status==='Approved')).toBe(true);
 expect(await db.pending.count()).toBe(0);
});

it('hydrates stable claim decision dates from the trusted pull and keeps them after cache reload',async()=>{const state=seed(),c=state.collections[0];c.status='Rejected';state.integration={lastPull:'2026-10-26T00:00:00Z',identityKey:'test',publishedTripIds:[],conflicts:[],collectionLinks:{[c.id]:{cloudId:'reviewed-claim',status:'Rejected',postedAmount:0,receiptIds:[],unallocated:c.amount}}};network.bridge.mockResolvedValue({operational:state,claims:[{id:'reviewed-claim',actorId:c.driverId,submissionId:c.submissionId,status:'Rejected',reviewedAt:'2026-10-19T01:00:00Z'}]});await refreshWorkspace(identity);expect((await db.state.get('main'))?.integration?.collectionLinks[c.id].reviewedAt).toBe('2026-10-19T01:00:00.000Z');expect((await db.state.get('main'))?.collections).toEqual(state.collections);await refreshWorkspace(identity);expect((await db.state.get('main'))?.integration?.collectionLinks[c.id].reviewedAt).toBe('2026-10-19T01:00:00.000Z');});

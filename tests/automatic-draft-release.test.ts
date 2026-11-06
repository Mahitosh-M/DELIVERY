import { expect, it } from 'vitest';
import { seed } from './fixtures/seed';
import { applyCommand } from '../src/commands';

it('cannot release automatic drafts until an active vehicle and authorised primary driver are selected',()=>{
 const state=seed(),admin=state.users.find(user=>user.role==='ADMIN')!;
 const trip={...structuredClone(state.trips[0]),id:'automatic-unassigned',autoCreated:true,status:'Draft' as const,vehicleId:'',primaryDriverId:''};state.trips.push(trip);
 const release=()=>applyCommand(state,admin,{type:'routeAction',id:trip.id,action:'Release',note:'Reviewed automatic draft'});
 expect(release).toThrow('Select an active vehicle');expect(trip.status).toBe('Draft');
 trip.vehicleId=state.vehicles.find(vehicle=>vehicle.active)!.id;
 expect(release).toThrow('Select an active primary driver');expect(trip.status).toBe('Draft');
 trip.primaryDriverId=admin.id;
 expect(release).toThrow('Select an active primary driver');expect(trip.status).toBe('Draft');
});

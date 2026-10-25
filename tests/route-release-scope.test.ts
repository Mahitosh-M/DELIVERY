import {it,expect} from 'vitest';
import {seed} from './fixtures/seed';
import {applyCommand} from '../src/commands';
function setup(){const state=seed();const trip={...state.trips[0],id:'release-test',startShopId:'SHOP_A',endShopId:'SHOP_S',status:'Draft' as const};state.trips.push(trip);return{state,trip};}
it('allows the departure shop manager to release a trip ending at the other shop',()=>{const{state,trip}=setup();applyCommand(state,state.users.find(u=>u.id==='manager-a')!,{type:'routeAction',id:trip.id,action:'Release',note:'Loaded for this shop'});expect(trip.status).toBe('Released');});
it('denies a manager whose shop is only the destination',()=>{const{state,trip}=setup();expect(()=>applyCommand(state,state.users.find(u=>u.id==='manager-s')!,{type:'routeAction',id:trip.id,action:'Release',note:'Not departure shop'})).toThrow('Manager access');expect(trip.status).toBe('Draft');});
it('allows Admin and prevents drivers from releasing routes',()=>{const{state,trip}=setup();expect(()=>applyCommand(state,state.users.find(u=>u.id==='driver-1')!,{type:'routeAction',id:trip.id,action:'Release',note:'Driver attempt'})).toThrow('Manager access');applyCommand(state,state.users.find(u=>u.id==='admin')!,{type:'routeAction',id:trip.id,action:'Release',note:'Admin review'});expect(trip.status).toBe('Released');});

it('allows Admin to release a route starting at SMPA as well as ASHOKA',()=>{const{state,trip}=setup();trip.startShopId='SHOP_S';trip.endShopId='SHOP_A';applyCommand(state,state.users.find(u=>u.id==='admin')!,{type:'routeAction',id:trip.id,action:'Release',note:'Admin SMPA release'});expect(trip.status).toBe('Released');});

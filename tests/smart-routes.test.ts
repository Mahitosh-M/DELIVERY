import {describe,it,expect} from 'vitest';
import {importGoogleRoute,coordinates,distanceToCorridorKm,CONFIRMED_SHOPS} from '../src/route-geo';
import {initialRouteTemplates} from '../src/route-seeds';
import {validateWeeklyRoute} from '../src/weekly-routes';
describe('versioned route foundations',()=>{
 it('imports ordered explicit coordinates and flags named or shortened links',()=>{
  const result=importGoogleRoute('https://www.google.com/maps/dir/?api=1&origin=15.1,76.1&waypoints=Named+shop%7C15.2,76.2&destination=15.3,76.3');
  expect(result.waypoints.map(p=>p.point?.lat??null)).toEqual([15.1,null,15.2,15.3]);expect(result.waypoints[1].issue).toBeTruthy();
  expect(importGoogleRoute('https://maps.app.goo.gl/abc').waypoints).toEqual([]);
  expect(importGoogleRoute('https://www.google.com/maps/dir/15.1,76.1/15.2,76.2/@15,76,10z').waypoints.map(p=>p.point?.lat)).toEqual([15.1,15.2]);
 });
 it('rejects arbitrary URLs, credential tricks, insecure protocols and private endpoints',()=>{
  for(const url of ['http://www.google.com/maps/dir/1,2/3,4','https://google.com.evil.test/maps/dir/1,2/3,4','https://user:pass@google.com/maps','https://127.0.0.1/maps','https://goo.gl/other/abc','https://www.google.com:8443/maps'])expect(()=>importGoogleRoute(url)).toThrow();
  expect(coordinates('91,76')).toBeNull();expect(coordinates('15,')).toBeNull();expect(coordinates('0,0')).toEqual({lat:0,lng:0});
 });
 it('preserves the exact supplied sequence and weekly vehicle continuity as drafts',()=>{
  const routes=initialRouteTemplates();expect(routes.map(r=>r.code)).toEqual(['MON_WESTERN','TUE_EASTERN','THU_NORTH','FRI_WESTERN','SAT_EASTERN']);
  expect(routes.map(r=>r.referenceKm)).toEqual([132,103,137,115,114]);expect(routes.every(r=>!r.active&&r.status==='Draft')).toBe(true);
  expect(routes[2].stops.map(s=>s.name)).toContain('Alkod');expect(routes[2].stops[2].name).toContain('Kavital');expect(routes[2].stops[5].lat).toBe(16.2259454);
  expect(routes.flatMap(r=>r.days)).toEqual([1,2,4,5,6]);expect(routes.map(r=>[r.startShopId,r.endShopId])).toEqual([['SHOP_S','SHOP_S'],['SHOP_S','SHOP_A'],['SHOP_A','SHOP_A'],['SHOP_A','SHOP_A'],['SHOP_A','SHOP_S']]);
  expect(routes[0].stops[1]).toMatchObject({lat:15.9606429,lng:76.6570609,kind:'Loading'});
  expect(CONFIRMED_SHOPS.SHOP_A.lat).toBe(15.960642922039911);
  for(const route of routes)expect(validateWeeklyRoute({...route,status:'Active',active:true}).stops).toEqual(route.stops);
 });
 it('requires resolved pins and matching endpoints for activation and measures geographic separation honestly',()=>{
  const route=initialRouteTemplates()[0];route.stops[3].lat=undefined;route.stops[3].lng=undefined;expect(()=>validateWeeklyRoute({...route,status:'Active'})).toThrow(/coordinates|waypoint/);
  expect(validateWeeklyRoute(route).status).toBe('Draft');
  expect(distanceToCorridorKm({lat:15,lng:76.5},[{lat:15,lng:76},{lat:15,lng:77}])).toBeCloseTo(0);
 });
});

import type {GeoPoint} from './route-geo';
export interface NavigationEta {pointId:string;routeRevision:number;minutes:number;expiresAt:string;source:'Provider';}
export interface NavigationProvider {
 readonly name:string;
 readonly capabilities:{roadRouting:boolean;turnByTurn:boolean;backgroundLocation:boolean};
 eta(pointId:string,position:GeoPoint,revision:number):Promise<NavigationEta|null>;
}
/** Current PWA provider deliberately supplies no fabricated driving ETA or turn-by-turn instructions. */
export const navigationProvider:NavigationProvider={name:'Saved route / foreground GPS',capabilities:{roadRouting:false,turnByTurn:false,backgroundLocation:false},eta:async()=>null};
export function usableEta(eta:NavigationEta|null,pointId:string,revision:number,at:string){return eta&&eta.pointId===pointId&&eta.routeRevision===revision&&Number.isFinite(eta.minutes)&&eta.minutes>=0&&Date.parse(eta.expiresAt)>Date.parse(at)?eta:null;}

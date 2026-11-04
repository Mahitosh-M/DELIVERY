import {useEffect,useState} from 'react';
import type {GeoPoint} from './route-geo';
/** Ephemeral foreground position only; never written to the operational ledger. */
export function useForegroundPosition(enabled:boolean){
 const [position,setPosition]=useState<GeoPoint|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  setPosition(null);setError('');if(!enabled)return;
  if(!navigator.geolocation){setError('Location unavailable on this device. Use the saved itinerary.');return;}
  let active=true;
  const id=navigator.geolocation.watchPosition(p=>{if(active){setPosition({lat:p.coords.latitude,lng:p.coords.longitude});setError('');}},e=>{if(active){setPosition(null);setError(e.code===1?'Location permission denied. Use the itinerary or external navigation.':'GPS position unavailable. Try again when safe.');}},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  return()=>{active=false;navigator.geolocation.clearWatch(id);};
 },[enabled]);
 return{position,error};
}

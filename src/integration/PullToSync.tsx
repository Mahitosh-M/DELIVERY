import {useEffect,useRef,useState} from 'react';
import {ArrowDown,RefreshCw} from 'lucide-react';
import {useSession} from './session';
import {useApp} from '../context';
import {syncWorkspace} from './live';
const threshold=80;
export function PullToSync(){
 const {identity}=useSession(),{notify,busy}=useApp();
 const [distance,setDistance]=useState(0),[running,setRunning]=useState(false);
 const latest=useRef({identity,notify,busy});latest.current={identity,notify,busy};
 const locked=useRef(false);
 useEffect(()=>{
  let start:{x:number;y:number}|null=null,pull=0;
  const root=document.documentElement,previous=root.style.overscrollBehaviorY;root.style.overscrollBehaviorY='contain';
  const atTop=()=>window.scrollY<=0&&(document.scrollingElement?.scrollTop??0)<=0;
  const begin=(e:TouchEvent)=>{start=null;pull=0;if(locked.current||latest.current.busy||!atTop()||e.touches.length!==1||document.querySelector('[role="dialog"]'))return;const target=e.target;if(!(target instanceof Element)||target.closest('input,select,textarea,button,a,canvas,.sidebar,.bottom-nav,.overlay'))return;start={x:e.touches[0].clientX,y:e.touches[0].clientY};};
  const move=(e:TouchEvent)=>{if(!start)return;if(e.touches.length!==1||!atTop()){start=null;pull=0;setDistance(0);return;}const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;if(dy<0||Math.abs(dx)>Math.abs(dy)){start=null;pull=0;setDistance(0);return;}if(dy>10){if(e.cancelable)e.preventDefault();pull=Math.min(dy,140);setDistance(pull);}};
  const finish=()=>{start=null;const ready=pull>=threshold;pull=0;setDistance(0);if(!ready||locked.current||latest.current.busy)return;locked.current=true;setRunning(true);void syncWorkspace(latest.current.identity).then(()=>latest.current.notify('CISapp records updated')).catch(e=>latest.current.notify((e as Error).message,true)).finally(()=>{locked.current=false;setRunning(false);});};
  const cancel=()=>{start=null;pull=0;setDistance(0);};
  window.addEventListener('touchstart',begin,{passive:true});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',finish);window.addEventListener('touchcancel',cancel);
  return()=>{root.style.overscrollBehaviorY=previous;window.removeEventListener('touchstart',begin);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',finish);window.removeEventListener('touchcancel',cancel);};
 },[]);
 if(!running&&distance<10)return null;
 return <div className="pull-sync" role="status" aria-live="polite">{running?<RefreshCw className="sync-spinning" size={18}/>:<ArrowDown style={{transform:`rotate(${distance>=threshold?180:0}deg)`}} size={18}/>}<span>{running?'Synchronising...':distance>=threshold?'Release to synchronise':'Pull down to synchronise'}</span></div>;
}

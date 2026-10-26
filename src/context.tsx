import SplashScreen from './components/SplashScreen';
﻿import React,{createContext,useContext,useState,type ReactNode} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {repository,db} from './data';
import type {AppState,User} from './domain';
import {businessDate} from './domain';
import type {Command} from './commands';
import {useSession} from './integration/session';
import {flushPending,refreshWorkspace,executeReviewed} from './integration/live';
import {bridge} from './integration/connection';
interface Context {state:AppState;user:User;setUser:(id:string)=>void;act:(command:Command)=>Promise<void>;notify:(text:string,error?:boolean)=>void;busy:boolean;}
const AppContext=createContext<Context|null>(null);
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('App provider required');return value;}
export function AppProvider({children}:{children:ReactNode}){
 const {identity}=useSession();const state=useLiveQuery(()=>db.state.get('main'),[identity.uid,identity.issuer]);const [toast,setToast]=useState<{text:string;error:boolean}|null>(null),[busy,setBusy]=useState(false);
 function notify(text:string,error=false){setToast({text,error});setTimeout(()=>setToast(null),6500);}
 if(!state)return <SplashScreen/>;
 const user=state.users.find(u=>u.id===identity.actorId&&u.active);if(!user)return <SplashScreen/>;
 async function act(c:Command){setBusy(true);try{const capability=c.type==='reviewCollection'?'approveCollections':['reviewFuel','reviewSales'].includes(c.type)?'reviewExpenses':['handover','closeTrip','correctOdometer','exception'].includes(c.type)?'reconcileCash':['saveTrip','routeAction','changeDriver','jobAction'].includes(c.type)?'manageDispatch':c.type==='submitCollection'?'recordCollections':'recordDeliveries';if(identity.permissions&&!identity.permissions.includes(capability))throw new Error('Your role does not permit this action');if(!navigator.onLine&&identity.role!=='DRIVER')throw new Error('Manager and Admin actions require a connection for permission verification');if(c.type==='reviewCollection'){if(!window.confirm(c.approve?'Post this verified collection to the real CISapp ledger? Receipts affect balances and shop funds once. Physical cash handover remains separate.':'Reject this collection claim? Physical cash still requires reconciliation.'))return;const link=state!.integration?.collectionLinks[c.id];if(!link)throw new Error('Synchronise the driver submission before reviewing it');await bridge(identity.issuer,'approveCollection',{id:link.cloudId,approvalId:c.approvalId,reject:!c.approve,note:c.note,digitalVerified:c.digitalVerified,date:businessDate(),allocations:c.allocations.map(a=>({invoiceId:state!.invoices.find(i=>i.id===a.invoiceId)?.externalId,amount:a.amount}))});await refreshWorkspace(identity);notify('CISapp verification and financial posting confirmed');}else if(['reviewFuel','handover','closeTrip'].includes(c.type)){await executeReviewed(identity,c);notify('Review confirmed by Firebase');}else{if(['createInvoice','saveCustomer','createJob','saveMaster','fuelTolerance'].includes(c.type))throw new Error('Use CISapp for customer/invoice changes, or Admin settings for configuration');await repository.execute(identity.actorId,c);if(navigator.onLine){await flushPending(identity);notify(await db.pending.count()?'Saved on this device; awaiting server acknowledgement':'Saved to connected Firebase');}else notify('Saved offline. Pull down or use Synchronise now when online.');}}catch(e){notify((e as Error).message,true);throw e;}finally{setBusy(false);}}
 return <AppContext.Provider value={{state,user,setUser:()=>{throw new Error('Sign in with another authorised account to change roles');},act,notify,busy}}>{children}{toast&&<div className={'toast '+(toast.error?'error':'')} role={toast.error?'alert':'status'}>{toast.text}<button aria-label="Dismiss notification" onClick={()=>setToast(null)}>×</button></div>}</AppContext.Provider>;
}

import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {CISAPP_URL} from './connection';
import {useSession} from './session';
import {db} from '../data';
import {useApp} from '../context';
import {timestamp} from '../domain';
import {syncWorkspace,refreshWorkspace} from './live';
export function ConnectionPage(){
 const {identity}=useSession(),{state,notify}=useApp();
 const pending=useLiveQuery(()=>db.pending.toArray())??[];
 const session=useLiveQuery(()=>db.session.get('identity'));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function sync(){setBusy(true);setError('');try{await syncWorkspace(identity);notify('Updated');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <>
  <div className="page-title"><h1>Connection & pending work</h1><button className="primary" disabled={busy} onClick={()=>void sync()}>{busy?'Updating...':'Synchronise now'}</button></div>
  {error&&<p role="alert" className="notice">{error}</p>}
  <p className="muted">Downloads run after sign-in or page reload. Pull down at the top, or use Synchronise now, to fetch newer CISapp records and retry pending work.</p>
  <div className="panel p-5"><dl className="connection-summary"><div><dt>Status</dt><dd>{navigator.onLine?'Online':'Offline'}</dd></div><div><dt>Last updated</dt><dd>{session?.lastSyncedAt?timestamp(session.lastSyncedAt):state.integration?.lastPull?timestamp(state.integration.lastPull):'Not yet updated'}</dd></div><div><dt>Pending</dt><dd>{pending.length}</dd></div></dl><a className="link" href={`${CISAPP_URL}/invoices`} target="_blank" rel="noreferrer">Open CISapp invoices</a></div>
  <div className="panel p-5 mt-4"><h2>Pending changes</h2>{!pending.length&&<p className="muted">No pending changes.</p>}{pending.map(p=><div className="summary-box" key={p.id}><strong className="capitalize">{p.command.type.replace(/([A-Z])/g,' $1')}</strong><small>{timestamp(p.capturedAt)}</small>{p.error&&<><p role="alert">{p.error}</p><button disabled={busy} className="danger" onClick={async()=>{if(!window.confirm('Discard this unacknowledged change and reload server records? Saved evidence is retained.'))return;await db.pending.delete(p.id);await refreshWorkspace(identity);}}>Discard rejected change</button></>}</div>)}</div>
 </>;
}

import {Link} from 'react-router-dom';
import {ArrowUpRight,type LucideIcon} from 'lucide-react';
export interface ActionItem{label:string;to:string;icon:LucideIcon;tone?:'violet'|'cyan'|'amber'|'green';count?:number;}
export function ActionTiles({items,label='Quick actions'}:{items:ActionItem[];label?:string}){return <section className="action-tiles" aria-label={label}>{items.map(({label:caption,to,icon:Icon,tone='violet',count})=><Link to={to} className={`action-tile action-tile-${tone}`} key={caption}><span className="action-tile-icon"><Icon size={24} aria-hidden="true"/></span><ArrowUpRight className="action-tile-arrow" size={16} aria-hidden="true"/><strong>{caption}</strong>{count!==undefined&&count>0&&<span className="action-tile-count">{count}</span>}</Link>)}</section>;}

import {Children,cloneElement,isValidElement,useLayoutEffect,useRef,type ReactNode} from 'react';
function cells(children:ReactNode):ReactNode{return Children.map(children,node=>{if(!isValidElement<{children?:ReactNode}>(node))return node;if(node.type==='td')return cloneElement(node,{},<span className="mobile-cell-content">{node.props.children}</span>);if(['tr','tbody','thead','tfoot'].includes(String(node.type)))return cloneElement(node,{},cells(node.props.children));return node;});}
/** Preserve real table headers on desktop; label each card field on phones. */
export function ResponsiveTable({children}:{children:ReactNode}){
 const ref=useRef<HTMLTableElement>(null);
 useLayoutEffect(()=>{const table=ref.current;if(!table)return;const headers=Array.from(table.querySelectorAll('thead th')).map(h=>h.textContent?.trim()??'');table.querySelectorAll('tbody tr').forEach(row=>Array.from(row.children).forEach((cell,index)=>{if(cell.tagName==='TD')cell.setAttribute('data-label',headers[index]??'');}));});
 return <table ref={ref} className="responsive-table">{cells(children)}</table>;
}

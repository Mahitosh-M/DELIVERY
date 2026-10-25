import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';
/** Keep an editable draft so numeric model coercion cannot put a deleted zero back. */
export function NumberInput({value,onChange,onWheelCapture,className='',type='number',...props}:InputHTMLAttributes<HTMLInputElement>){
 const [draft,setDraft]=useState(String(value??''));
 const edited=useRef<string|null>(null);
 useEffect(()=>{const next=String(value??'');if(edited.current!==null&&(next===edited.current||(typeof value==='number'&&Number(edited.current)===value))){edited.current=null;return;}edited.current=null;setDraft(next);},[value]);
 return <input {...props} type={type} className={`number-input ${className}`} value={draft} onChange={event=>{edited.current=event.target.value;setDraft(event.target.value);onChange?.(event);}} onWheelCapture={event=>{if(type==='number'&&document.activeElement===event.currentTarget)event.currentTarget.blur();onWheelCapture?.(event);}}/>;
}

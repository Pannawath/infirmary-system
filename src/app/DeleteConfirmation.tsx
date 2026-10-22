'use client';
import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Trash2} from 'lucide-react';

export default function DeleteConfirmation({title,description,busy,error,onCancel,onConfirm,children}:{title:string;description:string;busy:boolean;error?:string;onCancel:()=>void;onConfirm:()=>void;children?:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);const cancel=useRef<HTMLButtonElement>(null);const titleId=useId(),descriptionId=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const element=dialog.current;element?.showModal();cancel.current?.focus();return()=>{element?.close();previous?.focus()}},[]);
 return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();if(!busy)onCancel()}} className="delete-confirm-card">
  <div className="delete-confirm-icon"><Trash2 size={25}/></div>
  <p className="mb-2 text-xs font-bold tracking-wide text-rose-600">ยืนยันการลบ</p>
  <h2 id={titleId} className="text-xl font-bold text-slate-900">{title}</h2>
  <p id={descriptionId} className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-500">{description}</p>
  {children&&<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{children}</div>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  <div className="mt-6 grid grid-cols-2 gap-3"><button ref={cancel} type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">ยกเลิก</button><button type="button" disabled={busy} onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50">{busy?'กำลังลบ…':'ยืนยันลบ'}</button></div>
 </dialog>,document.body);
}

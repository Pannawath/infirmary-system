'use client';
import {useEffect,useState} from 'react';
import {Minus,Square,X} from 'lucide-react';
import {isTauri} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {watchWindowExpanded} from '@/lib/desktop-window-state';

export default function DesktopControls(){
 const [desktop,setDesktop]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{
  const active=isTauri();setDesktop(active);
  if(!active)return;
  document.documentElement.dataset.desktop='true';
  const stop=watchWindowExpanded(getCurrentWindow(),expanded=>{document.documentElement.dataset.windowExpanded=String(expanded)});
  return()=>{stop();delete document.documentElement.dataset.desktop;delete document.documentElement.dataset.windowExpanded};
 },[]);
 if(!desktop)return null;
 const action=async(type:'minimize'|'maximize'|'close')=>{try{setError('');const win=getCurrentWindow();if(type==='minimize')await win.minimize();else if(type==='maximize')await win.toggleMaximize();else await win.close()}catch{setError('ควบคุมหน้าต่างไม่สำเร็จ กรุณาลองใหม่')}};
 return <div className="desktop-window-controls" aria-label="ควบคุมหน้าต่างแอป">{error&&<span role="alert" className="desktop-window-error">{error}</span>}<button type="button" className="window-dot window-minimize" aria-label="ย่อหน้าต่าง" title="ย่อหน้าต่าง" onClick={()=>action('minimize')}><Minus size={10}/></button><button type="button" className="window-dot window-maximize" aria-label="ขยายหรือคืนขนาดหน้าต่าง" title="ขยาย / คืนขนาด" onClick={()=>action('maximize')}><Square size={8}/></button><button type="button" className="window-dot window-close" aria-label="ปิดแอป" title="ปิดแอป" onClick={()=>action('close')}><X size={10}/></button></div>;
}

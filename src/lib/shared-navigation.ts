'use client';
import {useRef} from 'react';
import {flushSync} from 'react-dom';
type Transition={ready:Promise<void>;finished:Promise<void>};
type MotionDocument=Document&{startViewTransition?:(update:()=>void)=>Transition};
/** Shared dashboard cards become pages; other pages use a restrained window transition. */
export function useSharedNavigation<T extends string>(tab:T,setTab:(tab:T)=>void,closeMenu:()=>void){
 const scroll=useRef<Record<string,number>>({}),origin=useRef(''),running=useRef(false);
 return (next:T,card?:string)=>{
  if(running.current)return;
  if(next===tab){closeMenu();window.dispatchEvent(new Event('workspace-enter'));return}
  scroll.current[tab]=window.scrollY;
  if(card)origin.current=card;
  else if(next!=='dashboard')origin.current=({records:'calendar',inventory:'stock',students:'metric-3',dispense:'service',reports:'term'} as Record<string,string>)[next]||'';
  const page=()=>document.querySelector<HTMLElement>('[data-page-surface]');
  const findCard=()=>origin.current?document.querySelector<HTMLElement>(`[data-shared-panel="${origin.current}"]`):null;
  const update=()=>{flushSync(()=>{setTab(next);closeMenu()});window.scrollTo({top:scroll.current[next]||0,behavior:'instant' as ScrollBehavior})};
  const doc=document as MotionDocument;
  if(!doc.startViewTransition||window.matchMedia('(prefers-reduced-motion: reduce)').matches){update();return}
  window.dispatchEvent(new Event('workspace-settle'));
  const source=(tab==='dashboard'?findCard():page())||page();
  source?.style.setProperty('view-transition-name','workspace-panel');
  running.current=true;doc.documentElement.dataset.sharedMotion='active';
  if(tab!=='dashboard'&&next!=='dashboard')doc.documentElement.dataset.windowMotion='true';
  const cleanup=()=>{source?.style.removeProperty('view-transition-name');doc.querySelectorAll<HTMLElement>('[data-page-surface],[data-shared-panel]').forEach(el=>el.style.removeProperty('view-transition-name'));delete doc.documentElement.dataset.sharedMotion;delete doc.documentElement.dataset.windowMotion;running.current=false;const target=page();if(target)target.dataset.morphArrival='true';window.dispatchEvent(new Event('workspace-enter'))};
  try{const transition=doc.startViewTransition(()=>{update();const target=(next==='dashboard'?findCard():page())||page();target?.style.setProperty('view-transition-name','workspace-panel')});transition.ready.catch(()=>{});transition.finished.then(cleanup,cleanup)}catch{cleanup();update()}
 };
}

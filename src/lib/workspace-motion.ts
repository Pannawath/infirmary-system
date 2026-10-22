'use client';
import {useEffect} from 'react';
const blocks:Record<string,string>={
 dashboard:'.dashboard-welcome,.dashboard-metric,.dashboard-activity,.dashboard-stock,.dashboard-calendar,.dashboard-action-panel,.dashboard-term-card,.dashboard-recent',
 dispense:'.service-desk-toolbar,.service-flow,.service-panel',
 students:'.workspace-heading,.student-grade-nav,.student-directory',
 inventory:'.inventory-heading,.inventory-metrics>div,.inventory-catalog',
 records:'.workspace-heading,.history-view-toolbar,.history-month-panel,.history-detail-rail,.history-search-filters,.history-result-count',
 reports:'.workspace-heading,.reports-step-label,.reports-controls>section,.teacher-report',
};
const additions='[role="dialog"],.history-day-details,.history-month-panel,.history-search-filters,.history-result-count,.reports-controls>section:not(.reports-filter-panel),.teacher-report,.workspace-feedback,.service-desk>[role="status"],.service-cart-line,.service-student-profile,.service-other-symptoms';
const PANEL_DURATION=280;
/** All visible panels and graphs start together, without zoom or nested row motion. */
export function useWorkspaceMotion(tab:string){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('[data-page-surface]');if(!root)return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let played=new WeakSet<Element>();let revealEnds=new WeakMap<Element,number>();const animations=new Set<Animation>();
  const motionAllowed=()=>!preference.matches&&document.visibilityState!=='hidden'&&!document.documentElement.dataset.sharedMotion;
  const animate=(el:Element,frames:Keyframe[],delay:number,duration=PANEL_DURATION)=>{
   if(typeof el.animate!=='function')return;
   const animation=el.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.65,.3,1)',fill:'backwards'});animations.add(animation);animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
  };
  const visualOrder=(elements:NodeListOf<Element>)=>Array.from(elements).map(el=>({el,rect:el.getBoundingClientRect()})).filter(x=>x.rect.width>0&&x.rect.height>0).sort((a,b)=>Math.abs(a.rect.top-b.rect.top)>8?a.rect.top-b.rect.top:a.rect.left-b.rect.left).map(x=>x.el);
  const reveal=(el:Element)=>{played.add(el);revealEnds.set(el,performance.now()+PANEL_DURATION);animate(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0px)'}],0)};
  const parentEnd=(el:Element)=>{let node=el.parentElement;while(node){const end=revealEnds.get(node);if(end)return Math.max(0,end-performance.now());node=node.parentElement}return 0};
  const graphs=()=>{
   if(!motionAllowed())return;
   root.querySelectorAll('.dashboard-chart-bar,.dashboard-trend-line polyline,.stock-ring-value,.inventory-stock-meter>div').forEach(el=>{
    if(played.has(el))return;played.add(el);
    const delay=0;
    if(el.matches('polyline'))animate(el,[{strokeDashoffset:'1',opacity:.25},{strokeDashoffset:'0',opacity:1}],delay,900);
    else if(el.matches('.stock-ring-value'))animate(el,[{strokeDashoffset:'100',opacity:.3},{strokeDashoffset:'0',opacity:1}],delay,700);
    else animate(el,[{transform:el.matches('.dashboard-chart-bar')?'scaleY(0)':'scaleX(0)',opacity:.3},{transform:'none',opacity:1}],delay,650);
   });
  };
  const entrance=()=>{
   if(!motionAllowed())return;
   animations.forEach(a=>a.cancel());animations.clear();played=new WeakSet();revealEnds=new WeakMap();
   if(root.dataset.morphArrival==='true'){
    delete root.dataset.morphArrival;
    // The window snapshot already reveals everything. Do not fade it out a second time.
    root.querySelectorAll((blocks[tab]||'.workspace-panel')+','+additions+',.dashboard-chart-bar,.dashboard-trend-line polyline,.stock-ring-value,.inventory-stock-meter>div').forEach(el=>played.add(el));
    return;
   }
   visualOrder(root.querySelectorAll(blocks[tab]||'.workspace-panel')).forEach(el=>reveal(el));
   graphs();
  };
  const observer=new MutationObserver(()=>{
   if(!motionAllowed())return;
   visualOrder(root.querySelectorAll(additions)).forEach(el=>{if(played.has(el))return;played.add(el);if(parentEnd(el)>0)return;reveal(el)});
   graphs();
  });
  observer.observe(root,{childList:true,subtree:true});entrance();
  const changed=()=>{if(preference.matches){animations.forEach(a=>a.cancel());animations.clear()}};
  const settle=()=>{animations.forEach(a=>a.cancel());animations.clear()};
  window.addEventListener('workspace-enter',entrance);window.addEventListener('workspace-settle',settle);preference.addEventListener('change',changed);
  return()=>{observer.disconnect();window.removeEventListener('workspace-enter',entrance);window.removeEventListener('workspace-settle',settle);preference.removeEventListener('change',changed);settle()};
 },[tab]);
}

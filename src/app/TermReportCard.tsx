'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,ArrowUpRight,FileBarChart} from 'lucide-react';
type Term={id:string;academicYear:number;termNumber:number;startDate:string;endDate:string};
const localDate=(value:string)=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
const dateLabel=(value:string)=>new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'});
export default function TermReportCard({onOpen}:{onOpen:()=>void}){
 const [terms,setTerms]=useState<Term[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError(false);fetch('/api/terms',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setTerms(await r.json())}).catch(()=>{if(!c.signal.aborted)setError(true)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort()},[retry]);
 const today=localDate(new Date().toISOString());
 const current=terms.find(t=>localDate(t.startDate)<=today&&localDate(t.endDate)>=today);
 const start=current?Date.parse(localDate(current.startDate)):0,end=current?Date.parse(localDate(current.endDate)):0;
 const duration=current?Math.round((end-start)/86400000)+1:0,elapsed=current?Math.round((Date.parse(today)-start)/86400000)+1:0;
 const progress=duration?Math.min(100,Math.round(elapsed/duration*100)):0;
 return <section data-shared-panel="term" className="dashboard-panel dashboard-term-card"><div className="dashboard-term-heading"><span><CalendarDays size={15}/></span><div><h2>ภาคเรียนและรายงาน</h2><p>{loading?'กำลังโหลดภาคเรียน…':error?'โหลดข้อมูลไม่สำเร็จ':current?`ปีการศึกษา ${current.academicYear} · ภาคเรียน ${current.termNumber}`:terms.length?'อยู่นอกช่วงภาคเรียนที่ตั้งไว้':'ยังไม่ได้ตั้งค่าภาคเรียน'}</p></div><FileBarChart size={19} className="dashboard-term-mark"/></div>{current&&!loading&&!error?<div className="dashboard-term-progress"><div><span>{dateLabel(current.startDate)} – {dateLabel(current.endDate)}</span><b>{progress}%</b></div><div role="progressbar" aria-label="ระยะเวลาภาคเรียนที่ผ่านไป" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{width:progress+'%'}}/></div></div>:!loading&&!error?<p className="dashboard-term-helper">{terms.length?'เลือกดูสรุปบริการย้อนหลังแยกแต่ละเทอม':'กำหนดวันเปิด–ปิดเทอม เพื่อสรุปบริการส่งครู'}</p>:null}<button onClick={error?()=>setRetry(n=>n+1):onOpen} className="dashboard-term-link">{error?'ลองโหลดใหม่':current||terms.length?'เปิดรายงาน · Excel / PDF':'ตั้งค่าภาคเรียน'}<ArrowUpRight size={14}/></button></section>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Users, Pill, Stethoscope, Bed, HeartPulse, Check, X, Plus, Minus, Trash2, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

type Medicine = { id:string; name:string; category:string; unit:string; stockQuantity:number; minThreshold:number; indications:string|null };
type Student = { id:string; fullName:string; studentCode:string; gradeLevel:string; classroom:string; allergies:string|null; chronicDiseases?:string|null };
type Line = { med:Medicine; quantity:number; instructions:string };
const services = [ {id:'DISPENSE',label:'จ่ายยา',hint:'บันทึกและตัดสต็อกยา',Icon:Pill}, {id:'WOUND_CARE',label:'ทำแผล',hint:'บันทึกการดูแลบาดแผล',Icon:HeartPulse}, {id:'REST',label:'นอนพัก',hint:'บันทึกอาการและการพัก',Icon:Bed} ];
const symptomOptions=['มีไข้','ปวดศีรษะ','ไอ / เจ็บคอ','ปวดท้อง','เวียนศีรษะ','คลื่นไส้','แผล / ฟกช้ำ','อื่น ๆ'];
const inputClass='w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white';

export default function ServiceWorkspace({meds}:{meds:Medicine[]}) {
  const [service,setService]=useState('DISPENSE');
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Student[]>([]);
  const [student,setStudent]=useState<Student|null>(null);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState('');
  const [showResults,setShowResults]=useState(false);
  const [symptoms,setSymptoms]=useState<string[]>([]);
  const [other,setOther]=useState('');
  const [notes,setNotes]=useState('');
  const [medicineQuery,setMedicineQuery]=useState('');
  const [filter,setFilter]=useState('available');
  const [cart,setCart]=useState<Line[]>([]);
  const [stock,setStock]=useState(meds);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const lock=useRef(false);
  const searchBox=useRef<HTMLDivElement>(null);
  useEffect(()=>setStock(meds),[meds]);
  useEffect(()=>{if(!student){setSymptoms([]);setOther('');setNotes('');setCart([])}},[student]);
  useEffect(()=>{const close=(e:MouseEvent)=>{if(!searchBox.current?.contains(e.target as Node))setShowResults(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
  useEffect(()=>{
    if(!query.trim()||student){setResults([]);setSearching(false);return}
    const controller=new AbortController();setSearching(true);setSearchError('');setResults([]);
    const timer=setTimeout(async()=>{try{const r=await fetch(`/api/students?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});if(!r.ok)throw Error();setResults(await r.json())}catch{if(!controller.signal.aborted)setSearchError('ค้นหาไม่สำเร็จ กรุณาลองใหม่')}finally{if(!controller.signal.aborted)setSearching(false)}},200);
    return()=>{clearTimeout(timer);controller.abort()};
  },[query,student]);
  const symptomText=[...symptoms.filter(s=>s!=='อื่น ๆ'),...(symptoms.includes('อื่น ๆ')&&other.trim()?[other.trim()]:[])].join(', ');
  const symptomsReady=!!symptomText&&(!symptoms.includes('อื่น ๆ')||!!other.trim());
  const canChooseMedicine=!!student&&symptomsReady;
  const canReview=canChooseMedicine&&(service!=='DISPENSE'||cart.length>0);
  const ready=!!student&&symptomsReady&&(service!=='DISPENSE'||cart.length>0)&&cart.every(l=>l.quantity>0&&Number.isInteger(l.quantity)&&l.quantity<=l.med.stockQuantity);
  const missing=!student?'เลือกนักเรียนจากผลการค้นหา':!symptomsReady?'ระบุอาการให้ครบ':service==='DISPENSE'&&!cart.length?'เลือกยาอย่างน้อย 1 รายการ':!ready?'ตรวจสอบจำนวนยา':'';
  const activeService=services.find(s=>s.id===service)!;
  const visible=stock.filter(m=>`${m.name} ${m.category}`.toLowerCase().includes(medicineQuery.trim().toLowerCase())&&(filter==='all'||(filter==='selected'?cart.some(l=>l.med.id===m.id):m.stockQuantity>0)));
  const toggle=(value:string)=>setSymptoms(current=>current.includes(value)?current.filter(s=>s!==value):[...current,value]);
  const add=(med:Medicine)=>{if(med.stockQuantity<1)return;setCart(current=>{const found=current.find(l=>l.med.id===med.id);return found?current.map(l=>l.med.id===med.id?{...l,quantity:Math.min(med.stockQuantity,l.quantity+1)}:l):[...current,{med,quantity:1,instructions:''}]})};
  const quantity=(id:string,delta:number)=>setCart(current=>current.map(l=>l.med.id===id?{...l,quantity:Math.max(1,Math.min(l.med.stockQuantity,l.quantity+delta))}:l));
  const save=async()=>{
    if(!ready||!student||lock.current)return;
    lock.current=true;setSaving(true);setError('');setMessage('');
    try{
      const response=await fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:student.id,serviceType:service,symptoms:symptomText,treatmentNotes:notes,dispensedMedicines:cart.map(l=>({medicationId:l.med.id,quantity:l.quantity,instructions:l.instructions}))})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'บันทึกไม่สำเร็จ');
      setStock(current=>current.map(m=>{const line=cart.find(l=>l.med.id===m.id);return line?{...m,stockQuantity:m.stockQuantity-line.quantity}:m}));
      setMessage(`บันทึก${activeService.label}ให้ ${student.fullName} เรียบร้อยแล้ว`);
      setStudent(null);setQuery('');setSymptoms([]);setOther('');setNotes('');setCart([]);setShowResults(false);
      window.dispatchEvent(new Event('infirmary-data-changed'));
    }catch(e){setError(e instanceof Error?e.message:'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง')}
    finally{setSaving(false);lock.current=false}
  };
  return <div className="service-desk">
    <div className="service-desk-toolbar"><div className="flex flex-wrap gap-1.5" role="group" aria-label="ประเภทบริการ">{services.map(({id,label,Icon})=><button key={id} disabled={saving} aria-pressed={service===id} onClick={()=>{setService(id);setError('')}} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${service===id?'bg-blue-600 text-white shadow-sm':'bg-white text-slate-500 hover:bg-blue-50'}`}><Icon size={17}/>{label}</button>)}</div><span className="hidden text-xs text-slate-500 sm:block">{activeService.hint}</span></div>
    {message&&<div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={18}/><span className="flex-1">{message}</span><button onClick={()=>setMessage('')} aria-label="ปิดข้อความ"><X size={16}/></button></div>}
    <div className="service-desk-grid">
      <section className="service-panel service-patient">
        <div className="service-panel-heading"><div><span className="service-eyebrow">01 · ผู้รับบริการ</span><h2>นักเรียนและอาการ</h2></div><Users size={20} className="text-blue-500"/></div>
        <div className="service-panel-scroll space-y-5">
          <div ref={searchBox} className="relative"><label htmlFor="student-search" className="mb-2 block text-xs font-semibold text-slate-600">ค้นหานักเรียน</label><div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={17} className="shrink-0 text-slate-400"/><input id="student-search" value={query} disabled={saving} onFocus={()=>setShowResults(true)} onKeyDown={e=>{if(e.key==='Escape')setShowResults(false)}} onChange={e=>{setQuery(e.target.value);setStudent(null);setShowResults(true)}} placeholder="ชื่อ หรือรหัสนักเรียน" autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"/>{query&&<button disabled={saving} onClick={()=>{setQuery('');setStudent(null)}} aria-label="ล้างนักเรียน" className="p-1 text-slate-400"><X size={15}/></button>}</div>
          {showResults&&!student&&query.trim()&&<div className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{searching?<p className="p-3 text-xs text-slate-500">กำลังค้นหา…</p>:searchError?<p role="alert" className="p-3 text-xs text-rose-600">{searchError}</p>:results.length?results.map(s=><button key={s.id} onClick={()=>{setStudent(s);setQuery(s.fullName);setShowResults(false)}} className="w-full rounded-lg p-2.5 text-left hover:bg-blue-50"><p className="text-sm font-semibold">{s.fullName}</p><p className="text-xs text-slate-500">{s.studentCode} · {s.gradeLevel}/{s.classroom}{s.allergies&&s.allergies!=='ไม่มี'?' · มีประวัติแพ้':''}</p></button>):<p className="p-3 text-xs text-slate-500">ไม่พบรายชื่อ ลองชื่อหรือรหัสอื่น</p>}</div>}</div>
          {student?<div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><p className="text-sm font-bold">{student.fullName}</p><p className="mt-1 text-xs text-slate-500">รหัส {student.studentCode} · {student.gradeLevel}/{student.classroom}</p><div className={`mt-3 rounded-lg p-2.5 text-xs ${student.allergies&&student.allergies!=='ไม่มี'?'bg-rose-50 text-rose-800':'bg-white text-slate-500'}`}><p className="flex items-center gap-1.5 font-bold"><ShieldAlert size={14}/>ประวัติการแพ้</p><p className="mt-1 whitespace-pre-wrap">{student.allergies||'ยังไม่ระบุข้อมูล กรุณาตรวจสอบกับนักเรียน'}</p></div>{student.chronicDiseases&&student.chronicDiseases!=='ไม่มี'&&<p className="mt-2 text-xs text-slate-600">โรคประจำตัว: {student.chronicDiseases}</p>}</div>:<p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">เลือกนักเรียนจากรายชื่อที่ปรากฏใต้ช่องค้นหา</p>}
          <fieldset disabled={!student||saving} className={!student?'service-locked rounded-xl p-3':'min-w-0'} aria-label="อาการและการดูแล"><div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">อาการเบื้องต้น</h3><span className="text-[11px] text-slate-400">{student?'เลือกได้หลายข้อ':'เลือกนักเรียนก่อน'}</span></div><div className="grid grid-cols-2 gap-2">{symptomOptions.map(s=><button key={s} disabled={saving} aria-pressed={symptoms.includes(s)} onClick={()=>toggle(s)} className={`flex min-h-10 items-center justify-between gap-1 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${symptoms.includes(s)?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}>{s}{symptoms.includes(s)&&<Check size={14} className="shrink-0"/>}</button>)}</div>{symptoms.includes('อื่น ๆ')&&<textarea aria-label="อาการอื่น ๆ" value={other} onChange={e=>setOther(e.target.value)} className={`${inputClass} mt-2 h-20`} placeholder="ระบุอาการอื่น ๆ"/>}</div>
          <label className="block text-xs font-semibold text-slate-600">{service==='WOUND_CARE'?'รายละเอียดการทำแผล':service==='REST'?'รายละเอียดการนอนพัก':'หมายเหตุการดูแล'}<textarea value={notes} onChange={e=>setNotes(e.target.value)} className={`${inputClass} mt-2 h-20 resize-none font-normal`} placeholder={service==='REST'?'เช่น เริ่มพัก 10:00 น. อาการหลังพัก…':service==='WOUND_CARE'?'เช่น ตำแหน่งบาดแผลและการดูแลที่ให้…':'บันทึกเพิ่มเติม (ถ้ามี)'}/></label>
          </fieldset>
        </div>
      </section>
      <fieldset disabled={!canChooseMedicine||saving} className={`service-panel service-catalog ${!canChooseMedicine?'service-locked':''}`} aria-label="เลือกยา">
        {!canChooseMedicine&&<p className="mx-4 mt-4 rounded-lg bg-slate-200/60 p-2.5 text-xs text-slate-500">{!student?'เลือกนักเรียนและระบุอาการก่อน':'ระบุอาการให้ครบเพื่อปลดล็อกการเลือกยา'}</p>}
        <div className="service-panel-heading"><div><span className="service-eyebrow">02 · รายการยา</span><h2>{service==='DISPENSE'?'เลือกยาที่ต้องการจ่าย':'ยาและเวชภัณฑ์เพิ่มเติม'}</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{stock.length}</span></div>
        <div className="border-b border-slate-100 px-4 pb-3"><div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3"><Search size={17} className="text-slate-400"/><input aria-label="ค้นหายา" value={medicineQuery} onChange={e=>setMedicineQuery(e.target.value)} placeholder="ค้นหาชื่อยา หรือหมวดหมู่" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"/></div><div className="flex flex-wrap gap-1.5">{[['available','มีสต็อก'],['all','ทั้งหมด'],['selected',`เลือกแล้ว ${cart.length}`]].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter===id?'bg-blue-50 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}>{label}</button>)}</div></div>
        <div className="service-panel-scroll">{service!=='DISPENSE'&&<p className="mb-3 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700">ไม่จ่ายยาก็บันทึกบริการนี้ได้</p>}<div className="space-y-2">{visible.map(m=>{const line=cart.find(l=>l.med.id===m.id);return <button key={m.id} disabled={m.stockQuantity<1||saving||!!line&&line.quantity>=m.stockQuantity} onClick={()=>add(m)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 ${line?'border-blue-300 bg-blue-50/50':'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${line?'bg-blue-600 text-white':'bg-slate-100 text-slate-400'}`}>{line?<Check size={18}/>:<Pill size={18}/>}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-relaxed">{m.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{m.category}</p><p className={`mt-1 text-xs ${m.stockQuantity<=m.minThreshold?'text-amber-700':'text-slate-500'}`}>คงเหลือ {m.stockQuantity} {m.unit}{m.stockQuantity===0?' · หมด':m.stockQuantity<=m.minThreshold?' · ใกล้หมด':''}</p></div><span className="mt-1 shrink-0 text-blue-600">{line?<b className="text-xs">{line.quantity}</b>:<Plus size={17}/>}</span></button>})}</div>{!visible.length&&<p className="py-10 text-center text-sm text-slate-400">ไม่พบรายการยาในตัวกรองนี้</p>}</div>
      </fieldset>
      <fieldset disabled={!canReview||saving} className={`service-panel service-review ${!canReview?'service-locked':''}`} aria-label="ตรวจสอบและบันทึก">
        {!canReview&&<p className="mx-4 mt-4 rounded-lg bg-slate-200/60 p-2.5 text-xs text-slate-500">{missing} เพื่อปลดล็อกการตรวจสอบ</p>}
        <div className="service-panel-heading"><div><span className="service-eyebrow">03 · ตรวจสอบ</span><h2>สรุปก่อนบันทึก</h2></div><CheckCircle2 size={20} className="text-blue-500"/></div>
        <div className="service-panel-scroll"><div className="mb-4 rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold text-blue-600">{activeService.label}</p><p className="mt-1 text-sm font-bold">{student?.fullName||'ยังไม่ได้เลือกนักเรียน'}</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{symptomText||'ยังไม่ได้ระบุอาการ'}</p></div><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-600">รายการที่เลือก</h3><span className="text-xs text-slate-400">{cart.length} รายการ</span></div>{!cart.length?<div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center"><Pill size={22} className="mx-auto mb-2 text-slate-300"/><p className="text-xs text-slate-400">{service==='DISPENSE'?'เลือกยาจากรายการตรงกลาง':'บริการนี้ยังไม่มีการจ่ายยา'}</p></div>:<div className="space-y-3">{cart.map(l=><div key={l.med.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start gap-2"><p className="flex-1 text-xs font-bold leading-relaxed">{l.med.name}</p><button disabled={saving} onClick={()=>setCart(current=>current.filter(i=>i.med.id!==l.med.id))} aria-label={`ลบ ${l.med.name}`} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button></div><div className="my-2 flex items-center justify-between"><span className="text-xs text-slate-400">จำนวน ({l.med.unit})</span><div className="flex items-center rounded-lg border border-slate-200"><button aria-label={`ลดจำนวน ${l.med.name}`} disabled={saving||l.quantity<=1} onClick={()=>quantity(l.med.id,-1)} className="p-2 disabled:opacity-30"><Minus size={13}/></button><span className="w-7 text-center text-sm font-bold">{l.quantity}</span><button aria-label={`เพิ่มจำนวน ${l.med.name}`} disabled={saving||l.quantity>=l.med.stockQuantity} onClick={()=>quantity(l.med.id,1)} className="p-2 disabled:opacity-30"><Plus size={13}/></button></div></div><input aria-label={`คำแนะนำ ${l.med.name}`} value={l.instructions} onChange={e=>setCart(current=>current.map(i=>i.med.id===l.med.id?{...i,instructions:e.target.value}:i))} placeholder="คำแนะนำการใช้ (ถ้ามี)" className="w-full rounded-lg bg-slate-50 px-2.5 py-2 text-xs outline-none"/></div>)}</div>}</div>
        <div className="service-save-bar">{error&&<p role="alert" className="mb-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}<p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">{ready?<><CheckCircle2 size={14} className="text-emerald-500"/>ข้อมูลครบ พร้อมบันทึก</>:missing}</p><button onClick={save} disabled={!ready||saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{saving?'กำลังบันทึก…':'บันทึกบริการ'}{!saving&&<ArrowRight size={16}/>}</button><p className="mt-2 text-center text-[10px] text-slate-400">บันทึกประวัติและตัดสต็อกพร้อมกัน</p></div>
      </fieldset>
    </div>
  </div>;
}

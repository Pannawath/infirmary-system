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
  const [category,setCategory]=useState('');
  const [activeResult,setActiveResult]=useState(-1);
  const [cart,setCart]=useState<Line[]>([]);
  const [stock,setStock]=useState(meds);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [attempted,setAttempted]=useState(false);
  const lock=useRef(false);
  const searchBox=useRef<HTMLDivElement>(null);
  useEffect(()=>{setStock(meds);setCart(current=>current.map(line=>({...line,med:meds.find(m=>m.id===line.med.id)||line.med})))},[meds]);
  useEffect(()=>{const close=(e:MouseEvent)=>{if(!searchBox.current?.contains(e.target as Node))setShowResults(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
  useEffect(()=>{
    if(!query.trim()||student){setResults([]);setSearching(false);return}
    const controller=new AbortController();setSearching(true);setSearchError('');setResults([]);
    const timer=setTimeout(async()=>{try{const r=await fetch(`/api/students?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});if(!r.ok)throw Error();setResults((await r.json()).slice(0,10));setActiveResult(-1)}catch{if(!controller.signal.aborted)setSearchError('ค้นหาไม่สำเร็จ กรุณาลองใหม่')}finally{if(!controller.signal.aborted)setSearching(false)}},200);
    return()=>{clearTimeout(timer);controller.abort()};
  },[query,student]);
  useEffect(()=>{if(showResults&&activeResult>=0&&results[activeResult])document.getElementById(`student-result-${results[activeResult].id}`)?.scrollIntoView({block:'nearest'})},[activeResult,showResults,results]);
  const symptomText=[...symptoms.filter(s=>s!=='อื่น ๆ'),...(symptoms.includes('อื่น ๆ')&&other.trim()?[other.trim()]:[])].join(', ');
  const symptomsReady=!!symptomText&&(!symptoms.includes('อื่น ๆ')||!!other.trim());
  const ready=!!student&&symptomsReady&&(service!=='DISPENSE'||cart.length>0)&&cart.every(l=>l.quantity>0&&Number.isInteger(l.quantity)&&l.quantity<=l.med.stockQuantity);
  const missing=[!student?'เลือกนักเรียนจากผลการค้นหา':'',!symptomsReady?'ระบุอาการให้ครบ':'',service==='DISPENSE'&&!cart.length?'เลือกยาอย่างน้อย 1 รายการ':'',cart.some(l=>!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>l.med.stockQuantity)?'ตรวจสอบจำนวนยา':''].filter(Boolean).join(' · ');
  const activeService=services.find(s=>s.id===service)!;
  const visible=stock.filter(m=>`${m.name} ${m.category}`.toLowerCase().includes(medicineQuery.trim().toLowerCase())&&(!category||m.category===category)&&(filter==='all'||(filter==='selected'?cart.some(l=>l.med.id===m.id):m.stockQuantity>0)));
  const toggle=(value:string)=>setSymptoms(current=>current.includes(value)?current.filter(s=>s!==value):[...current,value]);
  const add=(med:Medicine)=>{if(med.stockQuantity<1)return;setCart(current=>{const found=current.find(l=>l.med.id===med.id);return found?current.map(l=>l.med.id===med.id?{...l,quantity:Math.min(med.stockQuantity,l.quantity+1)}:l):[...current,{med,quantity:1,instructions:''}]})};
  const quantity=(id:string,delta:number)=>setCart(current=>current.map(l=>l.med.id===id?{...l,quantity:Math.max(1,Math.min(l.med.stockQuantity,l.quantity+delta))}:l));
  const save=async()=>{
    if(lock.current)return;
    if(!ready||!student){setAttempted(true);setError(`ยังบันทึกไม่ได้: ${missing}`);const target=!student?'student-search':!symptomsReady?'service-symptoms':service==='DISPENSE'&&!cart.length?'service-catalog':'service-cart';const element=document.getElementById(target);element?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});element?.focus({preventScroll:true});return;}
    lock.current=true;setSaving(true);setError('');setMessage('');
    try{
      const response=await fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:student.id,serviceType:service,symptoms:symptomText,treatmentNotes:notes,dispensedMedicines:cart.map(l=>({medicationId:l.med.id,quantity:l.quantity,instructions:l.instructions}))})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'บันทึกไม่สำเร็จ');
      setStock(current=>current.map(m=>{const line=cart.find(l=>l.med.id===m.id);return line?{...m,stockQuantity:m.stockQuantity-line.quantity}:m}));
      setMessage(`บันทึก${activeService.label}ให้ ${student.fullName} เรียบร้อยแล้ว`);
      setAttempted(false);setStudent(null);setQuery('');setSymptoms([]);setOther('');setNotes('');setCart([]);setShowResults(false);setFilter('available');setCategory('');setMedicineQuery('');
      window.dispatchEvent(new Event('infirmary-data-changed'));
    }catch(e){setError(e instanceof Error?e.message:'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง')}
    finally{setSaving(false);lock.current=false}
  };

  const chooseStudent=(s:Student)=>{setStudent(s);setQuery(s.fullName);setShowResults(false);setActiveResult(-1)};
  const categories=Array.from(new Set(stock.map(m=>m.category))).sort((a,b)=>a.localeCompare(b,'th'));
  const setExactQuantity=(id:string,value:string)=>setCart(current=>current.map(l=>l.med.id===id?{...l,quantity:Number(value)}:l));
  return <div className="service-desk workspace-service service-studio">
    <div className="service-desk-toolbar">
      <div className="service-type-tabs" role="group" aria-label="ประเภทบริการ">{services.map(({id,label,hint,Icon})=><button type="button" key={id} disabled={saving} aria-pressed={service===id} onClick={()=>{setService(id);setError('')}} className={service===id?'is-active':''}><span><Icon size={19}/></span><div><b>{label}</b><small>{hint}</small></div>{service===id&&<Check size={14}/>}</button>)}</div>
      <div className="service-session-state"><i/>{ready?'พร้อมบันทึก':student?'กำลังทำรายการ':'รายการใหม่'}</div>
    </div>
    {message&&<div role="status" className="service-success"><CheckCircle2 size={18}/><span>{message}</span><button type="button" onClick={()=>setMessage('')} aria-label="ปิดข้อความ"><X size={16}/></button></div>}
    <div className="service-desk-grid">
      <section className="service-panel service-patient">
        <div className="service-panel-heading"><div><span className="service-eyebrow">01 · ผู้รับบริการ</span><h2>นักเรียนและอาการ</h2></div><Users size={18}/></div>
        <div className="service-panel-scroll">
          <div ref={searchBox} className={`service-student-search ${attempted&&!student?'service-invalid':''}`}>
            <label htmlFor="student-search">ค้นหานักเรียน</label>
            <div className="service-search-input"><Search size={17}/><input id="student-search" aria-invalid={attempted&&!student} aria-describedby={attempted&&!student?'student-required':undefined} role="combobox" aria-autocomplete="list" aria-expanded={showResults&&!student&&!!query.trim()} aria-controls="service-student-results" aria-activedescendant={showResults&&!student&&activeResult>=0&&results[activeResult]?`student-result-${results[activeResult].id}`:undefined} value={query} disabled={saving} onFocus={()=>setShowResults(true)} onKeyDown={e=>{if(e.key==='Escape')setShowResults(false);if(!student&&showResults&&results.length){if(e.key==='ArrowDown'){e.preventDefault();setActiveResult(i=>Math.min(results.length-1,i+1))}if(e.key==='ArrowUp'){e.preventDefault();setActiveResult(i=>Math.max(0,i-1))}if(e.key==='Enter'&&activeResult>=0){e.preventDefault();chooseStudent(results[activeResult])}}}} onChange={e=>{setQuery(e.target.value);setStudent(null);setShowResults(true);setActiveResult(-1)}} placeholder="ชื่อ หรือรหัสนักเรียน" autoComplete="off"/>{query&&<button type="button" disabled={saving} onClick={()=>{setQuery('');setStudent(null);setActiveResult(-1)}} aria-label="ล้างนักเรียน"><X size={15}/></button>}</div>
            {showResults&&!student&&query.trim()&&<div id="service-student-results" role="listbox" aria-label="ผลการค้นหานักเรียน" className="service-search-results">{searching?<p role="status">กำลังค้นหา…</p>:searchError?<p role="alert">{searchError}</p>:results.length?results.map((s,i)=><button type="button" id={`student-result-${s.id}`} role="option" aria-selected={activeResult===i} key={s.id} onClick={()=>chooseStudent(s)} className={activeResult===i?'is-active':''}><span className="service-result-avatar">{s.fullName.slice(0,1)}</span><div><b>{s.fullName}</b><small>{s.studentCode} · {s.gradeLevel}/{s.classroom}</small></div>{s.allergies&&s.allergies!=='ไม่มี'&&<ShieldAlert size={15}/>}</button>):<p>ไม่พบรายชื่อ ลองชื่อหรือรหัสอื่น</p>}</div>}
          </div>
          {attempted&&!student&&<p id="student-required" className="service-line-error">กรุณาเลือกนักเรียนจากผลการค้นหา</p>}
          {student?<div className="service-student-profile"><div className="service-profile-name"><span>{student.fullName.slice(0,1)}</span><div><b>{student.fullName}</b><small>{student.studentCode} · {student.gradeLevel}/{student.classroom}</small></div><CheckCircle2 size={17}/></div><div className={`service-allergy ${student.allergies&&student.allergies!=='ไม่มี'?'has-allergy':''}`}><ShieldAlert size={15}/><div><b>ประวัติการแพ้</b><p>{student.allergies||'ยังไม่ระบุ · สอบถามนักเรียนก่อนจ่ายยา'}</p></div></div>{student.chronicDiseases&&student.chronicDiseases!=='ไม่มี'&&<p className="service-chronic">โรคประจำตัว: {student.chronicDiseases}</p>}</div>:<div className="service-student-placeholder"><Users size={23}/><div><b>เริ่มจากเลือกนักเรียน</b><p>ค้นหาและเลือกรายชื่อจากผลลัพธ์ด้านบน</p></div></div>}
          <fieldset disabled={saving} id="service-symptoms" tabIndex={-1} aria-invalid={attempted&&!symptomsReady} aria-describedby={attempted&&!symptomsReady?'symptoms-required':undefined} className={`service-symptom-section ${attempted&&!symptomsReady?'service-invalid':''}`} aria-label="อาการและการดูแล">
            <div className="service-section-label"><h3>อาการเบื้องต้น</h3><span>เลือกได้หลายข้อ</span></div>
            <div className="service-symptom-chips">{symptomOptions.map(s=><button type="button" key={s} aria-pressed={symptoms.includes(s)} onClick={()=>toggle(s)} className={symptoms.includes(s)?'is-selected':''}><span className="service-chip-check">{symptoms.includes(s)&&<Check size={11}/>}</span>{s}</button>)}</div>
            {symptoms.includes('อื่น ๆ')&&<textarea aria-label="อาการอื่น ๆ" aria-invalid={attempted&&symptoms.includes('อื่น ๆ')&&!other.trim()} value={other} onChange={e=>setOther(e.target.value)} className="service-other-symptoms" placeholder="ระบุอาการอื่น ๆ"/>}
            {attempted&&!symptomsReady&&<p id="symptoms-required" className="service-line-error">{symptoms.includes('อื่น ๆ')?'กรุณาระบุรายละเอียดอาการอื่น ๆ':'กรุณาเลือกอาการอย่างน้อย 1 ข้อ'}</p>}
            <details key={service} className="service-notes" open={service!=='DISPENSE'}><summary>{service==='WOUND_CARE'?'รายละเอียดการทำแผล':service==='REST'?'รายละเอียดการนอนพัก':'หมายเหตุการดูแล (ถ้ามี)'}<Plus size={13}/></summary><textarea aria-label="รายละเอียดการดูแล" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={service==='REST'?'เช่น เวลาเริ่มพัก และอาการหลังพัก':service==='WOUND_CARE'?'ตำแหน่งบาดแผลและการดูแลที่ให้':'บันทึกเพิ่มเติม'}/></details>
          </fieldset>
        </div>
      </section>
      <fieldset disabled={saving} id="service-catalog" tabIndex={-1} aria-invalid={attempted&&service==='DISPENSE'&&!cart.length} className={`service-panel service-catalog ${attempted&&service==='DISPENSE'&&!cart.length?'service-invalid':''}`} aria-label="เลือกยา">
        <div className="service-panel-heading"><div><span className="service-eyebrow">02 · ยาและเวชภัณฑ์</span><h2>{service==='DISPENSE'?'เลือกรายการยา':'เวชภัณฑ์เพิ่มเติม'}</h2></div><span className="service-count-badge">{visible.length} รายการ</span></div>
        {attempted&&service==='DISPENSE'&&!cart.length&&<p className="service-line-error">กรุณาเลือกยาอย่างน้อย 1 รายการ</p>}
        <div className="service-catalog-tools"><label className="service-search-input"><Search size={16}/><input aria-label="ค้นหายา" value={medicineQuery} onChange={e=>setMedicineQuery(e.target.value)} placeholder="ค้นหาชื่อยา หรือหมวดหมู่"/></label><div className="service-catalog-filter"><div>{[['available','มีสต็อก'],['all','ทั้งหมด'],['selected',`เลือกแล้ว ${cart.length}`]].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} className={filter===id?'is-active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><select aria-label="หมวดหมู่ยา" value={category} onChange={e=>setCategory(e.target.value)}><option value="">ทุกหมวดหมู่</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div></div>
        <div className="service-panel-scroll">{service!=='DISPENSE'&&<p className="service-optional-note">บริการนี้บันทึกได้โดยไม่ต้องเลือกยา</p>}<div className="service-medicine-grid">{visible.map(m=>{const line=cart.find(l=>l.med.id===m.id);return <button type="button" key={m.id} disabled={m.stockQuantity<1||!!line&&line.quantity>=m.stockQuantity} onClick={()=>add(m)} className={`service-medicine-card ${line?'is-selected':''}`}><div className="service-medicine-card-top"><span><Pill size={18}/></span><small>{m.category}</small><i>{line?<Check size={13}/>:<Plus size={13}/>}</i></div><b>{m.name}</b><div className="service-medicine-card-bottom"><span className={m.stockQuantity<=m.minThreshold?'is-low':''}>เหลือ {m.stockQuantity} {m.unit}</span>{line?<strong>เลือก {line.quantity}</strong>:<span>{m.stockQuantity===0?'หมด':'เพิ่มยา'}</span>}</div></button>})}</div>{!visible.length&&<div className="service-catalog-empty"><PackageEmpty/><b>ไม่พบรายการยา</b><p>ลองเปลี่ยนคำค้น หมวดหมู่ หรือตัวกรอง</p><button type="button" onClick={()=>{setMedicineQuery('');setCategory('');setFilter('all')}}>ล้างตัวกรอง</button></div>}</div>
      </fieldset>
      <fieldset disabled={saving} className="service-panel service-review" aria-label="ตรวจสอบและบันทึก">
        <div className="service-panel-heading"><div><span className="service-eyebrow">03 · ตรวจสอบ</span><h2>สรุปการให้บริการ</h2></div><CheckCircle2 size={18}/></div>
        <div className="service-panel-scroll"><div className="service-receipt-context"><span>{activeService.label}</span><b>{student?.fullName||'ยังไม่ได้เลือกนักเรียน'}</b>{student&&<small>{student.gradeLevel}/{student.classroom} · {student.studentCode}</small>}<p>{symptomText||'ยังไม่ได้ระบุอาการ'}</p></div><div className="service-receipt-label"><h3>รายการที่เลือก</h3><span>{cart.length} รายการ</span></div>
          {!cart.length?<div className="service-cart-empty"><Pill size={25}/><b>{service==='DISPENSE'?'ยังไม่ได้เลือกยา':'ยังไม่มีเวชภัณฑ์ที่เลือก'}</b><p>{service==='DISPENSE'?'เพิ่มรายการจากช่องตรงกลาง':'ไม่จ่ายยาก็สามารถบันทึกได้'}</p></div>:<div id="service-cart" tabIndex={-1} className="service-cart-lines">{cart.map(l=><div className={`service-cart-line ${attempted&&(!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>l.med.stockQuantity)?'service-invalid':''}`} key={l.med.id}><div className="service-cart-line-title"><b>{l.med.name}</b><button type="button" aria-label={`ลบ ${l.med.name}`} onClick={()=>setCart(current=>current.filter(i=>i.med.id!==l.med.id))}><Trash2 size={14}/></button></div><div className="service-quantity-row"><span>จำนวน · {l.med.unit}</span><div><button type="button" aria-label={`ลดจำนวน ${l.med.name}`} disabled={l.quantity<=1} onClick={()=>quantity(l.med.id,-1)}><Minus size={12}/></button><input type="number" min="1" max={l.med.stockQuantity} step="1" aria-label={`จำนวน ${l.med.name}`} aria-invalid={attempted&&(!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>l.med.stockQuantity)} value={l.quantity||''} onChange={e=>setExactQuantity(l.med.id,e.target.value)}/><button type="button" aria-label={`เพิ่มจำนวน ${l.med.name}`} disabled={l.quantity>=l.med.stockQuantity} onClick={()=>quantity(l.med.id,1)}><Plus size={12}/></button></div></div>{!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>l.med.stockQuantity?<p className="service-line-error">ระบุจำนวนเต็ม 1–{l.med.stockQuantity} {l.med.unit}</p>:<p className="service-stock-after">หลังจ่ายเหลือ {l.med.stockQuantity-l.quantity} {l.med.unit}</p>}</div>)}</div>}
          {notes&&<div className="service-receipt-notes"><span>หมายเหตุ</span><p>{notes}</p></div>}
        </div>
        <div className="service-save-bar">{error&&<p role="alert" className="service-line-error">{error}</p>}<div className={`service-ready-state ${ready?'is-ready':''}`}><CheckCircle2 size={14}/><span>{ready?'ตรวจสอบครบ พร้อมบันทึก':missing}</span></div><button type="button" onClick={save} disabled={saving}>{saving?'กำลังบันทึก…':`บันทึก${activeService.label}`}{!saving&&<ArrowRight size={16}/>}</button><p>บันทึกประวัติและปรับคลังยาอัตโนมัติ</p></div>
      </fieldset>
    </div>
  </div>;
}
function PackageEmpty(){return <Pill size={28} aria-hidden="true"/>}

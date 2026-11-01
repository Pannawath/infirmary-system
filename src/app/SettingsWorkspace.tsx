'use client';
import {useCallback,useEffect,useState} from 'react';
import StaffImportPanel from './StaffImportPanel';
import ExcelImportModal from './ExcelImportModal';
import {openExcelStudioWindow} from '@/lib/open-excel-window';
import type {ExcelInspectionSheet,SheetConfig} from '@/lib/excel-parser';
import {
  CalendarDays,
  Plus,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

type Year={id:string;year:number;_count:{enrollments:number};terms:{id:string;termNumber:number;startDate:string;endDate:string}[]};
type Sheet={name:string;rows:number;headerRow:number;columns:Record<string,number>;sample:{row:number;values:string[]}[]};
type Change={studentCode:string;fullName:string;kind:string;changes:{field:string;before:string;after:string}[]};
type Preview={id:string;year:number;total:number;changes:Change[];expiresAt:string};
type Batch={id:string;filename:string;confirmedAt:string;resultJson:string;year:{year:number};changes:{studentCode:string;kind:string;changesJson:string}[]};

const fields=[
  ['studentCode','รหัสนักเรียนของโรงเรียน',true],
  ['prefix','คำนำหน้าชื่อ',false],
  ['fullName','ชื่อ หรือชื่อ–นามสกุล',true],
  ['lastName','นามสกุล (กรณีแยกคอลัมน์)',false],
  ['gradeLevel','ระดับชั้น',true],
  ['classroom','ห้อง',true],
  ['rollNumber','เลขที่',false],
] as const;

const fieldLabels:Record<string,string>={
  fullName:'ชื่อ–นามสกุล',
  gradeLevel:'ระดับชั้น',
  classroom:'ห้อง',
  rollNumber:'เลขที่',
  status:'สถานะ',
  department:'กลุ่มงาน',
  position:'ตำแหน่ง',
};

const kindLabels:Record<string,string>={
  NEW:'นักเรียนใหม่',
  ENROLLED:'เพิ่มเข้าปีนี้',
  UPDATED:'มีการเปลี่ยนแปลง',
  UNCHANGED:'ข้อมูลเหมือนเดิม',
  MISSING:'ไม่พบในไฟล์ใหม่',
};

const fieldClass='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500';

export default function SettingsWorkspace(){
 const [years,setYears]=useState<Year[]>([]),[currentId,setCurrentId]=useState<string|null>(null),[selected,setSelected]=useState('');
 const [year,setYear]=useState(new Date().getFullYear()+543),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [file,setFile]=useState<File|null>(null),[sheets,setSheets]=useState<Sheet[]>([]),[sheet,setSheet]=useState(''),[headerRow,setHeaderRow]=useState(1),[columns,setColumns]=useState<Record<string,number>>({});
 
 // Rich Excel Grid State
 const [gridSheets,setGridSheets]=useState<ExcelInspectionSheet[]>([]);
 const [isExcelModalOpen,setIsExcelModalOpen]=useState(false);
 const [savedSheetConfigs,setSavedSheetConfigs]=useState<SheetConfig[]|null>(null);

 const [preview,setPreview]=useState<Preview|null>(null),[pauseMissing,setPauseMissing]=useState(false),[filter,setFilter]=useState('CHANGED'),[batches,setBatches]=useState<Batch[]>([]),[revision,setRevision]=useState(0);
 
 const load=useCallback(async()=>{
  setLoading(true);
  try{
    const r=await fetch('/api/settings/years');
    const d=await r.json();
    if(!r.ok)throw Error(d.error||'โหลดปีการศึกษาไม่ได้');
    setYears(d.years);
    setCurrentId(d.currentYearId);
    setSelected(old => {
      if (old && d.years.some((y: Year) => y.id === old)) return old;
      return d.currentYearId || d.years[0]?.id || '';
    });
  }catch(e){
    setError(e instanceof Error?e.message:'เชื่อมต่อไม่ได้');
  }finally{
    setLoading(false);
  }
 },[]);

 useEffect(()=>{void load()},[load]);
 
 useEffect(()=>{
  const c=new AbortController();
  setBatches([]);
  if(selected)fetch('/api/settings/student-imports?yearId='+selected,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error('โหลดประวัตินำเข้าไม่ได้');setBatches(await r.json())}).catch(e=>{if(!c.signal.aborted)setError(e.message)});
  return()=>c.abort();
 },[selected,revision]);

 const chosen=years.find(y=>y.id===selected);
 const sheetInfo=sheets.find(s=>s.name===sheet);
 const headers=sheetInfo?.sample.find(r=>r.row===headerRow)?.values||[];

 const clearPreview=()=>{
   setPreview(null);
   setPauseMissing(false);
 };

 async function createYear(){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
    const r=await fetch('/api/settings/years',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year})});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    setSelected(d.id);
    clearPreview();
    await load();
    setMessage(`สร้างปีการศึกษา ${year} แล้ว เริ่มนำเข้ารายชื่อได้เลย`);
  }catch(e){
    setError(e instanceof Error?e.message:'สร้างปีไม่ได้');
  }finally{
    setBusy(false);
  }
 }

 async function activateYear(){
  if(busy||!chosen)return;
  if(!window.confirm(`ตั้งปี ${chosen.year} เป็นปีปัจจุบัน?\nหน้าบันทึกบริการจะใช้รายชื่อและชั้น/ห้องของปีนี้ โดยไม่ลบประวัติเดิม`))return;
  setBusy(true);setError('');
  try{
    const r=await fetch('/api/settings/years',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:chosen.id})});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    await load();
    window.dispatchEvent(new Event('infirmary-data-changed'));
    setMessage(`เปลี่ยนปีปัจจุบันเป็น ${chosen.year} แล้ว`);
  }catch(e){
    setError(e instanceof Error?e.message:'เปลี่ยนปีไม่ได้');
  }finally{
    setBusy(false);
  }
 }

 async function deleteYear(){
  if(busy||!chosen)return;
  if(!window.confirm(`ยืนยันการลบปีการศึกษา ${chosen.year} หรือไม่?\n\nคำเตือน: ข้อมูลการนำเข้าและรายชื่อของปี ${chosen.year} ทั้งหมดจะถูกลบออก (หากเป็นปีปัจจุบัน ระบบจะสลับไปปีอื่นอัตโนมัติ)\n\nกด ตกลง (OK) เพื่อยืนยันการลบ`))return;
  setBusy(true);setError('');setMessage('');
  try{
    const r=await fetch(`/api/settings/years?id=${chosen.id}`,{method:'DELETE'});
    const d=await r.json();
    if(!r.ok)throw Error(d.error||'ลบปีการศึกษาไม่สำเร็จ');
    clearPreview();
    await load();
    window.dispatchEvent(new Event('infirmary-data-changed'));
    setMessage(`ลบปีการศึกษา ${chosen.year} เรียบร้อยแล้ว`);
  }catch(e){
    setError(e instanceof Error?e.message:'ลบปีการศึกษาไม่สำเร็จ');
  }finally{
    setBusy(false);
  }
 }

 async function inspectFile(next:File|null){
  setFile(next);
  setSheets([]);
  setGridSheets([]);
  setSheet('');
  setColumns({});
  setSavedSheetConfigs(null);
  clearPreview();
  setError('');
  if(!next)return;
  setBusy(true);
  try{
    const form=new FormData();
    form.set('file',next);
    form.set('mode','inspect');
    const r=await fetch('/api/settings/student-imports',{method:'POST',body:form});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    setSheets(d.sheets || []);
    if(d.gridSheets && d.gridSheets.length) {
      setGridSheets(d.gridSheets);
      const opened = await openExcelStudioWindow({
        fileName: next.name,
        gridSheets: d.gridSheets,
        personType: 'STUDENT',
        academicYear: chosen?.year || new Date().getFullYear() + 543,
        onSubmit: makePreviewFromGrid,
        onClose: () => setIsExcelModalOpen(false),
      });
      if (!opened) {
        setIsExcelModalOpen(true);
      }
    }
    setSheet(d.sheets[0]?.name||'');
    setHeaderRow(d.sheets[0]?.headerRow||1);
    setColumns(d.sheets[0]?.columns||{});
  }catch(e){
    setFile(null);
    setError(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้');
  }finally{
    setBusy(false);
  }
 }

 async function makePreviewFromGrid(config:{
   sheetConfigs: SheetConfig[];
 }) {
   if(busy||!file||!selected)return;
   setBusy(true);setError('');setMessage('');
   try{
     const form=new FormData();
     form.set('file',file);
     form.set('yearId',selected);
     form.set('personType','STUDENT');
     form.set('isGrid','true');
     form.set('sheetConfigs',JSON.stringify(config.sheetConfigs));

     const r=await fetch('/api/settings/student-imports',{method:'POST',body:form});
     const d=await r.json();
     if(!r.ok)throw Error(d.error);
     setSavedSheetConfigs(config.sheetConfigs);
     setPreview(d);
     setIsExcelModalOpen(false);
     setPauseMissing(false);
     setFilter('CHANGED');
     setMessage(`อ่านข้อมูลตารางสำเร็จ: ${d.total.toLocaleString()} รายชื่อ`);
   }catch(e){
     setError(e instanceof Error?e.message:'ตรวจข้อมูลไม่ได้');
   }finally{
     setBusy(false);
   }
 }

 async function makePreview(){
  if(busy||!file||!selected)return;
  if(savedSheetConfigs) {
    return makePreviewFromGrid({sheetConfigs: savedSheetConfigs});
  }
  setBusy(true);setError('');setMessage('');
  try{
    const form=new FormData();
    form.set('file',file);
    form.set('mode','preview');
    form.set('yearId',selected);
    form.set('sheet',sheet);
    form.set('headerRow',String(headerRow));
    form.set('columns',JSON.stringify(columns));
    const r=await fetch('/api/settings/student-imports',{method:'POST',body:form});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    setPreview(d);
    setPauseMissing(false);
    setFilter('CHANGED');
  }catch(e){
    setError(e instanceof Error?e.message:'ตรวจข้อมูลไม่ได้');
  }finally{
    setBusy(false);
  }
 }

 async function confirm(){
  if(busy||!preview)return;
  setBusy(true);setError('');
  try{
    const r=await fetch('/api/settings/student-imports',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:preview.id,pauseMissing,confirm:true})});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    setMessage(`นำเข้าสำเร็จ: ใหม่ ${d.new} · อัปเดต/เพิ่มเข้าปี ${d.updated} · เหมือนเดิม ${d.unchanged} · พักสถานะ ${d.paused}`);
    setPreview(null);
    setFile(null);
    setSavedSheetConfigs(null);
    setRevision(n=>n+1);
    await load();
    window.dispatchEvent(new Event('infirmary-data-changed'));
  }catch(e){
    setError(e instanceof Error?e.message:'นำเข้าไม่สำเร็จ');
  }finally{
    setBusy(false);
  }
 }

 const changes=preview?.changes.filter(c=>filter==='ALL'||(filter==='CHANGED'&&c.kind!=='UNCHANGED')||c.kind===filter)||[];

 return <div className="settings-workspace">
  {error&&<div role="alert" className="settings-notice is-error"><AlertTriangle size={18}/><span>{error}</span></div>}
  {message&&<div role="status" className="settings-notice is-success"><CheckCircle2 size={18}/><span>{message}</span></div>}
  
  <div className="settings-layout">
   <aside className="settings-year-panel workspace-panel">
    <div className="settings-section-title"><CalendarDays size={19}/><h2>ปีการศึกษา</h2></div>
    <p className="settings-help">แยกรายชื่อ ชั้น และห้องในแต่ละปี นักเรียนคนเดิมใช้ประวัติร่วมกัน</p>
    {loading?<p role="status" className="settings-help">กำลังโหลด…</p>:years.length?years.map(y=><button key={y.id} disabled={busy} onClick={()=>{setSelected(y.id);clearPreview()}} aria-pressed={selected===y.id} className={`settings-year-option ${selected===y.id?'is-active':''}`}><span><b>{y.year}</b><small>{y._count.enrollments.toLocaleString()} รายชื่อ</small></span>{currentId===y.id?<span className="settings-current-badge">ปัจจุบัน</span>:<ArrowRight size={15}/>}</button>):<p className="settings-help">ยังไม่มีปีการศึกษา สร้างปีแรกด้านล่าง</p>}
    <div className="settings-year-create">
      <label className="text-xs font-semibold text-slate-600">
        ปีการศึกษาใหม่ (พ.ศ.)
        <input type="number" min={2400} max={3000} value={year} disabled={busy} onChange={e=>setYear(Number(e.target.value))} className={fieldClass}/>
      </label>
      <button className="workspace-button primary" disabled={busy||!Number.isInteger(year)} onClick={createYear}>
        <Plus size={15}/>สร้างปีการศึกษา
      </button>
    </div>
   </aside>

   <main className="settings-main">
    {chosen?<>
      <section className="workspace-panel settings-selected-year">
        <div>
          <span className="settings-eyebrow">ปีที่กำลังจัดการ</span>
          <h2>ปีการศึกษา {chosen.year}</h2>
          <p>{currentId===chosen.id?'กำลังใช้กับหน้าบันทึกบริการ':'ดูข้อมูลย้อนหลังหรือนำเข้ารายชื่อก่อนเริ่มใช้งาน'}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentId!==chosen.id&&<button disabled={busy} onClick={activateYear} className="workspace-button primary text-xs">ตั้งเป็นปีปัจจุบัน</button>}
          <button
            type="button"
            disabled={busy}
            onClick={deleteYear}
            className="workspace-button text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            title="ลบปีการศึกษานี้และข้อมูลในระบบของปีนี้"
          >
            <Trash2 size={14}/>
            ลบปีการศึกษานี้
          </button>
        </div>
      </section>

      {/* Student Excel Import Panel */}
      <section className="workspace-panel settings-import-panel">
        <div className="settings-section-title">
          <FileSpreadsheet size={20}/>
          <div>
            <h2>นำเข้ารายชื่อนักเรียน</h2>
            <p className="settings-help">เปิดหน้าต่างตาราง Excel แยกอิสระ เลือกช่วง ตัดแถวหัวกระดาษ และรองรับหลายชีตพร้อมกัน</p>
          </div>
        </div>

        <label className="settings-upload">
          <Upload size={25}/>
          <b>{file?file.name:'เลือกไฟล์ Excel รายชื่อนักเรียน'}</b>
          <span>.xlsx ไม่เกิน 5 MB · ระบบจะเปิดหน้าต่างตาราง Excel ให้ตรวจสอบ</span>
          <input aria-label="เลือกไฟล์รายชื่อนักเรียน" type="file" accept=".xlsx" disabled={busy} onChange={e=>{void inspectFile(e.target.files?.[0]||null)}}/>
        </label>

        {!!gridSheets.length && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-4">
            <div>
              <b className="text-sm text-blue-950 block">ไฟล์พร้อมนำเข้า: {file?.name}</b>
              <span className="text-xs text-blue-700">
                {savedSheetConfigs
                  ? `ตั้งค่าเรียบร้อยแล้ว (${savedSheetConfigs.filter(c => c.enabled !== false).length} ชีต) · กด "ตรวจสอบการเปลี่ยนแปลง" เพื่อดูตัวอย่างและบันทึก`
                  : 'สามารถเปิดหน้าต่างตารางเพื่อปรับแถวหัวตาราง ตัดแถว หรือกดตรวจสอบได้ทันที'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const opened = await openExcelStudioWindow({
                    fileName: file?.name || 'Excel',
                    gridSheets,
                    personType: 'STUDENT',
                    academicYear: chosen?.year || new Date().getFullYear() + 543,
                    initialConfigs: savedSheetConfigs,
                    onSubmit: makePreviewFromGrid,
                    onClose: () => setIsExcelModalOpen(false),
                  });
                  if (!opened) setIsExcelModalOpen(true);
                }}
                className="workspace-button secondary text-xs"
              >
                <SlidersHorizontal size={14} />
                ปรับแต่งในหน้าต่างตาราง Excel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (savedSheetConfigs) {
                    void makePreviewFromGrid({sheetConfigs: savedSheetConfigs});
                  } else {
                    // Use initial suggested configs
                    const defaultConfigs = gridSheets.map(s => ({
                      sheetName: s.name,
                      headerRow: s.suggestedHeaderRow || 1,
                      excludedRows: [],
                      excludedCols: [],
                      enabled: true,
                      mapping: {
                        nameMode: (s.suggestedColumns?.firstName && s.suggestedColumns?.lastName ? (s.suggestedColumns?.prefix ? 'prefix_first_last' : 'first_last') : 'single') as any,
                        studentCodeCol: s.suggestedColumns?.studentCode || 0,
                        fullNameCol: s.suggestedColumns?.fullName || s.suggestedColumns?.firstName || 0,
                        prefixCol: s.suggestedColumns?.prefix || 0,
                        firstNameCol: s.suggestedColumns?.firstName || 0,
                        lastNameCol: s.suggestedColumns?.lastName || 0,
                        gradeMode: 'column' as const,
                        gradeLevelCol: s.suggestedColumns?.gradeLevel || 0,
                        fixedGradeLevel: '',
                        classMode: 'column' as const,
                        classroomCol: s.suggestedColumns?.classroom || 0,
                        fixedClassroom: '',
                        rollNumberCol: s.suggestedColumns?.rollNumber || 0,
                        departmentMode: 'fixed' as const,
                        departmentCol: 0,
                        fixedDepartment: s.name,
                        positionMode: 'column' as const,
                        positionCol: 0,
                        fixedPosition: '',
                      },
                    }));
                    void makePreviewFromGrid({sheetConfigs: defaultConfigs});
                  }
                }}
                className="workspace-button primary text-xs"
              >
                <FileSpreadsheet size={14} />
                {busy ? 'กำลังตรวจข้อมูล…' : 'ตรวจสอบและบันทึกข้อมูล'}
              </button>
            </div>
          </div>
        )}

        {/* Fallback column settings if not using rich modal */}
        {!!sheets.length && !gridSheets.length && (
          <>
            <div className="settings-file-options">
              <label className="text-xs font-semibold">ชีตข้อมูล<select className={fieldClass} disabled={busy} value={sheet} onChange={e=>{setSheet(e.target.value);setColumns({});clearPreview()}}>{sheets.map(s=><option key={s.name}>{s.name}</option>)}</select></label>
              <label className="text-xs font-semibold">แถวหัวตาราง<input className={fieldClass} type="number" min={1} max={sheetInfo?.rows||1} disabled={busy} value={headerRow} onChange={e=>{setHeaderRow(Number(e.target.value));setColumns({});clearPreview()}}/></label>
            </div>
            <h3 className="mt-5 text-sm font-bold text-slate-700">จับคู่คอลัมน์ในไฟล์</h3>
            <div className="settings-column-map">
              {fields.map(([key,label,required])=><label key={key} className="text-xs font-semibold text-slate-600">{label}{required?' *':' (ถ้ามี)'}<select className={fieldClass} disabled={busy} value={columns[key]||0} onChange={e=>{setColumns(old=>({...old,[key]:Number(e.target.value)}));clearPreview()}}><option value={0}>เลือกคอลัมน์</option>{Array.from({length:Math.min(100,Math.max(headers.length,...(sheetInfo?.sample.map(r=>r.values.length)||[0])) )},(_,i)=><option key={i} value={i+1}>คอลัมน์ {i+1}{headers[i]?` · ${headers[i]}`:''}</option>)}</select></label>)}
            </div>
            <button disabled={busy||fields.some(([key,,required])=>required&&!columns[key])} className="workspace-button primary mt-4" onClick={makePreview}>
              {busy?<Loader2 className="animate-spin" size={16}/>:<FileSpreadsheet size={16}/>}ตรวจสอบการเปลี่ยนแปลง
            </button>
          </>
        )}
      </section>

      {/* Staff Import & Rollover Panel */}
      <StaffImportPanel
        key={selected}
        yearId={selected}
        yearNumber={chosen.year}
        availableYears={years.map(y => ({id: y.id, year: y.year}))}
        onImported={()=>{setRevision(n=>n+1);void load();clearPreview()}}
      />

      {/* Preview Diff Section */}
      {preview&&<section className="workspace-panel settings-preview">
        <div className="settings-section-title"><CheckCircle2 size={20}/><div><h2>ตรวจสอบก่อนนำเข้า · {preview.total.toLocaleString()} รายชื่อ</h2><p className="settings-help">ยังไม่มีการแก้ไขข้อมูลจริง · ตัวอย่างหมดอายุใน 30 นาที</p></div></div>
        <div className="settings-change-filters">
          {[['CHANGED','ที่ต้องตรวจ'],['ALL','ทั้งหมด'],...Object.entries(kindLabels)].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} aria-pressed={filter===id}>{label} {id==='ALL'?preview.changes.length:id==='CHANGED'?preview.changes.filter(c=>c.kind!=='UNCHANGED').length:preview.changes.filter(c=>c.kind===id).length}</button>)}
        </div>
        <div className="settings-change-table">
          <table className="workspace-table">
            <thead><tr><th>นักเรียน</th><th>สถานะ</th><th>ข้อมูลที่เปลี่ยน</th></tr></thead>
            <tbody>{changes.slice(0,200).map(c=><tr key={c.studentCode}><td><b>{c.fullName}</b><small className="block text-slate-400">{c.studentCode}</small></td><td><span className={`settings-change-kind kind-${c.kind.toLowerCase()}`}>{kindLabels[c.kind]}</span></td><td>{c.changes.length?c.changes.map(x=><div key={x.field} className="settings-change-diff"><b>{fieldLabels[x.field]||x.field}</b><span>{x.before||'ไม่ได้ระบุ'}</span><ArrowRight size={12}/><strong>{x.after||'ไม่ได้ระบุ'}</strong></div>):c.kind==='NEW'?'สร้างนักเรียนใหม่และเพิ่มเข้าปีการศึกษา':c.kind==='ENROLLED'?'เพิ่มรายชื่อเดิมเข้าปีการศึกษานี้':'ไม่เปลี่ยนแปลง'}</td></tr>)}</tbody>
          </table>
          {!changes.length&&<p className="settings-help p-5">ไม่มีรายการในตัวกรองนี้</p>}
        </div>
        {changes.length>200&&<p className="settings-help">แสดงตัวอย่าง 200 รายการแรกจาก {changes.length} รายการ ระบบจะบันทึกครบทุกแถวที่ตรวจแล้ว</p>}
        <label className="settings-pause-option">
          <input type="checkbox" checked={pauseMissing} disabled={busy} onChange={e=>setPauseMissing(e.target.checked)}/>
          <span><b>พักสถานะนักเรียนที่หายจากไฟล์ เฉพาะปีนี้</b><small>ไม่ลบตัวนักเรียนหรือประวัติเดิม · หากเป็นไฟล์บางห้อง อย่าเลือกข้อนี้</small></span>
        </label>
        <div className="settings-confirm-actions">
          <button disabled={busy} onClick={()=>{setPreview(null);if(gridSheets.length)setIsExcelModalOpen(true)}} className="workspace-button secondary">
            กลับไปแก้การจับคู่
          </button>
          <button disabled={busy} onClick={confirm} className="workspace-button primary">
            {busy?'กำลังนำเข้า…':`ยืนยันนำเข้าในปี ${preview.year}`}
          </button>
        </div>
      </section>}

      {/* Import History */}
      <section className="workspace-panel settings-audit">
        <div className="settings-section-title"><History size={19}/><h2>ประวัติการนำเข้า</h2></div>
        {!batches.length?<p className="settings-help">ยังไม่มีการนำเข้าในปีนี้</p>:batches.map(batch=><details key={batch.id}><summary><span><b>{batch.filename}</b><small>{new Date(batch.confirmedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></span><span>{batch.changes.length} รายการเปลี่ยนแปลง</span></summary><div className="settings-audit-rows">{batch.changes.map((row,i)=>{const change=JSON.parse(row.changesJson) as Change;return <div key={i}><b>{row.studentCode} · {change.fullName}</b><small>{kindLabels[row.kind]}</small>{change.changes.map(x=><p key={x.field}>{fieldLabels[x.field]||x.field}: {x.before||'ว่าง'} → {x.after||'ว่าง'}</p>)}</div>})}</div></details>)}
      </section>

      <section className="settings-security-note">
        <ShieldCheck size={20}/>
        <div><b>ข้อมูลจริงบนระบบความปลอดภัย</b><p>ข้อมูลบุคคลและประวัติบริการถูกจัดเก็บอย่างปลอดภัยบนเครื่อง ไฟล์ Excel และฐานข้อมูลไม่ใช่ไฟล์สาธารณะ</p></div>
      </section>
    </>:
    <section className="workspace-panel settings-first-year">
      <CalendarDays size={36}/>
      <h2>เริ่มจากสร้างปีการศึกษา</h2>
      <p>กรอกปี พ.ศ. ด้านซ้าย จากนั้นนำเข้าไฟล์นักเรียนและไฟล์บุคลากรคนละช่อง ตรวจสอบรายชื่อก่อนยืนยัน</p>
    </section>}
   </main>
  </div>

  {/* Dedicated Excel Grid Window Modal */}
  {isExcelModalOpen && gridSheets.length > 0 && file && chosen && (
    <ExcelImportModal
      fileName={file.name}
      gridSheets={gridSheets}
      personType="STUDENT"
      academicYear={chosen.year}
      initialConfigs={savedSheetConfigs}
      onClose={() => setIsExcelModalOpen(false)}
      onSubmit={config => {
        void makePreviewFromGrid(config);
      }}
    />
  )}
 </div>;
}

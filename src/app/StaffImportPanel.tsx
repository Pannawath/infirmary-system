'use client';
import {useState} from 'react';
import {
  BriefcaseBusiness,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  History,
  SlidersHorizontal,
} from 'lucide-react';
import StaffRolloverModal from './StaffRolloverModal';
import ExcelImportModal from './ExcelImportModal';
import {openExcelStudioWindow} from '@/lib/open-excel-window';
import type {ExcelInspectionSheet,SheetConfig} from '@/lib/excel-parser';

type Change={
  studentCode:string;
  fullName:string;
  kind:string;
  department?:string;
  position?:string;
  changes:{field:string;before:string;after:string}[];
};
type Preview={id:string;year:number;total:number;changes:Change[]};

const labels:Record<string,string>={
  NEW:'เพิ่มใหม่',
  ENROLLED:'เพิ่มเข้าปีนี้',
  UPDATED:'เปลี่ยนแปลง',
  UNCHANGED:'เหมือนเดิม',
  MISSING:'ไม่พบในไฟล์นี้',
};

type Props = {
  yearId: string;
  yearNumber: number;
  availableYears: {id: string; year: number}[];
  onImported: () => void;
};

export default function StaffImportPanel({
  yearId,
  yearNumber,
  availableYears,
  onImported,
}: Props){
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');

 // Excel Grid Modal state for Staff
 const [gridSheets, setGridSheets] = useState<ExcelInspectionSheet[]>([]);
 const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
 const [savedConfigs, setSavedConfigs] = useState<SheetConfig[] | null>(null);

 // Rollover Modal state
 const [isRolloverOpen, setIsRolloverOpen] = useState(false);

 async function onFileSelected(next: File | null) {
   setFile(next);
   setPreview(null);
   setGridSheets([]);
   setSavedConfigs(null);
   setError('');
   setMessage('');
   if (!next) return;

   setBusy(true);
   try {
     const form = new FormData();
     form.set('file', next);
     form.set('mode', 'inspect');
     const r = await fetch('/api/settings/student-imports', {method: 'POST', body: form});
     const d = await r.json();
     if (!r.ok) throw Error(d.error || 'อ่านไฟล์ไม่สำเร็จ');
     if (d.gridSheets && d.gridSheets.length) {
       setGridSheets(d.gridSheets);
       const opened = await openExcelStudioWindow({
         fileName: next.name,
         gridSheets: d.gridSheets,
         personType: 'STAFF',
         academicYear: yearNumber,
         initialConfigs: savedConfigs,
         onSubmit: makePreviewFromGrid,
         onClose: () => setIsExcelModalOpen(false),
       });
       if (!opened) {
         setIsExcelModalOpen(true);
       }
     }
   } catch (e) {
     setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ');
   } finally {
     setBusy(false);
   }
 }

 async function makePreviewFromGrid(config:{
   sheetConfigs: SheetConfig[];
 }) {
   if (!file || busy) return;
   setBusy(true); setError(''); setMessage('');
   try {
     const form = new FormData();
     form.set('file', file);
     form.set('personType', 'STAFF');
     form.set('yearId', yearId);
     form.set('isGrid', 'true');
     form.set('sheetConfigs', JSON.stringify(config.sheetConfigs));

     const r = await fetch('/api/settings/student-imports', {method: 'POST', body: form});
     const d = await r.json();
     if (!r.ok) throw Error(d.error);
     setSavedConfigs(config.sheetConfigs);
     setPreview(d);
     setIsExcelModalOpen(false);
   } catch (e) {
     setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่ได้');
   } finally {
     setBusy(false);
   }
 }

 async function inspectLegacy(){
   if(!file||busy)return;
   setBusy(true);setError('');setMessage('');
   try{
     const form=new FormData();
     form.set('file',file);
     form.set('personType','STAFF');
     form.set('mode','preview');
     form.set('yearId',yearId);
     const r=await fetch('/api/settings/student-imports',{method:'POST',body:form});
     const d=await r.json();
     if(!r.ok)throw Error(d.error);
     setPreview(d);
   }catch(e){
     setError(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้');
   }finally{
     setBusy(false);
   }
 }

 async function confirm(){
   if(!preview||busy)return;
   setBusy(true);setError('');
   try{
     const r=await fetch('/api/settings/student-imports',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:preview.id,pauseMissing:false,confirm:true})});
     const d=await r.json();
     if(!r.ok)throw Error(d.error);
     setMessage(`นำเข้าบุคลากรสำเร็จ · ใหม่ ${d.new} · อัปเดต/เพิ่มเข้าปี ${d.updated} · เหมือนเดิม ${d.unchanged}`);
     setPreview(null);
     setFile(null);
     onImported();
     window.dispatchEvent(new Event('infirmary-data-changed'));
   }catch(e){
     setError(e instanceof Error?e.message:'นำเข้าไม่ได้');
   }finally{
     setBusy(false);
   }
 }

 const hasOtherYears = availableYears.some(y => y.id !== yearId);

 return (
  <section className="workspace-panel settings-import-panel">
    <div className="settings-section-title">
      <BriefcaseBusiness size={20}/>
      <div>
        <h2>จัดการรายชื่อครูและบุคลากร</h2>
        <p className="settings-help">นำเข้าจาก Excel แบบเลือกหลายชีต ตัดแถวแยกชีต หรือดึงรายชื่อจากปีการศึกษาเดิมมาใช้</p>
      </div>
    </div>

    {/* Option to rollover from previous year */}
    <div className="mb-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-wrap items-center justify-between gap-3">
      <div>
        <b className="text-xs text-indigo-950 block">ใช้รายชื่อครู/บุคลากรจากปีการศึกษาเดิม</b>
        <span className="text-xs text-indigo-700">
          ไม่สร้างตัวบุคคลซ้ำ และเก็บประวัติบริการ ข้อมูลแพ้ยา/โรคประจำตัวเดิมไว้อย่างต่อเนื่อง
        </span>
      </div>
      <button
        type="button"
        disabled={!hasOtherYears || busy}
        onClick={() => setIsRolloverOpen(true)}
        className="workspace-button secondary text-xs"
      >
        <History size={14} />
        ดึงรายชื่อจากปีการศึกษาเดิม
      </button>
    </div>

    {/* Excel Upload Area */}
    <label className="settings-upload">
      <Upload size={24}/>
      <b>{file?.name||'หรือเลือก Excel รายชื่อครูและบุคลากรใหม่'}</b>
      <span>.xlsx ไม่เกิน 5 MB · รองรับหลายชีต แยกกลุ่มงานตามชีต และตัดแถวแต่ละชีตได้อิสระ</span>
      <input
        type="file"
        accept=".xlsx"
        aria-label="เลือกไฟล์บุคลากร"
        disabled={busy}
        onChange={e=>{void onFileSelected(e.target.files?.[0]||null)}}
      />
    </label>

    {!!gridSheets.length && (
      <div className="mt-3 p-3 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-blue-900 font-medium">ไฟล์พร้อมนำเข้า: {file?.name} ({gridSheets.length} ชีต)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const opened = await openExcelStudioWindow({
                fileName: file?.name || 'Excel',
                gridSheets,
                personType: 'STAFF',
                academicYear: yearNumber,
                initialConfigs: savedConfigs,
                onSubmit: makePreviewFromGrid,
                onClose: () => setIsExcelModalOpen(false),
              });
              if (!opened) setIsExcelModalOpen(true);
            }}
            className="workspace-button secondary text-xs"
          >
            <SlidersHorizontal size={14} />
            ปรับแต่งในหน้าต่างตาราง ({gridSheets.length} ชีต)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (savedConfigs) {
                void makePreviewFromGrid({sheetConfigs: savedConfigs});
              } else {
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
                    gradeLevelCol: 0,
                    fixedGradeLevel: '',
                    classMode: 'column' as const,
                    classroomCol: 0,
                    fixedClassroom: '',
                    rollNumberCol: 0,
                    departmentMode: 'fixed' as const,
                    departmentCol: s.suggestedColumns?.department || 0,
                    fixedDepartment: s.name,
                    positionMode: 'column' as const,
                    positionCol: s.suggestedColumns?.position || 0,
                    fixedPosition: '',
                  },
                }));
                void makePreviewFromGrid({sheetConfigs: defaultConfigs});
              }
            }}
            className="workspace-button primary text-xs"
          >
            <FileSpreadsheet size={14} />
            {busy ? 'กำลังตรวจข้อมูล…' : 'ตรวจสอบและบันทึกข้อมูลครู/บุคลากร'}
          </button>
        </div>
      </div>
    )}

    {error&&<p role="alert" className="settings-notice is-error mt-3"><AlertTriangle size={16}/>{error}</p>}
    {message&&<p role="status" className="settings-notice is-success mt-3"><CheckCircle2 size={16}/>{message}</p>}

    {!preview && file && !gridSheets.length && (
      <button disabled={!file||busy} className="workspace-button primary mt-4" onClick={inspectLegacy}>
        <FileSpreadsheet size={16}/>{busy?'กำลังตรวจไฟล์…':'ตรวจสอบรายชื่อบุคลากร (อัตโนมัติ)'}
      </button>
    )}

    {preview&&<>
      <h3 className="mt-5 font-bold">ตรวจสอบ {preview.total} คน · ปี {preview.year}</h3>
      <div className="settings-change-table mt-3">
        <table className="workspace-table">
          <thead><tr><th>ชื่อ–นามสกุล</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead>
          <tbody>
            {preview.changes.map(c=>(
              <tr key={c.studentCode}>
                <td>
                  <b>{c.fullName}</b>
                  <small className="block text-slate-400">{c.department} {c.position}</small>
                </td>
                <td>{labels[c.kind]}</td>
                <td>{c.changes.map(x=><p key={x.field}>{x.field}: {x.before||'ว่าง'} → {x.after||'ว่าง'}</p>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="settings-help">ไม่ลบหรือพักสถานะนักเรียนและบุคลากรที่ไม่อยู่ในไฟล์นี้</p>
      <div className="settings-confirm-actions">
        <button disabled={busy} className="workspace-button secondary" onClick={()=>setPreview(null)}>
          ย้อนกลับ
        </button>
        <button disabled={busy} className="workspace-button primary" onClick={confirm}>
          {busy?'กำลังนำเข้า…':`ยืนยันนำเข้าบุคลากร ปี ${preview.year}`}
        </button>
      </div>
    </>}

    {/* Excel Modal for Staff */}
    {isExcelModalOpen && gridSheets.length > 0 && file && (
      <ExcelImportModal
        fileName={file.name}
        gridSheets={gridSheets}
        personType="STAFF"
        academicYear={yearNumber}
        initialConfigs={savedConfigs}
        onClose={() => setIsExcelModalOpen(false)}
        onSubmit={config => {
          void makePreviewFromGrid(config);
        }}
      />
    )}

    {/* Rollover Modal */}
    {isRolloverOpen && (
      <StaffRolloverModal
        targetYearId={yearId}
        targetYearNumber={yearNumber}
        availableYears={availableYears}
        onClose={() => setIsRolloverOpen(false)}
        onSuccess={() => {
          setIsRolloverOpen(false);
          onImported();
        }}
      />
    )}
  </section>
 );
}

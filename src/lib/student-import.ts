import {createHash} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {prisma} from './db';

export type ImportStudent={studentCode:string;fullName:string;gradeLevel:string;classroom:string;rollNumber:string;personType?:'STUDENT'|'STAFF';department?:string;position?:string};
type Change={field:string;before:string;after:string};
export type ImportChange={studentCode:string;fullName:string;kind:'NEW'|'UPDATED'|'ENROLLED'|'UNCHANGED'|'MISSING';changes:Change[]};
export async function importState(tx:Prisma.TransactionClient,yearId:string){
 const [students,enrollments,year]=await Promise.all([
  tx.student.findMany({orderBy:{id:'asc'}}),
  tx.studentEnrollment.findMany({where:{yearId},orderBy:{id:'asc'}}),
  tx.schoolYear.findUnique({where:{id:yearId}}),
 ]);
 if(!year)throw Error('ไม่พบปีการศึกษา');
 return {students,enrollments,year,version:createHash('sha256').update(JSON.stringify({students,enrollments})).digest('hex')};
}
export function diffStudents(rows:ImportStudent[],state:Awaited<ReturnType<typeof importState>>):ImportChange[]{
 const students=new Map(state.students.map(s=>[s.studentCode,s]));
 const memberships=new Map(state.enrollments.map(e=>[e.studentId,e]));
 const codes=new Set(rows.map(r=>r.studentCode));
 const changes:ImportChange[]=rows.map(row=>{
  const student=students.get(row.studentCode);if(!student)return {...row,kind:'NEW',changes:[]};
  if(student.personType!==(row.personType||'STUDENT'))throw Error('รหัสซ้ำกับผู้รับบริการคนละประเภท กรุณาตรวจสอบรหัส');
  const enrollment=memberships.get(student.id);const edits:Change[]=[];
  if(row.personType==='STAFF')for(const field of ['department','position'] as const){const before=student[field]||'';if(before!==(row[field]||''))edits.push({field,before,after:row[field]||''})}
  for(const field of ['fullName','gradeLevel','classroom','rollNumber'] as const){
   const before=field==='fullName'?student.fullName:enrollment?.[field]??(field==='rollNumber'?'':student[field]);
   if(before!==row[field])edits.push({field,before:before||'',after:row[field]});
  }
  if(enrollment?.status==='INACTIVE')edits.push({field:'status',before:'INACTIVE',after:'ACTIVE'});
  return {studentCode:row.studentCode,fullName:row.fullName,kind:!enrollment?'ENROLLED':edits.length?'UPDATED':'UNCHANGED',changes:edits};
 });
 for(const enrollment of state.enrollments.filter(e=>e.status==='ACTIVE')){
  const student=state.students.find(s=>s.id===enrollment.studentId);
  if(student&&student.personType===(rows[0]?.personType||'STUDENT')&&!codes.has(student.studentCode))changes.push({studentCode:student.studentCode,fullName:student.fullName,kind:'MISSING',changes:[{field:'status',before:'ACTIVE',after:'INACTIVE'}]});
 }
 return changes;
}
export function validateImportRows(value:unknown):ImportStudent[]{
 if(!Array.isArray(value)||!value.length||value.length>20000)throw Error('ต้องมีรายชื่อ 1–20,000 รายการ');
 const seen=new Set<string>();
 return value.map((v,index)=>{
  if(!v||typeof v!=='object')throw Error(`แถว ${index+1} ไม่ถูกต้อง`);
  const row=Object.fromEntries(['studentCode','fullName','gradeLevel','classroom','rollNumber'].map(key=>[key,typeof v[key]==='string'?v[key].trim():String(v[key]??'').trim()])) as ImportStudent;
  row.personType=v.personType==='STAFF'?'STAFF':'STUDENT';
  row.department=typeof v.department==='string'?v.department.trim():'';row.position=typeof v.position==='string'?v.position.trim():'';
  if((row.department||'').length>200||(row.position||'').length>200)throw Error(`แถว ${index+1}: กลุ่มงานหรือตำแหน่งยาวเกินกำหนด`);
  for(const key of ['studentCode','fullName','gradeLevel','classroom'] as const)if(!row[key]||row[key].length>200)throw Error(`แถว ${index+1}: กรอกรหัส ชื่อ ชั้น และห้องให้ครบ (ไม่เกิน 200 ตัวอักษร)`);
  if(/^\d{13}$/.test(row.studentCode))throw Error(`แถว ${index+1}: กรุณาเลือกรหัสนักเรียนของโรงเรียน ไม่ใช่เลขประจำตัวประชาชน`);
  if(row.rollNumber.length>20)throw Error(`แถว ${index+1}: เลขที่ไม่ถูกต้อง`);
  if(seen.has(row.studentCode))throw Error(`รหัสนักเรียน ${row.studentCode} ซ้ำในไฟล์ กรุณาแก้ก่อนนำเข้า`);
  seen.add(row.studentCode);return row;
 });
}

export async function confirmStudentImport(id:string,pauseMissing:boolean){
 return prisma.$transaction(async tx=>{
  const batch=await tx.studentImport.findUnique({where:{id}});
  if(!batch||batch.status!=='PREVIEW'||Date.now()-batch.createdAt.getTime()>30*60*1000)throw Error('รายการหมดอายุหรือยืนยันไปแล้ว กรุณาตรวจสอบไฟล์ใหม่');
  const state=await importState(tx,batch.yearId);
  if(state.version!==batch.baseVersion)throw Error('ข้อมูลนักเรียนเปลี่ยนหลังตรวจสอบ กรุณาสร้างตัวอย่างใหม่');
  const rows=validateImportRows(JSON.parse(batch.rowsJson));
  const changes=diffStudents(rows,state);const current=await tx.appSetting.findUnique({where:{key:'currentYearId'}});
  if(!current)await tx.appSetting.create({data:{key:'currentYearId',value:batch.yearId}});
  // Freeze identity/class on old visits before master data changes. Health data is untouched.
  for(const row of rows){
   const old=state.students.find(s=>s.studentCode===row.studentCode);
   if(old)await tx.infirmaryVisit.updateMany({where:{studentId:old.id,studentNameSnapshot:null},data:{studentNameSnapshot:old.fullName,gradeSnapshot:old.gradeLevel,classroomSnapshot:old.classroom}});
   const activeYear=!current||current.value===batch.yearId;
   const personData={personType:row.personType||'STUDENT',...(row.personType==='STAFF'?{department:row.department||null,position:row.position||null}:{})};
   const student=old?await tx.student.update({where:{id:old.id},data:{fullName:row.fullName,...personData,...(activeYear?{gradeLevel:row.gradeLevel,classroom:row.classroom,isActive:true}:{})}}):await tx.student.create({data:{studentCode:row.studentCode,fullName:row.fullName,...personData,gradeLevel:row.gradeLevel,classroom:row.classroom,isActive:activeYear}});
   await tx.studentEnrollment.upsert({where:{studentId_yearId:{studentId:student.id,yearId:batch.yearId}},create:{studentId:student.id,yearId:batch.yearId,gradeLevel:row.gradeLevel,classroom:row.classroom,rollNumber:row.rollNumber||null},update:{gradeLevel:row.gradeLevel,classroom:row.classroom,rollNumber:row.rollNumber||null,status:'ACTIVE'}});
  }
  if(pauseMissing){
   const missingCodes=changes.filter(c=>c.kind==='MISSING').map(c=>c.studentCode);
   const ids=state.students.filter(s=>missingCodes.includes(s.studentCode)).map(s=>s.id);
   await tx.studentEnrollment.updateMany({where:{yearId:batch.yearId,studentId:{in:ids}},data:{status:'INACTIVE'}});
   if(!current||current.value===batch.yearId)await tx.student.updateMany({where:{id:{in:ids}},data:{isActive:false}});
  }
  for(const change of changes.filter(c=>c.kind!=='UNCHANGED'&&(c.kind!=='MISSING'||pauseMissing)))await tx.studentImportChange.create({data:{importId:id,studentCode:change.studentCode,kind:change.kind,changesJson:JSON.stringify(change)}});
  const counts={new:changes.filter(c=>c.kind==='NEW').length,updated:changes.filter(c=>c.kind==='UPDATED'||c.kind==='ENROLLED').length,unchanged:changes.filter(c=>c.kind==='UNCHANGED').length,paused:pauseMissing?changes.filter(c=>c.kind==='MISSING').length:0};
  await tx.studentImport.update({where:{id},data:{status:'CONFIRMED',confirmedAt:new Date(),resultJson:JSON.stringify(counts),rowsJson:'[]'}});
  return counts;
 },{timeout:120000});
}

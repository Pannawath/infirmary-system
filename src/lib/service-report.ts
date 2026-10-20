import {prisma} from './db';
import type {Prisma} from '@prisma/client';
export async function serviceReport(params:URLSearchParams,includeStudents=false){
 let from=params.get('from')||'';let to=params.get('to')||'';let termLabel='ช่วงวันที่กำหนดเอง';
 if(params.get('termId')){const term=await prisma.academicTerm.findUnique({where:{id:params.get('termId')!}});if(!term)throw Error('ไม่พบภาคเรียน');from=term.startDate.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});to=term.endDate.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});termLabel=`ปีการศึกษา ${term.academicYear} ภาคเรียนที่ ${term.termNumber}`}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('กรุณาเลือกช่วงวันที่ให้ถูกต้อง');
 const start=new Date(from+'T00:00:00+07:00');const end=new Date(to+'T00:00:00+07:00');
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||start.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})!==from||end.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})!==to)throw Error('วันที่ไม่ถูกต้อง');
 end.setUTCDate(end.getUTCDate()+1);
 const service=params.get('service')||'';const grade=params.get('grade')||'';const room=params.get('room')||'';
 if(service&&!['DISPENSE','WOUND_CARE','REST'].includes(service))throw Error('ประเภทบริการไม่ถูกต้อง');
 const where:Prisma.InfirmaryVisitWhereInput={visitedAt:{gte:start,lt:end},...(service?{serviceType:service}:{}),...(grade||room?{student:{...(grade?{gradeLevel:grade}:{}),...(room?{classroom:room}:{})}}:{})};
 const visits=await prisma.infirmaryVisit.findMany({where,orderBy:[{visitedAt:'asc'},{id:'asc'}],include:{student:{select:{gradeLevel:true,classroom:true,fullName:true,studentCode:true}},dispensedItems:{include:{medication:true}}}});
 const services:Record<string,number>={DISPENSE:0,WOUND_CARE:0,REST:0};const people=new Set<string>();
 const classes=new Map<string,{grade:string;room:string;visits:number;people:Set<string>;services:Record<string,number>}>();const meds=new Map<string,{name:string;unit:string;quantity:number}>();
 visits.forEach(v=>{people.add(v.studentId);services[v.serviceType]=(services[v.serviceType]||0)+1;const key=v.student.gradeLevel+'/'+v.student.classroom;let c=classes.get(key);if(!c){c={grade:v.student.gradeLevel,room:v.student.classroom,visits:0,people:new Set(),services:{DISPENSE:0,WOUND_CARE:0,REST:0}};classes.set(key,c)}c.visits++;c.people.add(v.studentId);c.services[v.serviceType]=(c.services[v.serviceType]||0)+1;v.dispensedItems.forEach(i=>{const previous=meds.get(i.medicationId);meds.set(i.medicationId,{name:i.medication.name,unit:i.medication.unit,quantity:(previous?.quantity||0)+i.quantity})})});
 return {from,to,termLabel,filters:{service,grade,room},total:visits.length,uniqueStudents:people.size,services,classes:Array.from(classes.values()).map(c=>({...c,people:c.people.size})).sort((a,b)=>(a.grade+'/'+a.room).localeCompare(b.grade+'/'+b.room,'th',{numeric:true})),medications:Array.from(meds.values()).sort((a,b)=>b.quantity-a.quantity),students:includeStudents?visits.map(v=>({date:v.visitedAt.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}),time:v.visitedAt.toLocaleTimeString('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}),code:v.student.studentCode,name:v.student.fullName,grade:v.student.gradeLevel,room:v.student.classroom,service:v.serviceType,symptoms:v.symptoms,medications:v.dispensedItems.map(i=>`${i.medication.name} ${i.quantity} ${i.medication.unit}`).join(', ')})):undefined};
}

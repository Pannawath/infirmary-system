import {createHash} from 'node:crypto';
import {prisma} from '@/lib/db';
import {readStudentExcel} from '@/lib/excel-students';
import {readStaffExcel} from '@/lib/excel-staff';
import {confirmStudentImport,diffStudents,importState} from '@/lib/student-import';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const yearId=new URL(request.url).searchParams.get('yearId');
 const batches=await prisma.studentImport.findMany({where:{status:'CONFIRMED',...(yearId?{yearId}:{})},select:{id:true,filename:true,confirmedAt:true,resultJson:true,year:{select:{year:true}},changes:{select:{studentCode:true,kind:true,changesJson:true}}},orderBy:{confirmedAt:'desc'},take:15});
 return Response.json(batches);
}
export async function POST(request:Request){try{
 if(Number(request.headers.get('content-length'))>6*1024*1024)throw Error('ขนาดไฟล์เกิน 5 MB');
 const form=await request.formData();const file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx')||file.size>5*1024*1024)throw Error('เลือกไฟล์ .xlsx ขนาดไม่เกิน 5 MB');
 const buffer=Buffer.from(await file.arrayBuffer());const mode=form.get('mode');
 if(mode==='inspect')return Response.json(await readStudentExcel(buffer));
 const yearId=String(form.get('yearId')||'');const columns=JSON.parse(String(form.get('columns')||'{}'));const sheet=String(form.get('sheet')||'');const headerRow=Number(form.get('headerRow'));
 const personType=form.get('personType')==='STAFF'?'STAFF':'STUDENT';
 const result=personType==='STAFF'?await readStaffExcel(buffer):await readStudentExcel(buffer,{columns,sheet,headerRow});if(!result.rows)throw Error('ไม่พบรายชื่อในไฟล์');
 const state=await importState(prisma,yearId);
 if(personType==='STAFF')for(const row of result.rows){if(!row.studentCode.startsWith('STAFF-AUTO-'))continue;const matches=state.students.filter(s=>s.personType==='STAFF'&&s.fullName.replace(/\s/g,'').normalize('NFC')===row.fullName.replace(/\s/g,'').normalize('NFC'));if(matches.length>1)throw Error('ชื่อบุคลากรซ้ำในระบบ กรุณาใส่รหัสบุคลากรในไฟล์');if(matches.length===1)row.studentCode=matches[0].studentCode}
 const changes=diffStudents(result.rows,state);
 const batch=await prisma.studentImport.create({data:{yearId,personType,filename:file.name.slice(0,250),fileHash:createHash('sha256').update(buffer).digest('hex'),rowsJson:JSON.stringify(result.rows),baseVersion:state.version}});
 return Response.json({id:batch.id,year:state.year.year,total:result.rows.length,changes,expiresAt:new Date(batch.createdAt.getTime()+30*60*1000)});
}catch(e){return Response.json({error:e instanceof Error?e.message:'อ่านไฟล์ไม่สำเร็จ'},{status:400})}}
export async function PATCH(request:Request){try{
 const body=await request.json();if(typeof body.id!=='string'||typeof body.pauseMissing!=='boolean'||body.confirm!==true)throw Error('กรุณายืนยันการนำเข้าและการพักสถานะ');
 return Response.json(await confirmStudentImport(body.id,body.pauseMissing));
}catch(e){return Response.json({error:e instanceof Error?e.message:'นำเข้าไม่สำเร็จ ไม่มีข้อมูลถูกแก้ไข'},{status:409})}}

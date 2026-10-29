import {prisma} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){
 const [years,current,terms]=await Promise.all([prisma.schoolYear.findMany({orderBy:{year:'desc'},include:{_count:{select:{enrollments:true}}}}),prisma.appSetting.findUnique({where:{key:'currentYearId'}}),prisma.academicTerm.findMany({orderBy:{termNumber:'asc'}})]);
 return Response.json({years:years.map(y=>({...y,terms:terms.filter(t=>t.academicYear===y.year)})),currentYearId:current?.value||null});
}
export async function POST(request:Request){try{
 const body=await request.json();if(!Number.isInteger(body.year)||body.year<2400||body.year>3000)return Response.json({error:'ระบุปีการศึกษา พ.ศ. ระหว่าง 2400–3000'},{status:400});
 const year=await prisma.schoolYear.create({data:{year:body.year}});return Response.json(year,{status:201});
}catch{return Response.json({error:'สร้างปีการศึกษาไม่ได้ อาจมีปีนี้แล้ว'},{status:409})}}
export async function PATCH(request:Request){try{
 const body=await request.json();if(typeof body.id!=='string')throw Error('เลือกปีการศึกษา');
 await prisma.$transaction(async tx=>{
  const year=await tx.schoolYear.findUnique({where:{id:body.id},include:{enrollments:true}});if(!year)throw Error('ไม่พบปีการศึกษา');
  if(!year.enrollments.some(e=>e.status==='ACTIVE'))throw Error('กรุณานำเข้ารายชื่อที่ใช้งานก่อนตั้งเป็นปีปัจจุบัน');
  const students=await tx.student.findMany();
  for(const s of students)await tx.infirmaryVisit.updateMany({where:{studentId:s.id,studentNameSnapshot:null},data:{studentNameSnapshot:s.fullName,gradeSnapshot:s.gradeLevel,classroomSnapshot:s.classroom}});
  await tx.student.updateMany({data:{isActive:false}});
  for(const e of year.enrollments.filter(e=>e.status==='ACTIVE'))await tx.student.update({where:{id:e.studentId},data:{gradeLevel:e.gradeLevel,classroom:e.classroom,isActive:true}});
  await tx.appSetting.upsert({where:{key:'currentYearId'},create:{key:'currentYearId',value:year.id},update:{value:year.id}});
 },{timeout:120000});return Response.json({ok:true});
}catch(e){return Response.json({error:e instanceof Error?e.message:'ตั้งค่าปีไม่ได้'},{status:400})}}

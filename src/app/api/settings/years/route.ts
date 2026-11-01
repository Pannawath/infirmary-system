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
  const students=await tx.student.findMany();
  for(const s of students)await tx.infirmaryVisit.updateMany({where:{studentId:s.id,studentNameSnapshot:null},data:{studentNameSnapshot:s.fullName,gradeSnapshot:s.gradeLevel,classroomSnapshot:s.classroom}});
  await tx.student.updateMany({data:{isActive:false}});
  for(const e of year.enrollments.filter(e=>e.status==='ACTIVE'))await tx.student.update({where:{id:e.studentId},data:{gradeLevel:e.gradeLevel,classroom:e.classroom,isActive:true}});
  await tx.appSetting.upsert({where:{key:'currentYearId'},create:{key:'currentYearId',value:year.id},update:{value:year.id}});
 },{timeout:120000});return Response.json({ok:true});
}catch(e){return Response.json({error:e instanceof Error?e.message:'ตั้งค่าปีไม่ได้'},{status:400})}}

export async function DELETE(request:Request){try{
 const {searchParams}=new URL(request.url);
 const id=searchParams.get('id');
 if(!id)throw Error('ไม่พบรหัสปีการศึกษาที่ต้องการลบ');
 await prisma.$transaction(async tx=>{
  const year=await tx.schoolYear.findUnique({where:{id},include:{enrollments:true,imports:{include:{changes:true}}}});
  if(!year)throw Error('ไม่พบปีการศึกษานี้');
  
  // 1. Delete import changes and imports
  for(const imp of year.imports){
    await tx.studentImportChange.deleteMany({where:{importId:imp.id}});
  }
  await tx.studentImport.deleteMany({where:{yearId:id}});

  // 2. Delete enrollments of this year
  await tx.studentEnrollment.deleteMany({where:{yearId:id}});

  // 3. Delete academic terms of this year
  await tx.academicTerm.deleteMany({where:{academicYear:year.year}});

  // 4. Delete the school year
  await tx.schoolYear.delete({where:{id}});

  // 5. If this year was currentYearId, switch to another year or unset
  const current=await tx.appSetting.findUnique({where:{key:'currentYearId'}});
  if(current?.value===id){
    const nextYear=await tx.schoolYear.findFirst({orderBy:{year:'desc'}});
    if(nextYear){
      await tx.appSetting.update({where:{key:'currentYearId'},data:{value:nextYear.id}});
      const nextEnrollments=await tx.studentEnrollment.findMany({where:{yearId:nextYear.id,status:'ACTIVE'}});
      await tx.student.updateMany({data:{isActive:false}});
      for(const e of nextEnrollments){
        await tx.student.update({where:{id:e.studentId},data:{gradeLevel:e.gradeLevel,classroom:e.classroom,isActive:true}});
      }
    }else{
      await tx.appSetting.delete({where:{key:'currentYearId'}});
      await tx.student.updateMany({data:{isActive:false}});
    }
  }
 });
 return Response.json({ok:true});
}catch(e){return Response.json({error:e instanceof Error?e.message:'ลบปีการศึกษาไม่ได้'},{status:400})}}

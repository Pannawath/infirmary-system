import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await prisma.academicTerm.findMany({orderBy:[{academicYear:'desc'},{termNumber:'desc'}]}))}
async function save(request:Request,edit:boolean){
 try{
  const b=await request.json();const year=Number(b.academicYear);const number=Number(b.termNumber);
  if(!Number.isInteger(year)||year<2400||year>3000||![1,2,3].includes(number)||!/^\d{4}-\d{2}-\d{2}$/.test(b.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(b.endDate))return NextResponse.json({error:'ตรวจสอบปี พ.ศ. ภาคเรียน และวันที่'},{status:400});
  const start=new Date(b.startDate+'T00:00:00+07:00');const end=new Date(b.endDate+'T00:00:00+07:00');
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||start>end||start.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})!==b.startDate||end.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})!==b.endDate)return NextResponse.json({error:'ตรวจสอบวันที่ และวันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น'},{status:400});
  const result=await prisma.$transaction(async tx=>{
   const overlap=await tx.academicTerm.findFirst({where:{...(edit?{id:{not:b.id}}:{}),startDate:{lte:end},endDate:{gte:start}}});
   if(overlap)throw Error('OVERLAP');
   const data={academicYear:year,termNumber:number,startDate:start,endDate:end};
   return edit?tx.academicTerm.update({where:{id:b.id},data}):tx.academicTerm.create({data});
  });return NextResponse.json(result,{status:edit?200:201});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='OVERLAP'?'ช่วงวันที่ทับซ้อนกับภาคเรียนอื่น':'บันทึกไม่ได้ ตรวจสอบภาคเรียนซ้ำหรือข้อมูลที่กรอก'},{status:409})}
}
export async function POST(r:Request){return save(r,false)}
export async function PATCH(r:Request){return save(r,true)}

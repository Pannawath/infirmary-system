import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const month=new URL(request.url).searchParams.get('month')||'';
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'เดือนที่เลือกไม่ถูกต้อง'},{status:400});
 const start=new Date(`${month}-01T00:00:00+07:00`);const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)-7*60*60*1000);
 try{
  const visits=await prisma.infirmaryVisit.findMany({where:{visitedAt:{gte:start,lt:end}},select:{visitedAt:true,studentId:true,dispensedItems:{select:{quantity:true,medication:{select:{unit:true}}}}}});
  const days:Record<string,{visits:number;students:Set<string>;medicineLines:number;units:Record<string,number>}>={};
  visits.forEach(v=>{const date=v.visitedAt.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});const day=days[date]??={visits:0,students:new Set(),medicineLines:0,units:{}};day.visits++;day.students.add(v.studentId);day.medicineLines+=v.dispensedItems.length;v.dispensedItems.forEach(i=>{day.units[i.medication.unit]=(day.units[i.medication.unit]||0)+i.quantity})});
  return NextResponse.json({month,days:Object.fromEntries(Object.entries(days).map(([date,d])=>[date,{...d,students:d.students.size}]))});
 }catch{return NextResponse.json({error:'โหลดปฏิทินไม่สำเร็จ'},{status:500})}
}

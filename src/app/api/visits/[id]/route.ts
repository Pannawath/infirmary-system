import {prisma} from '@/lib/db';
import {createHash} from 'node:crypto';
const version=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const include={student:true,dispensedItems:{include:{medication:true}}} as const;
export async function GET(_:Request,{params}:{params:{id:string}}){
 const visit=await prisma.infirmaryVisit.findUnique({where:{id:params.id},include});
 if(!visit)return Response.json({error:'ไม่พบประวัติ'},{status:404});
 return Response.json({...visit,editVersion:version(visit)});
}
export async function PATCH(request:Request,{params}:{params:{id:string}}){
 try{
  const b=await request.json();const date=new Date(b.visitedAt);
  if(typeof b.symptoms!=='string'||!b.symptoms.trim()||!Number.isFinite(+date)||typeof b.editVersion!=='string'||typeof b.treatmentNotes!=='string'||!Array.isArray(b.dispensedMedicines)||b.dispensedMedicines.some((i:{medicationId?:string;quantity:number;instructions?:string})=>typeof i.medicationId!=='string'||!Number.isSafeInteger(i.quantity)||i.quantity<=0||(i.instructions!=null&&typeof i.instructions!=='string'))||new Set(b.dispensedMedicines.map((i:{medicationId:string})=>i.medicationId)).size!==b.dispensedMedicines.length)return Response.json({error:'ตรวจสอบอาการ วันที่ และจำนวนยา (จำนวนเต็มมากกว่า 0)'},{status:400});
  await prisma.$transaction(async tx=>{
   const old=await tx.infirmaryVisit.findUnique({where:{id:params.id},include});
   if(!old)throw Error('NOT_FOUND');
   if(version(old)!==b.editVersion)throw Error('CONFLICT');
   if(old.serviceType==='DISPENSE'&&!b.dispensedMedicines.length)throw Error('MED_REQUIRED');
   // Return the previous quantities first, then deduct the replacement within one transaction.
   for(const item of old.dispensedItems)await tx.medication.update({where:{id:item.medicationId},data:{stockQuantity:{increment:item.quantity}}});
   for(const item of b.dispensedMedicines){const result=await tx.medication.updateMany({where:{id:item.medicationId,stockQuantity:{gte:item.quantity}},data:{stockQuantity:{decrement:item.quantity}}});if(result.count!==1)throw Error('STOCK')}
   await tx.dispensedItem.deleteMany({where:{visitId:old.id}});
   await tx.infirmaryVisit.update({where:{id:old.id},data:{symptoms:b.symptoms.trim(),treatmentNotes:b.treatmentNotes.trim()||null,visitedAt:date,dispensedItems:{create:b.dispensedMedicines.map((i:{medicationId:string;quantity:number;instructions?:string})=>({medicationId:i.medicationId,quantity:i.quantity,instructions:i.instructions?.trim()||null}))}}});
  });return Response.json({ok:true});
 }catch(e){const message=e instanceof Error?e.message:'';const errors:Record<string,string>={NOT_FOUND:'ไม่พบประวัติ',CONFLICT:'ข้อมูลหรือคลังยามีการเปลี่ยนแปลง กรุณาปิดแล้วเปิดแก้ไขใหม่',MED_REQUIRED:'รายการจ่ายยาต้องมียาอย่างน้อย 1 รายการ',STOCK:'ยาไม่เพียงพอหรือไม่พบยา ไม่มีการเปลี่ยนข้อมูล'};return Response.json({error:errors[message]||'บันทึกไม่สำเร็จ ไม่มีการเปลี่ยนข้อมูล'},{status:message==='NOT_FOUND'?404:message==='MED_REQUIRED'?400:409})}
}

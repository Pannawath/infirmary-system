const assert=require('node:assert/strict');const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();const base='http://127.0.0.1:3102';
(async()=>{let student,med,other,visit;try{
 const key=String(Date.now());student=await p.student.create({data:{studentCode:'edit-test-'+key,fullName:'ทดสอบชั่วคราว',gradeLevel:'ทดสอบ',classroom:'0'}});
 med=await p.medication.create({data:{name:'edit-test-'+key,stockQuantity:8}});other=await p.medication.create({data:{name:'edit-other-'+key,stockQuantity:5}});
 visit=await p.infirmaryVisit.create({data:{studentId:student.id,symptoms:'เดิม',dispensedItems:{create:{medicationId:med.id,quantity:2}}}});
 const get=()=>fetch(base+'/api/visits/'+visit.id).then(r=>r.json());
 const patch=(v,items)=>fetch(base+'/api/visits/'+visit.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({editVersion:v.editVersion,symptoms:'แก้ไข',visitedAt:v.visitedAt,treatmentNotes:'ทดสอบ',dispensedMedicines:items})});
 let v=await get();assert.equal((await patch(v,[{medicationId:med.id,quantity:4}])).status,200);assert.equal((await p.medication.findUnique({where:{id:med.id}})).stockQuantity,6);
 assert.equal((await patch(v,[{medicationId:med.id,quantity:4}])).status,409);
 v=await get();assert.equal((await patch(v,[{medicationId:other.id,quantity:50}])).status,409);assert.equal((await p.medication.findUnique({where:{id:med.id}})).stockQuantity,6);assert.equal((await get()).dispensedItems[0].quantity,4);
 assert.equal((await patch(v,[{medicationId:other.id,quantity:3}])).status,200);assert.equal((await p.medication.findUnique({where:{id:med.id}})).stockQuantity,10);assert.equal((await p.medication.findUnique({where:{id:other.id}})).stockQuantity,2);
 v=await get();assert.equal((await patch(v,[])).status,400);assert.equal((await patch(v,[{medicationId:other.id,quantity:-1}])).status,400);
 console.log('PASS: edit fields, stock difference, medicine replacement, stale edit rejection, insufficient stock rollback, invalid quantity');
}finally{if(visit)await p.infirmaryVisit.delete({where:{id:visit.id}});if(student)await p.student.delete({where:{id:student.id}});for(const m of [med,other])if(m)await p.medication.delete({where:{id:m.id}});await p.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});

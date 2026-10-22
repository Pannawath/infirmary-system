const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();const base='http://127.0.0.1:3102';
const del=(path,data)=>fetch(base+path,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{let student,med,unused;const visits=[];try{
 const key=Date.now();student=await p.student.create({data:{studentCode:'delete-test-'+key,fullName:'ทดสอบลบชั่วคราว',gradeLevel:'ทดสอบ',classroom:'0'}});
 med=await p.medication.create({data:{name:'delete-test-'+key,stockQuantity:8}});unused=await p.medication.create({data:{name:'delete-unused-'+key,stockQuantity:5}});
 const create=async()=>{const v=await p.infirmaryVisit.create({data:{studentId:student.id,symptoms:'ทดสอบ',dispensedItems:{create:{medicationId:med.id,quantity:2}}}});visits.push(v.id);return v};
 let visit=await create();
 assert.equal((await del('/api/medications',{id:med.id,updatedAt:med.updatedAt.toISOString()})).status,409);
 assert.equal((await del('/api/medications',{id:unused.id,updatedAt:'2000-01-01'})).status,409);
 assert.equal((await del('/api/medications',{id:unused.id,updatedAt:unused.updatedAt.toISOString()})).status,200);
 assert.equal((await del('/api/medications',{id:unused.id,updatedAt:unused.updatedAt.toISOString()})).status,404);
 const path='/api/visits/'+visit.id;
 assert.equal((await del(path,{editVersion:'stale',returnStock:true})).status,409);
 let v=await fetch(base+path).then(r=>r.json());
 assert.equal((await del(path,{editVersion:v.editVersion})).status,400);
 assert.equal((await del(path,{editVersion:v.editVersion,returnStock:false})).status,200);
 assert.equal((await p.medication.findUnique({where:{id:med.id}})).stockQuantity,8);
 assert.equal(await p.dispensedItem.count({where:{visitId:visit.id}}),0);
 assert.equal((await del(path,{editVersion:v.editVersion,returnStock:true})).status,404);
 visit=await create();v=await fetch(base+'/api/visits/'+visit.id).then(r=>r.json());
 assert.equal((await del('/api/visits/'+visit.id,{editVersion:v.editVersion,returnStock:true})).status,200);
 const current=await p.medication.findUnique({where:{id:med.id}});assert.equal(current.stockQuantity,10);
 assert.equal((await del('/api/medications',{id:med.id,updatedAt:current.updatedAt.toISOString()})).status,200);
 console.log('PASS: delete unused medication, protect linked medication, stale rejection, history deletion with/without stock return, cascade, duplicate rejection');
 }finally{await p.infirmaryVisit.deleteMany({where:{id:{in:visits}}});await p.medication.deleteMany({where:{id:{in:[med?.id,unused?.id].filter(Boolean)}}});if(student)await p.student.delete({where:{id:student.id}});await p.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});

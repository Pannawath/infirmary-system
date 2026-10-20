const {PrismaClient}=require('@prisma/client');const assert=require('node:assert/strict');const p=new PrismaClient();
const origin=process.env.TEST_ORIGIN||'http://localhost:3102';
(async()=>{let student;const ids=[];try{
 student=await p.student.create({data:{studentCode:`service-test-${Date.now()}`,fullName:'ทดสอบชั่วคราว',gradeLevel:'ม.1',classroom:'1'}});
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
 const before=await fetch(`${origin}/api/reports/services?from=${today}&to=${today}`).then(r=>r.json());
 for(const serviceType of ['WOUND_CARE','REST']){
  const r=await fetch(origin+'/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:student.id,symptoms:'ทดสอบบริการ',serviceType,dispensedMedicines:[]})});const v=await r.json();assert.equal(r.status,201);ids.push(v.id);assert.equal(v.serviceType,serviceType);assert.equal(v.bedRest,serviceType==='REST');
 }
 const after=await fetch(`${origin}/api/reports/services?from=${today}&to=${today}`).then(r=>r.json());assert.equal(after.total,before.total+2);assert.equal(after.services.REST,before.services.REST+1);assert.equal(after.services.WOUND_CARE,before.services.WOUND_CARE+1);
 assert.equal((await fetch(`${origin}/api/reports/services?from=2026-10-22&to=2026-10-01`)).status,400);
 assert.equal(await p.student.count({where:{isActive:true,studentCode:{not:student.studentCode}}}),3760);
 console.log('PASS: roster=3760, wound care, rest, no medication required, date-range report, invalid dates');
}finally{for(const id of ids)await p.infirmaryVisit.delete({where:{id}});if(student)await p.student.delete({where:{id:student.id}});await p.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});

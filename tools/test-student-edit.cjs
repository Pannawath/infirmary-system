const {PrismaClient}=require('@prisma/client');
const assert=require('node:assert/strict');
const p=new PrismaClient();
(async()=>{
 let student;
 try {
  student=await p.student.create({data:{studentCode:`test-${Date.now()}`,fullName:'นักเรียนทดสอบชั่วคราว',gradeLevel:'ม.1',classroom:'1'}});
  const payload={...student,allergies:'แพ้กุ้ง: มีผื่น; แพ้ยาเพนิซิลลิน',chronicDiseases:'หอบหืด',guardianPhone:''};
  const response=await fetch('http://localhost:3100/api/students',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(response.status,200);
  const saved=await p.student.findUnique({where:{id:student.id}});
  assert.equal(saved.allergies,payload.allergies);assert.equal(saved.chronicDiseases,payload.chronicDiseases);
  const search=await fetch(`http://localhost:3100/api/students?q=${student.studentCode}`).then(r=>r.json());
  assert.equal(search[0].allergies,payload.allergies);
  const bad=await fetch('http://localhost:3100/api/students',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,fullName:''})});
  assert.equal(bad.status,400);
  console.log('PASS: student edit persists, search returns allergy details, required-field validation');
 } finally {if(student)await p.student.delete({where:{id:student.id}});await p.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});

const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const prisma = new PrismaClient();
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
async function request(path, method = 'GET', body) {
  const response = await fetch(origin + path, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
(async () => {
  let medId, visitId;
  try {
    const students = await request('/api/students');
    assert.equal(students.status, 200);
    assert.ok(students.data.length > 0 && students.data.length <= 10);
    const created = await request('/api/medications', 'POST', { name: `__smoke_${Date.now()}`, category: 'ทดสอบ', unit:'เม็ด', stockQuantity:5, minThreshold:1 });
    assert.equal(created.status,201); medId = created.data.id;
    const updated = await request('/api/medications','PATCH',{...created.data,stockQuantity:8});
    assert.equal(updated.status,200); assert.equal(updated.data.stockQuantity,8);
    const bad = await request('/api/medications','PATCH',{...updated.data,stockQuantity:-1});
    assert.equal(bad.status,400);
    const visit = await request('/api/visits','POST',{studentId:students.data[0].id,symptoms:'ทดสอบระบบ',dispensedMedicines:[{medicationId:medId,quantity:2}]});
    assert.equal(visit.status,201); visitId=visit.data.id;
    assert.equal((await prisma.medication.findUnique({where:{id:medId}})).stockQuantity,6);
    const count = await prisma.infirmaryVisit.count();
    const insufficient = await request('/api/visits','POST',{studentId:students.data[0].id,symptoms:'ทดสอบสต็อก',dispensedMedicines:[{medicationId:medId,quantity:100}]});
    assert.equal(insufficient.status,409);
    assert.equal(await prisma.infirmaryVisit.count(),count);
    assert.equal((await prisma.medication.findUnique({where:{id:medId}})).stockQuantity,6);
    assert.equal((await request('/api/reports/summary')).status,200);
    console.log('PASS: student search, create/edit medication, validation, dispensing, stock deduction, rollback, summary');
  } finally {
    // Remove only records created by this test; existing records are preserved.
    if(visitId) await prisma.infirmaryVisit.delete({where:{id:visitId}});
    if(medId) await prisma.medication.delete({where:{id:medId}});
    await prisma.$disconnect();
  }
})().catch(error=>{console.error(error);process.exitCode=1});

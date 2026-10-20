const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();const base=process.env.TEST_ORIGIN||'http://127.0.0.1:3102';
const send=(method,data)=>fetch(base+'/api/terms',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{let id;try{
 const data={academicYear:2990,termNumber:3,startDate:'2447-01-01',endDate:'2447-03-31'};
 let r=await send('POST',data);assert.equal(r.status,201);id=(await r.json()).id;
 assert.equal((await send('POST',data)).status,409);
 assert.equal((await send('POST',{...data,termNumber:2})).status,409);
 assert.equal((await send('POST',{...data,startDate:'2447-02-30'})).status,400);
 r=await send('PATCH',{...data,id,endDate:'2447-04-30'});assert.equal(r.status,200);
 const report=await fetch(base+'/api/reports/services?termId='+id).then(r=>r.json());assert.equal(report.to,'2447-04-30');assert.equal(report.total,0);
 const all=await fetch(base+'/api/reports/services?from=2020-01-01&to=2030-12-31').then(r=>r.json());
 assert.equal(all.total,await p.infirmaryVisit.count({where:{visitedAt:{gte:new Date('2020-01-01T00:00:00+07:00'),lt:new Date('2031-01-01T00:00:00+07:00')}}}));
 const filtered=await fetch(base+'/api/reports/services?from=2020-01-01&to=2030-12-31&service=REST').then(r=>r.json());assert.equal(filtered.total,all.services.REST);
 r=await fetch(base+'/api/reports/export?termId='+id);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/spreadsheetml/);
 const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.readUInt32LE(0),0x04034b50);
 const entries=[];let pos=0;while(bytes.readUInt32LE(pos)===0x04034b50){const size=bytes.readUInt32LE(pos+18),n=bytes.readUInt16LE(pos+26),e=bytes.readUInt16LE(pos+28);entries.push(bytes.subarray(pos+30,pos+30+n).toString());pos+=30+n+e+size;}assert.equal(entries.filter(n=>/^xl\/worksheets\//.test(n)).length,4);
 const exported=Buffer.from(await (await fetch(base+'/api/reports/export?from=2020-01-01&to=2030-12-31')).arrayBuffer()).toString('utf8');
 assert.ok(exported.includes('รายชื่อนักเรียน'));assert.ok(exported.includes('ชื่อ-นามสกุล'));
 const visit=await p.infirmaryVisit.findFirst({where:{visitedAt:{gte:new Date('2020-01-01T00:00:00+07:00'),lt:new Date('2031-01-01T00:00:00+07:00')}},include:{student:true}});
 if(visit){const escaped=visit.student.fullName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');assert.ok(exported.includes(escaped));assert.ok(exported.includes(visit.student.studentCode));}
 console.log('PASS: term create/edit, duplicate/overlap/invalid rejection, report totals and filters, XLSX four worksheets with student names and codes');
}finally{if(id)await p.academicTerm.delete({where:{id}});await p.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});

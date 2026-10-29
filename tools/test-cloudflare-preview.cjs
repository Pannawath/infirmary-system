const assert=require('node:assert/strict');const http=require('node:http');const {handle}=require('./cloudflare-preview.cjs');
(async()=>{const server=http.createServer(handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;try{
 let r=await fetch(base+'/api/students');const students=await r.json();assert.equal(students.length,10);assert.ok(students.every(s=>s.studentCode.startsWith('DEMO')&&s.fullName.startsWith('นักเรียนตัวอย่าง')));assert.equal(r.headers.get('x-preview-data'),'synthetic-only');
 for(const method of ['POST','PATCH','DELETE'])assert.equal((await fetch(base+'/api/visits',{method,body:'{}'})).status,403);
 for(const path of ['/prisma/dev.db','/.env','/api/reports/export','/api/unknown','/_next/static/../../../prisma/dev.db','/server.js','/school-logo-source.md'])assert.equal((await fetch(base+path)).status,404);
 r=await fetch(base+'/api/reports/summary');assert.equal((await r.json()).summary.totalStudents,10);
 const history=await fetch(base+'/api/visits?history=1').then(r=>r.json());assert.ok(history.items.every(v=>v.student.studentCode.startsWith('DEMO')));
 console.log('PASS: only synthetic data, all writes blocked, unknown API/files/path traversal blocked');
 }finally{await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});

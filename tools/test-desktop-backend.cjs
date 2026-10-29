const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');const ExcelJS=require('exceljs');
const root=path.resolve(__dirname,'..'),backend=path.join(root,'src-tauri/backend'),dir=fs.mkdtempSync(path.join(root,'work','desktop-smoke-')),database=path.join(dir,'desktop.db');
const child=spawn(path.join(backend,'node.exe'),['desktop-bootstrap.cjs'],{cwd:backend,env:{...process.env,PORT:'3114',HOSTNAME:'127.0.0.1',NODE_ENV:'production',INFIRMARY_DESKTOP_TOKEN:'',INFIRMARY_DATABASE_URL:'file:'+database.replaceAll('\\','/')},windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',x=>logs=(logs+x).slice(-3000));child.stderr.on('data',x=>logs=(logs+x).slice(-3000));
(async()=>{try{
 const base='http://127.0.0.1:3114';let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready,logs);
 for(const p of ['/api/students','/api/medications','/api/visits']){const r=await fetch(base+p);assert.equal(r.status,200,logs);assert.equal((await r.json()).length,0)}
 const year=await fetch(base+'/api/settings/years',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:2999})});assert.equal(year.status,201);const y=await year.json();
 const w=new ExcelJS.Workbook();w.addWorksheet('บุคลากรทดสอบ').addRows([['ลำดับ','ชื่อ - นามสกุล','ตำแหน่ง'],[1,'ชื่อ บุคลากรทดสอบ','ครู']]);const f=new FormData();f.set('file',new Blob([await w.xlsx.writeBuffer()]),'staff.xlsx');f.set('personType','STAFF');f.set('yearId',y.id);f.set('mode','preview');
 const preview=await fetch(base+'/api/settings/student-imports',{method:'POST',body:f});const d=await preview.json();assert.equal(preview.status,200,JSON.stringify(d));assert.equal(d.total,1);
 console.log('PASS: bundled Node boots standalone backend, creates empty DB, serves all empty APIs, creates school year and parses staff XLSX.');
 }finally{child.kill()}})().catch(e=>{console.error(e);console.error(logs);process.exitCode=1});

const fs=require('node:fs');
const path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const rows=input.filter(s=>/^\d{4,8}$/.test(s.studentCode));
 if(!rows.length||new Set(rows.map(s=>s.studentCode)).size!==rows.length)throw Error('Empty or duplicate roster');
 for(const s of rows)if(!/^\d{4,8}$/.test(s.studentCode)||!s.fullName||!s.gradeLevel||!s.classroom)throw Error('Invalid student data; nothing imported');
 const backup=path.resolve('prisma',`backup-before-roster-${Date.now()}.db`).replaceAll('\\','/');
 await p.$executeRawUnsafe(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
 await p.$transaction(async tx=>{
   await tx.student.updateMany({data:{isActive:false}});
   for(const s of rows)await tx.student.upsert({where:{studentCode:s.studentCode},create:{...s,isActive:true},update:{...s,isActive:true}});
 },{timeout:120000});
 console.log(JSON.stringify({imported:rows.length,skipped:input.length-rows.length,active:await p.student.count({where:{isActive:true}}),backup}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.$disconnect());

const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const backup=new PrismaClient({datasources:{db:{url:'file:'+process.argv[2].replaceAll('\\','/')}}});
(async()=>{
 const originals=await backup.student.findMany();
 if(originals.length>20)throw Error('Expected small demo database; manual review required');
 let separated=0;
 await p.$transaction(async tx=>{
  for(const old of originals){
   const current=await tx.student.findUnique({where:{id:old.id}});
   if(!current||!current.isActive)continue;
   const real={studentCode:current.studentCode,fullName:current.fullName,gradeLevel:current.gradeLevel,classroom:current.classroom};
   await tx.student.update({where:{id:old.id},data:{studentCode:`demo-${old.studentCode}-${old.id.slice(0,8)}`,fullName:old.fullName,gradeLevel:old.gradeLevel,classroom:old.classroom,allergies:old.allergies,chronicDiseases:old.chronicDiseases,guardianPhone:old.guardianPhone,isActive:false}});
   await tx.student.create({data:{...real,isActive:true}});separated++;
  }
 });
 console.log(JSON.stringify({separated,active:await p.student.count({where:{isActive:true}}),importedWithAllergies:await p.student.count({where:{isActive:true,allergies:{not:null}}})}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await p.$disconnect();await backup.$disconnect()});

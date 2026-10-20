import {serviceReport} from '@/lib/service-report';
import {xlsx} from '@/lib/xlsx';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const d=await serviceReport(new URL(request.url).searchParams,true);const serviceNames:Record<string,string>={DISPENSE:'จ่ายยา',WOUND_CARE:'ทำแผล',REST:'นอนพัก'};
 const data=xlsx([
 {name:'รายชื่อนักเรียน',rows:[['รายงานผู้ใช้บริการห้องพยาบาล'],[d.termLabel],[`ตั้งแต่ ${d.from} ถึง ${d.to}`],['บริการ',serviceNames[d.filters.service]||'ทั้งหมด','ชั้น',d.filters.grade||'ทั้งหมด','ห้อง',d.filters.room||'ทั้งหมด'],['หนึ่งแถวต่อการรับบริการหนึ่งครั้ง'],['ชื่อ-นามสกุล','รหัสนักเรียน','ชั้น','ห้อง','วันที่','เวลา','บริการ','อาการเบื้องต้น','ยาที่ได้รับ / จำนวน'],...(d.students||[]).map(s=>[s.name,s.code,s.grade,s.room,s.date,s.time,serviceNames[s.service]||s.service,s.symptoms,s.medications||'ไม่มีการเบิกยา'])]},
 {name:'สรุปบริการ',rows:[['รายงานห้องพยาบาล โรงเรียนสารคามพิทยาคม'],[d.termLabel],[`ตั้งแต่ ${d.from} ถึง ${d.to}`],['บริการ',serviceNames[d.filters.service]||'ทั้งหมด'],['ชั้น',d.filters.grade||'ทั้งหมด'],['ห้อง',d.filters.room||'ทั้งหมด'],['ประเภทบริการ','จำนวนครั้ง'],['จ่ายยา',d.services.DISPENSE],['ทำแผล',d.services.WOUND_CARE],['นอนพัก',d.services.REST],['รวมครั้ง',d.total],['นักเรียนไม่ซ้ำ (คน)',d.uniqueStudents]]},
 {name:'แยกชั้นและห้อง',rows:[['ชั้น','ห้อง','ครั้ง','คนไม่ซ้ำ','จ่ายยา','ทำแผล','นอนพัก'],...d.classes.map(c=>[c.grade,c.room,c.visits,c.people,c.services.DISPENSE,c.services.WOUND_CARE,c.services.REST])]},
 {name:'ยอดเบิกยา',rows:[['ชื่อยา','จำนวน','หน่วย'],...d.medications.map(m=>[m.name,m.quantity,m.unit])]}
 ]);
 return new Response(new Uint8Array(data),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="infirmary-report-${d.from}-${d.to}.xlsx"`,'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'ส่งออกไม่สำเร็จ'},{status:400})}}

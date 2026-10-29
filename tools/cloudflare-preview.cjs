// Public, read-only demonstration. NEVER forward API requests to the real backend.
const http=require('node:http');
const origin='http://127.0.0.1:3105';
const date=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
const today=date(new Date());const now=new Date().toISOString();
const students=Array.from({length:10},(_,i)=>({id:`preview-student-${i}`,studentCode:`DEMO${String(i+1).padStart(3,'0')}`,fullName:`นักเรียนตัวอย่าง ${String(i+1).padStart(2,'0')}`,gradeLevel:`ม.${i%3+1}`,classroom:String(i%2+1),allergies:i===2?'ข้อมูลสาธิต: แพ้อาหารตัวอย่าง':'ไม่มี',chronicDiseases:null,guardianPhone:null,isActive:true}));
const medications=[['พาราเซตามอล 500 mg','เม็ด',120,20],['เกลือแร่ ORS','ซอง',2,10],['น้ำเกลือล้างแผล','ขวด',24,5],['แอมโมเนียหอม','ขวด',0,5],['ผ้าก๊อซ','ชิ้น',80,15],['พลาสเตอร์','แผ่น',60,10]].map(([name,unit,stockQuantity,minThreshold],i)=>({id:`preview-med-${i}`,name,unit,stockQuantity,minThreshold,category:i<2?'ยาทั่วไป':'เวชภัณฑ์',indications:'ข้อมูลตัวอย่างสำหรับแสดงหน้าจอเท่านั้น',updatedAt:now}));
const visits=Array.from({length:28},(_,i)=>{const time=new Date(`${today}T09:00:00+07:00`);time.setDate(time.getDate()-Math.floor(i/4));time.setMinutes(i%4*20);const serviceType=['DISPENSE','WOUND_CARE','REST'][i%3];return {id:`preview-visit-${i}`,visitedAt:time.toISOString(),serviceType,symptoms:['ปวดศีรษะ','แผล / ฟกช้ำ','เวียนศีรษะ'][i%3],treatmentNotes:'ข้อมูลสมมติ ใช้ทดสอบหน้าตาแอปเท่านั้น',student:students[i%10],studentId:students[i%10].id,dispensedItems:serviceType==='REST'?[]:[{id:`preview-item-${i}`,medicationId:medications[i%2===0?0:4].id,quantity:2,instructions:null,medication:medications[i%2===0?0:4]}]}});
const groups=Array.from(new Set(students.map(s=>s.gradeLevel+'/'+s.classroom))).map(key=>{const [gradeLevel,classroom]=key.split('/');return {gradeLevel,classroom,_count:{_all:students.filter(s=>s.gradeLevel===gradeLevel&&s.classroom===classroom).length}}});
const year=Number(today.slice(0,4));const terms=[{id:'preview-term',academicYear:year+543,termNumber:1,startDate:`${year}-05-01T00:00:00+07:00`,endDate:`${year}-10-31T00:00:00+07:00`}];
const filtered=p=>visits.filter(v=>(!p.get('from')||date(v.visitedAt)>=p.get('from'))&&(!p.get('to')||date(v.visitedAt)<=p.get('to'))&&(!p.get('service')||v.serviceType===p.get('service'))&&(!p.get('grade')||v.student.gradeLevel===p.get('grade'))&&(!p.get('room')||v.student.classroom===p.get('room'))&&(!p.get('q')||`${v.student.fullName} ${v.student.studentCode} ${v.symptoms}`.includes(p.get('q')))&&(!p.get('medication')||v.dispensedItems.some(i=>i.medication.name.includes(p.get('medication')))));
function api(path,p){
 if(path==='/api/medications')return medications;
 if(path==='/api/students'){const items=students.filter(s=>(!p.get('q')||`${s.fullName} ${s.studentCode}`.includes(p.get('q')))&&(!p.get('grade')||s.gradeLevel===p.get('grade'))&&(!p.get('room')||s.classroom===p.get('room')));return p.get('directory')==='1'?{items,total:items.length,groups,page:1,pageSize:30}:items}
 if(path==='/api/visits/calendar'){const days={};for(const v of visits){const key=date(v.visitedAt);if(!key.startsWith(p.get('month')||''))continue;const d=days[key]??={visits:0,students:0,medicineLines:0,units:{}};d.visits++;d.students++;d.medicineLines+=v.dispensedItems.length;for(const i of v.dispensedItems)d.units[i.medication.unit]=(d.units[i.medication.unit]||0)+i.quantity}return {month:p.get('month'),days}}
 if(path==='/api/visits'){const items=filtered(p);return p.get('history')==='1'?{items:items.slice(((Number(p.get('page'))||1)-1)*25,(Number(p.get('page'))||1)*25),total:items.length,groups,page:Number(p.get('page'))||1,pageSize:25}:items}
 if(/^\/api\/visits\/preview-visit-\d+$/.test(path)){const v=visits.find(v=>v.id===path.split('/').pop());return v?{...v,editVersion:'preview-readonly'}:null}
 if(path==='/api/terms')return terms;
 if(path==='/api/reports/summary')return {summary:{todayVisits:visits.filter(v=>date(v.visitedAt)===today).length,totalVisits:visits.length,totalStudents:students.length,lowStockCount:2,todayDispensed:visits.filter(v=>date(v.visitedAt)===today).reduce((n,v)=>n+v.dispensedItems.length,0)},recentVisits:visits.slice(0,5),topMedications:[]};
 if(path==='/api/reports/services'){const items=filtered(p);const services={DISPENSE:0,WOUND_CARE:0,REST:0};items.forEach(v=>services[v.serviceType]++);return {from:p.get('from')||today.slice(0,8)+'01',to:p.get('to')||today,termLabel:'ภาคเรียนตัวอย่าง',filters:{service:p.get('service')||'',grade:p.get('grade')||'',room:p.get('room')||''},total:items.length,uniqueStudents:new Set(items.map(v=>v.studentId)).size,services,classes:groups.map(g=>{const rows=items.filter(v=>v.student.gradeLevel===g.gradeLevel&&v.student.classroom===g.classroom);return {grade:g.gradeLevel,room:g.classroom,visits:rows.length,people:new Set(rows.map(v=>v.studentId)).size,services:Object.fromEntries(Object.keys(services).map(key=>[key,rows.filter(v=>v.serviceType===key).length]))}}),medications:medications.map(m=>({name:m.name,unit:m.unit,quantity:items.flatMap(v=>v.dispensedItems).filter(i=>i.medicationId===m.id).reduce((n,i)=>n+i.quantity,0)}))}}
 return null;
}
const banner='<aside style="position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#17375f;color:white;border-radius:12px;padding:7px 14px;font:12px system-ui;box-shadow:0 3px 18px #0002;pointer-events:none">PREVIEW · ข้อมูลสมมติ · ไม่บันทึกข้อมูลจริง</aside>';
const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Preview-Data':'synthetic-only','Content-Security-Policy':"frame-ancestors 'none'"};
function json(res,status,data){res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
async function handle(req,res){try{
 const url=new URL(req.url,'http://preview.local');const path=decodeURIComponent(url.pathname);
 if(!['GET','HEAD'].includes(req.method)){json(res,403,{error:'Preview ใช้ดูและทดลองเลือกข้อมูลเท่านั้น ไม่บันทึก แก้ไข หรือลบข้อมูลจริง'});return}
 if(path.startsWith('/api/')){const data=api(path,url.searchParams);json(res,data===null?404:200,data??{error:'ไม่มี API นี้ใน Preview'});return}
 if(path!=='/'&&!['/school-logo.png','/school-hero.png','/sidebar-school.png'].includes(path)&&!(/^\/_next\/static\/[a-zA-Z0-9_./@-]+$/.test(path)&&!path.split('/').includes('..'))){json(res,404,{error:'Not available in preview'});return}
 // Fixed upstream origin + allowlisted paths only. Never forward cookies, credentials,
 // query strings, arbitrary URLs or /api to the production server.
 const upstream=await fetch(origin+path,{signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!upstream.ok){res.writeHead(upstream.status,security);res.end();return}
 const type=upstream.headers.get('content-type')||'application/octet-stream';
 let body=Buffer.from(await upstream.arrayBuffer());if(path==='/')body=Buffer.from(body.toString().replace('</body>',banner+'</body>'));
 if(path.endsWith('.css'))body=Buffer.from(body.toString()+'\nbody::after{content:"PREVIEW · ข้อมูลสมมติ · ไม่บันทึกข้อมูลจริง";position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#17375f;color:white;border-radius:12px;padding:7px 14px;font:12px system-ui;box-shadow:0 3px 18px #0002;pointer-events:none;white-space:nowrap}');
 res.writeHead(200,{...security,'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);
 }catch{json(res,502,{error:'Preview temporarily unavailable'})}}
if(require.main===module)http.createServer(handle).listen(3106,'127.0.0.1',()=>console.log('Synthetic, read-only preview: http://127.0.0.1:3106'));
module.exports={handle,api};

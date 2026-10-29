import ExcelJS from 'exceljs';
import {validateImportRows} from './student-import';

// Check ZIP metadata before decompression to reject oversized/ZIP64/encrypted files.
export function checkZip(buffer:Buffer){
 if(buffer.length>5*1024*1024||buffer.length<22)throw Error('รองรับ .xlsx ขนาดไม่เกิน 5 MB');
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0)throw Error('ไฟล์ Excel ไม่ถูกต้อง');
 const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),size=0;
 if(count>5000||offset>=end)throw Error('ไฟล์มีขนาดหรือโครงสร้างเกินกำหนด');
 for(let i=0;i<count;i++){
  if(offset+46>end||buffer.readUInt32LE(offset)!==0x02014b50)throw Error('โครงสร้าง Excel ไม่ถูกต้อง');
  const expanded=buffer.readUInt32LE(offset+24);size+=expanded;
  if(expanded===0xffffffff||size>25*1024*1024||(buffer.readUInt16LE(offset+8)&1))throw Error('ไม่รองรับไฟล์เข้ารหัส หรือข้อมูลเกิน 25 MB');
  offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
 }
}
function value(cell:ExcelJS.Cell){
 if(cell.type===ExcelJS.ValueType.Formula)throw Error(`ช่อง ${cell.address} เป็นสูตร กรุณาแปลงเป็นค่าข้อมูลก่อนนำเข้า`);
 return cell.text.trim();
}
export async function readStudentExcel(buffer:Buffer,options?:{sheet:string;headerRow:number;columns:Record<string,number>}){
 checkZip(buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
 if(!options)return {sheets:workbook.worksheets.map(sheet=>{
  let headerRow=1;let columns:Record<string,number>={};
  for(let i=1;i<=Math.min(12,sheet.rowCount);i++){
   const labels=Array.from({length:Math.min(100,sheet.columnCount)},(_,c)=>sheet.getCell(i,c+1).text.trim());
   const find=(pattern:RegExp)=>labels.findIndex(v=>pattern.test(v))+1;
   const gradeLevel=find(/^(ชั้น|ระดับชั้น)$/),classroom=find(/^ห้อง$/);
   if(!gradeLevel||!classroom)continue;
   headerRow=i;const codes=labels.flatMap((v,c)=>/^(รหัสนักเรียน|เลขประจำตัวนักเรียน)$/.test(v)?[c+1]:[]);
   // Some official rosters repeat the identifier label: prefer school IDs, never civil IDs.
   const studentCode=codes.find(c=>{const samples=Array.from({length:Math.min(10,sheet.rowCount-i)},(_,r)=>sheet.getCell(i+1+r,c).text.trim()).filter(Boolean);return samples.length>0&&samples.every(v=>/^\d{4,8}$/.test(v))})||0;
   columns={studentCode,fullName:find(/^(ชื่อ|ชื่อ.?นามสกุล|ชื่อ.?สกุล)$/),prefix:find(/^คำนำหน้าชื่อ$/),lastName:find(/^นามสกุล$/),gradeLevel,classroom,rollNumber:find(/^เลขที่$/)};break;
  }
  const safe=new Set(Object.values(columns).filter(Boolean));
  return {name:sheet.name,rows:sheet.rowCount,headerRow,columns,sample:Array.from({length:Math.min(12,sheet.rowCount)},(_,i)=>({row:i+1,values:Array.from({length:Math.min(100,sheet.columnCount)},(_,c)=>i+1===headerRow?sheet.getCell(i+1,c+1).text.trim():safe.has(c+1)?value(sheet.getCell(i+1,c+1)):'') }))};
 })};
 const sheet=workbook.getWorksheet(options.sheet);if(!sheet)throw Error('ไม่พบชีตที่เลือก');
 if(!Number.isInteger(options.headerRow)||options.headerRow<1||options.headerRow>sheet.rowCount)throw Error('เลือกแถวหัวตารางให้ถูกต้อง');
 const required=['studentCode','fullName','gradeLevel','classroom'];
 if(required.some(key=>!Number.isInteger(options.columns[key])||options.columns[key]<1||options.columns[key]>Math.min(sheet.columnCount,100)))throw Error('จับคู่คอลัมน์รหัส ชื่อ ชั้น และห้องให้ครบ');
 const columns=Object.values(options.columns).filter(Boolean);if(new Set(columns).size!==columns.length)throw Error('กรุณาเลือกแต่ละคอลัมน์ไม่ซ้ำกัน');
 if(columns.some(c=>!Number.isInteger(c)||c<1||c>Math.min(100,sheet.columnCount)))throw Error('หมายเลขคอลัมน์ไม่ถูกต้อง');
 if(sheet.rowCount-options.headerRow>20000)throw Error('นำเข้าได้ไม่เกิน 20,000 แถว');
 const rows=[];
 for(let i=options.headerRow+1;i<=sheet.rowCount;i++){
  const row=Object.fromEntries([...required,'rollNumber','prefix','lastName'].map(key=>[key,options.columns[key]?value(sheet.getCell(i,options.columns[key])):'']));
  if(Object.values(row).every(v=>!v))continue;
  if(!row.studentCode&&!row.fullName&&!row.lastName)continue;
  row.fullName=[row.prefix+row.fullName,row.lastName].filter(Boolean).join(' ');
  rows.push(row);
 }
 return {rows:validateImportRows(rows)};
}

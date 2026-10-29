import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
import {checkZip} from './excel-students';
import {validateImportRows} from './student-import';

// Read only name, position and department. Civil IDs/qualifications never leave this parser.
export async function readStaffExcel(buffer:Buffer){
 checkZip(buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
 const rows:Record<string,string>[]=[],seen=new Set<string>();const sheets:{name:string;count:number}[]=[];
 for(const sheet of workbook.worksheets){
  if(sheet.rowCount>20000)throw Error('ข้อมูลเกิน 20,000 แถวต่อชีต');
  let header=0,nameCol=0,positionCol=0,codeCol=0,orderCol=0;
  for(let r=1;r<=Math.min(12,sheet.rowCount);r++){
   for(let c=1;c<=Math.min(sheet.columnCount,100);c++){
    const label=sheet.getCell(r,c).text.replace(/\s/g,'');
    if(/^ชื่อ[-–]?นามสกุล$/.test(label)){header=r;nameCol=c}
   }
   if(header){for(let c=1;c<=Math.min(sheet.columnCount,100);c++){const label=sheet.getCell(header,c).text.replace(/\s/g,'');if(label==='ตำแหน่ง')positionCol=c;if(/^(รหัสบุคลากร|รหัสพนักงาน)$/.test(label))codeCol=c;if(/^(ลำดับ(?:ที่)?|เลขที่)$/.test(label))orderCol=c}break}
  }
  if(!header)continue;let count=0;
  if(!orderCol&&nameCol>1&&Array.from({length:Math.min(5,sheet.rowCount-header)},(_,i)=>sheet.getCell(header+i+1,1).text.trim()).some(v=>/^\d+$/.test(v)))orderCol=1;
  for(let r=header+1;r<=sheet.rowCount;r++){
   const name=sheet.getCell(r,nameCol);const fullName=name.text.replace(/\s+/g,' ').trim();
   if(name.isMerged&&name.master.address!==name.address)continue;
   if(!fullName)continue;
   if(orderCol&&!/^\d+$/.test(sheet.getCell(r,orderCol).text.trim()))continue;
   if(/^#(?:REF!|VALUE!|N\/A|NAME\?|NUM!|DIV\/0!|NULL!)/.test(fullName))throw Error(`ชีต ${sheet.name} แถว ${r}: ชื่อเป็นสูตรลิงก์ไฟล์ภายนอกที่มีข้อผิดพลาด กรุณาแก้ลิงก์ใน Excel แล้วคัดลอกชื่อวางเป็นค่า (Paste Values) ก่อนนำเข้า ระบบยังไม่บันทึกข้อมูลใด ๆ`);
   // Use only the cached text saved by Excel; never execute or resolve formulas/links.
   if(name.type===ExcelJS.ValueType.Formula&&typeof name.result!=='string')throw Error(`ชีต ${sheet.name} แถว ${r}: ไม่พบค่าชื่อที่บันทึกไว้ กรุณาแปลงเป็นข้อความก่อน`);
   if(!/^[^0-9]{2,200}$/.test(fullName))throw Error(`ชีต ${sheet.name} แถว ${r}: ตรวจสอบชื่อบุคลากร`);
   const normalized=fullName.replace(/\s/g,'').normalize('NFC');
   if(seen.has(normalized))throw Error(`พบชื่อบุคลากรซ้ำในชีต ${sheet.name} แถว ${r} กรุณาตรวจสอบก่อนนำเข้า`);seen.add(normalized);
   const sourceCode=codeCol?sheet.getCell(r,codeCol).text.trim():'';
   if(/^\d{13}$/.test(sourceCode))throw Error('ใช้รหัสบุคลากรของโรงเรียน ไม่ใช่เลขบัตรประชาชน');
   const studentCode=sourceCode?'STAFF-CODE-'+sourceCode:'STAFF-AUTO-'+createHash('sha256').update(normalized).digest('hex').slice(0,16);
   const position=positionCol?sheet.getCell(r,positionCol).text.trim():'';
   rows.push({studentCode,fullName,personType:'STAFF',department:sheet.name,position,gradeLevel:'บุคลากร',classroom:sheet.name,rollNumber:''});count++;
  }
  sheets.push({name:sheet.name,count});
 }
 return {rows:validateImportRows(rows),sheets};
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.dispensedItem.deleteMany();
  await prisma.infirmaryVisit.deleteMany();
  await prisma.student.deleteMany();
  await prisma.medication.deleteMany();

  const students = [
    { studentCode: "50101", fullName: "เด็กชายกิตติศักดิ์ เจริญสุข", gradeLevel: "ม.1", classroom: "1", allergies: "แพ้ยาเพนิซิลลิน (Penicillin)", chronicDiseases: "หอบหืด", guardianPhone: "081-234-5678" },
    { studentCode: "50102", fullName: "เด็กหญิงชนิกานต์ วงศ์สุวรรณ", gradeLevel: "ม.1", classroom: "2", allergies: "ไม่มี", chronicDiseases: "ไม่มี", guardianPhone: "089-876-5432" },
    { studentCode: "50201", fullName: "เด็กชายนภัทร ตั้งมั่น", gradeLevel: "ม.2", classroom: "1", allergies: "แพ้อาหารทะเล, ยาซัลฟา (Sulfa)", chronicDiseases: "ภูมิแพ้อากาศ", guardianPhone: "086-555-1234" },
    { studentCode: "50301", fullName: "นางสาวศิริพร บุญรักษา", gradeLevel: "ม.3", classroom: "4", allergies: "ไม่มี", chronicDiseases: "ไมเกรน", guardianPhone: "082-999-8877" },
    { studentCode: "50401", fullName: "นายธนกฤต แสงทอง", gradeLevel: "ม.4", classroom: "2", allergies: "ไม่มี", chronicDiseases: "ไม่มี", guardianPhone: "084-111-2233" },
  ];

  for (const student of students) {
    await prisma.student.create({ data: student });
  }

  const medications = [
    { name: "พาราเซตามอล (Paracetamol 500mg)", category: "ยาลดไข้ บรรเทาปวด", unit: "เม็ด", stockQuantity: 350, minThreshold: 50, indications: "รับประทานครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมงเมื่อมีอาการ" },
    { name: "คลอร์เฟนิรามีน (CPM 4mg)", category: "ยาแก้แพ้ ลดน้ำมูก", unit: "เม็ด", stockQuantity: 120, minThreshold: 30, indications: "รับประทานครั้งละ 1 เม็ด เช้า-เย็น หรือก่อนนอน" },
    { name: "ยาธาตุน้ำขาว ตรากระต่ายบิน", category: "ยาแก้ปวดท้อง ขับลม", unit: "ช้อนโต๊ะ", stockQuantity: 24, minThreshold: 5, indications: "รับประทานครั้งละ 1-2 ช้อนโต๊ะ หลังอาหาร" },
    { name: "เกลือแร่ ORS", category: "ชดเชยน้ำและเกลือแร่", unit: "ซอง", stockQuantity: 45, minThreshold: 15, indications: "ละลายน้ำดื่ม 1 แก้วเมื่อท้องเสียหรืออ่อนเพลีย" },
    { name: "เบตาดีน (Povidone Iodine 15ml)", category: "ยาใส่แผลสดภายนอก", unit: "ขวด", stockQuantity: 10, minThreshold: 3, indications: "ทาแผลสดหลังจากล้างแผลด้วยน้ำเกลือ" },
    { name: "ยาหม่องน้ำ / แอมโมเนียหอม", category: "ยาแก้วิงเวียนศีรษะ", unit: "ขวด", stockQuantity: 8, minThreshold: 2, indications: "ดมหรือทาขมับเมื่อมีอาการหน้ามืด คลื่นไส้" },
  ];

  for (const med of medications) {
    await prisma.medication.create({ data: med });
  }

  const studentTarget = await prisma.student.findFirst({ where: { studentCode: "50101" } });
  const medTarget = await prisma.medication.findFirst({ where: { name: { contains: "Paracetamol" } } });

  if (studentTarget && medTarget) {
    const visit = await prisma.infirmaryVisit.create({
      data: {
        studentId: studentTarget.id,
        symptoms: "ปวดศีรษะ ตัวรุมๆ จากการเรียนกลางแจ้ง",
        bodyTemperature: 37.8,
        bloodPressure: "115/75",
        pulseRate: 82,
        bedRest: true,
        bedRestStart: new Date(Date.now() - 3600000),
        bedRestEnd: new Date(),
        treatmentNotes: "ให้นอนพัก 1 ชั่วโมง เช็ดตัว และจ่ายยาลดไข้",
        status: "COMPLETED",
      },
    });

    await prisma.dispensedItem.create({
      data: {
        visitId: visit.id,
        medicationId: medTarget.id,
        quantity: 1,
        instructions: "1 เม็ด หลังอาหารทันที",
      },
    });
  }
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const medications = [
    { name: "พาราเซตามอล (Paracetamol 500mg)", category: "ยาลดไข้ บรรเทาปวด", unit: "เม็ด", stockQuantity: 350, minThreshold: 50, indications: "รับประทานครั้งละ 1 เม็ด ทุก 4-6 ชั่วโมงเมื่อมีอาการ" },
    { name: "คลอร์เฟนิรามีน (CPM 4mg)", category: "ยาแก้แพ้ ลดน้ำมูก", unit: "เม็ด", stockQuantity: 120, minThreshold: 30, indications: "รับประทานครั้งละ 1 เม็ด เช้า-เย็น หรือก่อนนอน" },
    { name: "ยาธาตุน้ำขาว ตรากระต่ายบิน", category: "ยาแก้ปวดท้อง ขับลม", unit: "ช้อนโต๊ะ", stockQuantity: 24, minThreshold: 5, indications: "รับประทานครั้งละ 1-2 ช้อนโต๊ะ หลังอาหาร" },
    { name: "เกลือแร่ ORS", category: "ชดเชยน้ำและเกลือแร่", unit: "ซอง", stockQuantity: 45, minThreshold: 15, indications: "ละลายน้ำดื่ม 1 แก้วเมื่อท้องเสียหรืออ่อนเพลีย" },
    { name: "เบตาดีน (Povidone Iodine 15ml)", category: "ยาใส่แผลสดภายนอก", unit: "ขวด", stockQuantity: 10, minThreshold: 3, indications: "ทาแผลสดหลังจากล้างแผลด้วยน้ำเกลือ" },
    { name: "ยาหม่องน้ำ / แอมโมเนียหอม", category: "ยาแก้วิงเวียนศีรษะ", unit: "ขวด", stockQuantity: 8, minThreshold: 2, indications: "ดมหรือทาขมับเมื่อมีอาการหน้ามืด คลื่นไส้" },
  ];

  for (const med of medications) {
    await prisma.medication.upsert({
      where: { name: med.name },
      create: med,
      update: {},
    });
  }

  console.log("Medication catalog initialized successfully. No demo student data.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

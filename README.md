# infirmary-system

> **School Infirmary & Medication Dispensing Management System**  
> ระบบบันทึกการรักษาและจ่ายยาห้องพยาบาลโรงเรียน (Walk-in Clinic)

---

## 📌 Features

- **Walk-in Triage & Registration**: ระบบค้นหาข้อมูลนักเรียนรวดเร็ว แสดงป้ายเตือนประวัติการแพ้ยา/โรคประจำตัวทันที
- **Vitals & Treatment Notes**: บันทึกสัญญาณชีพ (อุณหภูมิ, ความดัน, ชีพจร), อาการเบื้องต้น, และการนอนพัก
- **Medication Dispensing & Stock Deduction**: สั่งจ่ายยาพร้อมคำแนะนำการทาน และตัดสต็อกอัตโนมัติ (ACID Transaction)
- **Medical Records**: ตรวจสอบประวัติการรักษาและเวชระเบียนย้อนหลัง
- **Inventory Management**: ควบคุมและแจ้งเตือนเวชภัณฑ์ใกล้หมดสต็อก
- **Term Reports**: สรุปสถิติประจำวัน, สรุปยอดรวมผู้เข้ารับการรักษา, และ 5 อันดับยาที่มีการใช้มากที่สุด

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide React
- **Database**: SQLite (Local standalone database)
- **ORM**: Prisma ORM

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Migration & Seed Data
```bash
npx prisma db push
node prisma/seed.js
```

### 3. Run Development Server
```bash
npm run dev
```

เปิดบราวเซอร์ที่ [http://localhost:3000](http://localhost:3000)

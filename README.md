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

### 2. Create an Empty Local Database
```bash
npx prisma db push
npx prisma generate
```

### 3. Run Development Server
```bash
npm run dev
```

เปิดบราวเซอร์ที่ [http://localhost:3000](http://localhost:3000)

## Windows Desktop

Download the installer from GitHub Releases. A fresh installation starts empty.
Create an academic year in Settings, then import student and staff Excel files separately.
Excel previews must be confirmed before records are saved. Staff imports do not store civil IDs or qualifications.

```bash
npm run desktop:prepare
npm run desktop:build
```

The installer contains `schema.sql`, not a database file. The app creates its local SQLite
database on first launch. Updates preserve existing user records and back up the database
before additive schema upgrades; reinstalling does not erase existing application data.

## Private Data

Never commit databases, database backups, Excel rosters, exports, `.env` files or credentials.
These files are ignored by Git and excluded from the desktop resource bundle.
Use the Settings import screens to load real data locally after installation.
The optional Cloudflare gateway requires separate local password setup; no password or
gateway credentials are distributed in this repository or the installer.

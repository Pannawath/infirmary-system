const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(root, 'work', 'grid-test-'));
const dbPath = path.join(dir, 'grid-test.db');

const schema = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/prisma/build/index.js'),
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    path.join(root, 'prisma/schema.prisma'),
    '--script',
  ],
  { encoding: 'utf8' }
);
assert.equal(schema.status, 0, schema.stderr);
const db = new DatabaseSync(dbPath);
db.exec(schema.stdout);
db.close();

const databaseUrl = 'file:' + dbPath.replaceAll('\\', '/');
const p = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const base = 'http://127.0.0.1:3109';

const server = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3109',
  ],
  {
    cwd: root,
    env: { ...process.env, INFIRMARY_DATABASE_URL: databaseUrl, INFIRMARY_DESKTOP_TOKEN: '' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let log = '';
server.stdout.on('data', x => (log = (log + x).slice(-3000)));
server.stderr.on('data', x => (log = (log + x).slice(-3000)));

const request = async (url, method = 'GET', data) => {
  const r = await fetch(base + url, {
    method,
    ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
  });
  return { status: r.status, data: await r.json() };
};

(async () => {
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(base + '/api/desktop-health')).ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }

    // 1. Create school years: 2568 and 2569
    const y2568 = await request('/api/settings/years', 'POST', { year: 2568 });
    assert.equal(y2568.status, 201);
    const y2569 = await request('/api/settings/years', 'POST', { year: 2569 });
    assert.equal(y2569.status, 201);

    // 2. Build mock Excel with header banner, repeating headers, separate first/last name
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('ม.1-1');
    sheet.addRow(['โรงเรียนสารคามพิทยาคม - รายชื่อนักเรียน']); // row 1: banner to be excluded
    sheet.addRow(['ประจำปีการศึกษา 2569']); // row 2: banner
    sheet.addRow(['ลำดับ', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'รหัสนักเรียน', 'เลขที่']); // row 3: header row
    sheet.addRow([1, 'ด.ช.', 'สมชาย', 'ใจดี', '99001', '1']); // row 4
    sheet.addRow(['หมายเหตุ: นักเรียนย้ายมาใหม่']); // row 5: note to be excluded
    sheet.addRow([2, 'ด.ญ.', 'สมศรี', 'รักเรียน', '99002', '2']); // row 6
    sheet.addRow(['รวมทั้งหมด 2 คน']); // row 7: summary row to be excluded

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    // 3. Test inspect mode returns gridSheets
    const inspectForm = new FormData();
    inspectForm.set('file', new Blob([buffer]), 'students-grid.xlsx');
    inspectForm.set('mode', 'inspect');
    const inspectRes = await fetch(base + '/api/settings/student-imports', { method: 'POST', body: inspectForm });
    const inspectData = await inspectRes.json();
    assert.equal(inspectRes.status, 200);
    assert.ok(inspectData.gridSheets && inspectData.gridSheets.length > 0);
    assert.equal(inspectData.gridSheets[0].name, 'ม.1-1');

    // 4. Test preview with Grid configuration (exclude row 1, 2, 5, 7; headerRow 3; prefix+first+last name mode; fixed grade & classroom)
    const gridForm = new FormData();
    gridForm.set('file', new Blob([buffer]), 'students-grid.xlsx');
    gridForm.set('yearId', y2569.data.id);
    gridForm.set('personType', 'STUDENT');
    gridForm.set('isGrid', 'true');
    gridForm.set('sheet', 'ม.1-1');
    gridForm.set('headerRow', '3');
    gridForm.set('excludedRows', JSON.stringify([1, 2, 5, 7]));
    gridForm.set('excludedCols', JSON.stringify([]));
    gridForm.set(
      'mapping',
      JSON.stringify({
        studentCodeCol: 5,
        nameMode: 'prefix_first_last',
        prefixCol: 2,
        firstNameCol: 3,
        lastNameCol: 4,
        gradeMode: 'fixed',
        fixedGradeLevel: 'ม.1',
        classMode: 'fixed',
        fixedClassroom: '1',
        rollNumberCol: 6,
      })
    );

    const gridRes = await fetch(base + '/api/settings/student-imports', { method: 'POST', body: gridForm });
    const gridData = await gridRes.json();
    assert.equal(gridRes.status, 200, JSON.stringify(gridData));
    assert.equal(gridData.total, 2);
    assert.ok(gridData.changes.some(c => c.studentCode === '99001' && c.fullName === 'ด.ช.สมชาย ใจดี'));
    assert.ok(gridData.changes.some(c => c.studentCode === '99002' && c.fullName === 'ด.ญ.สมศรี รักเรียน'));

    // Confirm student import
    const confirmRes = await request('/api/settings/student-imports', 'PATCH', {
      id: gridData.id,
      pauseMissing: false,
      confirm: true,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.new, 2);

    // 5. Test Staff Rollover: Add a staff in year 2568, then rollover to 2569
    const staffTeacher = await p.student.create({
      data: {
        studentCode: 'T-101',
        personType: 'STAFF',
        fullName: 'ครูสมปอง วิทยาการ',
        department: 'กลุ่มสาระวิทยาศาสตร์',
        position: 'ครูชำนาญการพิเศษ',
        gradeLevel: 'บุคลากร',
        classroom: 'กลุ่มสาระวิทยาศาสตร์',
        allergies: 'แพ้เพนิซิลลิน',
      },
    });

    await p.studentEnrollment.create({
      data: {
        studentId: staffTeacher.id,
        yearId: y2568.data.id,
        gradeLevel: 'บุคลากร',
        classroom: 'กลุ่มสาระวิทยาศาสตร์',
        status: 'ACTIVE',
      },
    });

    // Check GET staff-rollover
    const getRollover = await request(
      `/api/settings/staff-rollover?sourceYearId=${y2568.data.id}&targetYearId=${y2569.data.id}`
    );
    assert.equal(getRollover.status, 200);
    assert.equal(getRollover.data.items.length, 1);
    assert.equal(getRollover.data.items[0].alreadyInTarget, false);

    // POST rollover
    const postRollover = await request('/api/settings/staff-rollover', 'POST', {
      targetYearId: y2569.data.id,
      studentIds: [staffTeacher.id],
    });
    assert.equal(postRollover.status, 200);
    assert.equal(postRollover.data.added, 1);

    // Verify staff is enrolled in 2569 with same id and allergy data
    const enroll2569 = await p.studentEnrollment.findUnique({
      where: {
        studentId_yearId: {
          studentId: staffTeacher.id,
          yearId: y2569.data.id,
        },
      },
      include: { student: true },
    });
    assert.ok(enroll2569);
    assert.equal(enroll2569.student.allergies, 'แพ้เพนิซิลลิน');
    assert.equal(enroll2569.student.id, staffTeacher.id);

    console.log('PASS: rich Excel grid inspect, exclude rows/cols, name composition, and staff rollover verified!');
  } finally {
    server.kill();
    await p.$disconnect();
  }
})().catch(e => {
  console.error(e);
  console.error(log);
  process.exitCode = 1;
});


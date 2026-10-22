const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
process.chdir(root);

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) throw Error('Build command failed: ' + args.join(' '));
}

console.log('Building Next.js production standalone...');
run(['node_modules/next/dist/bin/next', 'build']);

const target = path.join(root, 'src-tauri', 'backend');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const filter = (source) => {
  const name = path.basename(source);
  return !name.startsWith('.env') && !/\.(xlsx|csv)(-|$)/i.test(name) && name !== '.git';
};

console.log('Copying standalone bundle...');
fs.cpSync(path.join(root, '.next', 'standalone'), target, { recursive: true, filter });
fs.cpSync(path.join(root, '.next', 'static'), path.join(target, '.next', 'static'), { recursive: true });
fs.cpSync(path.join(root, 'public'), path.join(target, 'public'), { recursive: true, filter });
fs.copyFileSync(process.execPath, path.join(target, 'node.exe'));

// Prisma native engines
for (const name of ['.prisma/client', '@prisma/client']) {
  const src = path.join(root, 'node_modules', name);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(target, 'node_modules', name), { recursive: true });
  }
}

// Copy dev.db with 3,760 real students to initial.db
const devDbPath = path.join(root, 'prisma', 'dev.db');
const initialDbPath = path.join(target, 'initial.db');
if (!fs.existsSync(devDbPath)) {
  throw new Error('dev.db not found; cannot prepare desktop database');
}

// Ensure clean copy of database
const sourceDb = new DatabaseSync(devDbPath);
sourceDb.exec(`VACUUM INTO '${initialDbPath.replaceAll('\\', '/')}'`);
sourceDb.close();

const verifyDb = new DatabaseSync(initialDbPath);
const studentCount = verifyDb.prepare('SELECT count(*) as c FROM Student WHERE isActive=1').get().c;
const medCount = verifyDb.prepare('SELECT count(*) as c FROM Medication').get().c;
verifyDb.close();

fs.writeFileSync(path.join(target, 'runtime-info.json'), JSON.stringify({
  node: process.version,
  architecture: process.arch,
  activeStudents: studentCount,
  medications: medCount,
  buildTime: new Date().toISOString(),
}, null, 2));

console.log(`Backend prepared successfully! Real students: ${studentCount}, Medications: ${medCount}`);

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
if(path.resolve(target)!==path.join(root,'src-tauri','backend'))throw Error('Unexpected backend output directory');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const filter = (source) => {
  const name = path.basename(source);
  return !name.startsWith('.env') && !/\.(xlsx|csv|db|sqlite)(-|$)/i.test(name) && !/\.tmp\d*$/i.test(name) && name !== '.git';
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
    fs.cpSync(src, path.join(target, 'node_modules', name), { recursive: true, filter });
  }
}

// Generate a fresh schema-only database. NEVER ship live data or backups.
const schemaPath = path.join(target, 'schema.sql');
const schema=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],{encoding:'utf8'});
if(schema.status!==0)throw Error('Could not generate empty database schema');
fs.writeFileSync(schemaPath,schema.stdout);
fs.copyFileSync(path.join(root,'tools','desktop-bootstrap.cjs'),path.join(target,'desktop-bootstrap.cjs'));

const verifyDb = new DatabaseSync(':memory:');verifyDb.exec(schema.stdout);
const studentCount = verifyDb.prepare('SELECT count(*) as c FROM Student WHERE isActive=1').get().c;
const medCount = verifyDb.prepare('SELECT count(*) as c FROM Medication').get().c;
for(const {name}of verifyDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
 if(verifyDb.prepare('SELECT COUNT(*) AS c FROM "'+name.replaceAll('"','""')+'"').get().c!==0)throw Error('Installer database must be completely empty');
}
verifyDb.close();

fs.writeFileSync(path.join(target, 'runtime-info.json'), JSON.stringify({
  node: process.version,
  architecture: process.arch,
  activeStudents: studentCount,
  medications: medCount,
  buildTime: new Date().toISOString(),
}, null, 2));

console.log(`Backend prepared successfully! Empty database verified: ${studentCount} people, ${medCount} medications.`);

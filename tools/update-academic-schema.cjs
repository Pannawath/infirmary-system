// Additive schema update only. Refuses data-loss prompts; backs up before changes.
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');process.chdir(root);
const database=path.join(root,'prisma','dev.db');const backup=path.join(root,'prisma',`backup-academic-${Date.now()}.db`);
if(fs.existsSync(database)){const db=new DatabaseSync(database);db.exec(`VACUUM INTO '${backup.replaceAll('\\','/')}'`);db.close();console.log('Database backed up:',path.basename(backup))}
const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const generate=spawnSync(process.execPath,['node_modules/prisma/build/index.js','generate'],{stdio:'inherit'});if(generate.status!==0)process.exit(generate.status||1);
console.log('Academic schema updated without deleting existing records.');

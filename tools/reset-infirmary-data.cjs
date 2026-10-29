// Explicit operator-only reset. Never expose this operation as a public API.
const path=require('node:path');const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');
if(!process.argv.includes('--confirm=ERASE-ALL-INFIRMARY-DATA'))throw Error('Explicit reset confirmation flag required');
const root=path.resolve(__dirname,'..'),target=path.resolve(root,'prisma/dev.db');
if(path.dirname(target)!==path.join(root,'prisma')||!fs.existsSync(target))throw Error('Unexpected database target');
const backup=path.join(root,'prisma',`backup-reset-${Date.now()}.db`),db=new DatabaseSync(target);
const tables=['DispensedItem','InfirmaryVisit','StudentImportChange','StudentImport','StudentEnrollment','Student','Medication','AcademicTerm','SchoolYear','AppSetting'];
try{
 db.exec('PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON');
 db.exec(`VACUUM INTO '${backup.replaceAll('\\','/').replaceAll("'","''")}'`);
 const check=new DatabaseSync(backup,{readOnly:true});if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');check.close();
 const before=Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT COUNT(*) AS count FROM "${t}"`).get().count]));
 db.exec('BEGIN IMMEDIATE');try{for(const t of tables)db.exec(`DELETE FROM "${t}"`);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 const after=Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT COUNT(*) AS count FROM "${t}"`).get().count]));
 if(Object.values(after).some(Boolean))throw Error('Reset verification failed');
 console.log(JSON.stringify({backup,before,after}));
}finally{db.close()}

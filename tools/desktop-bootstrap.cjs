// Additive desktop schema upgrades. Never reset existing user data on update.
const fs=require('node:fs');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');
function upgrade(database,template){
 const source=new DatabaseSync(':memory:');source.exec(fs.readFileSync(template,'utf8'));const target=new DatabaseSync(database);
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 try{
  target.exec('PRAGMA busy_timeout=15000');const changes=[];
  for(const table of source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
   const exists=target.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table.name);
   if(!exists){changes.push(table.sql);continue}
   const old=new Set(target.prepare('PRAGMA table_info('+quote(table.name)+')').all().map(c=>c.name));
   for(const c of source.prepare('PRAGMA table_info('+quote(table.name)+')').all())if(!old.has(c.name)){
    if(c.pk||c.notnull&&c.dflt_value===null)throw Error('Unsupported schema upgrade: '+table.name+'.'+c.name);
    changes.push('ALTER TABLE '+quote(table.name)+' ADD COLUMN '+quote(c.name)+' '+c.type+(c.notnull?' NOT NULL':'')+(c.dflt_value!==null?' DEFAULT '+c.dflt_value:''));
   }
  }
  for(const index of source.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all())if(!target.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(index.name))changes.push(index.sql);
  if(!changes.length)return;
  const backup=database+'.backup-'+Date.now()+'.db';target.exec("VACUUM INTO '"+backup.replaceAll('\\','/').replaceAll("'","''")+"'");
  target.exec('BEGIN IMMEDIATE');try{for(const sql of changes)target.exec(sql);target.exec('COMMIT')}catch(e){target.exec('ROLLBACK');throw e}
 }finally{source.close();target.close()}
}
if(require.main===module){
 const url=process.env.INFIRMARY_DATABASE_URL;if(!url?.startsWith('file:'))throw Error('Desktop database path required');
 const database=url.slice(5),template=path.join(__dirname,'schema.sql');
 fs.mkdirSync(path.dirname(database),{recursive:true});
 upgrade(database,template);require(path.join(__dirname,'server.js'));
}
module.exports={upgrade};

const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=file=>/\.(db|sqlite3?)(?:$|[.-])/i.test(file)&&!/^node_modules\/@prisma\/client\/runtime\/query_engine_bg\.sqlite\.(js|wasm)$/.test(file)||/\.(xlsx?|csv|tsv)$/i.test(file)||/(^|\/)\.env(?:$|\.)/.test(file)&&!file.endsWith('.env.example')||/(^|\/)(cloudflare-auth\.json|.*\.pem)$/.test(file)||/^(work|src-tauri\/backend|src-tauri\/target|release-artifacts)\//.test(file);
assert.deepEqual(files.filter(forbidden),[],'Private/runtime files must not be tracked');
const backend=path.join(root,'src-tauri/backend');
if(fs.existsSync(backend)){
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 assert.deepEqual(walk(backend).filter(f=>forbidden(path.relative(backend,f).replaceAll('\\','/'))),[],'Desktop bundle must not contain databases, rosters or credentials');
 for(const file of walk(backend)){const fd=fs.openSync(file,'r');const header=Buffer.alloc(16);try{fs.readSync(fd,header,0,16,0)}finally{fs.closeSync(fd)}assert.notEqual(header.toString('binary'),'SQLite format 3\0','SQLite database embedded: '+file)}
 assert.ok(fs.existsSync(path.join(backend,'schema.sql')),'Desktop bundle must contain schema only');
}
console.log('PASS: no database files, rosters, exports, environment secrets or credentials in tracked sources / desktop resources.');

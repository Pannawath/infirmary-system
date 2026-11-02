// Test the REAL release launcher after relocation, without touching the user's database.
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(root,'work','packaged-launch-'));
const installed=path.join(dir,'Program Files simulation','SPK Infirmary'),profile=path.join(dir,"School User's AppData");
fs.mkdirSync(installed,{recursive:true});fs.mkdirSync(profile,{recursive:true});
fs.cpSync(path.join(root,'src-tauri/backend'),path.join(installed,'backend'),{recursive:true});
const executable=path.join(installed,'spk-infirmary.exe');fs.copyFileSync(path.join(root,'src-tauri/target/release/spk-infirmary.exe'),executable);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const busy=http.createServer((req,res)=>res.end('not the infirmary backend'));
 await new Promise(resolve=>{busy.once('error',resolve);busy.listen(3103,'127.0.0.1',resolve)});
 const child=spawn(executable,[],{cwd:profile,env:{...process.env,APPDATA:profile,LOCALAPPDATA:profile,NODE_OPTIONS:'--this-would-break-node-if-inherited'},windowsHide:false,stdio:'ignore'});
 const log=path.join(profile,'th.ac.spk.infirmary/startup.log');let base,ready=false;
 try{
  for(let i=0;i<160;i++){
   if(fs.existsSync(log)){const content=fs.readFileSync(log,'utf8');const match=content.match(/port=(\d+)/);if(match){base='http://127.0.0.1:'+match[1];assert.notEqual(match[1],'3103');try{const r=await fetch(base+'/api/desktop-health',{signal:AbortSignal.timeout(1000)});if(r.ok){const d=await r.json();if(d.application==='spk-infirmary'&&d.startupNonce){ready=true;break}}}catch{}}}
   if(child.exitCode!==null)throw Error('Launcher exited early');await sleep(500);
  }
  assert.ok(ready,fs.existsSync(log)?fs.readFileSync(log,'utf8'):'No startup log');
  for(const route of ['/api/students','/api/medications','/api/visits']){const r=await fetch(base+route);assert.equal(r.status,200);assert.equal((await r.json()).length,0)}
  assert.ok(fs.existsSync(path.join(profile,'th.ac.spk.infirmary/infirmary.db')));
  fs.writeFileSync(path.join(root,'work/launcher-test-result.json'),JSON.stringify({executable,profile,base,pid:child.pid,log},null,2));
  console.log('PASS: relocated release EXE starts bundled backend from unrelated working directory, occupied 3103, hostile inherited NODE_OPTIONS, and isolated profile with spaces/apostrophe.');
  console.log('READY_FOR_UI_CHECK '+JSON.stringify({base,pid:child.pid}));
  console.log('Close the test application normally to complete shutdown verification.');
  await new Promise(resolve=>{child.once('exit',resolve);if(child.exitCode!==null)resolve()});await sleep(1000);
  let stopped=false;try{await fetch(base+'/api/desktop-health',{signal:AbortSignal.timeout(1000)})}catch{stopped=true}assert.ok(stopped,'Backend must stop on application exit');console.log('PASS: normal app close stops the backend.');
 }finally{busy.close();if(child.exitCode===null)child.kill()}
})().catch(e=>{console.error(e.message);process.exitCode=1});

// Reuse only this project's development backend after an interrupted tauri dev.
const {spawn}=require('node:child_process');
(async()=>{
 try{
  const response=await fetch('http://127.0.0.1:3103/api/desktop-health',{signal:AbortSignal.timeout(15000)});
  if(response.ok&&(await response.json()).application==='spk-infirmary'){
   console.log('Reusing SPK infirmary backend on 127.0.0.1:3103');return;
  }
  throw Error('Port 3103 is occupied by another application. Close it before starting Tauri.');
 }catch(error){if(error.message?.startsWith('Port 3103'))throw error;}
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3103'],{stdio:'inherit',windowsHide:true});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
 child.on('exit',code=>process.exit(code??1));
 child.on('error',error=>{console.error(error);process.exitCode=1});
})().catch(error=>{console.error(error.message);process.exitCode=1});

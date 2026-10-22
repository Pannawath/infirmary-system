const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/desktop-window-state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let maximized=false,fullscreen=false,callback,stopped=false;const values=[];
 const win={isMaximized:async()=>maximized,isFullscreen:async()=>fullscreen,onResized:async cb=>{callback=cb;return()=>{stopped=true}}};
 const stop=mod.exports.watchWindowExpanded(win,value=>values.push(value));await tick();assert.equal(values.at(-1),false);
 maximized=true;callback();await tick();assert.equal(values.at(-1),true);
 maximized=false;callback();await tick();assert.equal(values.at(-1),false);
 fullscreen=true;callback();await tick();assert.equal(values.at(-1),true);
 fullscreen=false;callback();await tick();assert.equal(values.at(-1),false);
 stop();assert.ok(stopped);const length=values.length;callback();await tick();assert.equal(values.length,length);
 const css=fs.readFileSync('src/app/globals.css','utf8');assert.ok(css.includes('[data-window-expanded=true] .app-shell{border-radius:0;box-shadow:none}'));
 console.log('PASS: normal, maximized, restored, fullscreen, listener cleanup and square-corner styling');
})().catch(e=>{console.error(e);process.exitCode=1});

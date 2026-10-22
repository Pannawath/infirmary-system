const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/interaction-guards.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports});
const listeners=new Map();const doc={addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:(type,handler)=>{assert.equal(listeners.get(type),handler);listeners.delete(type)}};
const stop=mod.exports.installInteractionGuards(doc);
function blocked(type,editor=false,extra={}){let prevented=false;listeners.get(type)({target:{closest:()=>editor?{}:null},preventDefault:()=>{prevented=true},...extra});return prevented}
assert.ok(blocked('contextmenu'));assert.ok(blocked('contextmenu',true));assert.ok(blocked('selectstart'));assert.ok(!blocked('selectstart',true));assert.ok(blocked('keydown',false,{ctrlKey:true,key:'a'}));assert.ok(!blocked('keydown',true,{ctrlKey:true,key:'a'}));assert.ok(blocked('keydown',false,{metaKey:true,key:'A'}));assert.ok(!blocked('keydown',false,{key:'Tab'}));stop();assert.equal(listeners.size,0);
console.log('PASS: right-click blocked, page selection/Ctrl+A blocked, editing and keyboard navigation preserved, listeners cleaned up');

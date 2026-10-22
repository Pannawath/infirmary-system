const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const refs=[];let cursor=0,tab='dashboard',scrollY=120,enterEvents=0,stateChanges=0,finish,snapshots=[],reduced=false;
const make=()=>{const el={name:'',dataset:{},style:{setProperty(_,v){el.name=v},removeProperty(){el.name=''}}};return el};
const cards={stock:make(),calendar:make(),'metric-3':make(),service:make(),term:make()};let surface=make();const html={dataset:{}};
const document={documentElement:html,querySelector(selector){if(selector==='[data-page-surface]')return surface;const id=selector.match(/data-shared-panel="(.+)"/)[1];return tab==='dashboard'?cards[id]:null},querySelectorAll(){return [surface,...Object.values(cards)]},startViewTransition(update){snapshots.push((tab==='dashboard'?cards.stock:surface).name);update();snapshots.push((tab==='dashboard'?cards['metric-3']:surface).name);return {ready:Promise.resolve(),finished:new Promise(resolve=>finish=resolve)}}};
const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/lib/shared-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:mod.exports,Event,document,require(name){if(name==='react')return {useRef(value){const i=cursor++;return refs[i]||(refs[i]={current:value})}};if(name==='react-dom')return {flushSync(fn){fn()}};throw Error(name)},window:{matchMedia(){return {matches:reduced}},dispatchEvent(e){if(e.type==='workspace-enter')enterEvents++},get scrollY(){return scrollY},scrollTo({top}){scrollY=top}}});
const render=()=>{cursor=0;return mod.exports.useSharedNavigation(tab,value=>{tab=value;stateChanges++;surface=make()},()=>{})};
(async()=>{
 render()('inventory','stock');assert.deepEqual(snapshots,['workspace-panel','workspace-panel']);assert.equal(tab,'inventory');render()('students');assert.equal(tab,'inventory');finish();await Promise.resolve();assert.equal(surface.name,'');assert.equal(surface.dataset.morphArrival,'true');
 scrollY=260;render()('students');assert.equal(tab,'students');assert.equal(html.dataset.windowMotion,'true');finish();await Promise.resolve();assert.equal(html.dataset.windowMotion,undefined);
 render()('dashboard');assert.equal(cards['metric-3'].name,'workspace-panel');assert.equal(scrollY,120);finish();await Promise.resolve();assert.equal(cards['metric-3'].name,'');
 const before=stateChanges,events=enterEvents;render()('dashboard');assert.equal(stateChanges,before);assert.equal(enterEvents,events+1);
 reduced=true;render()('inventory');assert.equal(tab,'inventory');assert.equal(scrollY,260);reduced=false;delete document.startViewTransition;render()('dashboard');assert.equal(tab,'dashboard');
 console.log('PASS: dashboard card expansion/return, all-page window transition, scroll restoration, same-page replay, no double entrance and reduced-motion fallback');
})().catch(e=>{console.error(e);process.exitCode=1});

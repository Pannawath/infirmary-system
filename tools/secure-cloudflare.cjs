// Password gate for a TEMPORARY Cloudflare Tunnel. Bind only this gate to cloudflared.
// The Next.js origin remains loopback-only; secrets and database are never public files.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const credentialFile = path.resolve(__dirname, '../work/cloudflare-auth.json');
// Preserve the origin on same-site form POSTs. `no-referrer` makes browser form
// submissions use Origin: null, which correctly fails the CSRF origin check.
const security = {'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow, noarchive','Strict-Transport-Security':'max-age=86400','Content-Security-Policy':"frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",'X-Frame-Options':'DENY'};
function send(res,status,body,type='text/html; charset=utf-8',extra={}) {res.writeHead(status,{...security,'Content-Type':type,...extra});res.end(body)}
function page(error='') {return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เข้าสู่ระบบ · ห้องพยาบาล</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(ellipse at top right,#dce8ff,transparent 60%),#f2f5fc;color:#24345c;font-family:system-ui,sans-serif;padding:24px}main{width:100%;max-width:420px;background:white;border:1px solid #e1e7f4;border-radius:28px;padding:38px;box-shadow:0 24px 80px #233d7812}.icon{width:52px;height:52px;border-radius:17px;background:#eaf0ff;color:#4567da;display:grid;place-items:center;font-size:28px}h1{font-size:24px;margin:23px 0 8px}p{font-size:14px;color:#75819e;line-height:1.7}label{font-size:14px;font-weight:600;display:block;margin-top:26px}input{display:block;width:100%;border:1px solid #dce3f1;border-radius:13px;padding:14px;margin:10px 0 18px;font-size:16px;outline:none}input:focus{border-color:#4567da;box-shadow:0 0 0 3px #4567da15}button{width:100%;padding:14px;background:#375cce;border:0;border-radius:13px;color:white;font-size:15px;font-weight:600;cursor:pointer}.error{color:#c53451;background:#fff1f3;padding:10px;border-radius:10px}.note{font-size:12px;margin-top:24px}</style><main><div class="icon" aria-hidden="true">✚</div><h1>ห้องพยาบาล</h1><p>โรงเรียนสารคามพิทยาคม<br>กรอกรหัสผ่านเพื่อเข้าถึงข้อมูลของโรงเรียน</p>${error?`<p class="error" role="alert">${error}</p>`:''}<form method="post" action="/auth/login"><label for="password">รหัสผ่านผู้ดูแล</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200" autofocus><button>เข้าสู่ระบบ</button></form><p class="note">ข้อมูลส่วนบุคคล · สำหรับผู้ได้รับอนุญาตเท่านั้น<br>ระบบจะออกจากระบบเมื่อไม่มีการใช้งาน 30 นาที</p></main></html>`}
function createGate({origin='http://127.0.0.1:3109',credential,clock=Date.now,fetcher=fetch}) {
 if(!credential?.salt||!credential?.hash)throw Error('Configure password before starting the gate');
 const sessions=new Map(),attempts=new Map();let globalFailures=[];
 const cookieName='__Host-spk_session';
 const expiredCookie=`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
 function validSession(req){const value=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);const s=sessions.get(value);if(!s||s.until<clock()||s.created+8*3600000<clock()){sessions.delete(value);return null}s.until=clock()+30*60000;return value}
 async function body(req,max){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('TOO_LARGE');chunks.push(chunk)}return Buffer.concat(chunks)}
 const handler=async(req,res)=>{try{
  const url=new URL(req.url,'https://gate.invalid'),p=url.pathname;
  if(!req.headers.host||!(/^[a-z0-9-]+\.trycloudflare\.com$/.test(req.headers.host)))return send(res,400,'Invalid host');
  if(req.headers['x-forwarded-proto']!=='https')return send(res,400,'HTTPS required');
  const expectedOrigin='https://'+req.headers.host;
  const mutation=!['GET','HEAD'].includes(req.method);
  if(mutation&&req.headers.origin!==expectedOrigin)return send(res,403,'Origin not allowed','text/plain');
  if(p==='/auth/login'&&req.method==='POST'){
   const ip=String(req.headers['cf-connecting-ip']||'unknown');const now=clock();
   globalFailures=globalFailures.filter(t=>t>now-15*60000);const failures=(attempts.get(ip)||[]).filter(t=>t>now-15*60000);
   if(failures.length>=5||globalFailures.length>=30)return send(res,429,page('ลองเข้าสู่ระบบเกินกำหนด กรุณารอ 15 นาที'),'text/html; charset=utf-8',{'Retry-After':'900'});
   // Reserve an attempt before awaiting I/O/scrypt, so concurrent requests cannot bypass throttling.
   failures.push(now);attempts.set(ip,failures);globalFailures.push(now);
   const params=new URLSearchParams((await body(req,2048)).toString());const password=params.get('password')||'';
   const hash=await new Promise((resolve,reject)=>crypto.scrypt(password,credential.salt,64,(e,key)=>e?reject(e):resolve(key)));
   if(password.length>200||!crypto.timingSafeEqual(hash,Buffer.from(credential.hash,'hex')))return send(res,401,page('รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง'));
   attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{created:now,until:now+30*60000});
   return send(res,303,'','text/plain',{'Location':'/','Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
  }
  const session=validSession(req);
  if(!session){if(p.startsWith('/api/'))return send(res,401,JSON.stringify({error:'กรุณาเข้าสู่ระบบ',loginRequired:true}),'application/json');return send(res,200,page())}
  if(p==='/auth/logout'&&req.method==='POST'){sessions.delete(session);return send(res,303,'','text/plain',{'Location':'/','Set-Cookie':expiredCookie})}
  const asset=p==='/'||['/school-logo.png','/school-hero.png','/sidebar-school.png','/favicon.ico'].includes(p)||/^\/_next\/static\/[a-zA-Z0-9_./@-]+$/.test(p)&&!p.split('/').includes('..');
  const api=/^\/api\/(students|medications|terms|visits(?:\/calendar|\/[a-zA-Z0-9_-]+)?|reports\/(?:summary|services|export)|settings\/(?:years|student-imports))$/.test(p);
  if(!asset&&!api)return send(res,404,'Not found','text/plain');
  if(!api&&!['GET','HEAD'].includes(req.method))return send(res,405,'Method not allowed','text/plain');
  if(!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method))return send(res,405,'Method not allowed','text/plain');
  const data=mutation?await body(req,6*1024*1024):undefined;
  // Never forward middleware-bypass headers, Next actions, credentials, or an arbitrary origin.
  const headers={};if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
  const upstream=await fetcher(origin+p+url.search,{method:req.method,headers,body:data,redirect:'manual',signal:AbortSignal.timeout(120000)});
  if(upstream.status>=300&&upstream.status<400)return send(res,502,'Unexpected upstream redirect','text/plain');
  let response=Buffer.from(await upstream.arrayBuffer());const type=upstream.headers.get('content-type')||'application/octet-stream';
  if(p==='/'&&type.includes('text/html'))response=Buffer.from(response.toString().replace('</body>','<form method="post" action="/auth/logout" style="position:fixed;right:18px;bottom:12px;z-index:99999"><button style="border:1px solid #dbe2ef;background:white;color:#64748b;border-radius:10px;padding:6px 12px;font:12px system-ui;cursor:pointer">ออกจากระบบ</button></form></body>'));
  const extra={};const disposition=upstream.headers.get('content-disposition');if(disposition)extra['Content-Disposition']=disposition;
  send(res,upstream.status,req.method==='HEAD'?'':response,type,extra);
 }catch(e){send(res,e.message==='TOO_LARGE'?413:502,e.message==='TOO_LARGE'?'Request too large':'ระบบยังไม่พร้อม กรุณาลองใหม่','text/plain; charset=utf-8')}};
 const timer=setInterval(()=>{for(const [key,s]of sessions)if(s.until<clock())sessions.delete(key);for(const [key,t]of attempts)if(!t.some(x=>x>clock()-15*60000))attempts.delete(key)},60000);timer.unref();
 return handler;
}
async function main(){
 if(process.argv.includes('--setup')){
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  console.log('Send password through stdin (not echoed).');let input='';for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break}const password=input.trim();if(password.length<8||password.length>200)throw Error('Use a password of 8–200 characters');
  const salt=crypto.randomBytes(32).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');fs.mkdirSync(path.dirname(credentialFile),{recursive:true});fs.writeFileSync(credentialFile,JSON.stringify({salt,hash}),{mode:0o600});console.log('Password hash saved to ignored local configuration.');return;
 }
 const credential=JSON.parse(fs.readFileSync(credentialFile,'utf8'));
 const server=http.createServer(createGate({credential}));server.requestTimeout=130000;server.headersTimeout=15000;server.maxConnections=100;
 server.listen(3110,'127.0.0.1',()=>console.log('Protected gate listening on 127.0.0.1:3110. Only tunnel this port.'));
}
if(require.main===module)main().catch(()=>{console.error('Secure gate failed to start. Check local password configuration and ports.');process.exitCode=1});
module.exports={createGate};

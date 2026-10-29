const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const {createGate}=require('./secure-cloudflare.cjs');
(async()=>{
 const salt=crypto.randomBytes(16).toString('hex'),password=crypto.randomBytes(20).toString('hex');
 let now=Date.now(),forwarded=0;
 const server=http.createServer(createGate({credential:{salt,hash:crypto.scryptSync(password,salt,64).toString('hex')},clock:()=>now,fetcher:async(url,opts)=>{forwarded++;assert.ok(url.startsWith('http://127.0.0.1:3109/'));assert.equal(opts.headers['x-middleware-subrequest'],undefined);return new Response(JSON.stringify({protected:true}),{headers:{'content-type':'application/json'}})}}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const headers={host:'secure-test.trycloudflare.com','x-forwarded-proto':'https'};
 const request=(path,extra={})=>new Promise((resolve,reject)=>{const req=http.request(base+path,{method:extra.method||'GET',headers:{...headers,...extra.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:{get:k=>Array.isArray(res.headers[k])?res.headers[k].join(';'):res.headers[k]},text:async()=>Buffer.concat(chunks).toString()}))});req.on('error',reject);req.end(extra.body)});
 try{
  for(const path of ['/api/students','/api/reports/export?format=xlsx','/api/settings/student-imports'])assert.equal((await request(path)).status,401);
  assert.equal(forwarded,0);const landing=await request('/');assert.equal(landing.headers.get('referrer-policy'),'same-origin');assert.ok((await landing.text()).includes('type="password"'));
  assert.equal((await request('/auth/login',{method:'POST',body:'password='+password})).status,403);
  const loginHeaders={origin:'https://secure-test.trycloudflare.com','content-type':'application/x-www-form-urlencoded'};
  assert.equal((await request('/auth/login',{method:'POST',headers:loginHeaders,body:'password=wrong'})).status,401);
  const login=await request('/auth/login',{method:'POST',headers:loginHeaders,body:'password='+password});assert.equal(login.status,303);
  const setCookie=login.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(setCookie.includes(flag));const cookie=setCookie.split(';')[0];
  assert.equal((await request('/api/students',{headers:{cookie,'x-middleware-subrequest':'middleware'}})).status,200);
  assert.equal((await request('/api/students',{headers:{cookie:cookie+'tampered'}})).status,401);
  assert.equal((await request('/api/students',{method:'PATCH',headers:{cookie,origin:'https://evil.invalid'},body:'{}'})).status,403);
  assert.equal((await request('/prisma/dev.db',{headers:{cookie}})).status,404);
  now+=31*60000;assert.equal((await request('/api/students',{headers:{cookie}})).status,401);
  for(let i=0;i<5;i++)assert.equal((await request('/auth/login',{method:'POST',headers:loginHeaders,body:'password=wrong'})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',headers:loginHeaders,body:'password='+password})).status,429);
  now+=16*60000;const relogin=await request('/auth/login',{method:'POST',headers:loginHeaders,body:'password='+password});const newCookie=relogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/auth/logout',{method:'POST',headers:{...loginHeaders,cookie:newCookie}})).status,303);
  assert.equal((await request('/api/students',{headers:{cookie:newCookie}})).status,401);
  console.log('PASS: all APIs gated, login, secure cookie, tamper rejection, CSRF, no middleware-header bypass, file allowlist, expiry, throttling and logout.');
 }finally{server.closeAllConnections();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

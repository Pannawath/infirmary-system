// Read the password from stdin. Print statuses/counts only, never personal records or cookies.
const assert=require('node:assert/strict');
(async()=>{
 const base=process.argv[2];if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(base))throw Error('Expected HTTPS quick-tunnel origin');
 let password='';for await(const chunk of process.stdin)password+=chunk;password=password.trim();
 for(const p of ['/api/students','/api/reports/export?format=xlsx','/api/settings/years']){const r=await fetch(base+p);assert.equal(r.status,401);console.log('Unauthenticated '+p+': blocked (401)')}
 const landing=await fetch(base);assert.ok((await landing.text()).includes('name="password"'));console.log('Login page: OK');
 const login=await fetch(base+'/auth/login',{method:'POST',redirect:'manual',headers:{origin:base,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})});assert.equal(login.status,303);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 try{
  const root=await fetch(base,{headers:{cookie}});assert.equal(root.status,200);const html=await root.text();assert.ok(html.includes('/_next/static/'));assert.ok(!html.includes('name="password"'));console.log('Authenticated dashboard: OK');
  const css=html.match(/href="([^\"]+\.css[^\"]*)"/);if(css){const asset=await fetch(base+css[1].replaceAll('&amp;','&'),{headers:{cookie}});assert.equal(asset.status,200);console.log('Dashboard styles: OK')}
  const r=await fetch(base+'/api/students?directory=1&page=1&pageSize=1',{headers:{cookie}});assert.equal(r.status,200);const d=await r.json();if(process.argv.includes('--expect-empty'))assert.equal(d.total,0);else assert.ok(Number.isInteger(d.total));console.log('Protected database: '+d.total+' active people');
  if(process.argv.includes('--expect-empty'))for(const p of ['/api/medications','/api/visits']){const empty=await fetch(base+p,{headers:{cookie}});assert.equal(empty.status,200);assert.equal((await empty.json()).length,0);console.log(p+': empty')}
  const years=await fetch(base+'/api/settings/years',{headers:{cookie}});assert.equal(years.status,200);console.log('Settings API: OK');
 }finally{const logout=await fetch(base+'/auth/logout',{method:'POST',redirect:'manual',headers:{cookie,origin:base}});assert.equal(logout.status,303);assert.equal((await fetch(base+'/api/students',{headers:{cookie}})).status,401);console.log('Logout revocation: OK')}
})().catch(e=>{console.error(e.message);process.exitCode=1});

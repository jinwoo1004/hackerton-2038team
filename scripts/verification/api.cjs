const fs=require('node:fs');const assert=require('node:assert/strict');
const base='http://localhost:18080';const report={started:new Date().toISOString(),checks:[]};
async function req(route,token,method='GET',body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};}
(async()=>{
 const login=await req('/api/auth/login',null,'POST',{email:'admin@xisnd.com',password:'test1234'});assert.equal(login.status,200);const token=login.body.token;
 const health=await req('/api/health',token);assert.equal(health.status,200);const system=await req('/api/system/status',token);assert(system.body.services.every(s=>s.status==='UP'));report.checks.push({name:'health and system status',status:'PASS',health:health.body.status,services:system.body.services.map(s=>({key:s.key,status:s.status}))});
 const foreign=await req('/api/auth/signup',null,'POST',{name:'독립 검증 계정',email:`verification-${Date.now()}@example.invalid`,password:'test1234',company:'Synthetic'});assert.equal(foreign.status,201);
 const routes=['/api/projects/1','/api/projects/1/files','/api/projects/1/analysis/latest','/api/projects/1/agents','/api/projects/1/metrics','/api/projects/1/log-entries'];
 for(const route of routes){const r=await req(route,foreign.body.token);assert.equal(r.status,404,route);}
 for(const suffix of ['trigger','recover','agent-token']){const r=await req(`/api/demo/projects/1/${suffix}`,foreign.body.token,'POST',suffix==='trigger'?{scenario:'LATENCY'}:{});assert.equal(r.status,404,suffix);}
 report.checks.push({name:'cross-account project, data, demo endpoints return 404',status:'PASS',count:routes.length+3});
 const code='VERIFY-CODE-'+Date.now();const p=await req('/api/projects',token,'POST',{name:'Code invariant verification',projectCode:code,technologies:[{category:'LANGUAGE',name:'Java'}]});assert.equal(p.status,201);
 const update=await req(`/api/projects/${p.body.id}`,token,'PUT',{name:'Code invariant verification updated',nickname:'synthetic',description:'verification',projectCode:'ILLEGAL-CHANGE',technologies:[]});assert.equal(update.status,200);const again=await req(`/api/projects/${p.body.id}`,token);assert.equal(again.body.projectCode,code);report.checks.push({name:'project code is immutable after update',status:'PASS'});
 await req(`/api/projects/${p.body.id}`,token,'DELETE');
 const channels=await req('/api/alerts/channels',token);assert.equal(channels.status,200);report.slackChannelCount=channels.body.length;
 console.log(JSON.stringify(report));fs.writeFileSync('docs/evidence/api.json',JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});

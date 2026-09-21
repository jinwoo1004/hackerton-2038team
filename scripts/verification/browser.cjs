// Independent session-monitor verification. Synthetic fixtures only; never saves auth state or API bodies containing credentials.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const mode=process.argv[2]||'full';
const base='http://localhost:13200';
const evidence=path.resolve(process.env.VERIFICATION_EVIDENCE_DIR || 'docs/evidence');
fs.mkdirSync(evidence,{recursive:true});
const report={mode,started:new Date().toISOString(),viewport:{width:1440,height:900},checks:[],errors:[],network:[],console:[],screenshots:[]};
let browser,page;
const passed=(name,details)=>{report.checks.push({name,status:'PASS',details});console.log('PASS',name,JSON.stringify(details));};
async function shot(name){const file=`${mode}-${name}.png`;await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,file),fullPage:true,animations:'disabled',mask:[page.getByText(/^agt_/)]});report.screenshots.push(file);}
async function go(url){await page.goto(base+url);await page.waitForTimeout(700);}
async function api(route,options={}){return page.evaluate(async({route,options})=>{const r=await fetch('http://localhost:18080'+route,{...options,headers:{Authorization:'Bearer '+localStorage.getItem('mp.token'),'Content-Type':'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status} ${route}`);return r.status===204?null:r.json();},{route,options});}
async function snapshot(){
 if(mode==='full'){
  const ps=await api('/api/projects');const project=ps.find(p=>p.projectCode==='WALLPAD-DEMO');
  const [a,agents,m,logs,incidents,overview,dashboard]=await Promise.all([api(`/api/projects/${project.id}/analysis/latest`),api(`/api/projects/${project.id}/agents`),api(`/api/projects/${project.id}/metrics`),api(`/api/projects/${project.id}/log-entries`),api('/api/incidents?limit=300'),api('/api/monitoring/overview'),api('/api/dashboard')]);
  return {projectId:project.id,projectCount:ps.length,analysis:{score:a.score,overview:a.result.overview,codeLines:a.result.source.codeLines,totalLines:a.result.source.totalLines,largestFiles:a.result.source.largestFiles,findings:a.result.findings.length},agents:agents.map(a=>({id:a.id,state:a.state,version:a.agentVersion})),points:m.series.reduce((n,s)=>n+s.points.length,0),logs:logs.length,incidents:incidents.filter(i=>i.projectId===project.id).map(i=>({id:i.id,status:i.status,rule:i.rule,insight:i.insight})),health:overview.health,trend:overview.incidentTrend,dashboardHealth:dashboard.health,dashboardTrend:dashboard.incidentTrend};
 }
 return page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('mp.mockdb'));const project=db.projects.find(p=>p.projectCode==='WALLPAD-DEMO');const a=db.analyses.filter(a=>a.projectId===project.id).at(-1);return {projectId:project.id,projectCount:db.projects.length,analysis:{score:a.score,overview:a.result.overview,codeLines:a.result.source.codeLines,totalLines:a.result.source.totalLines,largestFiles:a.result.source.largestFiles,findings:a.result.findings.length},agents:db.agents.filter(a=>a.projectId===project.id).map(a=>({id:a.id,state:a.state,version:a.agentVersion})),logs:db.logs.length,incidents:db.incidents?.filter(i=>i.projectId===project.id).map(i=>({id:i.id,status:i.status,rule:i.rule,insight:i.insight}))??[]};});
}
async function healthDom(){const h=page.getByRole('heading',{name:'실시간 프로젝트 상태',exact:true}).locator('..').locator('..');await h.waitFor();return {text:await h.innerText(),values:await h.locator('dl dd').allTextContents(),trend:await page.getByRole('img',{name:'최근 7일 이상 발생 및 해결 건수'}).innerText()};}
async function wizard(ext){
 await go('/projects');await page.getByRole('link',{name:'새 프로젝트',exact:true}).first().click();
 await page.getByPlaceholder('프로젝트 이름을 입력하세요').fill(`검증 ${mode} ${ext}`);
 await page.getByPlaceholder('TREECS',{exact:true}).fill(`VERIFY-${mode}-${ext}-${Date.now()}`);
 await page.getByText('사용할 수 있는 코드입니다.',{exact:true}).waitFor();
 await shot(`wizard-${ext}-step1`);await page.getByRole('button',{name:'다음',exact:true}).first().click();
 await page.getByRole('button',{name:'TypeScript',exact:true}).click();
 await page.getByRole('button',{name:'다음',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles(path.resolve(`demo-fixtures/rules.${ext}`));
 await page.getByText(`rules.${ext}`,{exact:true}).waitFor();await shot(`wizard-${ext}-step3`);
 await page.getByRole('button',{name:'다음',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles(path.resolve('demo-fixtures/wallpad-source.zip'));
 await page.getByText('wallpad-source.zip',{exact:true}).waitFor();await page.getByRole('button',{name:'다음',exact:true}).first().click();
 await shot(`wizard-${ext}-step5`);await page.getByRole('button',{name:'프로젝트 생성',exact:true}).first().click();
 await page.waitForURL(/\/projects\/\d+$/,{timeout:30000});const id=Number(page.url().split('/').at(-1));
 await page.locator(`a[href="/projects/${id}/analysis"]`).first().click();
 await page.getByRole('button',{name:'분석 시작',exact:true}).click();
 await page.getByText('로컬 규칙 추출 + 정적 검사',{exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:/(?:규칙 문서에서 금지한|금지된) console.log/}).click();
 await page.getByText(new RegExp(`^규칙 출처: rules\\.${ext}`)).waitFor();
 const quote=await page.locator('blockquote').innerText();assert(quote.includes('console.log'));
 const text=await page.locator('body').innerText();assert(text.includes('src/WallpadClient.ts:5'));assert(!text.includes('파일 업로드에 실패'));
 await shot(`analysis-${ext}`);passed(`wizard actual ${ext.toUpperCase()} parsing and source-mapped citation`,{projectId:id,quote});return id;
}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:report.viewport});page=await context.newPage();page.setDefaultTimeout(12000);const requestHosts=new Set();page.on('request',r=>requestHosts.add(new URL(r.url()).host));
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
 page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')report.network.push({url:r.url().split('?')[0],error:r.failure()?.errorText});});
 page.on('response',r=>{if(r.status()>=400)report.network.push({url:r.url().split('?')[0],status:r.status()});});
 await go('/login');await shot('login');
 await page.getByLabel('이메일',{exact:true}).fill('admin@xisnd.com');await page.getByLabel('비밀번호',{exact:true}).fill('test1234');await page.getByRole('button',{name:'로그인',exact:true}).click();await page.waitForURL('**/projects');await page.waitForTimeout(700);passed('login and projects',{});
 if(mode==='frontend'){await page.getByRole('button',{name:'시연 데이터 준비',exact:true}).click();await page.getByRole('button',{name:'시연 데이터 확인',exact:true}).waitFor();}
 await page.getByRole('link',{name:'분석 결과',exact:true}).click();await page.getByText('로컬 규칙 추출 + 정적 검사',{exact:true}).waitFor();
 const s=await snapshot();report.baseline=s;assert.equal(s.analysis.score,69);assert.equal(s.analysis.findings,9);assert.equal(s.analysis.codeLines,28);assert.equal(s.analysis.totalLines,29);assert.equal(s.analysis.largestFiles[0].lines,29);assert.deepEqual(s.analysis.overview,{score:69,grade:'D',critical:0,warning:5,info:4});assert.equal(s.agents.length,1);assert.equal(s.agents[0].state,'ONLINE');
 await page.getByRole('button',{name:/(?:규칙 문서에서 금지한|금지된) console.log/}).click();await page.getByText('규칙 출처: rules.md',{exact:true}).waitFor();await shot('analysis-md');passed('MD seed analysis matches fixture',{...s.analysis});
 await page.getByRole('link',{name:'에이전트',exact:true}).click();await page.getByText('수집 중',{exact:true}).first().waitFor();await shot('agents');passed('one ONLINE Agent',s.agents);
 await page.getByRole('link',{name:'로그',exact:true}).click();await page.getByText(mode==='full'?/\[SYNTHETIC\].*responseMs=120/:/gateway response received/).first().waitFor();await shot('logs');passed('collected recent logs',{count:s.logs});
 await go('/monitoring');await page.getByRole('button',{name:/wallpad-demo-01.*CPU/}).click();
 const chartNames=['CPU 사용률 추이','메모리 사용률 추이','디스크 사용률 추이'];
 for(const name of chartNames){const chart=page.getByRole('img',{name,exact:true});await chart.waitFor();assert(await chart.locator('path[d]').count()>0);}
 await shot('resources');for(let index=0;index<3;index++)await page.getByRole('button',{name:'표로 보기',exact:true}).first().click();assert(await page.locator('table tbody tr').count()>=36);await shot('resource-tables');passed('CPU/memory/disk charts and actual time series table',{chartNames,tableRows:await page.locator('table tbody tr').count()});
 await page.getByRole('button',{name:'응답 지연 트리거',exact:true}).waitFor();await page.getByRole('button',{name:'정상 복구',exact:true}).click();await page.waitForTimeout(500);
 const b=await snapshot();const beforeDom=await healthDom();report.beforeIncident={health:b.health,dom:beforeDom};
 const scenarioChecks=[];
 for(const [scenario,label,response,timeout,errors] of [['LATENCY','응답 지연 트리거',3200,8,3],['ERROR_SPIKE','오류 급증 트리거',450,2,24]]){
   const start=Date.now();await page.getByRole('button',{name:label,exact:true}).click();
   const card=page.getByRole('region',{name:'AI 장애 징후 설명'}).first();await card.waitFor();await card.getByText(`120ms → ${response}ms`,{exact:true}).waitFor();const elapsedMs=Date.now()-start;assert(elapsedMs<10000);
   const current=await snapshot();const incident=current.incidents.find(i=>i.rule===scenario&&i.status==='OPEN');assert(incident);assert.equal(incident.insight.source,'LOCAL');assert.equal(incident.insight.currentResponseMs,response);assert.equal(incident.insight.timeoutCount,timeout);assert.equal(incident.insight.errorCount,errors);
   for(const phrase of [...incident.insight.evidence,...incident.insight.causes,...incident.insight.actions])assert((await card.innerText()).includes(phrase));
   await card.getByRole('button',{name:'Slack 메시지 미리보기',exact:true}).click();await card.getByText('Slack 미리보기 · 외부 발송 아님',{exact:true}).waitFor();
   const preview=await card.locator('[aria-live=polite]').innerText();for(const phrase of [String(response),String(timeout),String(errors),...incident.insight.evidence,...incident.insight.causes,...incident.insight.actions])assert(preview.includes(phrase));
   await shot(`incident-${scenario.toLowerCase()}`);
   await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(250);const repeated=await snapshot();assert.equal(repeated.incidents.filter(i=>i.rule===scenario&&i.status==='OPEN').length,1);assert.equal(repeated.incidents.find(i=>i.rule===scenario&&i.status==='OPEN').id,incident.id);
   const dom=await healthDom();assert.equal(dom.values[3].replace(/\s/g,''),'1개');assert(dom.text.includes(`진행 중 ${scenario==='LATENCY'?1:2}건`));
   if(mode==='full'){assert.deepEqual(current.health,current.dashboardHealth);assert.deepEqual(current.trend,current.dashboardTrend);assert.equal(current.health.critical,1);}
   scenarioChecks.push({scenario,elapsedMs,incidentId:incident.id,responseMs:response,timeoutCount:timeout,errorCount:errors,deduplicated:true,dom});
 }
 passed('both incident scenarios, <10s, dedup, insight and Slack evidence',scenarioChecks);report.scenarios=scenarioChecks;
 const openDom=await healthDom();await page.getByRole('link',{name:'개요',exact:true}).first().click();await page.getByRole('heading',{name:'실시간 프로젝트 상태'}).waitFor();const dashDom=await healthDom();assert.deepEqual(dashDom.values,openDom.values);assert.equal(dashDom.trend,openDom.trend);await shot('dashboard-open');
 await page.getByRole('link',{name:'모니터링',exact:true}).first().click();await page.getByRole('button',{name:'정상 복구',exact:true}).click();await page.waitForTimeout(500);const recovered=await snapshot();assert.equal(recovered.incidents.filter(i=>i.status==='OPEN').length,0);const recoveredDom=await healthDom();assert.equal(recoveredDom.values[3].replace(/\s/g,''),'0개');assert(recoveredDom.text.includes('진행 중 0건'));await shot('monitoring-recovered');
 await page.getByRole('link',{name:'개요',exact:true}).first().click();await page.getByRole('heading',{name:'실시간 프로젝트 상태'}).waitFor();const recoveryDashboard=await healthDom();assert.deepEqual(recoveryDashboard.values,recoveredDom.values);assert.equal(recoveryDashboard.trend,recoveredDom.trend);await shot('dashboard-recovered');passed('monitoring/dashboard immediate counts and incident trend after trigger/recovery',{open:openDom,recovered:recoveredDom});
 report.coreFlowMs=Date.now()-Date.parse(report.started);
 const created=[];for(const ext of ['pdf','xlsx','docx'])created.push(await wizard(ext));
 await go(`/projects/${s.projectId}`);await shot('project-overview');await go(`/projects/${s.projectId}/files`);await shot('project-files');await go(`/projects/${s.projectId}/settings`);await shot('project-settings');await go('/analysis');await page.waitForTimeout(500);await shot('analysis-history');await go('/events');await page.waitForTimeout(500);await shot('events');await go('/settings/alerts');await page.waitForTimeout(500);await shot('alert-settings');passed('project overview/files/settings, analysis, events, alert settings navigation',{});
 if(mode==='frontend'){
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('mp.mockdb')).projects.map(p=>({id:p.id,code:p.projectCode})));
   await go('/monitoring');await page.getByRole('button',{name:'데모 초기화',exact:true}).click();await page.getByRole('button',{name:'시연 데이터 준비',exact:true}).waitFor();
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('mp.mockdb')).projects.map(p=>({id:p.id,code:p.projectCode})));
   assert(!after.some(p=>p.code==='WALLPAD-DEMO'));for(const id of created)assert(after.some(p=>p.id===id));
   await page.getByRole('button',{name:'시연 데이터 준비',exact:true}).click();await page.getByRole('button',{name:'시연 데이터 확인',exact:true}).waitFor();const reseeded=await snapshot();assert.equal(reseeded.analysis.score,69);assert.equal(reseeded.agents.length,1);passed('frontend reset preserves unrelated projects and deterministic reseed',{beforeCount:before.length,afterCount:after.length,retainedProjectIds:created,seedScore:reseeded.analysis.score});
 }
 if(mode==='full'){for(const id of created)await api(`/api/projects/${id}`,{method:'DELETE'});passed('verification project cleanup',{removedIds:created});}
 report.requestHosts=[...requestHosts];if(mode==='frontend')assert.deepEqual(report.requestHosts,['localhost:13200']);report.completed=new Date().toISOString();assert.deepEqual(report.errors,[]);assert.deepEqual(report.console,[]);assert.deepEqual(report.network,[]);passed('browser console and network error free',{pageErrors:0,consoleErrors:0,networkErrors:0,requestHosts:report.requestHosts});
})().catch(async e=>{report.failure=e.stack;console.error('FAIL',e.message);if(page){await shot('failure').catch(()=>{});console.log((await page.locator('body').innerText().catch(()=>'' )).replace(/agt_[\w.-]+/g,'[REDACTED]').slice(-7000));}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(evidence,`${mode}-browser.json`),JSON.stringify(report,null,2));if(browser)await browser.close();});

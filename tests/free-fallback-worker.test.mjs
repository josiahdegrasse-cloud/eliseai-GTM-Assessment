import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,createFetchMock} from 'miniflare';
const key='fixture_free_key_not_a_credential';
for(const mode of ['no_key','exhausted','provider_exhausted','free_tokens'])test('cold lead completes using direct public evidence: '+mode,async()=>{
 const origin='https://assessment.test',network=createFetchMock(),requests=[];network.disableNetConnect();
 network.get('https://r.jina.ai').intercept({path:/^\//,method:'GET'}).reply(mode==='free_tokens'?200:mode==='no_key'?429:402,o=>{requests.push(o);return mode==='free_tokens'?{code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',content:'Acme Housing owns and manages residential apartment communities. We manage 500 apartment homes and handle leasing inquiries.',usage:{tokens:500}}}:{}},{headers:{'Retry-After':'60'}}).persist();
 network.get('https://dash.jina.ai').intercept({path:'/api/v1/authorization',method:'GET'}).reply(200,{wallet:{trial_balance:8000000,total_balance:8000000,regular_balance:0},metadata:{auto_recharge:false}}).persist();
 network.get('https://dns.google').intercept({path:/^\/resolve\?name=acmehousing.com&type=/,method:'GET'}).reply(200,o=>({Status:0,Answer:o.path.endsWith('type=A')?[{type:1,data:'93.184.216.34'}]:[]})).persist();
 network.get('https://acmehousing.com').intercept({path:'/robots.txt',method:'GET'}).reply(200,'User-agent: *\nAllow: /').persist();
 network.get('https://acmehousing.com').intercept({path:'/',method:'GET'}).reply(200,'<title>Acme Housing</title><p>Acme Housing owns and manages residential apartment communities.</p><p>We manage 500 apartment homes and handle leasing inquiries.</p>',{headers:{'Content-Type':'text/html'}}).persist();
 network.get('https://api.gleif.org').intercept({path:/^\/api\/v1\//,method:'GET'}).reply(200,{data:[]}).persist();
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'test',...(mode==='no_key'?{}:{JINA_FREE_API_KEY:key}),...(mode==='free_tokens'?{JINA_TOKEN_ACCOUNTING:'1'}:{})},fetchMock:network});
 try{
  const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  if(['exhausted','free_tokens'].includes(mode))await db.prepare('INSERT INTO request_limits VALUES(?,400,4102444800)').bind('jina-free-budget:'+createHash('sha256').update(key).digest('hex')).run();
  const s=await mf.dispatchFetch(origin+'/api/session'),session=await s.json(),cookie=s.headers.get('set-cookie').split(';')[0];
  const request=(path,body)=>mf.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const added=await (await request('/api/add',{name:'TEST Fallback',company:'Acme Housing',website:'https://acmehousing.com',email:'fallback@example.invalid',inquiry:'We want a demo.'})).json();
  const out=await (await request('/api/process',{id:added.ids[0]})).json();
  assert.equal(out.company_fit?.label,'High fit',JSON.stringify(out));assert.equal(out.lead_priority.tier,'A');assert.equal(out.company_stale,false);assert.ok(out.draft);assert.ok(out.evidence.every(e=>e.provider===(mode==='free_tokens'?'Jina Reader':'Direct company website')),JSON.stringify({evidence:out.evidence,retrieval:out.company_retrieval,requests:requests.length,service:(await (await request('/api/state')).json()).research_service}));
  const state=await (await request('/api/state')).json();assert.equal(state.research_service.mode,mode==='exhausted'?'direct_only':mode==='no_key'?'anonymous':'free_key');assert.equal(state.research_service.provider_balance_known,mode==='free_tokens');assert.ok(!JSON.stringify(state).includes(key));
  if(mode==='exhausted'){assert.equal(requests.length,0);assert.equal(state.research_service.app_requests_remaining,0);assert.equal((await db.prepare("SELECT count(*) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:%'").first()).n,0)}
  if(mode==='free_tokens'){assert.ok(requests.length);assert.equal(state.research_service.app_tokens_remaining,7900000-requests.length*500);assert.equal((await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'jina-free-budget:%'").first()).n,400)}
  if(mode==='no_key')assert.ok(requests.every(r=>!new Headers(r.headers).get('Authorization')));
 }finally{await mf.dispose()}
});

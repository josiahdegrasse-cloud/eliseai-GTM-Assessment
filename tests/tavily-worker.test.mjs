import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';
test('company processing recovers through free extraction and exposes no key',async()=>{
 const origin='https://assessment.test',key='test_free_key_not_a_real_secret',network=createFetchMock();network.disableNetConnect();let checks=0,extracts=0;
 network.get('https://r.jina.ai').intercept({path:/.*/,method:'GET'}).reply(500,{}).persist();
 network.get('https://api.tavily.com').intercept({path:'/usage',method:'GET'}).reply(200,()=>{checks++;return {account:{current_plan:'Researcher',plan_limit:1000,plan_usage:0,paygo_limit:0,paygo_usage:0},key:{limit:1000,usage:0}}}).persist();
 network.get('https://api.tavily.com').intercept({path:'/extract',method:'POST'}).reply(200,options=>{extracts++;return {results:[{url:'https://acmehousing.com/',title:'Acme Housing',raw_content:'Acme Housing owns and manages 500 residential apartment homes. Acme Housing handles leasing inquiries and resident services.'}]}}).persist();
 network.get('https://api.gleif.org').intercept({path:/.*/,method:'GET'}).reply(200,{data:[]}).persist();
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'test-salt',TAVILY_FREE_API_KEY:key},fetchMock:network});
 try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 await db.prepare("INSERT INTO request_limits VALUES('cooldown:reader',1,4102444800)").run();
 const r=await mf.dispatchFetch(origin+'/api/session'),session=await r.json(),cookie=r.headers.get('Set-Cookie').split(';')[0];
 const request=(path,body)=>mf.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'X-CSRF-Token':session.csrf,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const added=await (await request('/api/add',{name:'TEST Contact',email:'contact@acmehousing.com',company:'Acme Housing',website:'https://acmehousing.com',country:'US'})).json();
 const lead=await (await request('/api/process',{id:added.ids[0]})).json();assert.ok(extracts>0);assert.ok(checks>=extracts);assert.ok(lead.evidence.some(e=>e.provider==='Tavily Extract'),JSON.stringify(lead));assert.equal(lead.company_stale,false);assert.ok(lead.draft);
 const state=await (await request('/api/state')).json();assert.equal(state.research_service.additional_providers[0].status,'configured');
 const data=[JSON.stringify(lead),JSON.stringify(state)];for(const table of ['visitor_cache','visitor_leads','request_limits'])data.push(JSON.stringify(await db.prepare('SELECT * FROM '+table).all()));assert.ok(data.every(s=>!s.includes(key)));
 }finally{await mf.dispose()}
});

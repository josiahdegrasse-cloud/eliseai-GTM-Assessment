import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';

test('server free key enriches company and contact without leaking to assets, records or other providers',async()=>{
 const key='00000000-0000-4000-8000-000000000000',origin='https://assessment.test',outgoing=[],network=createFetchMock();network.disableNetConnect();
 network.get('https://r.jina.ai').intercept({path:/^\/https:\/\/acmehousing.com\//,method:'GET'}).reply(200,options=>{outgoing.push(options);return {code:200,data:{httpStatus:200,url:options.path.slice(1),title:'Acme Housing',content:'Acme Housing owns and manages 500 residential apartment homes and handles leasing inquiries.\n\nJordan Lee\nChief Operating Officer\nJordan Lee oversees operations at Acme Housing.'}}}).persist();
 network.get('https://api.gleif.org').intercept({path:/^\/api\/v1\/lei-records\?/,method:'GET'}).reply(200,options=>{outgoing.push(options);return {data:[]}}).persist();
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'test-salt',JINA_FREE_API_KEY:key},fetchMock:network});
 try{
  const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  const session=await mf.dispatchFetch(origin+'/api/session'),data=await session.json(),cookie=session.headers.get('Set-Cookie').split(';')[0];
  const request=(path,body)=>mf.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'X-CSRF-Token':data.csrf,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const added=await (await request('/api/add',{name:'Jordan Lee',email:'jordan@acmehousing.com',company:'Acme Housing',website:'https://acmehousing.com',country:'US'})).json();
  const result=await (await request('/api/process',{id:added.ids[0]})).json();
  assert.ok(result.evidence?.length,JSON.stringify(result));assert.equal(result.company_stale,false);
  const readers=outgoing.filter(r=>String(r.origin)==='https://r.jina.ai');assert.ok(readers.length>=2,'Both company and contact research use Reader');
  for(const request of readers){assert.equal(new Headers(request.headers).get('Authorization'),'Bearer '+key);assert.equal(new Headers(request.headers).get('X-Token-Budget'),'20000');assert.equal(new Headers(request.headers).get('X-Respond-With'),'markdown')}
  for(const request of outgoing.filter(r=>String(r.origin)!=='https://r.jina.ai'))assert.equal(new Headers(request.headers).get('Authorization'),null);
  const outputs=[JSON.stringify(result),await (await request('/api/state')).text(),await (await request('/')).text(),await (await request('/app.js')).text()];
  for(const table of ['visitor_leads','visitor_cache','public_sample_cache','security_events','request_limits'])outputs.push(JSON.stringify(await db.prepare('SELECT * FROM '+table).all()));
  for(const output of outputs)assert.ok(!output.includes(key),'Key leaked outside the request header');
  assert.ok((await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'jina-free-budget:%'").first()).n>=readers.length);
  // An exhausted lifetime budget prevents another network request, including
  // across new visitors. Retain the previously generated lead and draft.
  await db.prepare("UPDATE request_limits SET n=400 WHERE bucket LIKE 'jina-free-budget:%'").run();
  await db.prepare('DELETE FROM visitor_cache').run();
  const before=readers.length,next=await (await request('/api/process',{id:added.ids[0]})).json();
  assert.equal(outgoing.filter(r=>String(r.origin)==='https://r.jina.ai').length,before);
  assert.equal(next.company_stale,true);assert.equal(next.company_retry_code,'provider_quota');assert.ok(next.evidence.length);assert.ok(next.draft);
 }finally{await mf.dispose()}
});

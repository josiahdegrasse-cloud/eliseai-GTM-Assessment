import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';
import {safeDomain,intake,qualify} from '../website/domain.mjs';

const ORIGIN='https://assessment.test';
const JINA_TEST_KEY='jina_test_only';
const outgoing=[];
const SAMPLE={name:'TEST Contact',email:'test@example.invalid',company:'Acme Housing',website:'acmehousing.com',city:'Raleigh',state:'NC',country:'US',property_address:'12 Test Street'};
const EVIDENCE={code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',httpStatus:200,content:'Acme Housing manages residential multifamily communities and leasing inquiries.',html:'<header><img alt="Acme Housing logo" src="/logo.png"></header><link rel="icon" href="/favicon.ico">'}};
const bucket=name=>`provider:${name}:global:${Math.floor(Date.now()/60000)}`;
const CENSUS={result:{addressMatches:[{matchedAddress:'12 TEST STREET, RALEIGH, NC',addressComponents:{city:'RALEIGH',state:'NC',zip:'27601'},coordinates:{x:-78,y:35},geographies:{Counties:[{NAME:'Wake County'}],'Census Tracts':[{GEOID:'37183000100'}]}}]}};
let mf,db,network;
before(async()=>{
  network=createFetchMock();network.disableNetConnect();
  const areaFixture=JSON.parse(await readFile('test-data/area-fixture.json','utf8'));
  network.get('https://api.censusreporter.org').intercept({path:/^\/1.0\/data\/show\/latest\?/,method:'GET'}).reply(200,areaFixture).persist();
  const aerialFixture=new Uint8Array([255,216,255,192,0,17,8,1,164,2,208,3,1,17,0,2,17,0,3,17,0,...Array(15).fill(0),255,217]);
  network.get('https://imagery.nationalmap.gov').intercept({path:/^\/arcgis\/rest\/services\/USGSNAIPImagery\/ImageServer\/exportImage\?/,method:'GET'}).reply(200,aerialFixture,{headers:{'Content-Type':'image/jpeg'}}).persist();
  const logoFixture=await readFile('test-data/logo-fixture.png');
  network.get('https://dns.google').intercept({path:/^\/resolve\?name=acmehousing.com&type=/,method:'GET'}).reply(200,options=>({Status:0,Answer:options.path.endsWith('type=A')?[{type:1,data:'93.184.216.34'}]:[]})).persist();
  network.get('https://acmehousing.com').intercept({path:'/robots.txt',method:'GET'}).reply(200,'User-agent: *\nAllow: /').persist();
  network.get('https://acmehousing.com').intercept({path:'/',method:'GET'}).reply(200,'<title>Acme Housing</title><a href="/our-team">Our team</a>',{headers:{'Content-Type':'text/html'}}).persist();
  network.get('https://acmehousing.com').intercept({path:'/our-team',method:'GET'}).reply(200,options=>{outgoing.push(options);return '<title>Acme Housing</title><h2>Jordan Lee</h2><p>Chief Operating Officer</p><p>Jordan Lee oversees operations at Acme Housing.</p><h2>Alex Smith</h2><p>Chief Financial Officer</p><h2>Morgan Hale</h2><p>Director of Operations</p><a href="/team/morgan-hale">Morgan Hale</a>'},{headers:{'Content-Type':'text/html'}}).persist();
  network.get('https://acmehousing.com').intercept({path:'/team/morgan-hale',method:'GET'}).reply(200,options=>{outgoing.push(options);return '<title>Morgan Hale | Acme Housing</title><h2>Morgan Hale</h2><p>Director of Operations</p><p>Morgan Hale oversees leasing and resident operations across eight communities at Acme Housing.</p>'},{headers:{'Content-Type':'text/html'}}).persist();
  network.get('https://acmehousing.com').intercept({path:'/sitemap.xml',method:'GET'}).reply(200,options=>{outgoing.push(options);return '<urlset><url><loc>https://acmehousing.com/bio/nora-king</loc></url><url><loc>https://evil.com/nora-king</loc></url></urlset>'},{headers:{'Content-Type':'application/xml'}}).persist();
  network.get('https://acmehousing.com').intercept({path:'/bio/nora-king',method:'GET'}).reply(200,options=>{outgoing.push(options);return '<title>Acme Housing</title><h2>Nora King</h2><p>Director of Business Operations</p>'},{headers:{'Content-Type':'text/html'}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://fallback-acme.com/',method:'GET'}).reply(429,{}, {headers:{'Retry-After':'75'}}).persist();
  network.get('https://dns.google').intercept({path:/^\/resolve\?name=fallback-acme.com&type=/,method:'GET'}).reply(200,options=>({Status:0,Answer:options.path.endsWith('type=A')?[{type:1,data:'93.184.216.34'}]:[]})).persist();
  network.get('https://fallback-acme.com').intercept({path:'/robots.txt',method:'GET'}).reply(200,'User-agent: *\nAllow: /').persist();
  network.get('https://fallback-acme.com').intercept({path:'/about-us',method:'GET'}).reply(200,'<title>Acme Housing</title><p>Acme Housing is based in Raleigh and operates in eight states.</p><p>Acme Housing is a real estate investment trust (REIT).</p>',{headers:{'Content-Type':'text/html'}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://recovery-acme.com/',method:'GET'}).reply(403,options=>{outgoing.push(options);return {error:'private provider body'}}).persist();
  network.get('https://s.jina.ai').intercept({path:/^\//,method:'GET'}).reply(200,options=>{outgoing.push(options);return {code:200,data:[{url:'https://evil.test/invented-claim',content:'Acme Housing owns 9 million apartment homes.'},{url:'https://recovery-acme.com/company'}]}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://thin-acme.com/',method:'GET'}).reply(200,options=>{outgoing.push(options);return {...EVIDENCE,data:{...EVIDENCE.data,url:'https://thin-acme.com/'}}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://busy-acme.com/',method:'GET'}).reply(429,{}, {headers:{'Retry-After':'75'}}).persist();
  for(const [host,status] of [['auth-acme.com',401],['quota-acme.com',402]])network.get('https://r.jina.ai').intercept({path:'/https://'+host+'/',method:'GET'}).reply(status,options=>{outgoing.push(options);return {error:'Never expose provider body '+JINA_TEST_KEY}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://linked-acme.com/',method:'GET'}).reply(200,{...EVIDENCE,data:{...EVIDENCE.data,url:'https://linked-acme.com/',content:EVIDENCE.data.content+'\n\n[About us](https://linked-acme.com/about)'}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://linked-acme.com/about',method:'GET'}).reply(429,{}, {headers:{'Retry-After':'60'}});
  network.get('https://r.jina.ai').intercept({path:'/https://location-acme.com/',method:'GET'}).reply(200,{...EVIDENCE,data:{...EVIDENCE.data,url:'https://location-acme.com/',content:EVIDENCE.data.content+' We own 500 apartment homes.\n\n[Contact us](https://location-acme.com/contact)'}}).persist();
  network.get('https://r.jina.ai').intercept({path:'/https://location-acme.com/contact',method:'GET'}).reply(200,{...EVIDENCE,data:{...EVIDENCE.data,url:'https://location-acme.com/contact',content:'Acme Housing\n\nCorporate Headquarters\n12 Main Street\nRaleigh, NC 27601'}}).persist();
  network.get('https://wsrv.nl').intercept({path:/^\/\?/,method:'GET'}).reply(200,logoFixture,{headers:{'Content-Type':'image/png'}}).persist();
  network.get('https://r.jina.ai').intercept({path:/^\/https:\/\//,method:'GET'}).reply(200,options=>{outgoing.push(options);return {...EVIDENCE,data:{...EVIDENCE.data,content:EVIDENCE.data.content+' We own and manage 500 apartment homes.',url:options.path.slice(1)}}}).persist();
  network.get('https://api.gleif.org').intercept({path:/^\/api\/v1\/lei-records\?/,method:'GET'}).reply(200,options=>{outgoing.push(options);return {data:[]}}).persist();
  network.get('https://geocoding.geo.census.gov').intercept({path:/^\/geocoder\/geographies\/onelineaddress\?/,method:'GET'}).reply(200,CENSUS).persist();
  network.get('https://geocoding.geo.census.gov').intercept({path:value=>value.startsWith('/geocoder/geographies/address?')&&new URL(value,ORIGIN).searchParams.get('street')==='12 Test Street, Suite 300',method:'GET'}).reply(200,{result:{addressMatches:[]}}).persist();
  network.get('https://geocoding.geo.census.gov').intercept({path:value=>value.startsWith('/geocoder/geographies/address?')&&new URL(value,ORIGIN).searchParams.get('street')==='99 Ambiguous Street',method:'GET'}).reply(200,{result:{addressMatches:[...CENSUS.result.addressMatches,...CENSUS.result.addressMatches]}}).persist();
  network.get('https://geocoding.geo.census.gov').intercept({path:value=>value.startsWith('/geocoder/geographies/address?')&&new URL(value,ORIGIN).searchParams.get('street')==='40 Slow Street',method:'GET'}).reply(200,CENSUS).delay(1200).persist();
  network.get('https://geocoding.geo.census.gov').intercept({path:/^\/geocoder\/geographies\/address\?/,method:'GET'}).reply(200,options=>{outgoing.push(options);return CENSUS}).persist();
  mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:ORIGIN,EXA_API_KEY:'secret-test-key-not-real',JINA_API_KEY:JINA_TEST_KEY,RATE_LIMIT_SALT:'test-salt'},fetchMock:network});
  db=await mf.getD1Database('DB');
  for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
after(async()=>{await mf?.dispose()});
beforeEach(async()=>{outgoing.length=0;for(const t of ['public_sample_cache','visitor_cache','visitor_leads','visitor_sessions','request_limits','security_events'])await db.prepare('DELETE FROM '+t).run()});
async function request(path,client,body,extra={}){
  const headers={...(client?{Cookie:client.cookie,'X-CSRF-Token':client.csrf}:{}),...(body!==undefined?{'Content-Type':'application/json',Origin:ORIGIN}:{}),...extra};
  for(const k of Object.keys(headers))if(headers[k]===null)delete headers[k];
  return mf.dispatchFetch(ORIGIN+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
}
async function visitor(){const response=await request('/api/session');assert.equal(response.status,200);const data=await response.json();return {cookie:response.headers.get('Set-Cookie').split(';')[0],csrf:data.csrf,response,data}}
async function add(client,row=SAMPLE){const res=await request('/api/add',client,row);assert.equal(res.status,200);return (await res.json()).ids[0]}
async function state(client){const res=await request('/api/state',client);assert.equal(res.status,200);return res.json()}
test('public page opens from an external link without login',async()=>{const r=await request('/',null,undefined,{'Sec-Fetch-Site':'cross-site'});assert.equal(r.status,200);assert.match(await r.text(),/Inbound leads/)});
test('research renderer is served as a protected same-origin JavaScript module',async()=>{const html=await (await request('/')).text();assert.match(html,/type="module" src="\/app.js"/);const r=await request('/research.js');assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/javascript/);assert.ok(r.headers.get('Content-Security-Policy'));assert.match(await r.text(),/export function researchMarkup/)});
test('leads and template require an unexpired visitor session',async()=>{for(const path of ['/api/state','/template.csv'])assert.equal((await request(path)).status,401)});
test('database, source, configuration and credential routes are never served',async()=>{for(const path of ['/server.py','/.env','/inbound.sqlite3','/.openai/hosting.json','/api/connections/test'])assert.equal((await request(path)).status,404)});
test('session cookie is secure, HttpOnly, host-only, strict and tokens stored hashed',async()=>{const c=await visitor();const cookie=c.response.headers.get('Set-Cookie');for(const flag of ['__Host-','Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=86400'])assert.ok(cookie.includes(flag));assert.ok(!cookie.includes('Domain='));const row=await db.prepare('SELECT * FROM visitor_sessions').first();assert.notEqual(row.id,c.cookie.split('=')[1]);assert.equal(row.id.length,64)});
test('same browser reuses its session',async()=>{const c=await visitor();await add(c);const r=await request('/api/session',c);assert.equal((await r.json()).csrf,c.csrf);assert.equal(r.headers.get('Set-Cookie'),null);assert.equal((await state(c)).leads.length,1)});
test('session expiry denies reads immediately',async()=>{const c=await visitor();await db.prepare('UPDATE visitor_sessions SET expires=0').run();assert.equal((await request('/api/state',c)).status,401)});
test('expired sessions and their data are purged on the next session visit',async()=>{const c=await visitor();await add(c);await db.prepare('UPDATE visitor_sessions SET expires=0').run();await visitor();assert.equal((await db.prepare('SELECT count(*) AS n FROM visitor_leads').first()).n,0)});
test('browser receives hardening headers and no permissive CORS',async()=>{const r=await request('/');assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.match(r.headers.get('Strict-Transport-Security'),/31536000/);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null)});
test('forged cookie cannot read leads',async()=>{assert.equal((await request('/api/state',{cookie:'__Host-inbound-visitor='+'a'.repeat(64),csrf:'x'})).status,401)});
test('missing and incorrect CSRF tokens reject mutations',async()=>{const c=await visitor();for(const token of [null,'wrong'])assert.equal((await request('/api/add',c,SAMPLE,{'X-CSRF-Token':token})).status,403);assert.equal((await state(c)).leads.length,0)});
test('cross-origin and missing-Origin mutations rejected',async()=>{const c=await visitor();for(const origin of [null,'https://attacker.test'])assert.equal((await request('/api/add',c,SAMPLE,{Origin:origin})).status,403)});
test('cross-site session bootstrap rejected',async()=>{assert.equal((await request('/api/session',null,undefined,{'Sec-Fetch-Site':'cross-site'})).status,403)});
test('HTTP and unconfigured hosts fail closed',async()=>{for(const url of ['http://assessment.test/','https://attacker.test/'])assert.equal((await mf.dispatchFetch(url)).status,403)});
test('visitor A cannot read visitor B data',async()=>{const a=await visitor(),b=await visitor();await add(a);assert.equal((await state(a)).leads.length,1);assert.equal((await state(b)).leads.length,0)});
test('guessed lead IDs cannot be saved, updated or researched by another visitor',async()=>{const a=await visitor(),b=await visitor(),id=await add(a);for(const path of ['save','update','process'])assert.equal((await request('/api/'+path,b,{id,draft:'attacker',company:'attacker'})).status,404);assert.equal((await state(a)).leads[0].company,SAMPLE.company)});
test('duplicates are per visitor and isolated from other workspaces',async()=>{const a=await visitor(),b=await visitor();await add(a);const r=await request('/api/add',a,SAMPLE);assert.equal((await r.json()).duplicates,1);await add(b);assert.equal((await state(b)).leads.length,1)});
test('CSV accepts normalized headers and sample company fixture',async()=>{const c=await visitor();const csv=await readFile('test-data/public-company-samples.csv','utf8');const r=await request('/api/import',c,{csv});assert.equal((await r.json()).inserted,3);const again=await request('/api/import',c,{csv});assert.equal((await again.json()).duplicates,3)});
test('malformed, missing-column and oversized row imports are rejected',async()=>{const c=await visitor();for(const csv of ['name\nTest','name,email,company,city,state,property_address\n"unclosed'])assert.equal((await request('/api/import',c,{csv})).status,400);const csv='name,email,company,city,state,property_address\n'+Array(101).fill('Test,test@example.invalid,Acme,Raleigh,NC,12 St').join('\n');assert.equal((await request('/api/import',c,{csv})).status,400)});
test('non-JSON and oversized bodies are rejected',async()=>{const c=await visitor();assert.equal((await request('/api/add',c,SAMPLE,{'Content-Type':'text/plain'})).status,415);assert.equal((await request('/api/add',c,{notes:'x'.repeat(1000001)})).status,413)});
test('draft save and identity correction preserve the previous reviewed message',async()=>{const c=await visitor(),id=await add(c);assert.equal((await request('/api/save',c,{id,subject:'Edited',draft:'Reviewed text',reviewed:true})).status,200);assert.equal((await state(c)).leads[0].draft,'Reviewed text');await request('/api/update',c,{id,company:'Changed'});const l=(await state(c)).leads[0];assert.equal(l.previous_draft.draft,'Reviewed text');assert.equal(l.reviewed,false)});
test('both providers populate evidence; cache prevents repeat calls',async()=>{const c=await visitor(),id=await add(c);const r=await request('/api/process',c,{id});assert.equal(r.status,200);const lead=await r.json();assert.equal(lead.research_state,'complete');assert.equal(lead.fit.label,'Strong fit');assert.equal(lead.property_context.county,'Wake County');await request('/api/process',c,{id});assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1)});
test('research preserves a reviewed email',async()=>{const c=await visitor(),id=await add(c);await request('/api/save',c,{id,draft:'My reviewed email',reviewed:true});const lead=await (await request('/api/process',c,{id})).json();assert.equal(lead.draft,'My reviewed email')});
test('direct fallback recovers cited background during Reader throttling without changing fit or saved wording',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'fallback-acme.com'});await request('/api/save',c,{id,draft:'My reviewed email',reviewed:true});
 const lead=await (await request('/api/process',c,{id})).json();
 assert.equal(lead.company_stale,false);assert.equal(lead.company_retry_code,null);assert.equal(lead.company_identity.status,'confirmed');
 assert.equal(lead.research_brief.sources[0].provider,'Direct company website');assert.equal(lead.research_brief.context.length,2);assert.equal(lead.priority.fit,0);assert.equal(lead.priority.readiness,0);assert.equal(lead.draft,'My reviewed email');
 const calls=(await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%:global:%'").first()).n;
 await request('/api/process',c,{id});assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%:global:%'").first()).n,calls);
});
test('global Reader throttle defers excess requests and preserves property lookup',async()=>{const c=await visitor(),id=await add(c);await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),60,Math.floor(Date.now()/1000)+60).run();const lead=await (await request('/api/process',c,{id})).json();assert.equal(lead.research_state,'partial');assert.equal(lead.property_context.status,'matched');assert.equal(lead.evidence.length,0);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,60)});
test('concurrent requests cannot exceed the last global research allowance',async()=>{const a=await visitor(),b=await visitor(),ia=await add(a),ib=await add(b);await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),7,Math.floor(Date.now()/1000)+60).run();const records=await Promise.all([[a,ia],[b,ib]].map(async([client,id])=>(await request('/api/process',client,{id})).json()));assert.equal(records.filter(l=>l.evidence.length).length,1);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,8)});
test('optional Census daily limit renews without changing sessions',async()=>{
 const c=await visitor(),id=await add(c),session=await db.prepare('SELECT id FROM visitor_sessions').first();
 const day=Math.floor(Date.now()/86400000),key=`provider:census:session:${session.id}:${day}`;
 await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(key,30,Math.floor(Date.now()/1000)+86400).run();
 const first=await (await request('/api/process',c,{id})).json();assert.ok(first.evidence.length);assert.equal(first.property_context.status,'unavailable');assert.match(first.property_context.message,/midnight UTC/);
 // Expired counters renew atomically even without a session-bootstrap cleanup.
 await db.prepare('UPDATE request_limits SET expires=0 WHERE bucket=?').bind(key).run();await db.prepare('DELETE FROM visitor_cache').run();
 const next=await (await request('/api/process',c,{id})).json();assert.ok(next.evidence.length);assert.equal((await db.prepare('SELECT n FROM request_limits WHERE bucket=?').bind(key).first()).n,1);
});
test('request throttling returns 429',async()=>{const c=await visitor();const row=await db.prepare("SELECT bucket FROM request_limits WHERE bucket LIKE 'request:%'").first();await db.prepare('UPDATE request_limits SET n=120 WHERE bucket=?').bind(row.bucket).run();assert.equal((await request('/api/state',c)).status,429)});
test('clear data deletes only this visitor and revokes their cookie',async()=>{const a=await visitor(),b=await visitor();await add(a);await add(b);const r=await request('/api/session/delete',a,{});assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);assert.equal((await request('/api/state',a)).status,401);assert.equal((await state(b)).leads.length,1)});
test('credentials never appear in browser assets, processed leads, exports, caches or audit records',async()=>{
 const c=await visitor(),id=await add(c);const outputs=[await (await request('/api/process',c,{id})).text()];
 const paths=['/','/api/state','/api/export',...(await readdir('static')).filter(f=>f.endsWith('.js')).map(f=>'/'+f)];
 for(const path of paths)outputs.push(await (await request(path,c)).text());
 for(const table of ['visitor_cache','public_sample_cache','visitor_leads','security_events'])outputs.push(JSON.stringify(await db.prepare('SELECT * FROM '+table).all()));
 for(const text of outputs)for(const key of ['secret-test-key-not-real',JINA_TEST_KEY])assert.ok(!text.includes(key),'Credential leaked to a response or stored record');
 const events=await db.prepare('SELECT * FROM security_events').all();assert.ok(!JSON.stringify(events).includes(SAMPLE.email));assert.ok(!JSON.stringify(events).includes(c.csrf));
});
test('no upstream receives credentials, even when server or visitor keys exist',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,JINA_API_KEY:'visitor-override'});
 const lead=await (await request('/api/process',c,{id,JINA_API_KEY:'visitor-override',Authorization:'Bearer visitor-override'})).json();assert.ok(lead.evidence.length);
 const readers=outgoing.filter(o=>String(o.origin)==='https://r.jina.ai');assert.equal(readers.length,1);
 assert.equal(new Headers(readers[0].headers).get('Authorization'),null);
 const others=outgoing.filter(o=>String(o.origin)!=='https://r.jina.ai');assert.ok(others.length>=2);
 for(const other of others)assert.equal(new Headers(other.headers).get('Authorization'),null);
});
for(const [host,code] of [['quota-acme.com','provider_quota']])test(code+' is sanitized, cached and never retried anonymously',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:host});await request('/api/save',c,{id,draft:'Keep my reviewed email',reviewed:true});
 for(let i=0;i<2;i++){const lead=await (await request('/api/process',c,{id})).json();assert.equal(lead.company_retry_code,code);assert.equal(lead.draft,'Keep my reviewed email');assert.equal(lead.property_context.status,'matched');assert.ok(!JSON.stringify(lead).includes(JINA_TEST_KEY));assert.doesNotMatch(lead.research_note,/Never expose provider body|temporarily rate-limiting/)}
 assert.equal(outgoing.filter(o=>String(o.origin)==='https://r.jina.ai').length,1);
});
test('reserved, private and credential-bearing domains rejected',()=>{for(const d of ['localhost','127.0.0.1','169.254.169.254','example.invalid','https://user:pass@acme.com','http://acme.com','https://acme.com:8080'])assert.equal(safeDomain(d),'');assert.equal(safeDomain('https://acme.com'),'acme.com')});
test('Census and commercial evidence do not create residential fit claims',()=>{const l=intake(SAMPLE),c={evidence:[{verified:true,text:'Commercial office property management.'}],matched:true,message:'matched'};const out=qualify(l,c,{status:'matched'},[]);assert.equal(out.score,null);assert.ok(!out.draft.includes('describes residential property management'))});
test('only published sample research is shared; visitor records remain separate',async()=>{
 const publicData={location_version:1,cache_fetched_at:new Date().toISOString(),cache_fresh_until:new Date(Date.now()+3600000).toISOString(),evidence:[{verified:true,text:'Greystar manages multifamily communities.',url:'https://greystar.com',title:'Greystar'}],matched:true,message:'Published sample research'};
 await db.prepare('INSERT INTO public_sample_cache VALUES(?,?,?)').bind('reader-v2:recovery-v11:greystar.com|greystar|',JSON.stringify(publicData),Math.floor(Date.now()/1000)+3600).run();
 const a=await visitor(),b=await visitor(),sample={...SAMPLE,company:'Greystar',website:'greystar.com'};
 const ia=await add(a,{...sample,name:'TEST A'}),ib=await add(b,{...sample,name:'TEST B'});
 for(const [client,id] of [[a,ia],[b,ib]])assert.equal((await (await request('/api/process',client,{id})).json()).evidence[0].title,'Greystar');
 assert.equal((await state(a)).leads[0].name,'TEST A');assert.equal((await state(b)).leads[0].name,'TEST B');
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first(),null);
});
test('missing company website is actionable, never research complete',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,email:'qa@gmail.com',website:''});
 assert.equal((await state(c)).leads[0].research_state,'needs_website');
 const lead=await (await request('/api/process',c,{id})).json();assert.equal(lead.research_state,'needs_website');assert.equal(lead.evidence.length,0);assert.equal(lead.property_context.status,'matched');
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first(),null);
});
test('editing research inputs resets timestamp and evidence while preserving saved wording',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});await request('/api/save',c,{id,draft:'My reviewed email',reviewed:true});
 await request('/api/update',c,{id,website:'acmeother.com'});const lead=(await state(c)).leads[0];
 assert.equal(lead.processed_at,null);assert.equal(lead.score,null);assert.equal(lead.research_state,'pending');assert.equal(lead.fit.label,'Not researched');assert.equal(lead.evidence.length,0);assert.equal(lead.draft,'My reviewed email');assert.equal(lead.draft_stale,true);assert.equal(lead.reviewed,false);
});
test('qualification answers persist separately from research and reviewed draft',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/save',c,{id,qualifications:{role:'Operations lead',scope:'Two communities',process_timing:'Evaluating this quarter',injected:'ignored'}});
 await request('/api/process',c,{id});const l=(await state(c)).leads[0];assert.equal(l.qualification.recorded,2);assert.equal(l.qualifications.process_timing,'Evaluating this quarter');assert.equal(l.qualifications.timing,'');assert.equal(l.qualifications.injected,undefined);assert.equal(l.reviewed,false);
 await request('/api/update',c,{id,company:'Other company'});assert.equal((await state(c)).leads[0].qualification.recorded,0);
});
test('regenerating and restoring drafts preserves a recoverable saved version without API calls',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});await request('/api/save',c,{id,draft:'My custom draft',reviewed:true});
 await request('/api/draft',c,{id});let l=(await state(c)).leads[0];assert.notEqual(l.draft,'My custom draft');assert.equal(l.previous_draft.draft,'My custom draft');assert.equal(l.reviewed,false);
 await request('/api/draft',c,{id,restore:true});l=(await state(c)).leads[0];assert.equal(l.draft,'My custom draft');assert.equal(l.draft_stale,true);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
});
test('other visitors cannot regenerate drafts or write discovery answers',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a);assert.equal((await request('/api/draft',b,{id})).status,404);assert.equal((await request('/api/save',b,{id,qualifications:{role:'attacker'}})).status,404);
});
test('optional missing address does not mark successful company research incomplete',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,property_address:''});const l=await (await request('/api/process',c,{id})).json();assert.equal(l.research_state,'complete');assert.equal(l.fit.label,'Strong fit');assert.equal(l.property_context.status,'incomplete');assert.doesNotMatch(l.research_note,/Add street/);
});
test('saved but unreviewed edits survive research and are flagged when evidence changes',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/save',c,{id,draft:'My unfinished edits',reviewed:false});const l=await (await request('/api/process',c,{id})).json();assert.equal(l.draft,'My unfinished edits');assert.equal(l.draft_stale,true);
});
test('inquiry imports as optional text and context-only updates retain company evidence',async()=>{
 const c=await visitor();const csv='name,email,company,city,state,property_address,website,inquiry\r\nTEST Contact,test@example.invalid,Acme Housing,Raleigh,NC,12 Test Street,acmehousing.com,"Need faster replies, after hours"';
 const res=await request('/api/import',c,{csv});assert.equal(res.status,200);const id=(await res.json()).ids[0];
 await request('/api/process',c,{id});const prior=(await state(c)).leads[0];assert.equal(prior.inquiry,'Need faster replies, after hours');
 await request('/api/update',c,{id,inquiry:'Improve tour follow-up'});const lead=(await state(c)).leads[0];
 assert.equal(lead.processed_at,prior.processed_at);assert.deepEqual(lead.evidence,prior.evidence);assert.equal(lead.inquiry,'Improve tour follow-up');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
});
test('saving discovery updates an untouched draft without another provider call',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,inquiry:'Improve inquiry response'});await request('/api/process',c,{id});
 await request('/api/save',c,{id,qualifications:{scope:'Two communities',process:'Yardi plus shared inbox'}});
 const lead=(await state(c)).leads[0];assert.equal(lead.next_question.key,'timing');assert.match(lead.draft,/Would a quick walkthrough of prospect follow-up/);assert.doesNotMatch(lead.draft,/which tools/);
 assert.equal(lead.draft_stale,false);assert.equal(lead.qualification.recorded,2);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
});
test('buyer context changes preserve reviewed wording and require a new review',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/save',c,{id,draft:'Keep my approved wording',reviewed:true});
 await request('/api/save',c,{id,inquiry:'Need faster follow-up',qualifications:{scope:'Three communities'}});
 const lead=(await state(c)).leads[0];assert.equal(lead.draft,'Keep my approved wording');assert.equal(lead.reviewed,false);assert.equal(lead.draft_stale,true);assert.equal(lead.status,'Recheck draft');
 await request('/api/draft',c,{id});const regenerated=(await state(c)).leads[0];assert.match(regenerated.draft,/How does your team handle prospect follow-up today/);assert.doesNotMatch(regenerated.draft,/EliseAI can/);
});
test('inquiry is bounded and session-isolated on both update routes',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a,{...SAMPLE,inquiry:'x'.repeat(2200)});
 assert.equal((await state(a)).leads[0].inquiry.length,2000);
 for(const path of ['save','update'])assert.equal((await request('/api/'+path,b,{id,inquiry:'attacker'})).status,404);
 assert.equal((await state(b)).leads.length,0);
 await request('/api/save',a,{id,inquiry:'y'.repeat(2300)});assert.equal((await state(a)).leads[0].inquiry.length,2000);
});
async function ageCompanyCache(){
 const rows=(await db.prepare('SELECT key,data FROM visitor_cache').all()).results;
 for(const row of rows){const data=JSON.parse(row.data);if(data.evidence||data.page){data.cache_fetched_at=new Date(Date.now()-90000000).toISOString();data.cache_fresh_until=new Date(Date.now()-3600000).toISOString();await db.prepare('UPDATE visitor_cache SET data=? WHERE key=?').bind(JSON.stringify(data),row.key).run()}}
}
test('reopening recent company research preserves retrieval time and avoids provider calls',async()=>{
 const c=await visitor(),id=await add(c);const first=await (await request('/api/process',c,{id})).json(),second=await (await request('/api/process',c,{id})).json();
 assert.equal(second.company_fetched_at,first.company_fetched_at);assert.equal(second.company_fresh_until,first.company_fresh_until);assert.equal(second.cached,true);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
});
test('24-hour company expiry refreshes while the address cache remains reusable',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});await ageCompanyCache();
 const lead=await (await request('/api/process',c,{id})).json();assert.ok(Date.parse(lead.company_fresh_until)>Date.now());assert.equal(lead.company_stale,false);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,2);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first()).n,1);
});
test('different contacts at the same company share a concurrent lookup',async()=>{
 const c=await visitor(),a=await add(c),b=await add(c,{...SAMPLE,email:'another@example.invalid'});
 // Follow Miniflare's immediate body-consumption contract while requests run concurrently.
 const replies=await Promise.all([a,b].map(async id=>{const reply=await request('/api/process',c,{id});assert.equal(reply.status,200);return reply.json()}));
 for(const reply of replies)assert.equal(reply.fit.label,'Strong fit');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first()).n,1);
});
test('refresh failures preserve evidence and suppress repeated automatic provider attempts',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});await ageCompanyCache();await request('/api/save',c,{id,draft:'Keep this wording',reviewed:true});
 await db.prepare("UPDATE request_limits SET n=60 WHERE bucket LIKE 'provider:reader:global:%'").run();
 const first=await (await request('/api/process',c,{id})).json();assert.equal(first.company_stale,true);assert.ok(first.evidence.length);assert.equal(first.draft,'Keep this wording');assert.ok(Date.parse(first.company_retry_after)>Date.now());
 const before=await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:session:%'").first();await request('/api/process',c,{id});const after=await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:session:%'").first();assert.equal(after.n,before.n);
});
test('legacy cache without a freshness timestamp is checked again',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});
 const rows=(await db.prepare('SELECT key,data FROM visitor_cache').all()).results;
 for(const row of rows){const data=JSON.parse(row.data);if(data.evidence||data.page){delete data.cache_fresh_until;await db.prepare('UPDATE visitor_cache SET data=? WHERE key=?').bind(JSON.stringify(data),row.key).run()}}
 await request('/api/process',c,{id});assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,2);
});
test('duplicate manual intake returns only the owning visitor’s existing lead',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a);const duplicate=await (await request('/api/add',a,SAMPLE)).json();assert.deepEqual(duplicate.existing_ids,[id]);
 const other=await (await request('/api/add',b,SAMPLE)).json();assert.deepEqual(other.existing_ids,[]);assert.notEqual(other.ids[0],id);
});

test('published samples survive expired caches and exhausted allowances without network calls',async()=>{
 const c=await visitor();for(const [name,n] of [['reader',60],['census',30]])await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket(name),n,Math.floor(Date.now()/1000)+60).run();
 const csv=await readFile('test-data/public-company-samples.csv','utf8');const imported=await (await request('/api/import',c,{csv})).json();
 for(const id of imported.ids){const out=await (await request('/api/process',c,{id})).json();assert.ok(out.evidence.length);assert.equal(out.company_snapshot,true);assert.equal(out.company_stale,true);assert.equal(out.company_fresh_until,null);assert.equal(out.property_context.status,'matched');assert.equal(out.property_context.sample_snapshot,true);assert.ok(out.draft.length>50);assert.ok(out.company_fetched_at.startsWith('2026-09-29'));}
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,60);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM public_sample_cache WHERE key NOT LIKE \'gleif:%\'').first()).n,0);
});
test('unpublished companies never inherit sample facts when research is unavailable',async()=>{
 const c=await visitor(),id=await add(c);await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),60,Math.floor(Date.now()/1000)+60).run();
 const out=await (await request('/api/process',c,{id})).json();assert.equal(out.company_snapshot,false);assert.equal(out.evidence.length,0);assert.equal(out.draft_basis.length,0);
});
test('snapshot labels clear when a later real lookup succeeds',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,company:'Greystar',website:'greystar.com'});
 await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),60,Math.floor(Date.now()/1000)+60).run();
 assert.equal((await (await request('/api/process',c,{id})).json()).company_snapshot,true);
 // Reset only this disposable test database to model a newly available provider.
 await db.prepare("DELETE FROM request_limits WHERE bucket LIKE 'provider:reader:%'").run();
 const refreshed=await (await request('/api/process',c,{id})).json();assert.equal(refreshed.company_snapshot,false);assert.equal(refreshed.company_stale,false);assert.ok(Date.parse(refreshed.company_fresh_until)>Date.now());
});
test('non-US leads still get company research and explicitly unsupported Census coverage',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,country:'CA'});const out=await (await request('/api/process',c,{id})).json();
 assert.equal(out.property_context.status,'unsupported');assert.equal(out.fit.label,'Strong fit');assert.equal(out.research_state,'complete');
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first(),null);
});

test('CSV download returns a readable attachment scoped to the requesting visitor',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a),other=await add(b,{...SAMPLE,name:'Private other visitor'});
 const response=await request('/api/export?id='+id+'&id='+other,a);assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/attachment; filename="inbound-leads.csv"/);
 const csv=await response.text();assert.match(csv,/company_fit,fit_reason/);assert.match(csv,/TEST Contact/);assert.ok(!csv.includes('Private other visitor'));
 assert.equal((await request('/api/export')).status,401);
});

test('an earlier empty sample result cannot hide the source fallback on a failed refresh',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,company:'AMLI',website:'amli.com'});
 await db.prepare('INSERT INTO public_sample_cache VALUES(?,?,?)').bind('reader:amli.com|amli',JSON.stringify({evidence:[],cache_fresh_until:'2020-01-01',cache_fetched_at:'2020-01-01'}),Math.floor(Date.now()/1000)+3600).run();
 await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),60,Math.floor(Date.now()/1000)+60).run();
 const out=await (await request('/api/process',c,{id})).json();assert.equal(out.company_snapshot,true);assert.equal(out.research_brief.portfolio.value,'over 25,000 apartment homes');assert.ok(out.company_fetched_at.startsWith('2026-09-29'));
});

test('old lifetime Exa and Census counters cannot block the free providers',async()=>{
 const c=await visitor(),id=await add(c);
 for(const [name,n] of [['exa',16],['census',100]])await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(`provider:${name}:global`,n,253402300799).run();
 const l=await (await request('/api/process',c,{id})).json();assert.equal(l.company_engine,'reader-v2');assert.equal(l.fit.label,'Strong fit');assert.equal(l.property_context.status,'matched');
 assert.equal((await db.prepare("SELECT n FROM request_limits WHERE bucket='provider:exa:global'").first()).n,16);
 const data=await state(c);assert.equal(data.usage,undefined);assert.match(data.research_provider,/Jina/);
});
test('optional registry failure cannot block the account brief or property result',async()=>{
 const c=await visitor(),id=await add(c);await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('gleif'),30,Math.floor(Date.now()/1000)+60).run();
 const l=await (await request('/api/process',c,{id})).json();assert.equal(l.research_state,'complete');assert.equal(l.fit.label,'Strong fit');assert.equal(l.registry_context.stale,true);assert.ok(l.draft.length>50);
});

test('company logos require the owning session and CSRF; untrusted input is not a fetch target',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a);
 assert.equal((await request('/api/logo',b,{id})).status,404);
 assert.equal((await request('/api/logo',a,{id},{'X-CSRF-Token':null})).status,403);
 await request('/api/process',a,{id});
 const result=await (await request('/api/logo',a,{id,url:'http://127.0.0.1/secret'})).json();
 assert.equal(result.status,'found');assert.match(result.image,/^data:image\/png;base64,/);assert.equal(result.source_url,'https://acmehousing.com/logo.png');
});
test('logo cache reuses image bytes across contacts without changing drafts or research',async()=>{
 const c=await visitor(),id=await add(c),id2=await add(c,{...SAMPLE,email:'test2@example.invalid'});
 await request('/api/process',c,{id});
 const before=(await state(c)).leads[0];
 const first=await (await request('/api/logo',c,{id})).json();
 const second=await (await request('/api/logo',c,{id:id2})).json();assert.deepEqual(second,first);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
 const after=(await state(c)).leads[0];assert.equal(after.draft,before.draft);assert.equal(after.processed_at,before.processed_at);assert.equal(after.reviewed,false);
 const cache=(await db.prepare('SELECT data FROM visitor_cache').all()).results;assert.ok(cache.some(row=>/data:image/.test(row.data)));
});
test('logos can use a retained official team page without a homepage cache',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,research_url:'https://acmehousing.com/our-team'});
 const session=await db.prepare('SELECT id FROM visitor_sessions').first();
 const key='company-page-v7:https://acmehousing.com/our-team|acme housing';
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
 await db.prepare('INSERT INTO visitor_cache(key,session_id,data,expires) VALUES(?,?,?,?)').bind(session.id+':'+hash,session.id,JSON.stringify({page:{url:'https://acmehousing.com/our-team'},candidates:[{url:'https://acmehousing.com/logo.png',page_url:'https://acmehousing.com/our-team',kind:'logo',theme:'light'}]}),Math.floor(Date.now()/1000)+3600).run();
 const logo=await (await request('/api/logo',c,{id})).json();assert.equal(logo.status,'found');assert.equal(logo.page_url,'https://acmehousing.com/our-team');assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:%'").first(),null);
});
test('logo provider exhaustion is nonfatal and missing website makes no provider call',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'',email:'test@gmail.com'});
 assert.equal((await (await request('/api/logo',c,{id})).json()).status,'missing');assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first(),null);
 const id2=await add(c);await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(bucket('reader'),60,Math.floor(Date.now()/1000)+60).run();
 const r=await request('/api/logo',c,{id:id2});assert.equal(r.status,200);assert.equal((await r.json()).status,'deferred');assert.equal((await state(c)).leads.length,2);
});
test('all three verified sample logos load without research or image-provider capacity',async()=>{
 const c=await visitor();
 await db.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,999,?)').bind(bucket('reader'),Math.floor(Date.now()/1000)+120).run();
 for(const [company,website,w,h] of [['Greystar','greystar.com',783,171],['Camden Property Trust','camdenliving.com',833,292],['AMLI','amli.com',456,212]]){
  const id=await add(c,{...SAMPLE,company,website});
  const result=await (await request('/api/logo',c,{id})).json();assert.equal(result.status,'found');assert.equal(result.kind,'logo');
  const asset=await request(result.image);assert.equal(asset.status,200);assert.equal(asset.headers.get('Content-Type'),'image/png');
  const bytes=new DataView(await asset.arrayBuffer());assert.equal(bytes.getUint32(16),w);assert.equal(bytes.getUint32(20),h);
 }
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'logo:%'").first(),null);
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:session:%'").first(),null);
 assert.equal((await request('/company-marks/not-a-brand.png')).status,404);
});
test('deferred logos become available after research without their own Reader fetch',async()=>{
 const c=await visitor(),id=await add(c);
 await db.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,999,?)').bind(bucket('reader'),Math.floor(Date.now()/1000)+120).run();
 const result=await (await request('/api/logo',c,{id})).json();assert.equal(result.status,'deferred');assert.ok(Date.parse(result.retry_after)>Date.now());
 await db.prepare('DELETE FROM request_limits').run();
 await request('/api/process',c,{id});
 await db.prepare("UPDATE visitor_cache SET data=json_set(data,'$.retry_after','2000-01-01T00:00:00Z')").run();
 assert.equal((await (await request('/api/logo',c,{id})).json()).status,'found');
});
test('one homepage fetch supplies concurrent company research and logo extraction',async()=>{
 const c=await visitor(),id=await add(c);const replies=await Promise.all([request('/api/process',c,{id}),request('/api/logo',c,{id})]);
 const [lead,logo]=await Promise.all(replies.map(r=>r.json()));assert.ok(lead.evidence.length);assert.ok(['deferred','found'].includes(logo.status));assert.equal((await (await request('/api/logo',c,{id})).json()).status,'found');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
 const next=await (await request('/api/process',c,{id})).json();assert.equal(next.company_fetched_at,lead.company_fetched_at);
});
test('external 429 pauses other companies and logos without spending their research allowance',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a,{...SAMPLE,website:'busy-acme.com',property_address:''}),other=await add(b);
 const lead=await (await request('/api/process',a,{id})).json();assert.equal(lead.company_retry_code,'provider_busy');assert.equal(lead.evidence.length,0);assert.doesNotMatch(lead.research_note,/Add street/);
 const until=Date.parse(lead.company_retry_after);assert.ok(until>Date.now()+70000);
 const next=await (await request('/api/process',b,{id:other})).json();assert.equal(next.company_retry_code,'provider_busy');assert.equal(next.property_context.status,'matched');
 assert.equal((await (await request('/api/logo',b,{id:other})).json()).status,'deferred');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,1);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:session:%'").first()).n,1);
 // Model the provider reopening; do not reset allowances, saved leads or drafts.
 await db.prepare("UPDATE request_limits SET expires=0 WHERE bucket='cooldown:reader'").run();
 await db.prepare("UPDATE visitor_cache SET data=json_set(data,'$.retry_after','2000-01-01T00:00:00Z')").run();
 const recovered=await (await request('/api/process',b,{id:other})).json();assert.equal(recovered.company_stale,false);assert.ok(recovered.evidence.length);assert.equal(recovered.company_retry_code,null);
});
test('free daily company allowance is enforced independently per visitor',async()=>{
 const a=await visitor(),id=await add(a),session=await db.prepare('SELECT id FROM visitor_sessions').first(),day=Math.floor(Date.now()/86400000);
 await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind(`provider:reader:session:${session.id}:${day}`,60,(day+1)*86400).run();
 assert.equal((await (await request('/api/process',a,{id})).json()).company_retry_code,'daily_limit');
 const b=await visitor(),other=await add(b);assert.ok((await (await request('/api/process',b,{id:other})).json()).evidence.length);
 assert.equal(await db.prepare("SELECT bucket FROM request_limits WHERE bucket='cooldown:reader'").first(),null);
});
test('a throttled linked page retries from the cached homepage and preserves edited drafts',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'linked-acme.com'});
 const first=await (await request('/api/process',c,{id})).json();assert.ok(first.evidence.length);assert.equal(first.company_stale,true);assert.equal(first.company_fresh_until,null);assert.equal(first.company_retry_code,'provider_busy');
 await request('/api/save',c,{id,draft:'Keep my edits',reviewed:true});
 await db.prepare("UPDATE request_limits SET expires=0 WHERE bucket='cooldown:reader'").run();
 await db.prepare("UPDATE visitor_cache SET data=json_set(data,'$.retry_after','2000-01-01T00:00:00Z')").run();
 const next=await (await request('/api/process',c,{id})).json();assert.equal(next.company_stale,false);assert.equal(next.automation_pending,false);assert.equal(next.company_fit.research_status,'complete');assert.equal(next.company_retry_after,null);assert.equal(next.company_retry_code,null);assert.equal(next.company_error,null);assert.equal(next.evidence.length,2);assert.equal(next.draft,'Keep my edits');
 assert.equal(next.evidence[0].date,first.evidence[0].date);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:global:%'").first()).n,3);
});
test('property imagery requires the owning session, CSRF and matched server-side coordinates',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a);
 assert.equal((await request('/api/property-image',b,{id})).status,404);
 assert.equal((await request('/api/property-image',a,{id},{'X-CSRF-Token':null})).status,403);
 assert.equal((await (await request('/api/property-image',a,{id,url:'http://localhost/'})).json()).status,'unavailable');
 await request('/api/process',a,{id});
 const first=await (await request('/api/property-image',a,{id,url:'http://localhost/'})).json(),second=await (await request('/api/property-image',a,{id})).json();
 assert.equal(first.status,'found');assert.match(first.image,/^data:image\/jpeg;base64,/);assert.deepEqual(first,second);
 assert.equal((await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'aerial:global:%'").first()).n,1);
});
test('imagery allowance exhaustion preserves research and email content',async()=>{
 const c=await visitor(),id=await add(c);const before=await (await request('/api/process',c,{id})).json();
 await db.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,999,?)').bind('aerial:global:'+Math.floor(Date.now()/60000),Math.floor(Date.now()/1000)+120).run();
 const image=await (await request('/api/property-image',c,{id})).json();assert.equal(image.status,'unavailable');
 const after=(await state(c)).leads[0];assert.equal(after.draft,before.draft);assert.deepEqual(after.evidence,before.evidence);
});

test('buyer assessments persist and update priority without trusting a client-supplied score',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,name:'Jordan Lee',inquiry:'We need help with after-hours replies.'});
 await request('/api/process',c,{id});
 const initial=(await state(c)).leads[0];assert.equal(initial.priority.readiness,0);
 const before=(await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%'").first()).n;
 const response=await request('/api/save',c,{id,score:999,priority:{total:999},qualifications:{need_status:'confirmed',scope_status:'defined',timing_status:'30_days',role_status:'decision_maker',scope:'Pilot at two communities',timing:'Start in October',role:'Contact has final approval'}});
 assert.equal(response.status,200);
 const updated=(await state(c)).leads[0];assert.equal(updated.priority.readiness,50);assert.equal(updated.score,null);assert.equal(updated.priority.tier,'Prioritize conversation');assert.equal(updated.qualifications.need_status,'confirmed');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%'").first()).n,before);
 await request('/api/save',c,{id,qualifications:{need_status:'untrusted-option'}});
 const reset=(await state(c)).leads[0];assert.equal(reset.qualifications.need_status,'unknown');assert.equal(reset.priority.readiness,30);assert.notEqual(reset.priority.tier,'Prioritize conversation');
});
test('decision notes are server-dated, isolated, retained and exported without extra provider calls',async()=>{
 const c=await visitor(),other=await visitor(),id=await add(c,{...SAMPLE,name:'Jordan Lee',inquiry:'Missed calls are slowing our leasing follow-up.'});
 await request('/api/process',c,{id});
 const providerCount=async()=>(await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%'").first()).n;
 const before=await providerCount();
 const q={need_status:'confirmed',timing_status:'30_days',role_status:'decision_maker',scope_status:'defined',timing:'Buyer targets next month',role:'Buyer approves the contract',scope:'Start with two communities',workflow_key:'voice',workflow_note:'Buyer confirms unanswered leasing calls',impact_metric:'missed_calls_week',impact_value:'25',impact_note:'Buyer reports 25 missed calls last week',pms_name:'Example PMS',pms_edition:'Enterprise',integration_status:'supported',integration_source_url:'https://eliseai.com/integrations',integration_note:'Rep checked voice workflow and required edition',account_status:'new',account_note:'Rep checked the account directory',owner:'Assigned rep',next_step:'Confirm the two pilot communities',next_due:'2026-12-01'};
 const r=await request('/api/save',c,{id,qualifications:q,qualification_evidence:{need:{recorded_at:'2099-01-01'}},qualification_history:[{forged:true}],decision:{action:{label:'Forged'}}});assert.equal(r.status,200);
 const saved=(await state(c)).leads[0];assert.equal(saved.decision.opportunity.product,'VoiceAI');assert.equal(saved.decision.system.status,'supported');assert.equal(saved.decision.action.label,'Follow the agreed next step');assert.equal(saved.qualifications.impact_value,'25');assert.ok(saved.qualification_evidence.need.recorded_at.startsWith(new Date().toISOString().slice(0,10)));assert.equal(saved.qualification_history.length,1);assert.equal(saved.qualification_history[0].forged,undefined);
 assert.equal((await request('/api/save',other,{id,qualifications:{owner:'Intruder'}})).status,404);
 await request('/api/save',c,{id,qualifications:{owner:'Different rep'}});const later=(await state(c)).leads[0];assert.deepEqual(later.qualification_evidence.need,saved.qualification_evidence.need);assert.equal(later.qualification_history.length,2);
 await request('/api/save',c,{id,qualifications:{pms_edition:'Different edition'}});assert.equal((await state(c)).leads[0].decision.system.status,'unknown');assert.equal(await providerCount(),before);
 const csv=await (await request('/api/export',c)).text();assert.match(csv,/assessment_evidence/);assert.match(csv,/VoiceAI/);assert.match(csv,/housing-balanced-v3/);
 await request('/api/update',c,{id,company:'Different Company'});const reset=(await state(c)).leads[0];assert.equal(reset.qualifications.account_status,'unknown');assert.deepEqual(reset.qualification_evidence,{});assert.equal(reset.qualification_history.length,0);
});
test('saving an unchanged legacy assessment gives it provenance and refreshes an unedited draft',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,inquiry:'Buyer needs missed-call coverage.'});await request('/api/process',c,{id});
 const row=await db.prepare('SELECT data FROM visitor_leads WHERE id=?').bind(id).first(),l=JSON.parse(row.data);
 l.qualifications={need_status:'confirmed',workflow_key:'voice',workflow_note:'Buyer confirms missed calls'};l.qualification_evidence={};l.draft='Legacy generated draft';l.draft_edited=false;l.reviewed=false;
 await db.prepare('UPDATE visitor_leads SET data=? WHERE id=?').bind(JSON.stringify(l),id).run();
 assert.equal((await state(c)).leads[0].priority.readiness,0);
 await request('/api/save',c,{id,qualifications:l.qualifications});const after=(await state(c)).leads[0];assert.equal(after.priority.readiness,20);assert.equal(after.theme,'voice');assert.notEqual(after.draft,'Legacy generated draft');
});
test('a full property address works without separate city and state fields, then reuses its cache',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,property_address:'12 Test Street, Raleigh, NC 27601',city:'',state:''});
 const first=await (await request('/api/process',c,{id})).json();assert.equal(first.property_context.status,'matched');assert.equal(first.property_context.city,'RALEIGH');assert.match(first.property_context.url,/onelineaddress/);
 await request('/api/process',c,{id});assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first()).n,1);
});
test('an unmatched split address retries once without unit details',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,property_address:'12 Test Street, Suite 300'});const lead=await (await request('/api/process',c,{id})).json();
 assert.equal(lead.property_context.status,'matched');assert.match(lead.property_context.lookup_method,/unit details omitted/);assert.equal(lead.property_address,'12 Test Street, Suite 300');
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first()).n,2);
});
test('observed contact pages add an office location without turning it into the submitted property',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'location-acme.com',property_address:'',city:'',state:''});const lead=await (await request('/api/process',c,{id})).json();
 assert.equal(lead.company_locations[0].city,'Raleigh');assert.equal(lead.company_locations[0].source_url,'https://location-acme.com/contact');assert.equal(lead.company_location_version,1);assert.equal(lead.property_context.status,'incomplete');assert.equal(lead.property_address,'');assert.equal(lead.needs_location_refresh,false);
 await request('/api/save',c,{id,company_locations:[{city:'Invented'}]});assert.equal((await state(c)).leads[0].company_locations[0].city,'Raleigh');
});
test('minimal CSV headers and legacy inquiry markers are handled without a new research call',async()=>{
 const c=await visitor(),csv='name,email,company,website,inquiry\nJordan,qa@example.invalid,Acme Housing,acmehousing.com,[TEST INQUIRY] Help with tours.';
 const response=await request('/api/import',c,{csv});assert.equal(response.status,200);const id=(await response.json()).ids[0];
 await db.prepare("UPDATE visitor_leads SET data=json_set(data,'$.inquiry','[TEST INQUIRY] Help with tours.') WHERE id=?").bind(id).run();
 assert.equal((await state(c)).leads[0].inquiry,'Help with tours.');const exported=await (await request('/api/export',c)).text();assert.doesNotMatch(exported,/TEST INQUIRY/);assert.match(exported,/Help with tours/);
});
test('ambiguous property matches are not silently resolved by a second lookup',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,property_address:'99 Ambiguous Street'}),lead=await (await request('/api/process',c,{id})).json();
 assert.equal(lead.property_context.status,'ambiguous');assert.equal(lead.property_context.coordinates,undefined);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:census:global:%'").first()).n,1);
});

test('uploads queue every new lead; completed research clears pending and adds cached area context',async()=>{
 const c=await visitor(),id=await add(c);assert.equal((await state(c)).leads[0].automation_pending,true);
 const first=await (await request('/api/process',c,{id})).json();assert.equal(first.automation_pending,false);assert.equal(first.area_context.status,'available');assert.equal(first.area_context.median_gross_rent,1500);assert.equal(first.needs_area_refresh,false);
 const second=await (await request('/api/process',c,{id})).json();assert.equal(second.area_context.cached,true);assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:area:global:%'").first()).n,1);
 const csv=await (await request('/api/export',c)).text();assert.match(csv,/area_median_gross_rent/);assert.match(csv,/2020-2024/);assert.match(csv,/Not verified/);
 await request('/api/update',c,{id,property_address:'15 Changed Street'});const changed=(await state(c)).leads[0];assert.equal(changed.automation_pending,true);assert.deepEqual(changed.area_context,{});
});
test('area outage remains separate from successful company research and preserves an earlier area result',async()=>{
 const c=await visitor(),id=await add(c);await request('/api/process',c,{id});
 const rows=(await db.prepare('SELECT key,data FROM visitor_cache').all()).results;
 for(const row of rows){const d=JSON.parse(row.data);if(d.provider==='U.S. Census ACS via Census Reporter'){d.cache_fresh_until='2000-01-01';await db.prepare('UPDATE visitor_cache SET data=? WHERE key=?').bind(JSON.stringify(d),row.key).run()}}
 await db.prepare('INSERT OR REPLACE INTO request_limits VALUES(?,?,?)').bind(bucket('area'),30,Math.floor(Date.now()/1000)+60).run();
 const l=await (await request('/api/process',c,{id})).json();assert.equal(l.research_state,'complete');assert.equal(l.company_stale,false);assert.equal(l.area_context.median_gross_rent,1500);assert.equal(l.area_context.stale,true);assert.equal(l.automation_pending,false);
});
test('area provider is never called for ambiguous or absent property geography',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,property_address:'99 Ambiguous Street'});const l=await (await request('/api/process',c,{id})).json();assert.equal(l.area_context.status,'no_geography');assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:area:global:%'").first(),null);
});

test('scrolling through uncached company logos spends no Reader allowance',async()=>{
 const c=await visitor();for(let i=0;i<6;i++){
  const id=await add(c,{...SAMPLE,email:'contact'+i+'@example.invalid',company:'Company '+i,website:'company'+i+'.com'});
  assert.equal((await (await request('/api/logo',c,{id})).json()).status,'deferred');
 }
 assert.equal(await db.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'provider:reader:%'").first(),null);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM visitor_cache').first()).n,0);
});
test('company evidence is reused across contacts for seven days without changing its retrieval date',async()=>{
 const c=await visitor(),id=await add(c);const first=await (await request('/api/process',c,{id})).json();
 assert.equal(Date.parse(first.company_fresh_until)-Date.parse(first.company_fetched_at),7*86400000);
 const rows=(await db.prepare('SELECT key,data FROM visitor_cache').all()).results;
 const threeDaysAgo=new Date(Date.now()-3*86400000).toISOString(),tomorrow=new Date(Date.now()+4*86400000).toISOString();
 for(const row of rows){const data=JSON.parse(row.data);if(data.evidence||data.page){data.cache_fetched_at=threeDaysAgo;data.cache_fresh_until=tomorrow;await db.prepare('UPDATE visitor_cache SET data=? WHERE key=?').bind(JSON.stringify(data),row.key).run()}}
 const secondId=await add(c,{...SAMPLE,name:'Another Contact',email:'another@acmehousing.com'});
 const next=await (await request('/api/process',c,{id:secondId})).json();assert.equal(next.company_fetched_at,threeDaysAgo);assert.equal(next.company_fresh_until,tomorrow);
 assert.equal((await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:reader:session:%'").first()).n,1);
});

test('blocked homepage recovers through public paths without paid search',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'recovery-acme.com',property_address:''});
 const result=await (await request('/api/process',c,{id})).json();
 assert.equal(result.company_stale,false);assert.equal(result.fit.label,'Strong fit');
 assert.ok(result.evidence.every(e=>e.url==='https://recovery-acme.com/about'));
 assert.doesNotMatch(JSON.stringify(result),/9 million|private provider body|evil.test/);
 const search=outgoing.find(o=>String(o.origin)==='https://s.jina.ai');assert.equal(search,undefined);
 const before=outgoing.length;await (await request('/api/process',c,{id})).json();assert.equal(outgoing.length,before);
});
test('official source input is scoped, preferred, isolated and preserves saved research while changing',async()=>{
 const c=await visitor(),id=await add(c);await (await request('/api/process',c,{id})).json();
 const before=(await state(c)).leads[0];await request('/api/save',c,{id,draft:'My reviewed wording',reviewed:true});
 for(const research_url of ['https://evil.test/','https://127.0.0.1/','https://acmehousing.com:9443/','http://acmehousing.com/about'])assert.equal((await request('/api/update',c,{id,research_url})).status,400);
 assert.equal((await request('/api/update',c,{id,research_url:'https://investors.acmehousing.com/overview'})).status,200);
 const pending=(await state(c)).leads[0];assert.deepEqual(pending.evidence,before.evidence);assert.equal(pending.draft,'My reviewed wording');assert.equal(pending.company_stale,true);
 const result=await (await request('/api/process',c,{id})).json();assert.equal(result.evidence[0].url,'https://investors.acmehousing.com/overview');assert.equal(result.draft,'My reviewed wording');
});
test('company and contact briefs stream independently before slow context and preserve intervening edits',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,name:'Jordan Lee',property_address:'40 Slow Street'});
 const response=await request('/api/process',c,{id,stream:true});assert.match(response.headers.get('Content-Type'),/ndjson/);
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',events=[];
 while(true){
  const chunk=await reader.read();if(chunk.done)break;
  buffer+=decoder.decode(chunk.value,{stream:true});let end;
  while((end=buffer.indexOf('\n'))>=0){
   const event=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);events.push(event);
   if(event.type==='company'||event.type==='professional'){
    assert.notEqual(event.lead.property_context?.status,'matched');
    assert.equal((await request('/api/save',c,{id,draft:'Written while context loads'})).status,200);
   }
  }
 }
 const company=events.find(e=>e.type==='company'),person=events.find(e=>e.type==='professional'),complete=events.at(-1);
 assert.equal(company.lead.fit.label,'Strong fit');assert.ok(company.lead.context_pending_until);
 assert.equal(person.lead.professional_context.people[0].role,'Chief Operating Officer');
 assert.equal(complete.type,'complete');assert.equal(complete.lead.professional_context.people[0].role,'Chief Operating Officer');
 assert.equal(complete.lead.property_context.status,'matched');assert.equal(complete.lead.context_pending_until,null);assert.equal(complete.lead.draft,'Written while context loads');
 assert.equal((await state(c)).leads[0].draft,'Written while context loads');
});

test('free limits and retained evidence remain enforced even with a supplied key',async()=>{
 const c=await visitor(),id=await add(c);const first=await (await request('/api/process',c,{id})).json();
 const retry=new Date(Date.now()+3600000).toISOString();
 for(const row of (await db.prepare('SELECT key,data FROM visitor_cache').all()).results){const data=JSON.parse(row.data);if(data.evidence||data.page)await db.prepare('UPDATE visitor_cache SET data=? WHERE key=?').bind(JSON.stringify({...data,stale:true,cache_fresh_until:null,retry_code:'daily_limit',retry_after:retry}),row.key).run()}
 await db.prepare('UPDATE visitor_leads SET data=? WHERE id=?').bind(JSON.stringify({...first,company_stale:true,company_fresh_until:null,company_retry_code:'daily_limit',company_retry_after:retry,company_recovery_version:1}),id).run();
 const ready=(await state(c)).leads[0];assert.equal(ready.company_retry_after,retry);assert.equal(ready.company_retry_code,'daily_limit');
 const recovered=await (await request('/api/process',c,{id})).json();assert.equal(recovered.company_stale,true);assert.ok(recovered.evidence.length);
});

test('a matched but thin homepage is enriched through an official fallback page',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,website:'thin-acme.com'});
 const lead=await (await request('/api/process',c,{id})).json();
 assert.ok(lead.research_brief.portfolio);assert.match(lead.research_brief.portfolio.value,/500/);
 assert.ok(lead.evidence.some(e=>e.url==='https://thin-acme.com/about'));
 assert.ok(!lead.evidence.some(e=>e.url?.includes('evil.test')));
 const before=outgoing.length;await request('/api/process',c,{id});assert.equal(outgoing.length,before);
});

test('free individual research verifies public roles, caches, preserves edits and isolates visitors',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a,{...SAMPLE,name:'Jordan Lee',inquiry:'Buyer private note'});
 await request('/api/save',a,{id,draft:'My saved email',reviewed:true});
 assert.equal((await request('/api/professional',b,{id})).status,404);
 const done=await (await request('/api/professional',a,{id})).json();
 assert.equal(done.professional_context.people[0]?.role,'Chief Operating Officer');assert.equal(done.draft,'My saved email');assert.equal(done.priority.readiness,0);
 assert.equal(done.professional_context.cost_dollars,0);assert.equal(done.professional_context.version,9);assert.equal(done.professional_context.research_diagnostics.paid_requests,0);
 const before=outgoing.length;await request('/api/professional',a,{id});assert.equal(outgoing.length,before);
 for(const o of outgoing){assert.ok(!/exa.ai|s.jina.ai/.test(String(o.origin)));assert.equal(new Headers(o.headers).get('Authorization'),null)}
 await request('/api/update',a,{id,name:'Alex Smith'});assert.equal((await state(a)).leads[0].professional_context,null);
});
test('free individual research allowance prevents further requests without a paid fallback',async()=>{
 const a=await visitor(),id=await add(a,{...SAMPLE,name:'Jordan Lee'}),session=await db.prepare('SELECT id FROM visitor_sessions').first(),day=Math.floor(Date.now()/86400000);
 await db.prepare('INSERT INTO request_limits VALUES(?,?,?)').bind('professional-free:'+session.id+':'+day,60,(day+1)*86400).run();
 const result=await (await request('/api/professional',a,{id})).json();assert.equal(result.professional_context.retry_code,'free_limit');assert.equal(outgoing.length,0);
});
test('different people at one company reuse retrieved pages but do not share across visitors',async()=>{
 const a=await visitor(),id=await add(a,{...SAMPLE,name:'Jordan Lee'});
 const first=await (await request('/api/professional',a,{id})).json(),before=outgoing.length;
 const secondId=await add(a,{...SAMPLE,name:'Alex Smith',email:'alex@example.invalid'});
 const second=await (await request('/api/professional',a,{id:secondId})).json();
 assert.equal(second.professional_context.people[0].role,'Chief Financial Officer');assert.equal(outgoing.length,before);
 assert.equal(second.professional_context.research_diagnostics.pages_reused,2);assert.equal(second.professional_context.people[0].retrieved_at,first.professional_context.people[0].retrieved_at);
 const b=await visitor(),other=await add(b,{...SAMPLE,name:'Alex Smith'});await request('/api/professional',b,{id:other});assert.ok(outgoing.length>before);
});
test('free sitemap discovery finds a profile and verifies its page rather than trusting the sitemap',async()=>{
 const a=await visitor(),id=await add(a,{...SAMPLE,name:'Nora King'});
 const result=await (await request('/api/professional',a,{id})).json(),p=result.professional_context;
 assert.equal(p.people[0]?.role,'Director of Business Operations');assert.equal(p.people[0].url,'https://acmehousing.com/bio/nora-king');assert.equal(p.research_diagnostics.sitemaps_checked,1);
 assert.ok(outgoing.some(o=>o.path==='/sitemap.xml'));assert.ok(outgoing.some(o=>o.path==='/bio/nora-king'));assert.ok(!outgoing.some(o=>String(o.origin).includes('evil.com')));
});

test('automatic research follows the matched contact biography and personalizes only untouched emails',async()=>{
 const c=await visitor(),id=await add(c,{...SAMPLE,name:'Morgan Hale',inquiry:'Interested in leasing inquiries.'});
 const done=await (await request('/api/process',c,{id})).json();
 assert.equal(done.professional_context.people.length,1,JSON.stringify(done.professional_context));assert.ok(done.professional_context.insights.some(i=>i.quote.includes('eight communities')));
 assert.doesNotMatch(done.draft,/Director of Operations|website lists you/);assert.match(done.question,/coordinating leasing follow-up across properties/);assert.equal(done.priority.readiness,0);
 assert.ok(done.draft_basis.some(b=>b.usage==='professional_role'));assert.equal(done.professional_context.research_diagnostics.paid_requests,0);
 await request('/api/save',c,{id,draft:'My saved role-specific email',reviewed:true});
 const refreshed=await (await request('/api/professional',c,{id})).json();assert.equal(refreshed.draft,'My saved role-specific email');
});

test('researched examples load immediately, ignore supplied data and preserve existing edited drafts',async()=>{
 const a=await visitor(),b=await visitor();
 const r=await request('/api/samples',a,{name:'Injected Person',professional_context:{people:[{role:'Invented'}]}});assert.equal(r.status,200);assert.equal((await r.json()).inserted,10);
 const first=await state(a);assert.equal(first.leads.length,10);assert.equal((await state(b)).leads.length,0);assert.equal(outgoing.length,0);
 for(const l of first.leads){assert.equal(l.sample_lead,true);assert.equal(l.automation_pending,false);if(l.company==='Yardi')assert.equal(l.professional_context,null);else{assert.ok(Array.isArray(l.professional_context.people));assert.equal(l.professional_context.snapshot,true);}assert.ok(l.email.includes('@'));assert.ok(l.draft);assert.ok(!l.draft.includes('Invented'));}
 const id=first.leads[0].id;await request('/api/save',a,{id,draft:'Keep this edited example',reviewed:true});
 const again=await (await request('/api/samples',a,{})).json();assert.equal(again.duplicates,10);assert.equal(again.inserted,0);assert.equal((await state(a)).leads.find(l=>l.id===id).draft,'Keep this edited example');
 await request('/api/update',a,{id,name:'Different Person'});const updated=(await state(a)).leads.find(l=>l.id===id);assert.equal(updated.sample_lead,false);assert.equal(updated.professional_context,null);
 assert.equal((await request('/api/samples',b,{}, {'X-CSRF-Token':'wrong'})).status,403);
});

test('older researched examples upgrade in place without replacing rep edits or real leads',async()=>{
 const a=await visitor();await request('/api/samples',a,{});
 const sample=(await state(a)).leads.find(l=>l.name==='Carrie King');
 await request('/api/save',a,{id:sample.id,draft:'Keep my reviewed wording',reviewed:true});
 const stored=await db.prepare('SELECT data FROM visitor_leads WHERE id=?').bind(sample.id).first();
 const old=JSON.parse(stored.data);delete old.sample_set_version;old.property_address='';old.notes='Rep notes to preserve';
 await db.prepare('UPDATE visitor_leads SET data=?,identity=? WHERE id=?').bind(JSON.stringify(old),[old.email,old.company,''].join('|').toLowerCase(),sample.id).run();
 const real=await add(a,{...SAMPLE,name:'Actual inbox lead'});
 const result=await(await request('/api/samples',a,{})).json();assert.equal(result.inserted,0);assert.equal(result.duplicates,10);
 const leads=(await state(a)).leads,updated=leads.find(l=>l.id===sample.id);
 assert.equal(leads.length,11);assert.equal(updated.property_address,'1825 Oakview Avenue Southeast');assert.equal(updated.sample_set_version,5);
 assert.equal(updated.draft,'Keep my reviewed wording');assert.equal(updated.draft_stale,true);assert.equal(updated.notes,'Rep notes to preserve');
 assert.equal(leads.find(l=>l.id===real).name,'Actual inbox lead');
});

test('loading the Sheet set retires only untouched legacy examples and is session isolated',async()=>{
 const a=await visitor(),b=await visitor(),legacy=JSON.parse(await readFile('test-data/legacy-example-inputs.json','utf8'));
 for(const client of [a,b])for(const [i,row] of legacy.slice(0,3).entries()){
  const id=await add(client,row),stored=JSON.parse((await db.prepare('SELECT data FROM visitor_leads WHERE id=?').bind(id).first()).data);
  Object.assign(stored,row,{sample_lead:true,company_snapshot:true,sample_set_version:3,notes:i===1?'Keep my notes':'',draft_edited:i===2,draft:i===2?'My own draft':stored.draft});
  await db.prepare('UPDATE visitor_leads SET data=? WHERE id=?').bind(JSON.stringify(stored),id).run();
 }
 await request('/api/samples',a,{});
 const updated=(await state(a)).leads;
 assert.equal(updated.length,12);assert.ok(!updated.some(l=>l.name===legacy[0].name));
 assert.equal(updated.find(l=>l.name===legacy[1].name).notes,'Keep my notes');
 assert.equal(updated.find(l=>l.name===legacy[2].name).draft,'My own draft');
 assert.equal((await state(b)).leads.length,3);assert.equal(outgoing.length,0);
 await request('/api/samples',a,{});assert.equal((await state(a)).leads.length,12);
});
test('Sheet import and matching researched examples do not create duplicate contacts or replace real inputs',async()=>{
 const a=await visitor(),inputs=JSON.parse(await readFile('test-data/sheet-example-inputs.json','utf8'));
 const id=await add(a,{...inputs[0],inquiry:'My real inquiry'});
 await request('/api/samples',a,{});const leads=(await state(a)).leads;
 assert.equal(leads.length,10);assert.equal(leads.find(l=>l.id===id).inquiry,'My real inquiry');
 assert.equal(leads.find(l=>l.id===id).sample_lead,undefined);
});

test('spreadsheet row imports normalize columns and reject invalid input before writing',async()=>{
 const c=await visitor();let r=await request('/api/import-rows',c,{rows:[{'Full Name':'Example Person','Email Address':'person@example.invalid','Company Name':'Acme Housing'}]});assert.equal(r.status,200);assert.equal((await r.json()).inserted,1);
 r=await request('/api/import-rows',c,{rows:[{name:'Invalid'}]});assert.equal(r.status,400);assert.equal((await state(c)).leads.length,1);
});
test('sheet connection is scoped, revocable, duplicate-safe and can research without a browser',async()=>{
 const a=await visitor(),b=await visitor(),spreadsheet_id='practice_sheet_id_1234567890',tab_name='Leads';
 const connected=await request('/api/sheets/connect',a,{spreadsheet_id,tab_name});assert.equal(connected.status,200);assert.match(connected.headers.get('set-cookie'),/Max-Age=7776000/);
 const {script}=await connected.json(),token=JSON.parse(script.match(/const INBOUND_DESK = (.*);/)[1]).token;
 const send=(path,body,t=token)=>mf.dispatchFetch(ORIGIN+'/api/sheets/'+path,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({spreadsheet_id,tab_name,...body})});
 const stored=await db.prepare('SELECT * FROM sheet_connections').first();assert.notEqual(stored.token_hash,token);assert.ok(!JSON.stringify(await state(a)).includes(token));assert.equal((await (await request('/api/sheets',b)).json()).connection,null);
 assert.equal((await send('ingest',{rows:[]},'0'.repeat(64))).status,401);assert.equal((await send('ingest',{tab_name:'Other',rows:[]})).status,403);
 const row={name:'TEST Sheet Contact',email:'sheet@example.invalid',company:'Acme Housing',website:'acmehousing.com'};
 let response=await send('ingest',{rows:[row]});assert.equal(response.status,200);assert.equal((await response.json()).inserted,1);assert.equal((await (await send('ingest',{rows:[row]})).json()).duplicates,1);
 assert.equal((await state(b)).leads.length,0);assert.equal((await state(a)).leads[0].source_type,'google_sheets');
 const processed=await send('process',{});assert.equal(processed.status,200);assert.equal((await processed.json()).processed,true);assert.ok((await state(a)).leads[0].processed_at);
 await request('/api/sheets/disconnect',a,{});assert.equal((await send('ingest',{rows:[]})).status,401);assert.equal((await state(a)).leads.length,1);
});
test('sheet key rotation and session deletion revoke old access',async()=>{
 const c=await visitor(),spreadsheet_id='practice_sheet_id_1234567890',tab_name='Leads';
 const getToken=async()=>JSON.parse((await (await request('/api/sheets/connect',c,{spreadsheet_id,tab_name})).json()).script.match(/const INBOUND_DESK = (.*);/)[1]).token;
 const old=await getToken(),current=await getToken();assert.notEqual(old,current);
 const ping=token=>mf.dispatchFetch(ORIGIN+'/api/sheets/ingest',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({spreadsheet_id,tab_name,rows:[]})});
 assert.equal((await ping(old)).status,401);assert.equal((await ping(current)).status,200);await request('/api/session/delete',c,{});assert.equal((await ping(current)).status,401);
});

test('activity and saved assessments are owner-scoped, retain exact inputs, and delete with the session',async()=>{
 const a=await visitor(),b=await visitor(),id=await add(a);
 assert.equal((await request('/api/activity?id='+id,b)).status,404);
 const initial=await (await request('/api/activity?id='+id,a)).json();assert.equal(initial.snapshots.length,1);assert.equal(initial.snapshots[0].data.inputs.company,SAMPLE.company);
 await request('/api/save',a,{id,draft:'Reviewed human wording',would_send:'Would send',feedback_reason:'Concise and relevant',reviewed:true});
 const reviewed=await (await request('/api/activity?id='+id,a)).json();assert.equal(reviewed.snapshots[0].data.email.text,'Reviewed human wording');assert.equal(reviewed.snapshots[0].data.feedback.would_send,'Would send');
 await request('/api/process',a,{id});const log=await (await request('/api/activity?id='+id,a)).json();for(const source of ['company','contact','property','entity','area'])assert.ok(log.runs.some(r=>r.source===source));
 assert.ok(log.runs.every(r=>r.finished_at&&r.status!=='running'));assert.doesNotMatch(JSON.stringify(log),/jina_test_only|Bearer /);
 await request('/api/session/delete',a,{});assert.equal((await db.prepare('SELECT count(*) AS n FROM assessment_snapshots').first()).n,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM research_runs').first()).n,0);
});
test('sheet reviews bind feedback to the exact draft and reject cross-sheet or stale ratings',async()=>{
 const c=await visitor(),spreadsheet_id='quality_sheet_id_1234567890',tab_name='Leads';
 const config=await (await request('/api/sheets/connect',c,{spreadsheet_id,tab_name})).json(),token=JSON.parse(config.script.match(/const INBOUND_DESK = (.*);/)[1]).token;
 const send=(path,rows)=>mf.dispatchFetch(ORIGIN+'/api/sheets/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({spreadsheet_id,tab_name,rows})});
 await send('ingest',[SAMPLE]);const first=(await (await send('review',[SAMPLE])).json()).reviews[0];assert.ok(first.draft_id);
 await send('review',[{...SAMPLE,draft_id:'wrong',would_send:'Would send'}]);assert.notEqual((await state(c)).leads[0].would_send,'Would send');
 const accepted=(await (await send('review',[{...SAMPLE,draft_id:first.draft_id,would_send:'Would send',feedback_reason:'Good opener'}])).json()).reviews[0];assert.equal(accepted.status,'Feedback saved');assert.equal((await state(c)).leads[0].would_send,'Would send');
 const upgrade=await (await request('/api/sheets/script',c)).json();assert.ok(!upgrade.script.includes(token));assert.match(upgrade.script,/INBOUND_DESK_CONFIG/);
});

test('keyless Street View saves only to owning lead and preserves reviewed draft',async()=>{
 const {propertyViewKey}=await import('../static/street-view.js');
 const c=await visitor(),other=await visitor(),id=await add(c);
 await request('/api/save',c,{id,subject:'Reviewed',draft:'Keep this wording',reviewed:true});
 const before=(await state(c)).leads[0],address_key=propertyViewKey(before);
 const embed='https://www.google.com/maps/embed?pb=!4v1790880044592!6m8!1m7!1sOlYQRRbYAxDzXVwXOlIa_A!2m2!1d39.73232508965585!2d-104.9828943998595!3f271.68234!4f0!5f0.7820865974627469';
 assert.equal((await request('/api/street-view',other,{id,embed,address_key})).status,404);
 assert.equal((await request('/api/street-view',c,{id,embed:'https://evil.com/',address_key})).status,400);
 assert.equal((await request('/api/street-view',c,{id,embed,address_key:'changed'})).status,409);
 assert.equal((await request('/api/street-view',c,{id,embed,address_key})).status,200);
 const after=(await state(c)).leads[0];assert.ok(after.street_view.url);assert.equal(after.draft,before.draft);assert.equal(after.reviewed,before.reviewed);
 assert.equal((await request('/api/street-view',c,{id,embed:'',address_key})).status,200);assert.equal((await state(c)).leads[0].street_view,null);
});

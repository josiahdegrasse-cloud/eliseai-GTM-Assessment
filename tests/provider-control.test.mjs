import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {paceReader,pauseProvider,providerCooldown,retrySeconds,beginReaderProbe,finishReaderProbe} from '../website/provider-control.mjs';
import {cachedResearch} from '../website/research-cache.mjs';
let mf,env;
before(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB']});env={DB:await mf.getD1Database('DB')};await env.DB.prepare('CREATE TABLE request_limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)').run();await env.DB.prepare('CREATE TABLE visitor_cache(key TEXT PRIMARY KEY,session_id TEXT,data TEXT,expires INTEGER)').run();await env.DB.prepare('CREATE TABLE public_sample_cache(key TEXT PRIMARY KEY,data TEXT,expires INTEGER)').run()});
after(async()=>{await mf.dispose()});
beforeEach(async()=>{await env.DB.prepare('DELETE FROM request_limits').run();await env.DB.prepare('DELETE FROM public_sample_cache').run()});
test('provider Retry-After accepts seconds and HTTP dates, without shortening longer pauses',()=>{
 const now=Date.now();assert.equal(retrySeconds('90',now),90);assert.equal(retrySeconds(new Date(now+120000).toUTCString(),now),120);assert.equal(retrySeconds('1800'),1800);for(const value of [null,'invalid','-1','0'])assert.equal(retrySeconds(value),60);
});
test('concurrent callers receive spaced slots with a bounded backlog',async()=>{
 const now=Date.now(),waits=[];
 const results=await Promise.allSettled(Array.from({length:6},()=>paceReader(env,{now,wait:async ms=>waits.push(ms)})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.deepEqual(waits.sort((a,b)=>a-b),[8000]);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='provider_queue'));
});
test('spacing persists across a minute boundary and cooldown interrupts reserved work',async()=>{
 const now=60000-500,waits=[];await paceReader(env,{now,wait:async ms=>waits.push(ms)});await paceReader(env,{now:60000+500,wait:async ms=>waits.push(ms)});assert.deepEqual(waits,[7000]);
 await env.DB.prepare('DELETE FROM request_limits').run();
 await paceReader(env);await assert.rejects(paceReader(env,{wait:async()=>{await pauseProvider(env,'reader','120')}}),e=>e.code==='provider_busy');
});
test('external cooldown is shared by provider only and never shortened by a concurrent error',async()=>{
 await pauseProvider(env,'reader','180');await pauseProvider(env,'reader','60');await assert.rejects(providerCooldown(env,'reader'),e=>e.retryAfter>=179);await providerCooldown(env,'census');
 const rows=(await env.DB.prepare('SELECT * FROM request_limits').all()).results;assert.deepEqual(rows.map(r=>r.bucket).sort(),['backoff:reader','cooldown:reader']);
});
test('a partial public sample cannot share a visitor-specific daily cooldown',async()=>{
 const result=await cachedResearch(env,{id:'first'},'sample',async()=>({evidence:[{text:'Observed public evidence'}],stale:true,retry_code:'daily_limit',retry_after:new Date(Date.now()+3600000).toISOString()}),{shared:true});
 assert.equal(result.stale,true);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM public_sample_cache').first()).n,0);
 let called=false;const next=await cachedResearch(env,{id:'second'},'sample',async()=>{called=true;return {evidence:[{text:'Refreshed evidence'}]}},{shared:true});
 assert.equal(called,true);assert.equal(next.stale,false);assert.equal(next.retry_after,null);
});

test('repeated throttles back off globally, respect a longer provider delay and permit one recovery probe',async()=>{
 const delays=[];for(let i=0;i<6;i++)delays.push((await pauseProvider(env,'reader','60',{random:()=>0})).retryAfter);
 assert.deepEqual(delays,[60,120,240,480,900,900]);
 assert.equal((await pauseProvider(env,'reader','1800',{random:()=>0})).retryAfter,1800);
 await assert.rejects(beginReaderProbe(env),e=>e.code==='provider_busy');
 await env.DB.prepare("UPDATE request_limits SET expires=0 WHERE bucket='cooldown:reader'").run();
 const probes=await Promise.allSettled([beginReaderProbe(env),beginReaderProbe(env)]);
 assert.equal(probes.filter(p=>p.status==='fulfilled').length,1);assert.ok(probes.filter(p=>p.status==='rejected').every(p=>p.reason.code==='provider_queue'));
 const lease=probes.find(p=>p.status==='fulfilled').value;await finishReaderProbe(env,lease,true);
 assert.equal(await env.DB.prepare("SELECT n FROM request_limits WHERE bucket='backoff:reader'").first(),null);
 assert.equal(await beginReaderProbe(env),null);
 assert.equal((await pauseProvider(env,'reader','60',{random:()=>0})).retryAfter,60);
});
test('an overlapping success cannot reset an active cooldown and failed probes release their lease',async()=>{
 await pauseProvider(env,'reader','60',{random:()=>0});await finishReaderProbe(env,null,true);
 assert.ok(await env.DB.prepare("SELECT n FROM request_limits WHERE bucket='backoff:reader'").first());
 await env.DB.prepare("UPDATE request_limits SET expires=0 WHERE bucket='cooldown:reader'").run();
 const lease=await beginReaderProbe(env);await finishReaderProbe(env,lease,false);
 assert.ok(await env.DB.prepare("SELECT n FROM request_limits WHERE bucket='backoff:reader'").first());
 assert.equal(await env.DB.prepare("SELECT n FROM request_limits WHERE bucket='probe:reader'").first(),null);
});
test('cache-only reads never run the lookup, acquire a lease or overwrite retained evidence',async()=>{
 let calls=0;const lookup=async()=>{calls++;return {evidence:[{text:'Retained page'}]}};
 assert.equal(await cachedResearch(env,{id:'test'},'page',lookup,{shared:true,cacheOnly:true}),null);
 assert.equal(calls,0);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM request_limits').first()).n,0);
 await cachedResearch(env,{id:'test'},'page',lookup,{shared:true,ttl:1});
 await env.DB.prepare("UPDATE public_sample_cache SET data=json_set(data,'$.cache_fresh_until','2020-01-01')").run();
 const retained=await cachedResearch(env,{id:'test'},'page',lookup,{shared:true,cacheOnly:true});assert.equal(retained.evidence[0].text,'Retained page');assert.equal(calls,1);
});

test('company research is reused across contacts for seven days, expires, and retains evidence on failure',async()=>{
 const {COMPANY_TTL}=await import('../website/research-cache.mjs');assert.equal(COMPANY_TTL,7*86400);
 let calls=0;const lookup=async()=>{calls++;return {evidence:[{text:'Public company fact'}]}};
 const first=await cachedResearch(env,{id:'visitor'},'company-domain',lookup,{shared:true});
 const second=await cachedResearch(env,{id:'visitor'},'company-domain',lookup,{shared:true});
 assert.equal(calls,1);assert.equal(second.cached,true);assert.equal(second.cache_fetched_at,first.cache_fetched_at);
 assert.ok(Date.parse(first.cache_fresh_until)-Date.parse(first.cache_fetched_at)>=7*86400000-1000);
 const expired={...first,cache_fresh_until:new Date(Date.now()-1000).toISOString()};
 await env.DB.prepare('UPDATE public_sample_cache SET data=? WHERE key=?').bind(JSON.stringify(expired),'company-domain').run();
 const failed=await cachedResearch(env,{id:'visitor'},'company-domain',async()=>{calls++;throw Error('offline')},{shared:true});
 assert.equal(calls,2);assert.equal(failed.stale,true);assert.deepEqual(failed.evidence,first.evidence);
});


test('company cache reuses within a visitor and never leaks private research between visitors',async()=>{
 const expires=Math.floor(Date.now()/1000)+30*86400;let calls=0;
 const lookup=async()=>({evidence:[{text:'Public company fact'}],call:++calls});
 const first=await cachedResearch(env,{id:'private-a',expires},'company:acmehousing.com',lookup);
 const repeat=await cachedResearch(env,{id:'private-a',expires},'company:acmehousing.com',lookup);
 assert.equal(repeat.cached,true);assert.equal(repeat.call,first.call);
 const other=await cachedResearch(env,{id:'private-b',expires},'company:acmehousing.com',lookup);
 assert.equal(other.cached,false);assert.equal(calls,2);
});

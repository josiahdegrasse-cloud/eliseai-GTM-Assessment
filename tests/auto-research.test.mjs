import {test} from 'node:test';
import assert from 'node:assert/strict';
import {autoResearchDue,autoResearchPlan,researchQueue} from '../static/workflow.js';
import {readerRequest} from '../website/free-research.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('opening new or aged research refreshes; recent data and failures are reused',()=>{
 const time=Date.now(),past=new Date(time-1).toISOString(),future=new Date(time+600000).toISOString();
 assert.ok(autoResearchDue({research_state:'pending'},time));
 assert.ok(autoResearchDue({research_state:'complete',company_fresh_until:past},time));
 assert.equal(autoResearchDue({research_state:'complete',company_fresh_until:future},time),false);
 assert.equal(autoResearchDue({company_retry_after:future},time),false);
 assert.equal(autoResearchDue({research_state:'needs_website'},time),false);
 assert.equal(autoResearchDue(null,time),false);
});
test('rapid repeated opens share work and opening another lead does not block',async()=>{
 const started=[],finish=new Map();const queue=researchQueue(id=>new Promise(resolve=>{started.push(id);finish.set(id,resolve)}));
 const first=queue.add('a'),again=queue.add('a'),second=queue.add('b'),third=queue.add('c'),latest=queue.add('d');
 assert.equal(first,again);await tick();assert.deepEqual(started,['a','b']);
 finish.get('a')();await first;await tick();assert.deepEqual(started,['a','b','d']);assert.equal(queue.has('a'),false);
 finish.get('b')();await second;await tick();assert.deepEqual(started,['a','b','d','c']);
 finish.get('c')();finish.get('d')();await Promise.all([third,latest]);assert.equal(queue.has('d'),false);
});
test('a failed request releases the queue and permits a later retry',async()=>{
 let calls=0;const queue=researchQueue(async()=>{if(++calls===1)throw Error('offline');return 'ready'},{concurrency:1});
 await assert.rejects(queue.add('lead'),/offline/);assert.equal(queue.has('lead'),false);assert.equal(await queue.add('lead'),'ready');
});
test('keyless page extraction bounds freshness and crawl wait, with no credentials',()=>{
 const request=readerRequest('https://acme.com/','acme.com');
 assert.equal(request.url,'https://r.jina.ai/https://acme.com/');assert.equal(request.options.headers['X-Cache-Tolerance'],'3600');assert.equal(request.options.headers['X-Timeout'],'10');assert.equal(request.options.redirect,'manual');assert.equal(request.options.headers.Authorization,undefined);
});
test('supplied credentials cannot enable authenticated extraction',()=>{
 const request=readerRequest('https://acme.com/about','acme.com','jina_test_only');
 assert.equal(request.url,'https://r.jina.ai/https://acme.com/about');assert.equal(request.options.headers.Authorization,undefined);
 assert.equal(request.options.redirect,'manual');assert.ok(!request.url.includes('jina_test_only'));
 for(const target of ['https://other.com/','https://user:pass@acme.com/','http://127.0.0.1/'])assert.throws(()=>readerRequest(target,'acme.com','jina_test_only'),/Invalid company URL/);
});
test('malformed credentials cannot inject headers or appear in validation errors',()=>{
 for(const key of ['secret\r\nInjected: value','secret value',{},'x'.repeat(513)])assert.equal(readerRequest('https://acme.com/','acme.com',key).options.headers.Authorization,undefined);
});
test('automatic retry respects the provider time and stops after three attempts',()=>{
 const now=Date.now(),lead={company_stale:true,company_retry_code:'provider_busy',company_retry_after:new Date(now+65000).toISOString()};
 assert.equal(autoResearchPlan(lead,{at:now,count:1},now),now+65000);
 assert.equal(autoResearchPlan(lead,{at:now,count:3},now),null);
 for(const code of ['site_blocked','daily_limit','provider_auth','provider_quota'])assert.equal(autoResearchPlan({...lead,company_retry_code:code},{},now),null);
 assert.equal(autoResearchPlan({company_fresh_until:new Date(now+3600000).toISOString()},{},now),null);
 assert.equal(autoResearchPlan({...lead,company_retry_after:null},{at:now,count:1},now),now+11000);
});
test('batch research is paced even when cached responses complete immediately',async()=>{
 let now=1000;const timers=[],started=[];
 const queue=researchQueue(async id=>started.push([id,now]),{concurrency:1,interval:11000,now:()=>now,schedule:(fn,delay)=>{timers.push({fn,delay});return timers.length}});
 const first=queue.add('a'),second=queue.add('b'),last=queue.add('c');await first;await tick();assert.deepEqual(started,[['a',1000]]);assert.equal(queue.size,2);
 let timer=timers.shift();assert.equal(timer.delay,11000);now+=timer.delay;timer.fn();await last;await tick();assert.deepEqual(started,[['a',1000],['c',12000]]);
 timer=timers.shift();now+=timer.delay;timer.fn();await second;assert.equal(queue.size,0);assert.equal(started[2][1],23000);
});
test('production research bundle excludes retired providers and legacy credentials',async()=>{
 const {readFile}=await import('node:fs/promises');
 const bundle=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
 assert.doesNotMatch(bundle,/api\.exa\.ai|EXA_API_KEY|JINA_API_KEY/);
});

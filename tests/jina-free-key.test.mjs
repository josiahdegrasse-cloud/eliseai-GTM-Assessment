import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {freeReaderKey,freeReaderRequest,readerLimits,FREE_READER_REQUESTS} from '../website/jina-free-key.mjs';
import {paceReader} from '../website/provider-control.mjs';
let mf,env;
const KEY='00000000-0000-4000-8000-000000000000';
before(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB']});env={DB:await mf.getD1Database('DB'),JINA_FREE_API_KEY:KEY};await env.DB.prepare('CREATE TABLE request_limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)').run()});
after(async()=>{await mf.dispose()});
beforeEach(async()=>{await env.DB.prepare('DELETE FROM request_limits').run()});
test('only the explicitly configured free secret authorizes the fixed Reader endpoint',async()=>{
 const request=await freeReaderRequest(env,'https://acme.com/','acme.com');
 assert.equal(request.url,'https://r.jina.ai/https://acme.com/');assert.equal(request.options.headers.Authorization,'Bearer '+KEY);
 assert.equal(request.options.headers['X-Token-Budget'],'20000');assert.equal(request.options.redirect,'manual');assert.ok(!request.url.includes(KEY));
 const rows=(await env.DB.prepare('SELECT * FROM request_limits').all()).results;
 assert.equal(rows[0].n,1);assert.ok(!JSON.stringify(rows).includes(KEY));
 const anonymous=await freeReaderRequest({DB:env.DB,JINA_API_KEY:KEY},'https://acme.com/','acme.com');
 assert.equal(anonymous.options.headers.Authorization,undefined);assert.equal(readerLimits({}).interval,8000);
});
test('invalid secrets and unsafe target URLs cannot inject or leak credentials',async()=>{
 for(const key of ['secret\r\nInjected: value','secret value',{},'x'.repeat(513)])assert.equal(freeReaderKey({JINA_FREE_API_KEY:key}),'');
 for(const url of ['https://other.com/','https://user:pass@acme.com/','http://127.0.0.1/'])await assert.rejects(freeReaderRequest(env,url,'acme.com'),error=>/Invalid company URL/.test(error.message)&&!error.message.includes(KEY));
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM request_limits').first()).n,0);
});
test('concurrent company/contact requests cannot exceed the lifetime free-credit reservation',async()=>{
 await freeReaderRequest(env,'https://acme.com/','acme.com');
 await env.DB.prepare('UPDATE request_limits SET n=?').bind(FREE_READER_REQUESTS-1).run();
 const attempts=await Promise.allSettled(Array.from({length:5},()=>freeReaderRequest(env,'https://acme.com/','acme.com')));
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(attempts.filter(r=>r.status==='rejected').every(r=>r.reason.code==='provider_quota'&&!r.reason.message.includes(KEY)));
 assert.equal((await env.DB.prepare('SELECT n FROM request_limits').first()).n,FREE_READER_REQUESTS);
 // Quota is not date-scoped and an exhausted key stays exhausted on later runs.
 await assert.rejects(freeReaderRequest(env,'https://acme.com/','acme.com'),e=>e.code==='provider_quota');
});
test('free-key pacing remains bounded at thirty starts per minute',async()=>{
 assert.deepEqual(readerLimits(env),{perMinute:30,perDay:300,interval:2000});
 const waits=[],now=Date.now();await paceReader(env,{now,wait:async ms=>waits.push(ms)});await paceReader(env,{now,wait:async ms=>waits.push(ms)});
 assert.deepEqual(waits,[2000]);await assert.rejects(paceReader(env,{now,wait:async()=>{}}),e=>e.code==='provider_queue');
});

import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {verifyTavilyFreeUsage,tavilySearch,tavilyExtract,tavilyStatus} from '../website/tavily-free.mjs';
import {discoverOfficialPages} from '../website/hybrid-research.mjs';
let mf,env;const usage=()=>({account:{current_plan:'Researcher',plan_limit:1000,plan_usage:0,paygo_limit:0,paygo_usage:0},key:{limit:1000,usage:0}});
before(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});env={DB:await mf.getD1Database('DB'),TAVILY_FREE_API_KEY:'test_free_key_not_a_real_secret'};for(const sql of ['CREATE TABLE request_limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)','CREATE TABLE visitor_cache(key TEXT PRIMARY KEY,session_id TEXT,data TEXT,expires INTEGER)'])await env.DB.prepare(sql).run()});
after(async()=>mf.dispose());beforeEach(async()=>{await env.DB.prepare('DELETE FROM request_limits').run();await env.DB.prepare('DELETE FROM visitor_cache').run()});
test('only verified free plans with disabled paygo and a safety buffer pass',()=>{
 assert.equal(verifyTavilyFreeUsage(usage()),1000);
 for(const patch of [{current_plan:'Bootstrap'},{paygo_limit:1},{paygo_usage:1},{plan_limit:15000},{plan_usage:990},{plan_usage:'0'},{paygo_limit:undefined}]){const u=usage();Object.assign(u.account,patch);assert.throws(()=>verifyTavilyFreeUsage(u))}
 assert.throws(()=>verifyTavilyFreeUsage({}));
});
test('missing key never makes an external request',async()=>{
 let calls=0;await assert.rejects(tavilySearch({DB:env.DB},'Acme','acme.com',{fetcher:()=>{calls++}}));assert.equal(calls,0);assert.equal((await tavilyStatus({})).status,'not_connected');
});
test('search checks usage before consuming credits and drops summaries and unrelated domains',async()=>{
 const calls=[];const fetcher=async(url,o)=>{calls.push(url);assert.equal(o.redirect,'manual');assert.ok(!url.includes(env.TAVILY_FREE_API_KEY));if(url.endsWith('/usage'))return Response.json(usage());const b=JSON.parse(o.body);assert.equal(b.search_depth,'basic');assert.equal(b.auto_parameters,false);assert.equal(b.include_answer,false);return Response.json({results:[{url:'https://acme.com/about',content:'Invented 1 billion units'},{url:'https://evil.com/x'}]})};
 assert.deepEqual(await tavilySearch(env,'Acme','acme.com',{fetcher}),[{url:'https://acme.com/about'}]);assert.equal(calls.length,2);assert.equal((await tavilyStatus(env)).app_credits_remaining,398);
});
test('paid account and unknown usage never reach enrichment endpoint',async()=>{
 let posts=0;const fetcher=async(url,o)=>{if(o.method==='POST')posts++;const u=usage();u.account.paygo_limit=100;return Response.json(u)};
 await assert.rejects(tavilySearch(env,'Acme','acme.com',{fetcher}));assert.equal(posts,0);assert.equal((await tavilyStatus(env)).app_credits_remaining,400);
});
test('failed requests retain reservation and exhausted local allowance stops before network',async()=>{
 let calls=0;const fetcher=async(url)=>{calls++;return url.endsWith('/usage')?Response.json(usage()):new Response('',{status:429})};
 await assert.rejects(tavilySearch(env,'Acme','acme.com',{fetcher}));assert.equal((await tavilyStatus(env)).app_credits_remaining,398);
 await env.DB.prepare("UPDATE request_limits SET n=400 WHERE bucket LIKE 'tavily-free-v1:%'").run();calls=0;await assert.rejects(tavilySearch(env,'Acme','acme.com',{fetcher}));assert.equal(calls,0);
});
test('concurrent visitors cannot overspend final reservation',async()=>{
 const fetcher=async(url)=>Response.json(url.endsWith('/usage')?usage():{results:[]});await tavilySearch(env,'seed','acme.com',{fetcher});await env.DB.prepare("UPDATE request_limits SET n=398 WHERE bucket LIKE 'tavily-free-v1:%'").run();
 const results=await Promise.allSettled(Array.from({length:4},()=>tavilySearch(env,'Acme','acme.com',{fetcher})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await tavilyStatus(env)).app_credits_remaining,0);
});
test('extract requires exact official URL and marks retrieval provider',async()=>{
 const fetcher=async(url,o)=>{if(url.endsWith('/usage'))return Response.json(usage());const b=JSON.parse(o.body);assert.deepEqual(b.urls,['https://acme.com/about']);assert.equal(b.extract_depth,'basic');return Response.json({results:[{url:'https://acme.com/about',raw_content:'Acme manages 500 apartment homes.'}]})};
 const p=await tavilyExtract(env,'https://acme.com/about','acme.com',{fetcher});assert.equal(p.provider,'Tavily Extract');assert.match(p.data.content,/500/);
 await assert.rejects(tavilyExtract(env,'https://evil.com/about','acme.com',{fetcher}));
});
test('discovery works without Jina key, caches official URLs only, and does not store secret',async()=>{
 let calls=0;const fetcher=async url=>{calls++;return Response.json(url.endsWith('/usage')?usage():{results:[{url:'https://acme.com/about',content:'Invented 1 billion units'}]})};const args=[env,{id:'test',expires:4102444800},{company:'Acme'},'acme.com',{fetcher}];
 assert.deepEqual(await discoverOfficialPages(...args),['https://acme.com/about']);await discoverOfficialPages(...args);assert.equal(calls,2);const cache=JSON.stringify(await env.DB.prepare('SELECT * FROM visitor_cache').all());assert.ok(!cache.includes('billion'));assert.ok(!cache.includes(env.TAVILY_FREE_API_KEY));
});

test('new free account null caps use mandatory free account ceiling; absent caps still reject',()=>{
 const u=usage();u.account.paygo_limit=null;u.key.limit=null;assert.equal(verifyTavilyFreeUsage(u),1000);
 u.account.plan_usage=990;assert.throws(()=>verifyTavilyFreeUsage(u));u.account.plan_usage=0;
 delete u.key.limit;assert.throws(()=>verifyTavilyFreeUsage(u));u.key.limit=null;delete u.account.paygo_limit;assert.throws(()=>verifyTavilyFreeUsage(u));
 u.account.paygo_limit=null;u.account.current_plan='Bootstrap';assert.throws(()=>verifyTavilyFreeUsage(u));
});

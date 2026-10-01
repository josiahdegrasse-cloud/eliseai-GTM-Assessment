import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {freeBalance,ensureTokenBudget,reserveTokens,settleTokens,tokenBudgetStatus,reportedTokens} from '../website/free-token-budget.mjs';
const key='fixture_only_free_token_key';let mf,env;
before(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB']});env={DB:await mf.getD1Database('DB')};await env.DB.prepare('CREATE TABLE request_limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)').run()});
after(()=>mf.dispose());beforeEach(()=>env.DB.prepare('DELETE FROM request_limits').run());
const wallet=n=>({wallet:{trial_balance:n,total_balance:n,regular_balance:0},metadata:{auto_recharge:false}});
const balance=n=>({fetcher:async(url,options)=>{assert.equal(url,'https://dash.jina.ai/api/v1/authorization');assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.redirect,'manual');return Response.json(wallet(n))}});
test('verified free balance initializes once; legacy limits and secret are never reset or stored',async()=>{
 await env.DB.prepare("INSERT INTO request_limits VALUES('jina-free-budget:legacy',400,4102444800)").run();
 const state=await ensureTokenBudget(env,key,balance(8372417));assert.equal(state.limit,8000000);
 await ensureTokenBudget(env,key,{fetcher:()=>{throw Error('Must reuse the non-renewing allowance')}});
 const rows=(await env.DB.prepare('SELECT * FROM request_limits').all()).results;assert.equal(rows.find(r=>r.bucket==='jina-free-budget:legacy').n,400);assert.ok(!JSON.stringify(rows).includes(key));
});
test('concurrent reservations cannot exceed available free tokens',async()=>{
 await ensureTokenBudget(env,key,balance(140000));
 const attempts=await Promise.allSettled(Array.from({length:6},()=>reserveTokens(env,key)));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,2);assert.equal((await tokenBudgetStatus(env,key)).remaining,0);
 assert.equal((await env.DB.prepare("SELECT count(*) n FROM request_limits WHERE bucket LIKE '%:request:%'").first()).n,2);
});
test('successful usage refunds only unused tokens once; failed or uncertain calls retain reservation',async()=>{
 await ensureTokenBudget(env,key,balance(200000));const r=await reserveTokens(env,key);
 assert.equal((await tokenBudgetStatus(env,key)).remaining,80000);
 await settleTokens(env,r,{});await settleTokens(env,r,{usage:{tokens:-10}});assert.equal((await tokenBudgetStatus(env,key)).remaining,80000);
 await Promise.all([settleTokens(env,r,{data:{usage:{tokens:900}}}),settleTokens(env,r,{data:{usage:{tokens:900}}})]);
 assert.equal((await tokenBudgetStatus(env,key)).remaining,99100);
});
test('over-budget reported usage is fully charged and prevents more requests',async()=>{
 await ensureTokenBudget(env,key,balance(130000));const r=await reserveTokens(env,key);await settleTokens(env,r,{usage:{total_tokens:35000}});
 assert.equal((await tokenBudgetStatus(env,key)).remaining,0);await assert.rejects(reserveTokens(env,key),e=>e.code==='provider_quota');
});
test('paid, auto-recharging, missing and malformed balances fail closed',async()=>{
 for(const x of [{},wallet(-1),{...wallet(1000000),wallet:{trial_balance:1000000,total_balance:2000000,regular_balance:1000000}},{...wallet(1000000),metadata:{auto_recharge:true}},{...wallet(1000000),payment_method:{last4:'1234'}}])assert.throws(()=>freeBalance(x),e=>e.code==='free_balance_unverified');
 await assert.rejects(ensureTokenBudget(env,key,{fetcher:()=>{throw Error(key)}}),e=>e.code==='free_balance_unverified'&&!e.message.includes(key));
 assert.equal((await tokenBudgetStatus(env,key)).initialized,false);
 assert.equal(reportedTokens({usage:{total_tokens:'100'}}),null);assert.equal(reportedTokens({usage:{total_tokens:500}}),500);
});

import {readerRequest} from './free-research.mjs';
import {ensureTokenBudget,reserveTokens,tokenBudgetStatus} from './free-token-budget.mjs';
export {settleTokens} from './free-token-budget.mjs';

// Only this explicitly configured server secret opts in. Legacy keys and lead
// input cannot enable authenticated requests. No billing or top-up API is used.
export function freeReaderKey(env){
 const key=env?.JINA_FREE_API_KEY;
 return typeof key==='string'&&/^[A-Za-z0-9._-]{16,512}$/.test(key)?key:'';
}
export const FREE_READER_REQUEST_TOKENS=20000;
export const FREE_READER_REQUESTS=400;
export const readerCacheSuffix=env=>freeReaderKey(env)?env.JINA_TOKEN_ACCOUNTING==='1'?'|free-key-v2':'|free-key-v1':'';
const budgetBucket=async key=>'jina-free-budget:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function freeResearchStatus(env){
 const key=freeReaderKey(env);
 if(!key)return {mode:'anonymous',message:'Keyless research: public company pages and anonymous Reader. Provider limits still apply.',app_request_limit:null,app_requests_remaining:null,provider_balance_known:false};
 if(env.JINA_TOKEN_ACCOUNTING==='1'){
  const state=await tokenBudgetStatus(env,key),ready=!state.initialized||state.remaining>=FREE_READER_REQUEST_TOKENS;
  return {mode:ready?'free_key':'direct_only',message:!state.initialized?'The configured free key’s balance will be verified before the first request.':ready?'Research uses verified free credits and direct company pages. Reported token usage is tracked; uncertain requests retain their full reservation.':'The verified free token allowance is used. Research continues through direct company pages.',app_request_limit:null,app_requests_remaining:null,provider_balance_known:state.initialized,app_token_limit:state.limit??null,app_tokens_remaining:state.remaining??null,balance_verified_at:state.checked_at??null};
 }
 const row=await env.DB.prepare('SELECT n FROM request_limits WHERE bucket=?').bind(await budgetBucket(key)).first();
 const remaining=Math.max(0,FREE_READER_REQUESTS-(row?.n||0));
 return {mode:remaining?'free_key':'direct_only',message:remaining?'Free-key Reader is configured, with direct website fallback. Availability also depends on the provider’s limits.':'The app’s Reader allowance is exhausted. Research uses direct public company pages; coverage varies by website.',app_request_limit:FREE_READER_REQUESTS,app_requests_remaining:remaining,provider_balance_known:false};
}
export async function checkFreeReaderBudget(env){
 if(freeReaderKey(env)&&env.JINA_TOKEN_ACCOUNTING==='1')await ensureTokenBudget(env,freeReaderKey(env));
 if(freeReaderKey(env)&&(await freeResearchStatus(env)).mode==='direct_only')throw quotaError();
}
function quotaError(){const error=Error('The free-key usage cap is reached. Direct public website research remains available.');return Object.assign(error,{publicMessage:error.message,status:503,code:'provider_quota',retryAfter:86400})}
export function readerLimits(env){return freeReaderKey(env)?{perMinute:30,perDay:300,interval:2000}:{perMinute:8,perDay:60,interval:8000}}
export async function reserveFreeRequest(env){
 const key=freeReaderKey(env);if(!key)throw Error('Free research key not configured');
 if(env.JINA_TOKEN_ACCOUNTING==='1'){await reserveTokens(env,key);return key}
 // Reserve the maximum request budget atomically across company/person lookups
 // and all workspaces. Failures also consume a reservation: no under-counting.
 // 400 * 20k = 8M tokens maximum through this app for this key, without resets.
 const row=await env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 WHERE n<? RETURNING n').bind(await budgetBucket(key),4102444800,FREE_READER_REQUESTS).first();
 if(!row)throw quotaError();
 return key;
}
export async function reserveResearchRequest(env){
 const key=freeReaderKey(env);
 if(key&&env.JINA_TOKEN_ACCOUNTING==='1')return {key,reservation:await reserveTokens(env,key)};
 return {key:await reserveFreeRequest(env),reservation:null};
}
export async function freeReaderRequest(env,target,domain){
 const request=readerRequest(target,domain);if(!freeReaderKey(env))return request;
 const {key,reservation}=await reserveResearchRequest(env);request.reservation=reservation;
 request.options.headers.Authorization='Bearer '+key;
 request.options.headers['X-Token-Budget']=String(FREE_READER_REQUEST_TOKENS);
 return request;
}

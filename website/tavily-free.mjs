// Optional free-plan search and extraction. No billing, upgrades or top-ups.
import {boundedText} from './direct-research.mjs';
import {sourceURL} from './brief.mjs';
import {safeDomain} from './domain.mjs';
export const TAVILY_ALLOWANCE=400,TAVILY_RESERVATION=2;
const FOREVER=4102444800;
export const tavilyFreeKey=env=>typeof env?.TAVILY_FREE_API_KEY==='string'&&/^[A-Za-z0-9_-]{16,512}$/.test(env.TAVILY_FREE_API_KEY)?env.TAVILY_FREE_API_KEY:'';
export const tavilyCacheSuffix=env=>tavilyFreeKey(env)?'|tavily-free-v1':'';
const failure=()=>Object.assign(Error('Free search is unavailable; public website research remains available.'),{code:'free_search_unavailable'});
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const bucket=async key=>'tavily-free-v1:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
export function verifyTavilyFreeUsage(data){
 const a=data?.account,k=data?.key;
 // A new free account returns explicit null for disabled paygo and an unset
 // per-key cap (confirmed against the account dashboard). Missing fields still
 // fail closed. The account's free-plan ceiling always remains mandatory.
 if(!['researcher','free'].includes(String(a?.current_plan).toLowerCase())||!(a.paygo_limit===0||a.paygo_limit===null)||a.paygo_usage!==0||!integer(a.plan_limit)||a.plan_limit>1000||!integer(a.plan_usage)||!(k?.limit===null||integer(k?.limit))||!integer(k.usage))throw failure();
 const remaining=Math.min(a.plan_limit-a.plan_usage,k.limit===null?a.plan_limit-a.plan_usage:k.limit-k.usage);
 if(remaining<TAVILY_RESERVATION+10)throw failure();
 return remaining;
}
async function jsonRequest(key,path,body,fetcher,signal){
 const r=await fetcher('https://api.tavily.com/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal});
 if(!r.ok){await r.body?.cancel();throw failure()}
 return JSON.parse(await boundedText(r,path==='usage'?32000:1500000));
}
async function request(env,path,body,{fetcher=fetch,timeoutMs=5000}={}){
 const key=tavilyFreeKey(env);if(!key)throw failure();
 const signal=AbortSignal.timeout(timeoutMs);
 const b=await bucket(key);
 // No automatic monthly renewal: failures keep reservations and key rotation
 // does not circumvent the provider-account usage check.
 const used=await env.DB.prepare('SELECT n FROM request_limits WHERE bucket=?').bind(b).first();
 if((used?.n||0)+TAVILY_RESERVATION>TAVILY_ALLOWANCE)throw failure();
 const minute=Math.floor(Date.now()/60000);
 const rate=await env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 WHERE n<6 RETURNING n').bind('tavily-minute:'+minute,(minute+1)*60).first();
 if(!rate)throw failure();
 verifyTavilyFreeUsage(await jsonRequest(key,'usage',null,fetcher,signal));
 const reserved=await env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET n=n+? WHERE n+?<=? RETURNING n').bind(b,TAVILY_RESERVATION,FOREVER,TAVILY_RESERVATION,TAVILY_RESERVATION,TAVILY_ALLOWANCE).first();
 if(!reserved)throw failure();
 const data=await jsonRequest(key,path,body,fetcher,signal);
 // Unexpected pricing changes stop future requests. Never refund uncertain calls.
 if(Number.isFinite(data?.usage?.credits)&&data.usage.credits>TAVILY_RESERVATION){await env.DB.prepare('UPDATE request_limits SET n=? WHERE bucket=?').bind(TAVILY_ALLOWANCE,b).run();throw failure()}
 return data;
}
export async function tavilySearch(env,query,domain,options){
 if(!safeDomain(domain))return [];
 const data=await request(env,'search',{query,search_depth:'basic',auto_parameters:false,max_results:5,include_domains:[domain],include_answer:false,include_raw_content:false,include_images:false,include_usage:true},options);
 // Discard summaries. Callers must fetch and validate the original company page.
 return (Array.isArray(data.results)?data.results:[]).slice(0,5).map(r=>({url:sourceURL(r.url,domain)})).filter(r=>r.url);
}
export async function tavilyExtract(env,target,domain,options){
 const url=sourceURL(target,domain);if(!url||!safeDomain(domain))throw failure();
 const data=await request(env,'extract',{urls:[url],extract_depth:'basic',format:'markdown',include_images:false,include_usage:true},options);
 const page=Array.isArray(data.results)&&data.results.find(r=>sourceURL(r.url,domain)===url);
 if(!page||typeof page.raw_content!=='string'||!page.raw_content.trim())throw failure();
 return {code:200,provider:'Tavily Extract',data:{url,content:page.raw_content,title:typeof page.title==='string'?page.title:domain}};
}
export async function tavilyStatus(env){
 const key=tavilyFreeKey(env);if(!key)return {provider:'Tavily',status:'not_connected',message:'Optional free search and page extraction: not connected.'};
 const used=await env.DB.prepare('SELECT n FROM request_limits WHERE bucket=?').bind(await bucket(key)).first(),remaining=Math.max(0,TAVILY_ALLOWANCE-(used?.n||0));
 return {provider:'Tavily',status:remaining>=TAVILY_RESERVATION?'configured':'allowance_used',app_credits_remaining:remaining,message:remaining>=TAVILY_RESERVATION?'Free search and page extraction configured. The free plan and disabled pay-as-you-go are checked before each request.':'Optional search allowance used. Public website research continues.'};
}

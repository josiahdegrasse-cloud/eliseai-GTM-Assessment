import {readerLimits} from './jina-free-key.mjs';
// Shared scheduling contains provider state only, never lead or visitor data.
export class Failure extends Error{
 constructor(message,status=400,retryAfter=600,code='unavailable'){super(message);Object.assign(this,{status,publicMessage:message,retryAfter,code})}
}
const nowSeconds=()=>Math.floor(Date.now()/1000);
const sql=(env,query,...args)=>env.DB.prepare(query).bind(...args);
export const READER_PER_MINUTE=8;
export function retrySeconds(value,now=Date.now()){
 const raw=String(value||'').trim(),delay=/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-now)/1000);
 return Math.min(86400,Math.max(60,Number.isFinite(delay)?delay:60));
}
export async function providerCooldown(env,name){
 const row=await sql(env,'SELECT expires FROM request_limits WHERE bucket=? AND expires>?','cooldown:'+name,nowSeconds()).first();
 if(row)throw new Failure('Research requests are paused until the provider allows another attempt.',429,row.expires-nowSeconds(),'provider_busy');
}
export async function pauseProvider(env,name,header,{random=Math.random}={}){
 const at=nowSeconds();let delay=retrySeconds(header);
 if(name==='reader'){
  const streak=await sql(env,'INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN request_limits.expires<=? THEN 1 ELSE MIN(request_limits.n+1,5) END,expires=MAX(request_limits.expires,excluded.expires) RETURNING n','backoff:reader',at+delay+3600,at).first();
  delay=Math.min(86400,Math.max(delay,Math.min(900,60*2**(streak.n-1)))+Math.floor(random()*11));
 }
 const row=await sql(env,'INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET expires=MAX(request_limits.expires,excluded.expires) RETURNING expires','cooldown:'+name,at+delay).first();
 return new Failure('The research provider is temporarily rate-limiting requests.',429,Math.max(1,row.expires-at),'provider_busy');
}
// After a pause, only one request may test recovery across all Worker instances.
export async function beginReaderProbe(env){
 await providerCooldown(env,'reader');
 const at=nowSeconds();if(!await sql(env,'SELECT n FROM request_limits WHERE bucket=? AND expires>?','backoff:reader',at).first())return null;
 const row=await sql(env,'INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET expires=excluded.expires WHERE request_limits.expires<=? RETURNING expires','probe:reader',at+20,at).first();
 if(!row)throw new Failure('A company research request is checking whether the provider has recovered.',429,20,'provider_queue');
 return row.expires;
}
export async function finishReaderProbe(env,lease,success){
 // An older success must not erase a newer concurrent throttling response.
 if(success)await sql(env,"DELETE FROM request_limits WHERE bucket='backoff:reader' AND NOT EXISTS (SELECT 1 FROM request_limits WHERE bucket='cooldown:reader' AND expires>?)",nowSeconds()).run();
 if(lease!==null)await sql(env,'DELETE FROM request_limits WHERE bucket=? AND expires=?','probe:reader',lease).run();
}
// Eight-second spacing stays well below the keyless limit, including across minute boundaries.
// Bound waits so page-cache leases and the lead lock cannot outlive the request.
export async function paceReader(env,{now=Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const interval=readerLimits(env).interval,maxWait=interval;
 const row=await sql(env,'INSERT INTO request_limits(bucket,n,expires) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET n=MAX(request_limits.n,?)+?,expires=? WHERE request_limits.n<=? RETURNING n','pace:reader',now+interval,Math.ceil((now+maxWait+interval)/1000),now,interval,Math.ceil((now+maxWait+interval)/1000),now+maxWait).first();
 if(!row)throw new Failure('Company research is queued. Saved sources and your draft remain available.',429,12,'provider_queue');
 const delay=Math.max(0,row.n-interval-now);if(delay)await wait(delay);
 await providerCooldown(env,'reader');
}

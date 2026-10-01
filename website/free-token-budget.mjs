// Read-only balance verification, then a non-renewing token allowance. No billing
// mutations, top-ups, new keys or daily budget resets. Legacy counters stay intact.
export const TOKEN_RESERVATION=20000,MAX_FREE_TOKENS=8000000,FREE_TOKEN_BUFFER=100000;
const FOREVER=4102444800;
const digest=async key=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
const budgetError=(message,code='provider_quota')=>Object.assign(Error(message),{publicMessage:message,status:503,code,retryAfter:600});
const safeInteger=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export function freeBalance(data){
 const wallet=data?.wallet;
 // A wallet with purchased tokens or automatic billing is not a free-only wallet.
 if(!safeInteger(wallet?.trial_balance)||!safeInteger(wallet?.total_balance)||wallet.regular_balance!==0||data?.metadata?.auto_recharge||data?.payment_method?.last4)throw budgetError('The configured key could not be verified as free-only. Direct website research remains available.','free_balance_unverified');
 return Math.min(wallet.trial_balance,wallet.total_balance);
}
export async function tokenBudgetStatus(env,key){
 const hash=await digest(key),prefix='jina-free-tokens-v2:'+hash;
 const rows=(await env.DB.prepare('SELECT bucket,n FROM request_limits WHERE bucket IN (?,?,?)').bind(prefix,prefix+':ceiling',prefix+':checked').all()).results;
 const values=new Map(rows.map(r=>[r.bucket,r.n]));
 if(!values.has(prefix+':ceiling'))return {initialized:false,prefix};
 return {initialized:true,prefix,limit:values.get(prefix+':ceiling'),remaining:Math.max(0,values.get(prefix+':ceiling')-(values.get(prefix)||0)),checked_at:new Date(values.get(prefix+':checked')*1000).toISOString()};
}
export async function ensureTokenBudget(env,key,{fetcher=fetch}={}){
 let state=await tokenBudgetStatus(env,key);if(state.initialized)return state;
 let data;
 try{
  // Endpoint used by Jina's own Reader authorization service. The secret is in
  // the header, never a URL, log, database record or client response.
  const r=await fetcher('https://dash.jina.ai/api/v1/authorization',{method:'GET',headers:{Authorization:'Bearer '+key,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(!r.ok){await r.body?.cancel();throw Error('Balance unavailable')}
  const reader=r.body.getReader();let size=0,parts=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32000){await reader.cancel();throw Error('Invalid balance')}parts.push(value)}
  const body=new Uint8Array(size);let offset=0;for(const p of parts){body.set(p,offset);offset+=p.length}data=JSON.parse(new TextDecoder().decode(body));
 }catch{throw budgetError('The free token balance could not be checked. Direct website research remains available.','free_balance_unverified')}
 const limit=Math.max(0,Math.min(MAX_FREE_TOKENS,freeBalance(data)-FREE_TOKEN_BUFFER)),p=state.prefix;
 // First initialization wins even when company and contact start concurrently.
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO request_limits VALUES(?,0,?)').bind(p,FOREVER),
  env.DB.prepare('INSERT OR IGNORE INTO request_limits VALUES(?,?,?)').bind(p+':ceiling',limit,FOREVER),
  env.DB.prepare('INSERT OR IGNORE INTO request_limits VALUES(?,?,?)').bind(p+':checked',Math.floor(Date.now()/1000),FOREVER)
 ]);
 return tokenBudgetStatus(env,key);
}
export async function reserveTokens(env,key,options){
 const state=await ensureTokenBudget(env,key,options),id=state.prefix+':request:'+crypto.randomUUID();
 // The ceiling and reservation are checked atomically across every visitor.
 const rows=await env.DB.batch([
  env.DB.prepare('UPDATE request_limits SET n=n+? WHERE bucket=? AND n+? <= (SELECT n FROM request_limits WHERE bucket=?) RETURNING n').bind(TOKEN_RESERVATION,state.prefix,TOKEN_RESERVATION,state.prefix+':ceiling'),
  env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) SELECT ?,?,? WHERE changes()=1').bind(id,TOKEN_RESERVATION,FOREVER)
 ]);
 if(!rows[0].results.length)throw budgetError('The verified free token allowance is used. Direct website research remains available.');
 return {id,bucket:state.prefix};
}
export function reportedTokens(data){
 const candidates=[data?.usage?.total_tokens,data?.usage?.tokens,data?.data?.usage?.tokens];
 const n=candidates.find(safeInteger);return n===undefined?null:n;
}
export async function settleTokens(env,reservation,data){
 if(!reservation)return;
 const used=reportedTokens(data);if(used===null)return; // Uncertain/failed calls retain the full reservation.
 const delta=used-TOKEN_RESERVATION;
 // Idempotent settlement. Over-budget reports charge the full observed amount
 // and stop subsequent requests once the ceiling is reached.
 await env.DB.batch([
  env.DB.prepare('UPDATE request_limits SET n=MAX(0,n+?) WHERE bucket=? AND EXISTS(SELECT 1 FROM request_limits WHERE bucket=?)').bind(delta,reservation.bucket,reservation.id),
  env.DB.prepare('DELETE FROM request_limits WHERE bucket=?').bind(reservation.id)
 ]);
}

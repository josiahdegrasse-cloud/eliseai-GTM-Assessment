// Freshness and retention are separate: old evidence remains available if a refresh fails.
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const seconds=()=>Math.floor(Date.now()/1000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const COMPANY_TTL=7*86400, ADDRESS_TTL=86400, RETRY_DELAY=600;

export async function cachedResearch(env,session,key,lookup,{shared=false,ttl=COMPANY_TTL,fallback=null,cacheOnly=false}={}){
 const storageKey=shared?key:session.id+':'+await hash(key);
 const table=shared?'public_sample_cache':'visitor_cache';
 const sql=(query,...args)=>env.DB.prepare(query).bind(...args);
 const read=async()=>{const row=await sql(`SELECT data FROM ${table} WHERE key=? AND expires>?`,storageKey,seconds()).first();return row?JSON.parse(row.data):null};
 const write=async data=>{const encoded=JSON.stringify(data);await (shared?sql('INSERT OR REPLACE INTO public_sample_cache(key,data,expires) VALUES(?,?,?)',storageKey,encoded,seconds()+30*ADDRESS_TTL):sql('INSERT OR REPLACE INTO visitor_cache(key,session_id,data,expires) VALUES(?,?,?,?)',storageKey,session.id,encoded,session.expires)).run()};
 const usable=data=>data&&((!data.stale&&Date.parse(data.cache_fresh_until)>Date.now())||Date.parse(data.retry_after)>Date.now());
 let prior=await read();
 // Branding may use retained page metadata but must never cause a research request.
 if(cacheOnly)return prior?{...prior,cached:true}:null;
 if(usable(prior))return {...prior,cached:true};
 // D1 atomic leases also deduplicate requests across Worker instances. The limits table
 // already expires ephemeral rows; this separate namespace never modifies provider caps.
 const bucket='cache-flight:'+await hash(storageKey),leaseUntil=seconds()+90;
 const lease=await sql('INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=1,expires=excluded.expires WHERE request_limits.expires<=? RETURNING bucket',bucket,leaseUntil,seconds()).first();
 if(!lease){
   for(let i=0;i<28;i++){
     await sleep(i?1000:150);const current=await read();if(usable(current))return {...current,cached:true};
     if(!await sql('SELECT bucket FROM request_limits WHERE bucket=? AND expires>?',bucket,seconds()).first())break;
   }
   throw new Error('Research is already refreshing.');
 }
 try{
   prior=await read();if(usable(prior))return {...prior,cached:true};
   try{
     const data=await lookup(),at=new Date().toISOString();
     const stored={...data,cache_fetched_at:data.cache_fetched_at||at,cache_fresh_until:data.stale?null:data.cache_fresh_until||new Date(Date.now()+ttl*1000).toISOString(),retry_after:data.retry_after||null,stale:!!data.stale};
     // Useful partial evidence may be shared, but one visitor's daily exhaustion
     // must not impose a retry deadline on the other sample visitors.
     if(!shared||!data.stale||data.retry_code!=='daily_limit')await write(stored);
     return {...stored,cached:false};
   }catch(error){
     // Only fixed, user-safe provider messages are passed by the caller.
     const retained=shared&&fallback?.evidence?.length&&!prior?.evidence?.length?fallback:prior||(shared?fallback:null);
     const delay=Math.min(86400,Math.max(1,Number(error.retryAfter)||RETRY_DELAY));
     const stored={...(retained||{}),...(error.retrieval?{retrieval:error.retrieval}:{}),stale:true,cache_fresh_until:null,retry_after:new Date(Date.now()+delay*1000).toISOString(),retry_code:error.code||'unavailable',refresh_error:error.publicMessage||'Research is temporarily unavailable. Existing information is preserved.'};
     // A visitor's exhausted allowance must never cool down another visitor's sample lookup.
     if(!shared)await write(stored);return {...stored,cached:!!retained};
   }
 }finally{await sql('DELETE FROM request_limits WHERE bucket=? AND expires=?',bucket,leaseUntil).run()}
}

import {tavilyFreeKey,tavilySearch,tavilyCacheSuffix} from './tavily-free.mjs';
import {sourceURL} from './brief.mjs';
import {freeReaderKey,reserveResearchRequest,settleTokens,FREE_READER_REQUEST_TOKENS} from './jina-free-key.mjs';
import {cachedResearch,COMPANY_TTL} from './research-cache.mjs';
import {boundedText} from './direct-research.mjs';

const words=s=>(String(s).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!['the','and','for','with','that','this','from','are'].includes(w));
export function keywordRank(query,items){
 const terms=[...new Set(words(query))],docs=items.map(x=>words(x.text)),avg=docs.reduce((n,d)=>n+d.length,0)/(docs.length||1);
 return items.map((item,index)=>({index,item,score:terms.reduce((sum,t)=>{const tf=docs[index].filter(w=>w===t).length,df=docs.filter(d=>d.includes(t)).length;return sum+(tf?Math.log(1+(docs.length-df+.5)/(df+.5))*tf*2.2/(tf+1.2*(.25+.75*docs[index].length/(avg||1))):0)},0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
}
export function cosine(a,b){if(!Array.isArray(a)||a.length<16||a.length!==b?.length||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))throw Error('Invalid semantic response');const dot=a.reduce((n,x,i)=>n+x*b[i],0),norm=Math.sqrt(a.reduce((n,x)=>n+x*x,0)*b.reduce((n,x)=>n+x*x,0));if(!norm)throw Error('Invalid semantic response');return dot/norm}
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function requestJSON(env,url,options,fetcher){
 const minute=Math.floor(Date.now()/60000);
 const slot=await env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 WHERE n<6 RETURNING n').bind('hybrid-minute:'+minute,(minute+1)*60).first();
 if(!slot)throw Error('Research fallback queued');
 // Auxiliary requests share Reader’s free-credit ledger and reserve before sending.
 const {key,reservation}=await reserveResearchRequest(env);
 const response=await fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(6000),headers:{...options.headers,Authorization:'Bearer '+key,'X-Token-Budget':String(FREE_READER_REQUEST_TOKENS),Accept:'application/json'}});
 if(!response.ok){await response.body?.cancel();throw Error('Research fallback unavailable')}
 const data=JSON.parse(await boundedText(response,600000));await settleTokens(env,reservation,data);return data;
}
export function officialSearchURLs(data,domain){
 return [...new Set((Array.isArray(data?.data)?data.data:[]).slice(0,5).map(x=>sourceURL(x.url,domain)).filter(url=>{if(!url)return false;const u=new URL(url);return !u.search&&!/\.(?:pdf|png|jpe?g|zip|svg)$/i.test(u.pathname)&&!/\/(?:login|sign-in|case-studies|customer-stories|testimonials|partners|directory)(?:\/|$)/i.test(u.pathname)}))].slice(0,3);
}
export async function discoverOfficialPages(env,session,lead,domain,{contact=false,fetcher=fetch}={}){
 if(!freeReaderKey(env)&&!tavilyFreeKey(env))return [];
 // Search is only URL discovery. Snippets and generated summaries are never
 // copied into evidence, fit, contact roles or draft text.
 const safe=s=>String(s).replace(/[^\p{L}\p{N} &.'-]/gu,' ').slice(0,160);
 const q=`site:${domain} "${safe(contact?lead.name:lead.company)}" ${contact?'team leadership role biography':'residential apartment property management portfolio about'}`;
 const result=await cachedResearch(env,session,'hybrid-discovery-v1:'+q+tavilyCacheSuffix(env),async()=>{
  if(freeReaderKey(env))try{const urls=officialSearchURLs(await requestJSON(env,'https://s.jina.ai/?'+new URLSearchParams({q}),{method:'GET'},fetcher),domain);if(urls.length)return {urls}}catch{/* Independent free search can recover discovery. */}
  if(tavilyFreeKey(env))return {urls:officialSearchURLs({data:await tavilySearch(env,q,domain,{fetcher})},domain)};
  return {urls:[]};
 },{ttl:contact?86400:COMPANY_TTL});
 return result.stale?[]:result.urls||[];
}
export async function rankEvidencePassages(env,session,lead,pages,{fetcher=fetch}={}){
 const query='The company owns and manages residential apartment communities. Its portfolio includes rental homes. Its team handles leasing and resident services.';
 const items=pages.flatMap((p,page)=>[...new Set([...(p.passages||[]),...(p.highlights||[])].flatMap(s=>s.split(/\n\n|(?<=[.!?])\s+(?=[A-Z])/)))].filter(text=>text.length>=35&&text.length<=1200).map(text=>({page,text})));
 const ranked=keywordRank(query,items),candidates=ranked.slice(0,8).map(r=>r.item);
 // Include a few passages with different wording; pure keyword prefiltering
 // would discard the very evidence semantic similarity is meant to recover.
 for(const item of items)if(candidates.length<12&&!candidates.some(x=>x.page===item.page&&x.text===item.text))candidates.push(item);
 const input=[query,...candidates.map(x=>x.text)];let order=keywordRank(query,candidates),mode='keyword';
 if(freeReaderKey(env)&&candidates.length&&new TextEncoder().encode(input.join('\n')).length<=16000){
  const key='hybrid-rank-v1:'+await digest(JSON.stringify(input));
  const result=await cachedResearch(env,session,key,async()=>{
   const data=await requestJSON(env,'https://api.jina.ai/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'jina-embeddings-v3',task:'text-matching',dimensions:256,embedding_type:'float',input})},fetcher);
   if(!Array.isArray(data.data)||data.data.length!==input.length)throw Error('Invalid semantic response');
   const vectors=new Map(data.data.map(d=>[d.index,d.embedding]));if(vectors.size!==input.length)throw Error('Invalid semantic response');
   return {scores:candidates.map((_,i)=>cosine(vectors.get(0),vectors.get(i+1)))};
  },{ttl:86400});
  if(!result.stale&&result.scores?.length===candidates.length){
   const lexical=new Map(order.map((r,i)=>[r.index,i])),semantic=result.scores.map((score,index)=>({score,index})).sort((a,b)=>b.score-a.score);
   const semanticRanks=new Map(semantic.map((r,i)=>[r.index,i]));
   order=candidates.map((item,index)=>({item,index,score:1/(60+lexical.get(index))+1/(60+semanticRanks.get(index))})).sort((a,b)=>b.score-a.score||a.index-b.index);mode='keyword+semantic';
  }
 }
 // Ranking selects exact passages, never generated facts or verification flags.
 return {mode,pages:pages.map((p,page)=>({...p,ranked_quotes:order.filter(r=>r.item.page===page).slice(0,2).map(r=>r.item.text)}))};
}

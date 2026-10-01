import {tavilyExtract,tavilyFreeKey,tavilyCacheSuffix} from './tavily-free.mjs';
// Bounded official-source research; optional discovery uses reserved free credits.
import {domain} from './domain.mjs';
import {directPage,boundedText} from './direct-research.mjs';
import {freeReaderRequest,readerCacheSuffix,checkFreeReaderBudget,settleTokens} from './jina-free-key.mjs';
import {cachedResearch} from './research-cache.mjs';
import {discoverOfficialPages} from './hybrid-research.mjs';
import {Failure,paceReader,pauseProvider} from './provider-control.mjs';
import {professionalEvidence,professionalKey,professionalURL} from './professional-evidence.mjs';
import {sourceURL} from './brief.mjs';
import {freePersonCandidates,personLinks,sitemapLinks,personPublicationDate} from './person-discovery.mjs';
export {professionalEvidence,professionalKey,professionalURL} from './professional-evidence.mjs';
export {freePersonCandidates} from './person-discovery.mjs';
export async function professionalResearch(env,session,lead){
 const d=domain(lead),input_key=professionalKey(lead),empty={version:9,input_key,people:[],insights:[],company_facts:[],provider:'Free public-source research',cost_dollars:0};
 if(!d||lead.name.trim().split(/\s+/).length<2||/\bTEST\b/i.test(lead.name))return {...empty,status:'not_assessed'};
 const result=await cachedResearch(env,session,'professional-free-v7:'+input_key+readerCacheSuffix(env)+tavilyCacheSuffix(env),async()=>{
  const day=Math.floor(Date.now()/86400000),bucket='professional-free:'+session.id+':'+day;
  const allowed=await env.DB.prepare('INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 WHERE n<60 RETURNING n').bind(bucket,(day+1)*86400).first();
  if(!allowed)throw new Failure('Public research is available again tomorrow. Saved sources remain available.',429,(day+1)*86400-Math.floor(Date.now()/1000),'free_limit');
  const deadline=Date.now()+40000,memo=new Map(),pages=[],visited=new Set(),aliases=new Set(),failures=[];
  let reused=0,sitemapChecked=false,sitemaps=0,searchChecked=false;
  const canonical=url=>url.replace('://www.','://').replace(/\/$/,'');
  const supplied=[...new Set((lead.inquiry||'').match(/https:\/\/[^\s<>]+/g)||[])].map(url=>sourceURL(url.replace(/[),.;]+$/,''),d)).filter(url=>url&&/team|people|leadership|contact|about|corporate/i.test(new URL(url).pathname)).slice(0,2);
  let queue=[...supplied.map(url=>({url,score:300})),{url:'https://'+d+'/',score:200},...['/our-team','/leadership','/team','/about-us'].map(url=>({url:'https://'+d+url,score:0}))];
  const enqueue=links=>{queue=[...queue,...links].sort((a,b)=>b.score-a.score);const seen=new Set();queue=queue.filter(x=>{const key=canonical(x.url);if(visited.has(key)||aliases.has(key)||seen.has(key))return false;seen.add(key);return true;});};
  const remaining=()=>deadline-Date.now();
  const evaluate=()=>{const extracted=pages.map(p=>freePersonCandidates(lead,p));return professionalEvidence(lead,{status:'completed',costDollars:{total:0},output:{structured:{people:extracted.flatMap(x=>x.people).slice(0,3),insights:extracted.flatMap(x=>x.insights).slice(0,3),company_facts:[]},grounding:pages.map(p=>({citations:[{url:p.url}]}))}},pages)};
  const discoverSitemap=async()=>{
   sitemapChecked=true;
   // A sitemap supplies candidate URLs only. It can never establish a role.
   let targets=['https://'+d+'/sitemap.xml'];
   while(targets.length&&sitemaps<2&&remaining()>5000){
    const target=targets.shift();sitemaps++;
    const cached=await cachedResearch(env,session,'person-sitemap-v1:'+target,async()=>{
     const xml=await directPage(target,d,{memo,format:'xml',signal:AbortSignal.timeout(Math.min(4000,remaining()))});
     return {links:sitemapLinks(xml.body,xml.url,d)};
    },{ttl:86400});
    if(cached.stale)continue;
    const links=cached.links||[],ranked=personLinks(lead,{url:'https://'+d+'/',links});enqueue(ranked);
    if(ranked.some(l=>l.score>=50))break;
    targets.push(...links.filter(l=>/\.xml$/i.test(new URL(l.url).pathname)&&!/image|video|product|categor|tag/i.test(l.url)).sort((a,b)=>Number(/page|team|people/i.test(b.url))-Number(/page|team|people/i.test(a.url))).map(l=>l.url).slice(0,1));
   }
  };
  while(queue.length&&visited.size<8&&remaining()>1000){
   if(visited.size>=2&&!searchChecked&&!evaluate().people.some(p=>!p.historical)&&remaining()>14000){
    searchChecked=true;
    try{enqueue((await discoverOfficialPages(env,session,lead,d,{contact:true})).map(url=>({url,score:250})))}catch{/* Keep direct company discovery available. */}
   }
   // Prefer discovered official paths; consult one bounded sitemap chain before
   // spending the remaining attempts on guessed team paths.
   if(visited.size>=2&&!sitemapChecked&&(queue[0].score<50||visited.size>=4)&&remaining()>8000)await discoverSitemap();
   const target=sourceURL(queue.shift()?.url,d);if(!target||visited.has(canonical(target)))continue;visited.add(canonical(target));
   const cached=await cachedResearch(env,session,'person-page-v5:'+canonical(target)+readerCacheSuffix(env)+tavilyCacheSuffix(env),async()=>{
    let raw;
    try{raw=await directPage(target,d,{memo,signal:AbortSignal.timeout(Math.min(5500,remaining()))});}
    catch(directError){
     try{
     if(remaining()<1000)throw Error('Research deadline');
     await checkFreeReaderBudget(env);await paceReader(env);if(remaining()<1000)throw Error('Research deadline');
     const r=await freeReaderRequest(env,target,d);r.options.signal=AbortSignal.timeout(Math.min(11000,remaining()));
     const response=await fetch(r.url,r.options);
     if(!response.ok){await response.body?.cancel();if(response.status===429)throw await pauseProvider(env,'reader',response.headers.get('Retry-After'));throw Error('Public page unavailable');}
     raw=JSON.parse(await boundedText(response,1500000));await settleTokens(env,r.reservation,raw);
     }catch(readerError){
      if(remaining()<1000||!tavilyFreeKey(env)||['robots_disallowed','unsafe_host'].includes(directError.code))throw readerError;
      raw=await tavilyExtract(env,target,d,{timeoutMs:Math.min(5000,remaining())});
     }
    }
    const url=professionalURL(raw?.data?.url);if(!url||!sourceURL(url,d)||typeof raw?.data?.content!=='string'||raw.data.httpStatus&&raw.data.httpStatus!==200||/access denied|just a moment|page not found/i.test(raw.data.title||''))throw Error('Invalid public page');
    const directory=/team|leadership|our.people|officers|trustees|management|biograph/i.test(new URL(url).pathname+' '+raw.data.title)&&!/\/(?:blog|news|press|customer|case-stud)/i.test(new URL(url).pathname);
    const profiles=directory?(raw.data.profiles||[]).filter(p=>p.name&&p.role):[];
    return {page:{url,provider:raw.provider||'Company website',title:raw.data.title||d,publishedDate:personPublicationDate(raw.data),text:(raw.data.profile_text||raw.data.content).slice(0,180000)+(profiles.length?'\n\n'+profiles.map(p=>p.name+'\n'+p.role).join('\n\n'):''),profile_blocks:raw.data.profile_blocks||[],profiles,links:(raw.data.links||[]).slice(0,500)}};
   },{ttl:86400});
   if(cached.stale||!cached.page){failures.push({reason:'public_page_unavailable',url:target});continue;}
   if(cached.cached)reused++;
   const page={...cached.page,retrieved_at:cached.cache_fetched_at};aliases.add(canonical(page.url));pages.push(page);
   enqueue(personLinks(lead,page));
   const found=evaluate();
   if(found.people.some(p=>!p.historical)){
    // Once identity is established, follow observed links to this individual's
    // biography. Do not spend the remaining budget on unrelated directories.
    const biographies=queue.filter(x=>x.score===100);
    if(found.insights.length>=2||!biographies.length)break;
    queue=biographies.slice(0,2);
   }
  }
  if(!pages.length&&failures.length)throw new Failure('Public research is temporarily unavailable. Saved sources remain available.',503,600,'public_page_unavailable');
  const evidence=evaluate();
  return {...evidence,...empty,people:evidence.people,insights:evidence.insights,match:evidence.match,status:'complete',cache_fresh_until:new Date(Date.now()+(evidence.people.some(p=>!p.historical)?86400:3600)*1000).toISOString(),checked_at:evidence.checked_at,conversation_starter:evidence.conversation_starter,research_diagnostics:{...evidence.research_diagnostics,pages_checked:visited.size,pages_reused:reused,sitemaps_checked:sitemaps,source_failures:failures,paid_requests:0}};
 },{ttl:86400});
 return {...empty,...result,status:result.status||'unavailable'};
}

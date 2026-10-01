import {demoInquiryCleanup} from './demo-inquiry-cleanup.mjs';
import {googleStreetViewEmbed,propertyViewKey} from '../static/street-view.js';
import {tavilyExtract,tavilyFreeKey,tavilyCacheSuffix,tavilyStatus} from './tavily-free.mjs';
import {trackRun,saveAssessment,historyFor} from './quality-history.mjs';
import sheetsUIJS from '../static/sheets-ui.js?raw';
import {sheetSettings,sheetStatus,sheetWebhook} from './google-sheets.mjs';
import {appsScript} from '../static/sheets-script.js';
import {normalizeRows} from '../static/import-data.js';
import importDataJS from '../static/import-data.js?raw';
import importUIJS from '../static/import-ui.js?raw';
import spreadsheetJS from '../static/vendor/xlsx.mjs?raw';
import companyFitJS from '../static/company-fit.js?raw';
import Papa from 'papaparse';
import {logoCandidates,retrieveLogo} from './company-logo.mjs';
import {companyLocations,mergeCompanyLocations} from './company-locations.mjs';
import {areaRequest,areaEvidence} from './area-context.mjs';
import areaJS from '../static/area.js?raw';
import {knownCompanyLogo} from '../static/company-brands.js';
import brandsJS from '../static/company-brands.js?raw';
import brandImages from './company-brand-images.json';
import {aerialRequest,aerialImage} from './property-imagery.mjs';
import {RESEARCH_ENGINE,nextCompanyPage,readerPage,readerEvidence,researchHasContext,registryRequest,registryEvidence,retainCompanyEvidence} from './free-research.mjs';
import {freeReaderRequest,readerLimits,readerCacheSuffix,freeResearchStatus,checkFreeReaderBudget,settleTokens} from './jina-free-key.mjs';
import {discoverOfficialPages,rankEvidencePassages} from './hybrid-research.mjs';
import {directPage} from './direct-research.mjs';
import {professionalResearch,professionalKey} from './professional-research.mjs';
import {sourceURL} from './brief.mjs';
import {cachedResearch,COMPANY_TTL,ADDRESS_TTL} from './research-cache.mjs';
import {Failure,providerCooldown,pauseProvider,paceReader,beginReaderProbe,finishReaderProbe} from './provider-control.mjs';
import html from '../static/index.html?raw';
import appJS from '../static/app.js?raw';
import css from '../static/style.css?raw';
import researchJS from '../static/research.js?raw';
import visualsJS from '../static/account-visuals.js?raw';
import streetViewJS from '../static/street-view.js?raw';
import mapDataJS from '../static/map-data.js?raw';
import workflowJS from '../static/workflow.js?raw';
import streamJS from '../static/research-stream.js?raw';
import salesContextJS from '../static/sales-context.js?raw';
import {qualificationAnswers} from '../static/sales-context.js';
import samples from '../test-data/public-company-samples.csv?raw';
import snapshots from '../test-data/public-research-snapshots.json';
import researchedExamples from '../test-data/researched-examples.json';
import legacyExamples from '../test-data/legacy-example-inputs.json';
import exportJS from '../static/export.js?raw';
import decisionUIJS from '../static/decision-ui.js?raw';
import {leadsCSV} from '../static/export.js';
import {recordQualification} from './qualification-evidence.mjs';
import {REQUIRED,OPTIONAL,intake,identity,validate,draftFor,domain,censusParams,censusFallbackParams,propertyEvidence,qualify,presentLead,draftSignature,cleanInquiry} from './domain.mjs';

const DAY=86400,COOKIE='__Host-inbound-visitor',MAX_BODY=1000000;
const CENSUS='https://geocoding.geo.census.gov/geocoder/geographies/address';
const censusURL=params=>(params.address?CENSUS.replace(/address$/,'onelineaddress'):CENSUS)+'?'+new URLSearchParams(params);
// Share only the explicitly published sample companies/addresses, never visitor input or drafts.
const PUBLIC_CACHE_KEYS=new Set(Papa.parse(samples,{header:true,skipEmptyLines:true}).data.flatMap(l=>['reader:'+domain(l)+'|'+l.company.toLowerCase(),'gleif:'+l.company.toLowerCase(),'census:'+JSON.stringify(censusParams(l)).toLowerCase()]));
const seconds=()=>Math.floor(Date.now()/1000);
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})}
function headers(res){
  const h=new Headers(res.headers);
  for(const [k,v] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Strict-Transport-Security':'max-age=31536000','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}))h.set(k,v);
  return new Response(res.body,{status:res.status,headers:h});
}
async function count(env,bucket,limit,expires){
  const result=await stmt(env,'INSERT INTO request_limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=CASE WHEN request_limits.expires<=? THEN 1 ELSE n+1 END,expires=excluded.expires WHERE request_limits.expires<=? OR ? IS NULL OR n<? RETURNING n',bucket,expires,seconds(),seconds(),limit,limit).first();
  if(!result)throw new Failure('Request limit reached. Please try again later.',429);
}
async function cleanup(env){
  const t=seconds();
  await env.DB.batch([
    stmt(env,'DELETE FROM visitor_sessions WHERE expires<=?',t),
    stmt(env,'DELETE FROM visitor_cache WHERE expires<=?',t),
    stmt(env,'DELETE FROM public_sample_cache WHERE expires<=?',t),
    stmt(env,'DELETE FROM request_limits WHERE expires<=?',t),
    stmt(env,'DELETE FROM security_events WHERE at<?',t-7*DAY),
  ]);
}
async function audit(env,session,action){await stmt(env,'INSERT INTO security_events(id,actor,action,at) VALUES(?,?,?,?)',crypto.randomUUID(),session.id,action,seconds()).run()}
async function sessionFor(req,env){
  const token=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return stmt(env,'SELECT id,csrf,expires FROM visitor_sessions WHERE id=? AND expires>?',await digest(token),seconds()).first();
}
async function requireSession(req,env){const session=await sessionFor(req,env);if(!session)throw new Failure('Your workspace session expired. Reload to start a new session.',401);return session}
async function readBody(req){
  if(req.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')throw new Failure('JSON required',415);
  if(Number(req.headers.get('Content-Length')||0)>MAX_BODY)throw new Failure('Request must be under 1 MB',413);
  const reader=req.body?.getReader();let size=0,parts=[];
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new Failure('Request must be under 1 MB',413)}parts.push(value)}}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{throw new Failure('Valid JSON required')}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Failure('JSON object required');return body;
}
async function getLead(env,session,id){
  if(typeof id!=='string')throw new Failure('Lead not found',404);
  const row=await stmt(env,'SELECT data,version,processing_until FROM visitor_leads WHERE id=? AND session_id=?',id,session.id).first();
  if(!row)throw new Failure('Lead not found',404);
  return {...row,lead:JSON.parse(row.data)};
}
async function updateExampleScenarios(env,session,records){
  for(const item of records){
    const old=JSON.parse(item.data);
    if(item.processing_until<seconds()){
      const cleaned=demoInquiryCleanup(old,presentLead(old).lead_priority.tier,[...researchedExamples,...legacyExamples]);
      if(cleaned){
        const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=? AND processing_until<?',JSON.stringify(cleaned),item.id,session.id,item.version,seconds()).run();
        if(saved.meta.changes){item.data=JSON.stringify(cleaned);await saveAssessment(env,session,cleaned,'remove demo inquiry');}
        else {const current=await stmt(env,'SELECT data FROM visitor_leads WHERE id=? AND session_id=?',item.id,session.id).first();if(current)item.data=current.data;}
        continue;
      }
    }
    // Only migrate the known saved showcase, with its original inquiry. Never
    // replace imported inputs, refreshed evidence, custom messages or active work.
    if(!old.sample_lead||!old.company_snapshot||old.company_stale||(old.sample_set_version||0)<2||item.processing_until>=seconds())continue;
    const row=researchedExamples.find(r=>r.sample_key===old.sample_key&&r.email===old.email&&r.company===old.company);
    if(!row||old.sample_set_version>=row.sample_set_version||!row.sample_previous_inquiries?.includes(old.inquiry))continue;
    const preserve=old.draft_edited||old.reviewed,changed=old.inquiry!==row.inquiry;
    const lead={...old,inquiry:row.inquiry,sample_focus:row.sample_focus,sample_response_type:row.sample_response_type,sample_grounded_draft:row.sample_grounded_draft,sample_set_version:row.sample_set_version,
      ...(!preserve?{draft_version:0}:changed?{draft_edited:true,reviewed:false,draft_stale:true}:{})};
    const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=? AND processing_until<?',JSON.stringify(lead),item.id,session.id,item.version,seconds()).run();
    if(saved.meta.changes){item.data=JSON.stringify(lead);await saveAssessment(env,session,lead,'example scenario update')}
    else {const current=await stmt(env,'SELECT data FROM visitor_leads WHERE id=? AND session_id=?',item.id,session.id).first();if(current)item.data=current.data}
  }
  return records;
}
async function retireUntouchedExamples(env,session){
  const stored=await stmt(env,'SELECT id,data,version,processing_until FROM visitor_leads WHERE session_id=?',session.id).all();
  for(const item of stored.results){
    const old=JSON.parse(item.data),original=legacyExamples.find(r=>r.sample_key===old.sample_key);
    if(!original||!old.sample_lead||old.sample_retired||!old.company_snapshot||old.company_stale||item.processing_until>=seconds())continue;
    if(['name','email','company','website','property_address','city','state'].some(k=>(old[k]||'')!==(original[k]||'')))continue;
    if(![original.inquiry,...original.sample_previous_inquiries||[]].includes(old.inquiry))continue;
    if(old.draft_edited||old.reviewed||old.notes||old.feedback||old.feedback_reason||old.would_send||old.qualification_history?.length)continue;
    if(Object.entries(old.qualifications||{}).some(([k,v])=>v&&v!=='unknown'&&v!==original.qualifications?.[k]))continue;
    // Keep the original record and audit history; only retire untouched defaults.
    await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=? AND processing_until<?',JSON.stringify({...old,sample_retired:true}),item.id,session.id,item.version,seconds()).run();
  }
}
async function add(env,session,rows,prepared=false,metadata=null){
  // Upgrade only untouched example inputs. Keep the same ID and any rep-edited
  // draft; real imports and edited lead identities never become demo records.
  if(prepared){
    const stored=await stmt(env,'SELECT id,data,version FROM visitor_leads WHERE session_id=?',session.id).all();
    for(const item of stored.results){
      const old=JSON.parse(item.data);
      const row=rows.find(r=>old.sample_lead&&old.email===r.email&&old.company===r.company);
      if(!row||(old.sample_set_version||0)>=(row.sample_set_version||0))continue;
      const preserve=old.draft_edited||old.reviewed;
      const lead={...intake(row),...row,id:old.id,created_at:old.created_at,...(preserve?{subject:old.subject,draft:old.draft,draft_edited:true,reviewed:false,draft_stale:true,draft_version:old.draft_version,draft_basis:old.draft_basis,draft_facts:old.draft_facts,draft_hooks:old.draft_hooks}: {})};
      for(const key of ['notes','feedback','feedback_reason','would_send','reviewed_draft_id','qualification_history'])if(old[key])lead[key]=old[key];
      if(Object.values(old.qualifications||{}).some(value=>value&&value!=='unknown')){lead.qualifications=old.qualifications;lead.qualification_evidence=old.qualification_evidence;}
      const saved=await stmt(env,'UPDATE OR IGNORE visitor_leads SET data=?,identity=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(lead),identity(lead),old.id,session.id,item.version).run();
      if(saved.meta.changes)await saveAssessment(env,session,lead,'example update');
    }
  }
  const total=(await stmt(env,'SELECT count(*) AS n FROM visitor_leads WHERE session_id=?',session.id).first()).n;

  const existingRows=await stmt(env,'SELECT identity FROM visitor_leads WHERE session_id=?',session.id).all(),existingKeys=new Set(existingRows.results.map(r=>r.identity));
  const newKeys=new Set(rows.map(row=>identity(intake(row))).filter(key=>!existingKeys.has(key)));
  if(total+newKeys.size>100)throw new Failure('This workspace supports up to 100 leads. Import fewer leads or clear the workspace.',409);
  let inserted=0,duplicates=0;const ids=[],existing_ids=[];
  for(const row of rows){
    const lead=intake(row);if(prepared)Object.assign(lead,row,{id:lead.id,created_at:lead.created_at});if(metadata)Object.assign(lead,metadata);if(!REQUIRED.some(k=>lead[k]))continue;
    if(lead.research_url&&!sourceURL(lead.research_url,domain(lead)))throw new Failure('Use an HTTPS research page on the company website or its investor subdomain.');
    const result=await stmt(env,'INSERT OR IGNORE INTO visitor_leads(id,session_id,identity,data) SELECT ?,?,?,? WHERE (SELECT count(*) FROM visitor_leads WHERE session_id=?)<100',lead.id,session.id,identity(lead),JSON.stringify(lead),session.id).run();
    if(result.meta.changes){inserted++;ids.push(lead.id);await saveAssessment(env,session,lead,'import')}else{duplicates++;const existing=await stmt(env,'SELECT id FROM visitor_leads WHERE session_id=? AND identity=?',session.id,identity(lead)).first();if(existing)existing_ids.push(existing.id);else throw new Failure('This workspace has reached its 100-lead capacity. Import fewer leads or clear the workspace.',409)}
  }
  await audit(env,session,'leads.import');return {inserted,duplicates,ids,existing_ids};
}
async function provider(env,session,name,payload){
  if(name==='reader')await checkFreeReaderBudget(env);
  await providerCooldown(env,name);
  const minute=Math.floor(seconds()/60),day=Math.floor(seconds()/DAY);
  const limits=readerLimits(env);
  const perMinute={reader:limits.perMinute,census:30,gleif:30,area:30},perDay={reader:limits.perDay,census:30,gleif:30,area:60};
  // Anonymous research respects free-service limits.
  const dailyLimit=perDay[name];
  // Check exhausted budgets before reserving a pacing slot. Counters are still atomic.
  const daily=await stmt(env,'SELECT n FROM request_limits WHERE bucket=? AND expires>?',`provider:${name}:session:${session.id}:${day}`,seconds()).first();
  if(dailyLimit!==null&&daily?.n>=dailyLimit)throw new Failure('Today’s research limit is reached. It renews at midnight UTC; saved research remains available.',429,(day+1)*DAY-seconds(),'daily_limit');
  const global=await stmt(env,'SELECT n FROM request_limits WHERE bucket=? AND expires>?',`provider:${name}:global:${minute}`,seconds()).first();
  if(global?.n>=perMinute[name])throw new Failure('Company research is queued. Saved sources and your draft remain available.',429,Math.max(1,(minute+1)*60-seconds()),'provider_queue');
  if(name==='reader')await paceReader(env);
  const probe=name==='reader'?await beginReaderProbe(env):null;let success=false;
  try{
  const currentMinute=Math.floor(seconds()/60),currentDay=Math.floor(seconds()/DAY);
  try{await count(env,`provider:${name}:global:${currentMinute}`,perMinute[name],(currentMinute+1)*60)}catch{throw new Failure('Company research is queued. Saved sources and your draft remain available.',429,Math.max(1,(currentMinute+1)*60-seconds()),'provider_queue')}
  try{await count(env,`provider:${name}:session:${session.id}:${currentDay}`,dailyLimit,(currentDay+1)*DAY)}catch{throw new Failure('Today’s research limit is reached. It renews at midnight UTC; saved research remains available.',429,(currentDay+1)*DAY-seconds(),'daily_limit')}
  const {url,options,reservation}=name==='area'?areaRequest(payload):name==='reader'?await freeReaderRequest(env,payload.url,payload.domain):{url:name==='gleif'?registryRequest(payload.company):censusURL(payload),options:{method:'GET',headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)}};
  if(name==='reader'&&payload.timeoutMs)options.signal=AbortSignal.timeout(Math.min(12000,payload.timeoutMs));
  try{
    const result=await fetch(url,options);
    if(!result.ok&&result.status!==429)console.warn(JSON.stringify({event:'provider_response',provider:name,status:result.status}));
    if(result.status===429){const error=await pauseProvider(env,name,result.headers.get('Retry-After'));console.warn(JSON.stringify({event:'provider_throttled',provider:name,retry_seconds:error.retryAfter}));throw error}
    if(name==='reader'&&result.status===402)throw new Failure('The research provider allowance is exhausted. The site owner needs to review the free quota.',503,3600,'provider_quota');
    if(name==='reader'&&[403,451].includes(result.status))throw new Failure('The research service could not access this company page. The response does not establish whether the restriction is at the website or the provider.',503,3600,'site_blocked');
    if(name==='reader'&&[401,409].includes(result.status))throw new Failure('The research service could not read this company page. Try a different official page.',503,600,'source_unavailable');
    if(!result.ok)throw Error('provider');
    const reader=result.body.getReader();let parts=[],size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw Error('size')}parts.push(value)}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(name==='reader')await settleTokens(env,reservation,data);
    if(name==='census'&&!Array.isArray(data.result?.addressMatches))throw Error('shape');
    success=true;return data;
  }catch(error){if(error instanceof Failure)throw error;throw new Failure(`${name==='reader'?'Company website research':name==='gleif'?'Legal-entity lookup':name==='area'?'Area data':'Property lookup'} is temporarily unavailable. Previous results are preserved.`)}
  }finally{if(name==='reader')await finishReaderProbe(env,probe,success)}
}
async function companyPage(env,session,lead,url,timeoutMs=12000){
  const d=domain(lead),shared=PUBLIC_CACHE_KEYS.has('reader:'+d+'|'+lead.company.toLowerCase());
  // Request readable text only: full HTML can exceed the per-page token ceiling.
  // Branding has its own cached, bounded direct-HTML path and cannot block facts.
  const pageKey='company-page-v9:'+url+'|'+lead.company.toLowerCase()+readerCacheSuffix(env)+tavilyCacheSuffix(env);
  const fetchPage=async()=>{
    let raw;
    try{raw=await provider(env,session,'reader',{url,domain:d,timeoutMs})}catch(error){
      if(!tavilyFreeKey(env)||['site_blocked','robots_disallowed'].includes(error.code))throw error;
      try{raw=await tavilyExtract(env,url,d,{timeoutMs:Math.min(timeoutMs,5000)})}catch{throw error}
    }
    let page;
    try{page=readerPage(raw,d,lead.company);if(raw.provider)page.provider=raw.provider}catch{throw new Failure('The page did not return usable company text. Try a different official company page.',503,600,'source_unavailable')}
    let candidates=[];try{candidates=logoCandidates(raw,d,lead.company)}catch{/* Branding is optional. */}
    return {page,candidates,locations:companyLocations(raw,d,lead.company)};
  };
  let result=await cachedResearch(env,session,pageKey,fetchPage,{shared,ttl:COMPANY_TTL});
  // Reuse old page excerpts when they already answer the portfolio question.
  // Only incomplete old extracts need a bounded re-fetch to recover discarded stats.
  if(!result.stale&&result.page?.extraction_version!==2&&!researchHasContext(lead,[result.page])){
    result=await cachedResearch(env,session,pageKey+':statistics-v2',fetchPage,{shared,ttl:COMPANY_TTL});
  }
  if(result.stale)throw new Failure(result.refresh_error,503,Math.max(1,Math.ceil((Date.parse(result.retry_after)-Date.now())/1000)),result.retry_code);
  return {...result,page:{...result.page,locations:result.locations||[],retrieved_at:result.cache_fetched_at,fresh_until:result.cache_fresh_until}};
}
async function companyLogo(env,session,lead){
  const known=knownCompanyLogo(lead.company,lead.website,lead.email);if(known)return known;
  const d=domain(lead);if(!d)return {status:'missing'};
  const shared=PUBLIC_CACHE_KEYS.has('reader:'+d+'|'+lead.company.toLowerCase());
  const key='logo-v3:'+d+'|'+lead.company.toLowerCase();
  const stored=await cachedResearch(env,session,key,null,{shared,cacheOnly:true});
  const response=result=>result.image?{status:'found',image:result.image,source_url:result.source_url,page_url:result.page_url,kind:result.kind,theme:result.theme}:{status:'missing',retry_after:result.retry_after};
  if(stored?.image&&Date.parse(stored.cache_fresh_until)>Date.now())return response(stored);
  const pages=[...new Set([sourceURL(lead.research_url,d),'https://'+d+'/',...(lead.evidence||[]).map(e=>sourceURL(e.url,d))].filter(Boolean))].slice(0,6);
  const savedPages=await Promise.all(pages.flatMap(url=>['company-page-v9:','company-page-v8:','company-page-v7:','direct-page-v5:'].map(prefix=>cachedResearch(env,session,prefix+url+'|'+lead.company.toLowerCase()+(prefix.startsWith('company-page')?readerCacheSuffix(env):''),null,{shared,cacheOnly:true}))));
  let candidates=savedPages.flatMap(p=>p?.candidates||[]);
  if(!candidates.length&&(!lead.processed_at||!lead.evidence?.length))return stored?.image?response(stored):{status:'deferred',retry_after:new Date(Date.now()+60000).toISOString()};
  const result=await cachedResearch(env,session,key,async()=>{
    const day=Math.floor(seconds()/DAY),minute=Math.floor(seconds()/60);
    await count(env,`logo:${session.id}:${day}`,30,(day+1)*DAY);
    await count(env,`logo:global:${minute}`,12,(minute+1)*60);
    if(!candidates.length){
      const branding=await cachedResearch(env,session,'logo-page-v1:'+d,async()=>{
        const raw=await directPage('https://'+d+'/',d,{signal:AbortSignal.timeout(5000)});
        return {candidates:logoCandidates(raw,d,lead.company)};
      },{shared,ttl:COMPANY_TTL});
      candidates=branding.candidates||[];
    }
    if(!candidates.length)throw new Failure('Company image is unavailable.',503,600);
    const found=await retrieveLogo(candidates,({url,options})=>fetch(url,options));
    if(found.status==='missing')throw new Failure('Company image is unavailable.',503,600);
    return found;
  },{shared,ttl:7*DAY});
  return response(result);
}
async function companyResearch(env,session,lead){
  const d=domain(lead);if(!d)return {engine:RESEARCH_ENGINE,evidence:[],matched:false,message:'Add a public company website to research this account.'};
  const preferred=sourceURL(lead.research_url,d),publicKey='reader:'+d+'|'+lead.company.toLowerCase(),key=RESEARCH_ENGINE+':recovery-v11:'+d+'|'+lead.company.toLowerCase()+'|'+preferred+readerCacheSuffix(env)+tavilyCacheSuffix(env);
  const shared=!preferred&&PUBLIC_CACHE_KEYS.has(publicKey);
  const result=await cachedResearch(env,session,key,async()=>{
    const started=Date.now(),pages=[],visited=new Set(),directFailures=[];let attempts=0,directAttempts=0,limited=null,discovered=false;
    const canonical=url=>url.replace('://www.','://').replace(/\/$/,'');
    const alternatives=[preferred,'https://'+d+'/'].filter(Boolean);
    const providerStopped=error=>['provider_busy','provider_queue','daily_limit','provider_auth','provider_quota','free_balance_unverified'].includes(error?.code);
    while(attempts<4&&Date.now()-started<26000){
      const enough=researchHasContext(lead,pages);
      let next=nextCompanyPage({domain:d,preferred,pages,visited,alternatives,enough});
      if(!next&&!enough&&!discovered){
        discovered=true;
        // Public conventional overview pages are a fallback, never challenge bypasses.
        alternatives.push(...['/about','/about-us','/company','/investors'].map(path=>'https://'+d+path));
        next=nextCompanyPage({domain:d,preferred,pages,visited,alternatives,enough});
      }
      if(!next||attempts>=4||Date.now()-started>=26000)break;
      visited.add(canonical(next));attempts++;
      try{pages.push((await companyPage(env,session,lead,next)).page);limited=null}
      catch(error){limited=error;if(providerStopped(error))break}
    }
    // Reader outages and thin pages can still leave useful public HTML available.
    // Separate limits, cache and credentials prevent one service's cooldown from
    // becoming a dependency for every research path. Three pages, twelve seconds total.
    if(!researchHasContext(lead,pages)){
      const memo=new Map(),signal=AbortSignal.timeout(12000);
      const targets=[...new Set([preferred,...pages.flatMap(p=>p.links||[]),'https://'+d+'/','https://'+d+'/about-us'].filter(Boolean))],directVisited=new Set();
      for(let directAttempt=0;directAttempt<3&&targets.length;directAttempt++){
        const target=targets.shift();if(directVisited.has(canonical(target))){directAttempt--;continue}directVisited.add(canonical(target));
        directAttempts++;
        try{
          const fallback=await cachedResearch(env,session,'direct-page-v5:'+target+'|'+lead.company.toLowerCase(),async()=>{
            await providerCooldown(env,'direct');
            const minute=Math.floor(seconds()/60),day=Math.floor(seconds()/DAY);
            try{await count(env,`provider:direct:global:${minute}`,12,(minute+1)*60)}catch{throw new Failure('Direct website research is queued to respect request limits.',429,(minute+1)*60-seconds(),'provider_queue')}
            try{await count(env,`provider:direct:session:${session.id}:${day}`,90,(day+1)*DAY)}catch{throw new Failure('Today’s direct website research allowance is used. Saved research is retained.',429,(day+1)*DAY-seconds(),'daily_limit')}
            const raw=await directPage(target,d,{signal,memo}),page=readerPage(raw,d,lead.company);
            return {page:{...page,provider:'Direct company website',locations:companyLocations(raw,d,lead.company)},candidates:logoCandidates(raw,d,lead.company)};
          },{shared,ttl:COMPANY_TTL});
          if(fallback.stale)throw new Failure(fallback.refresh_error,503,Math.max(1,(Date.parse(fallback.retry_after)-Date.now())/1000),fallback.retry_code);
          if(fallback.page){
            const page={...fallback.page,retrieved_at:fallback.cache_fetched_at,fresh_until:fallback.cache_fresh_until};
            // Prefer the richer excerpt when both paths retrieved the same URL.
            const index=pages.findIndex(p=>canonical(p.url)===canonical(page.url));
            if(index<0)pages.push(page);else if(page.highlights.join('').length>pages[index].highlights.join('').length)pages[index]=page;
            if(readerEvidence(lead,[page]).matched)limited=null;
            targets.unshift(...(page.links||[]).filter(url=>!directVisited.has(canonical(url))));
            if(researchHasContext(lead,pages)){limited=null;break}
          }
        }catch(error){directFailures.push(error.code||'source_unavailable');if(['daily_limit','provider_queue'].includes(error.code)){limited=error;break}/* Preserve other sources within the shared deadline. */}
        if(signal.aborted)break;
      }
    }
    const diagnostics={mode:'keyword',discovered:0,direct_attempts:directAttempts,direct_failures:directFailures,reader_mode:(await freeResearchStatus(env)).mode};
    if(!researchHasContext(lead,pages)&&Date.now()-started<40000){
      try{
        const urls=await discoverOfficialPages(env,session,lead,d);
        const target=urls.find(url=>!visited.has(canonical(url))&&!pages.some(p=>canonical(p.url)===canonical(url)));
        if(target&&Date.now()-started<48000){pages.push((await companyPage(env,session,lead,target,6000)).page);diagnostics.discovered++;if(researchHasContext(lead,pages))limited=null;}
      }catch{/* Discovery is optional; only a fetched original page can add evidence. */}
    }
    if(pages.length&&!researchHasContext(lead,pages)&&Date.now()-started<50000){
      try{const ranked=await rankEvidencePassages(env,session,lead,pages);pages.splice(0,pages.length,...ranked.pages);diagnostics.mode=ranked.mode;}catch{/* Existing keyword evidence survives semantic-service failure. */}
    }
    const found=readerEvidence(lead,pages);found.retrieval=diagnostics;
    found.locations=mergeCompanyLocations(pages.flatMap(p=>p.locations||[]));found.location_version=1;
    found.cache_fetched_at=pages.map(p=>p.retrieved_at).sort()[0];found.cache_fresh_until=pages.map(p=>p.fresh_until).sort()[0];
    if(!found.evidence.length&&!found.locations.length){const error=limited||new Failure('No usable company text was available. Add an official company overview or investor page.',503,600,'source_unavailable');error.retrieval=diagnostics;throw error;}
    if(limited){found.message+=' Some linked company pages could not be refreshed.';if(!researchHasContext(lead,pages))Object.assign(found,{stale:true,refresh_error:limited.publicMessage,retry_code:limited.code,retry_after:new Date(Date.now()+limited.retryAfter*1000).toISOString()})}
    return found;
  },{shared:!preferred&&PUBLIC_CACHE_KEYS.has(publicKey),ttl:COMPANY_TTL,fallback:snapshots['exa:'+d+'|'+lead.company.toLowerCase()]});
  return {...result,engine:RESEARCH_ENGINE,brief_version:4};
}
async function propertyImage(env,session,lead){
 const request=aerialRequest(lead.property_context);if(!request)return {status:'unavailable'};
 const shared=PUBLIC_CACHE_KEYS.has('census:'+JSON.stringify(censusParams(lead)).toLowerCase());
 const result=await cachedResearch(env,session,'aerial-v1:'+JSON.stringify(lead.property_context.coordinates),async()=>{
  const day=Math.floor(seconds()/DAY),minute=Math.floor(seconds()/60);
  await count(env,`aerial:${session.id}:${day}`,20,(day+1)*DAY);await count(env,`aerial:global:${minute}`,12,(minute+1)*60);
  return {image:await aerialImage(await fetch(request.url,request.options))};
 },{shared,ttl:DAY});
 return result.image?{status:'found',image:result.image,provider:'USGS / USDA NAIP',stale:!!result.stale}:{status:'unavailable',retry_after:result.retry_after};
}
async function registryResearch(env,session,lead){
  if(!lead.company)return {status:'incomplete'};
  const key='gleif:'+lead.company.toLowerCase();
  return cachedResearch(env,session,key,async()=>registryEvidence(lead.company,await provider(env,session,'gleif',{company:lead.company})),{shared:PUBLIC_CACHE_KEYS.has(key),ttl:ADDRESS_TTL});
}
async function propertyResearch(env,session,lead){
  if(!['US','USA','UNITED STATES','UNITED STATES OF AMERICA','PR','PUERTO RICO'].includes(lead.country.toUpperCase()))return {status:'unsupported',message:'Census lookup is available for U.S. and Puerto Rico addresses.'};
  if(!lead.property_address)return {status:'incomplete',message:'Paste the full property address to locate it. Company offices are shown separately.'};
  if(!/^\s*\d/.test(lead.property_address))return {status:'incomplete',message:'Include a street number and address. A property name alone cannot establish its location.'};
  const params=censusParams(lead);
  const key='census:'+JSON.stringify(params).toLowerCase();
  return cachedResearch(env,session,key,async()=>{
    const first=propertyEvidence((await provider(env,session,'census',params)).result.addressMatches,censusURL(params));
    // Only an explicit no-match gets a second shape. Never turn multiple matches
    // or a provider outage into a guessed location.
    const fallback=censusFallbackParams(lead);
    if(first.status!=='unmatched'||JSON.stringify(fallback)===JSON.stringify(params))return first;
    try{const result=propertyEvidence((await provider(env,session,'census',fallback)).result.addressMatches,censusURL(fallback));return {...result,lookup_method:'Full-address fallback; unit details omitted if present'}}
    catch{return {...first,message:first.message+' The alternate address lookup is temporarily unavailable.'}}
  },{shared:PUBLIC_CACHE_KEYS.has(key),ttl:ADDRESS_TTL,fallback:snapshots[key]});
}
async function areaResearch(env,session,location){
 if(!areaRequest(location))return {version:1,status:'no_geography'};
 const result=await cachedResearch(env,session,'area-v1:'+location.tract,async()=>areaEvidence(await provider(env,session,'area',location),location),{ttl:7*DAY});
 return {version:1,status:'unavailable',...result};
}
async function research(env,session,id,onPartial=null){
  const locked=await stmt(env,'UPDATE visitor_leads SET processing_until=? WHERE id=? AND session_id=? AND processing_until<? RETURNING data,version',seconds()+65,id,session.id,seconds()).first();
  if(!locked){await getLead(env,session,id);throw new Failure('Research is already running for this lead. The queue will retry shortly.',409,65,'lead_busy')}
  const original=JSON.parse(locked.data),failures=[];let company,location,registry;
  try{
    const tracked=(source,work)=>trackRun(env,session,id,source,work);
    const propertyJob=tracked('property',()=>propertyResearch(env,session,original));
    // Contact and company research start together; each brief is saved and
    // streamed independently, without waiting on location or registry lookups.
    const professionalJob=tracked('contact',()=>professionalResearch(env,session,original)).then(async context=>{
      if(onPartial)for(let i=0;i<5;i++){
        const latest=await getLead(env,session,id);
        if(professionalKey(latest.lead)!==professionalKey(original))return context;
        const early=presentLead({...latest.lead,professional_context:context});
        const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(early),id,session.id,latest.version).run();
        if(saved.meta.changes){onPartial(early,'professional');break}
      }
      return context;
    });
    const contextJob=Promise.allSettled([propertyJob,tracked('entity',()=>registryResearch(env,session,original)),propertyJob.then(location=>tracked('area',()=>areaResearch(env,session,location))),professionalJob]);
    const [companyResult]=await Promise.allSettled([tracked('company',()=>companyResearch(env,session,original))]);
    if(onPartial){
      const data=companyResult.status==='fulfilled'?companyResult.value:{stale:true,refresh_error:'Company research is temporarily unavailable.',retry_after:new Date(Date.now()+600000).toISOString()};
      const earlyCompany={...data,evidence:retainCompanyEvidence(data.evidence,original.evidence,data.stale),message:data.message||'Company evidence is not yet available.'};
      for(let i=0;i<5;i++){
        const latest=await getLead(env,session,id);
        const early=qualify({...latest.lead,context_pending_until:new Date(Date.now()+65000).toISOString()},earlyCompany,latest.lead.property_context||{},data.stale?[data.refresh_error]:[]);
        const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(early),id,session.id,latest.version).run();
        if(saved.meta.changes){onPartial(early,'company');break}
      }
    }
    const [propertyResult,registryResult,areaResult,professionalResult]=await contextJob;
    const professional=professionalResult.status==='fulfilled'?professionalResult.value:{status:'unavailable',input_key:professionalKey(original),retry_after:new Date(Date.now()+600000).toISOString()};
    const fallback=(result,label)=>result.status==='fulfilled'?result.value:{stale:true,refresh_error:label+' is temporarily unavailable. Previous results are preserved.',retry_after:new Date(Date.now()+600000).toISOString()};
    const companyData=fallback(companyResult,'Company research'),propertyData=fallback(propertyResult,'Property lookup');
    const registryData=fallback(registryResult,'Legal-entity lookup');
    registry={...(registryData.stale?original.registry_context:{}),...registryData};
    company={...companyData,evidence:retainCompanyEvidence(companyData.evidence,original.evidence,companyData.stale),message:companyData.message||'Company evidence is not yet available.'};
    location={...(propertyData.stale?original.property_context:{}),...propertyData};
    let area=areaResult.status==='fulfilled'?areaResult.value:{version:1,status:'unavailable'};
    if(area.status!=='available'&&original.area_context?.status==='available'&&original.area_context.tract===location.tract)area={...original.area_context,stale:true,version:1,retry_after:area.retry_after};
    if(area.status==='available'&&propertyData.stale)area.stale=true;
    if(company.stale)failures.push(company.refresh_error);
    if(location.stale){location.status||='unavailable';location.message=location.refresh_error;failures.push(location.refresh_error)}
    // Compare-and-swap retries merge draft edits saved while external requests ran.
    for(let i=0;i<5;i++){
      const latest=await getLead(env,session,id);
      const result=qualify({...latest.lead,context_pending_until:null,registry_context:registry,area_context:area,professional_context:professional},company,location,failures);
      const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(result),id,session.id,latest.version).run();
      if(saved.meta.changes){await saveAssessment(env,session,result,'research');await audit(env,session,'lead.research');return result}
    }
    throw new Failure('The draft changed during research. Please retry.',409);
  }finally{await stmt(env,'UPDATE visitor_leads SET processing_until=0 WHERE id=? AND session_id=?',id,session.id).run()}
}
async function route(req,env,ctx){
  const url=new URL(req.url),path=url.pathname;
  if(!env.PUBLIC_ORIGIN||url.origin!==env.PUBLIC_ORIGIN||url.protocol!=='https:')throw new Failure('Request origin rejected',403);
  if(path==='/api/email'||path.startsWith('/api/email/'))throw new Failure('Not found',404);
  if(!['GET','HEAD','POST'].includes(req.method))throw new Failure('Method not allowed',405);
  const origin=req.headers.get('Origin');
  if(path.startsWith('/api/')&&((origin&&origin!==env.PUBLIC_ORIGIN)||req.headers.get('Sec-Fetch-Site')==='cross-site'))throw new Failure('Request origin rejected',403);
  if(req.method==='POST'&&origin!==env.PUBLIC_ORIGIN&&!['/api/sheets/ingest','/api/sheets/process','/api/sheets/review'].includes(path))throw new Failure('Request origin rejected',403);
  if(path.startsWith('/api/connections/'))throw new Failure('Not found',404);
  if(['GET','HEAD'].includes(req.method)&&Object.hasOwn(brandImages,path))return new Response(req.method==='HEAD'?null:Uint8Array.from(atob(brandImages[path]),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});
  if(['GET','HEAD'].includes(req.method)&&path==='/company-brands.js')return new Response(req.method==='HEAD'?null:brandsJS,{headers:{'Content-Type':'text/javascript; charset=utf-8'}});
  if(['GET','HEAD'].includes(req.method)&&path==='/area.js')return new Response(req.method==='HEAD'?null:areaJS,{headers:{'Content-Type':'text/javascript; charset=utf-8'}});
  if(['GET','HEAD'].includes(req.method)&&path==='/research-stream.js')return new Response(req.method==='HEAD'?null:streamJS,{headers:{'Content-Type':'text/javascript; charset=utf-8'}});
  const staticFiles={'/street-view.js':[streetViewJS,'text/javascript; charset=utf-8'],'/sheets-ui.js':[sheetsUIJS,'text/javascript; charset=utf-8'],'/import-data.js':[importDataJS,'text/javascript; charset=utf-8'],'/import-ui.js':[importUIJS,'text/javascript; charset=utf-8'],'/vendor/xlsx.mjs':[spreadsheetJS,'text/javascript; charset=utf-8'],'/company-fit.js':[companyFitJS,'text/javascript; charset=utf-8'],'/decision-ui.js':[decisionUIJS,'text/javascript; charset=utf-8'],'/account-visuals.js':[visualsJS,'text/javascript; charset=utf-8'],'/map-data.js':[mapDataJS,'text/javascript; charset=utf-8'],'/export.js':[exportJS,'text/javascript; charset=utf-8'],'/':[html,'text/html; charset=utf-8'],'/app.js':[appJS,'text/javascript; charset=utf-8'],'/research.js':[researchJS,'text/javascript; charset=utf-8'],'/workflow.js':[workflowJS,'text/javascript; charset=utf-8'],'/sales-context.js':[salesContextJS,'text/javascript; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/samples.csv':[samples,'text/csv; charset=utf-8']};
  if(['GET','HEAD'].includes(req.method)&&staticFiles[path])return new Response(req.method==='HEAD'?null:staticFiles[path][0],{headers:{'Content-Type':staticFiles[path][1]}});
  if(!path.startsWith('/api/')&&path!=='/template.csv')throw new Failure('Not found',404);
  // The platform supplies this header; it is only an extra throttle, never an authorization signal.
  const network=await digest((env.RATE_LIMIT_SALT||'')+'|'+(req.headers.get('CF-Connecting-IP')||'shared-edge'));
  await count(env,`request:${network}:${Math.floor(seconds()/60)}`,120,seconds()+120);
  if(['/api/sheets/ingest','/api/sheets/process','/api/sheets/review'].includes(path))return json(await sheetWebhook(req,env,ctx,{stmt,digest,readBody,count,add,research,trackRun,saveAssessment}));
  if(path==='/api/session'&&req.method==='GET'){
    await cleanup(env);
    let session=await sessionFor(req,env),token;
    if(!session){
      await count(env,`new-session:${network}:${Math.floor(seconds()/3600)}`,10,seconds()+3600);
      token=random();session={id:await digest(token),csrf:random(),expires:seconds()+DAY};
      const created=await stmt(env,'INSERT INTO visitor_sessions(id,csrf,expires) SELECT ?,?,? WHERE (SELECT count(*) FROM visitor_sessions)<100',session.id,session.csrf,session.expires).run();
      if(!created.meta.changes)throw new Failure('The assessment is busy. Please try again later.',429);
    }
    const connection=await sheetStatus(env,session,stmt);const res=json({csrf:session.csrf,expires_at:session.expires,public_assessment:true,has_sheet_connection:!!connection});
    if(token)res.headers.set('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAY}`);
    return res;
  }
  const session=await requireSession(req,env);
  if(req.method==='GET'){
    if(path==='/api/activity'){const id=url.searchParams.get('id');if(id)await getLead(env,session,id);return json(await historyFor(env,session,id))}
    if(path==='/api/sheets/script'){const c=await sheetStatus(env,session,stmt);if(!c)throw new Failure('Connect a sheet first.',404);return json({script:appsScript({origin:env.PUBLIC_ORIGIN,token:'',spreadsheet_id:c.spreadsheet_id,tab_name:c.tab_name},importDataJS)})}
    if(path==='/api/sheets')return json({connection:await sheetStatus(env,session,stmt)});
    if(path==='/api/export'){
      const ids=new Set(url.searchParams.getAll('id'));if(ids.size>100)throw new Failure('Export up to 100 leads.');
      const records=await stmt(env,'SELECT data FROM visitor_leads WHERE session_id=? ORDER BY rowid',session.id).all();
      const leads=records.results.map(r=>presentLead(JSON.parse(r.data))).filter(l=>!l.sample_retired&&(!ids.size||ids.has(l.id)));
      return new Response(leadsCSV(leads),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inbound-leads.csv"'}});
    }
    if(path==='/api/state'){
      const rows=await stmt(env,'SELECT id,data,version,processing_until FROM visitor_leads WHERE session_id=? ORDER BY rowid',session.id).all();
      const records=await updateExampleScenarios(env,session,rows.results);
      return json({leads:records.map(r=>presentLead(JSON.parse(r.data))).filter(l=>!l.sample_retired),research_provider:'Company website via Jina Reader or direct public HTML',research_service:{...await freeResearchStatus(env),additional_providers:[await tavilyStatus(env)]},mode:'assessment',expires_at:session.expires,sheet_connection:await sheetStatus(env,session,stmt)});
    }
    if(path==='/template.csv')return new Response([...REQUIRED,...OPTIONAL].join(',')+'\r\n',{headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="lead-template.csv"'}});
    throw new Failure('Not found',404);
  }
  if(req.method!=='POST')throw new Failure('Method not allowed',405);
  if(!equal(req.headers.get('X-CSRF-Token'),session.csrf))throw new Failure('Request verification failed. Reload and try again.',403);
  const body=await readBody(req);
  await count(env,`write:${session.id}:${Math.floor(seconds()/60)}`,40,seconds()+120);
  if(path==='/api/sheets/connect'){
    const settings=sheetSettings(body),token=random(),expires=seconds()+90*DAY;
    const existing=await stmt(env,'SELECT id FROM sheet_connections WHERE session_id=?',session.id).first(),id=existing?.id||crypto.randomUUID();
    await env.DB.batch([
      stmt(env,'INSERT INTO sheet_connections(id,session_id,token_hash,spreadsheet_id,tab_name,created_at,expires) VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash,spreadsheet_id=excluded.spreadsheet_id,tab_name=excluded.tab_name,created_at=excluded.created_at,expires=excluded.expires,last_sync_at=NULL,last_error=NULL',id,session.id,await digest(token),settings.spreadsheet_id,settings.tab_name,seconds(),expires),
      stmt(env,'UPDATE visitor_sessions SET expires=? WHERE id=?',expires,session.id)
    ]);
    const res=json({script:appsScript({origin:env.PUBLIC_ORIGIN,token,...settings},importDataJS),expires_at:expires});
    const browserToken=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    res.headers.set('Set-Cookie',`${COOKIE}=${browserToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${90*DAY}`);return res;
  }
  if(path==='/api/sheets/disconnect'){await stmt(env,'DELETE FROM sheet_connections WHERE session_id=?',session.id).run();return json({ok:true});}
  if(path==='/api/session/delete'){
    const auditResult=audit(env,session,'session.delete');await auditResult;
    await stmt(env,'DELETE FROM visitor_sessions WHERE id=?',session.id).run();
    const res=json({ok:true});res.headers.set('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return res;
  }
  if(path==='/api/samples'){await retireUntouchedExamples(env,session);return json(await add(env,session,researchedExamples,true));}
  if(path==='/api/add')return json(await add(env,session,[body]));
  if(path==='/api/import-rows'){let rows;try{rows=normalizeRows(body.rows)}catch(e){throw new Failure(e.message)}return json(await add(env,session,rows));}
  if(path==='/api/import'){
    if(typeof body.csv!=='string')throw new Failure('CSV text required');
    const parsed=Papa.parse(body.csv.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim().toLowerCase().replaceAll(' ','_')});
    if(parsed.errors.length)throw new Failure('Check the CSV columns and quoted values.');
    if(['name','email','company'].some(k=>!parsed.meta.fields?.includes(k)))throw new Failure('CSV needs name, email and company columns.');
    if(!parsed.data.length||parsed.data.length>100)throw new Failure('Import between 1 and 100 leads');
    return json(await add(env,session,parsed.data));
  }
  if(!['/api/process','/api/professional','/api/save','/api/update','/api/draft','/api/logo','/api/property-image','/api/street-view'].includes(path))throw new Failure('Not found',404);
  const record=await getLead(env,session,body.id),lead=record.lead;lead.inquiry=cleanInquiry(lead.inquiry);
  if(path==='/api/street-view'){
    if(!lead.property_address)throw new Failure('Add the property address first.');
    if(body.address_key!==propertyViewKey(lead))throw new Failure('The address changed. Reopen this lead and select its Street View again.',409);
    const value=String(body.embed||'').trim(),url=googleStreetViewEmbed(value);
    if(value&&!url)throw new Failure('Use the Street View code from Google Maps: Share → Embed a map → Copy HTML.');
    lead.street_view=url?{url,address_key:propertyViewKey(lead)}:null;
    const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(lead),lead.id,session.id,record.version).run();
    if(!saved.meta.changes)throw new Failure('The lead changed while saving. Please try again.',409);
    return json({saved:true});
  }
  if(path==='/api/professional'){
    const context=await trackRun(env,session,lead.id,'contact',()=>professionalResearch(env,session,lead));
    for(let i=0;i<5;i++){
      const current=await getLead(env,session,lead.id);if(professionalKey(current.lead)!==professionalKey(lead))throw new Failure('Lead details changed. Research the updated contact.',409);
      const updated=presentLead({...current.lead,professional_context:context});
      const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(updated),lead.id,session.id,current.version).run();
      if(saved.meta.changes){await saveAssessment(env,session,updated,'contact research');return json(updated)}
    }
    throw new Failure('Lead changed during research. Please retry.',409);
  }
  if(path==='/api/logo')return json(await trackRun(env,session,lead.id,'logo',()=>companyLogo(env,session,lead)));
  if(path==='/api/property-image')return json(await trackRun(env,session,lead.id,'imagery',()=>propertyImage(env,session,lead)));
  if(path==='/api/process'){
    try{await count(env,`research:${session.id}:${Math.floor(seconds()/60)}`,6,seconds()+120)}catch{throw new Failure('Company research is queued. Your draft remains available.',429,60-seconds()%60,'provider_queue')}
    if(body.stream!==true)return json(await research(env,session,body.id));
    let closed=false;
    const stream=new ReadableStream({start(controller){
      const send=value=>{if(!closed)try{controller.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'))}catch{closed=true}};
      const task=research(env,session,body.id,(lead,type)=>send({type,lead})).then(lead=>send({type:'complete',lead})).catch(error=>send({type:'error',error:error instanceof Failure?error.message:'Research could not finish. Reload to see saved results.',status:error instanceof Failure?error.status:500,code:error instanceof Failure?error.code:'unavailable',retry_after:new Date(Date.now()+(error instanceof Failure?error.retryAfter:60)*1000).toISOString()})).finally(()=>{if(!closed){closed=true;controller.close()}});
      ctx.waitUntil(task);
    },cancel(){closed=true}});
    return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8'}});
  }
  if(path==='/api/update'){
    if(record.processing_until>=seconds())throw new Failure('Wait for research to finish before changing lead details.',409);
    for(const k of [...REQUIRED,...OPTIONAL])if(k in body)lead[k]=String(body[k]??'').trim().slice(0,k==='inquiry'?2000:1000);
    if(lead.research_url&&!sourceURL(lead.research_url,domain(lead)))throw new Failure('Use an HTTPS research page on the company website or its investor subdomain.');
    lead.inquiry=cleanInquiry(lead.inquiry);
    const changed=[...REQUIRED,...OPTIONAL].some(k=>lead[k]!==JSON.parse(record.data)[k]);
    if(changed){
      lead.sample_lead=false;lead.sample_retrieved_at=null;
      if(['name','company','website','email'].some(k=>lead[k]!==JSON.parse(record.data)[k]))lead.professional_context=null;
      const edited=lead.reviewed||lead.draft_edited;
      lead.previous_draft={subject:lead.subject,draft:lead.draft,draft_basis:lead.draft_basis||[]};
      const researchChanged=[...REQUIRED.filter(k=>k!=='name'),'country','website','postal_code','research_url'].some(k=>lead[k]!==JSON.parse(record.data)[k]);
      const sourceOnly=researchChanged&&lead.processed_at&&[...REQUIRED.filter(k=>k!=='name'),'country','website','postal_code'].every(k=>lead[k]===JSON.parse(record.data)[k]);
      if(sourceOnly)Object.assign(lead,{automation_pending:true,company_fresh_until:null,company_retry_after:null,company_retry_code:null,company_stale:true,research_state:'partial',company_error:'Official page updated. Refreshing company evidence.',research_note:'Official page updated. Refreshing company evidence.'});
      else if(researchChanged)Object.assign(lead,{automation_pending:true,issues:validate(lead),status:'New',score:null,evidence:[],property_context:{},area_context:{},registry_context:{},research_brief:null,processed_at:null,company_fetched_at:null,company_fresh_until:null,company_retry_after:null,cached:false,company_stale:false,research_state:'pending',confidence:'Not researched',research_note:'Record updated. Research queued.'});
      if(['email','company','website'].some(k=>lead[k]!==JSON.parse(record.data)[k]))Object.assign(lead,{qualifications:{},qualification_evidence:{},qualification_history:[]});
      if(edited){lead.draft_stale=true;lead.draft_edited=true;lead.reviewed=false}else{const brief=presentLead(lead).research_brief;Object.assign(lead,draftFor(lead,brief.signals[0].supported,brief.signals[1].supported,brief),{reviewed:false})}
    }
  }else if(path==='/api/draft'){
    const current={subject:lead.subject,draft:lead.draft,draft_basis:lead.draft_basis||[]};
    if(body.restore===true){
      if(!lead.previous_draft)throw new Failure('No previous saved draft is available.');
      Object.assign(lead,lead.previous_draft,{draft_edited:true,draft_stale:true,reviewed:false});
    }else{
      const presented=presentLead(lead),brief=presented.research_brief;
      Object.assign(lead,draftFor(lead,brief.signals[0].supported,brief.signals[1].supported,brief),{reviewed:false});
    }
    lead.previous_draft=current;lead.would_send='';lead.feedback_reason='';lead.reviewed_draft_id=null;
  }else{
    const previousContext={...lead},evidenceBefore=JSON.stringify(lead.qualification_evidence||{});
    const contextBefore=JSON.stringify([lead.inquiry||'',qualificationAnswers(lead.qualifications)]);
    if('inquiry' in body)lead.inquiry=cleanInquiry(String(body.inquiry??'').trim().slice(0,2000));
    if(body.qualifications&&typeof body.qualifications==='object'&&!Array.isArray(body.qualifications))lead.qualifications=qualificationAnswers({...qualificationAnswers(lead.qualifications),...body.qualifications});
    if(body.qualifications&&typeof body.qualifications==='object'&&!Array.isArray(body.qualifications))recordQualification(lead,previousContext,{reconfirm:body.reconfirm===true});
    if(contextBefore!==JSON.stringify([lead.inquiry||'',qualificationAnswers(lead.qualifications)])||evidenceBefore!==JSON.stringify(lead.qualification_evidence||{})){
      if(lead.reviewed||lead.draft_edited){lead.draft_stale=true;lead.reviewed=false;lead.draft_edited=true}
      else {const brief=presentLead(lead).research_brief;Object.assign(lead,draftFor(lead,brief.signals[0].supported,brief.signals[1].supported,brief))}
    }
    if(['subject','draft'].some(k=>k in body&&String(body[k])!==lead[k]))lead.draft_edited=true;
    if('would_send' in body){if(!['','Would send','Would not send'].includes(body.would_send))throw new Failure('Choose Would send or Would not send.');lead.would_send=body.would_send}
    if('feedback_reason' in body)lead.feedback_reason=String(body.feedback_reason||'').slice(0,1500);
    for(const k of ['subject','draft','notes','feedback'])if(k in body)lead[k]=String(body[k]??'').slice(0,10000);
    if('would_send' in body)lead.reviewed_draft_id=lead.would_send?await digest(JSON.stringify([lead.subject,lead.draft])):null;
    if('reviewed' in body){lead.reviewed=body.reviewed===true;if(lead.reviewed){lead.draft_stale=false;lead.draft_research_signature=draftSignature(lead)}}
  }
  let result;
  try{result=await stmt(env,'UPDATE visitor_leads SET data=?,identity=?,version=version+1 WHERE id=? AND session_id=? AND version=?'+(path==='/api/update'?' AND processing_until<?':''),JSON.stringify(lead),identity(lead),lead.id,session.id,record.version,...(path==='/api/update'?[seconds()]:[])).run()}
  catch(e){if(String(e.message).includes('UNIQUE'))throw new Failure('A lead with this email, company and property already exists.');throw e}
  if(!result.meta.changes)throw new Failure('This record changed. Reload and try again.',409);
  await saveAssessment(env,session,lead,path.slice(5));
  await audit(env,session,path==='/api/save'?'lead.save':path==='/api/draft'?'draft.regenerate':'lead.update');return json({ok:true});
}
export default {
  async fetch(req,env,ctx){
    try{return headers(await route(req,env,ctx))}catch(e){const res=json({error:e instanceof Failure?e.message:'The request could not be completed. Please try again.',...(e instanceof Failure?{code:e.code,retry_after:new Date(Date.now()+e.retryAfter*1000).toISOString()}: {})},e instanceof Failure?e.status:500);if(e.status===429)res.headers.set('Retry-After',String(e.retryAfter));return headers(res)}
  },
  async scheduled(event,env,ctx){ctx.waitUntil(cleanup(env))}
};

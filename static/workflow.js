import {companyFit,leadPriority} from './company-fit.js';
export const normalizeSearch=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}@.]+/gu,' ').trim();
function near(a,b){
 if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++}return edits+(i<a.length||j<b.length?1:0)<=1;
}
export function matchesLead(lead,query){
 const text=normalizeSearch(['name','company','email','city','state','country','property_address','website'].map(k=>lead[k]).join(' ')),words=text.split(/\s+/);
 return normalizeSearch(query).split(/\s+/).filter(Boolean).every(term=>text.includes(term)||(/^[a-z]{5,}$/.test(term)&&words.some(w=>near(term,w))));
}
export const needsResearch=lead=>['pending','blocked'].includes(lead.research_state)||!!lead.company_stale||!!lead.needs_location_refresh||!!lead.needs_brief_refresh;
export function autoResearchDue(lead,time=Date.now()){
 if(!lead||lead.sample_lead||lead.research_state==='needs_website')return false;
 if(Date.parse(lead.company_retry_after)>time)return false;
 return !!lead.needs_brief_refresh||!!lead.needs_location_refresh||!!lead.needs_area_refresh||!(Date.parse(lead.company_fresh_until)>time);
}

// A bounded queue shares repeated opens and prioritizes the most recently opened lead.
export function researchQueue(run,{concurrency=2,interval=0,now=Date.now,schedule=setTimeout}={}){
 const waiting=[],jobs=new Map();let active=0,nextStart=0,timer=null;
 function pump(){if(timer||active>=concurrency||!waiting.length)return;const delay=nextStart-now();if(delay>0){timer=schedule(()=>{timer=null;pump()},delay);return}while(active<concurrency&&waiting.length){const job=waiting.shift();active++;nextStart=now()+interval;const finish=()=>{active--;jobs.delete(job.id);pump()};Promise.resolve().then(()=>run(job.id)).then(value=>{finish();job.resolve(value)},error=>{finish();job.reject(error)});if(interval){pump();break}}}
 return {get size(){return jobs.size},has:id=>jobs.has(id),add(id){if(jobs.has(id))return jobs.get(id).promise;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});const job={id,promise,resolve,reject};jobs.set(id,job);waiting.unshift(job);pump();return promise}};
}
export function autoResearchPlan(lead,attempt={},time=Date.now()){
 if(!lead||lead.sample_lead||lead.research_state==='needs_website'||!lead.needs_brief_refresh&&!lead.needs_location_refresh&&!lead.needs_area_refresh&&Date.parse(lead.company_fresh_until)>time)return null;
 if(['daily_limit','site_blocked','source_unavailable','provider_auth','provider_quota'].includes(lead.company_retry_code))return null;
 // Initial attempt plus two automatic retries. Manual refresh resets this budget.
 if((attempt.count||0)>=3)return null;
 return Math.max(time,Date.parse(lead.company_retry_after)||0,(attempt.at||0)+11000);
}
// Uploads and research-input edits are persisted as pending on the server, so
// reloads resume the same visitor's work without storing contacts in localStorage.
export function automaticCandidate(leads,selected,attempts=new Map(),time=Date.now()){
 return leads.filter(l=>l.automation_pending||l.id===selected).map(lead=>({lead,at:autoResearchPlan(lead,attempts.get(lead.id),time)})).filter(job=>job.at!==null).sort((a,b)=>a.at-b.at||(a.lead.id===selected?-1:b.lead.id===selected?1:Date.parse(a.lead.created_at)-Date.parse(b.lead.created_at)))[0]||null;
}
export const researchLabel=lead=>lead.company_stale?({daily_limit:'Daily allowance reached',site_blocked:'Company page unavailable',source_unavailable:'Try another company page',provider_auth:'Research needs attention',provider_quota:'Provider allowance reached'}[lead.company_retry_code]||(lead.evidence?.length?'Saved research · refresh pending':'Research waiting')):lead.company_snapshot?'Saved sources':({pending:'Ready to research',needs_website:'Company website needed',needs_confirmation:'Confirm company',partial:'Company research incomplete',blocked:'Research paused',complete:'Company researched'}[lead.research_state]||'Ready to research');

export function contactFit(lead){
 const fit=companyFit(lead);
 return fit;
}
export function sortContacts(leads,order='priority'){
 const byName=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base',numeric:true})||String(a.id).localeCompare(String(b.id));
 return [...leads].sort((a,b)=>{
  if(order==='name-asc')return byName(a,b);
  if(order==='name-desc')return -byName(a,b);
  if(order==='newest')return (Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||byName(a,b);
  if(order==='lead-priority')return leadPriority(b).rank-leadPriority(a).rank||byName(a,b);
  if(order==='fit-desc'||order==='fit-asc'){
   const x=contactFit(a).rank,y=contactFit(b).rank;
   if(x===null||y===null)return x===y?byName(a,b):x===null?1:-1;
   return (order==='fit-desc'?y-x:x-y)||byName(a,b);
  }
  return (b.decision?.action.rank??0)-(a.decision?.action.rank??0)||Number(a.reviewed)-Number(b.reviewed)||(b.priority?.rank??0)-(a.priority?.rank??0)||(b.priority?.total??-1)-(a.priority?.total??-1)||(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||byName(a,b);
 });
}

export const emailStatusLabel=status=>({'Draft to review':'Email · Review draft','Recheck draft':'Email · Recheck','Draft reviewed':'Email · Reviewed','New':'Research queued'}[status]||status);

// Completion describes the research attempt, separately from fit and sales intent.
export function researchProgress(lead,{busy=false,contactBusy=false,retryAt=null,time=Date.now()}={}){
 if(busy||contactBusy||Date.parse(lead.context_pending_until)>time)return {kind:'running',label:'Researching',detail:contactBusy&&!busy?'Updating the contact brief.':'Company, contact and property checks are running.'};
 if(lead.research_state==='needs_website')return {kind:'action',label:'Company website needed',detail:'Add the official company website to start research.',action:'Edit company details'};
 if(lead.company_stale||lead.research_state==='blocked'){
  const code=lead.company_retry_code,hasSources=!!lead.research_brief?.sources?.length;
  const reason=({provider_auth:'The research connection needs attention from the site owner.',provider_quota:'The free research allowance is exhausted.',daily_limit:'Today’s research allowance is used.',site_blocked:'The company page could not be accessed.',source_unavailable:'The company page could not be read.'})[code]||'A company lookup did not finish.';
  return {kind:'interrupted',label:hasSources?'Refresh interrupted · saved research available':'Research interrupted',detail:reason+(retryAt!==null?' Another attempt is scheduled while this page is open.':'') ,action:['site_blocked','source_unavailable'].includes(code)?'Try another official page':'View research status'};
 }
 if(!lead.processed_at)return {kind:'queued',label:'Research queued',detail:'Research starts automatically while this workspace is open.'};
 if(lead.research_state==='needs_confirmation')return {kind:'action',label:'Company match needs review',detail:'Check the company name and website before using the research.',action:'Edit company details'};
 const missing=[];const p=lead.professional_context;
 if(p?.stale||p?.status==='unavailable'||lead.property_context?.stale||lead.property_context?.status==='unavailable')return {kind:'interrupted',label:'Some checks were interrupted',detail:'Available research is saved. A contact or property lookup could not finish.',action:'View research details'};
 const sourcedExample=lead.sample_lead&&lead.company_snapshot&&lead.research_brief?.classification?.kind!=='unclassified'&&lead.research_brief?.classification?.evidence?.length;
 if(!sourcedExample&&!lead.research_brief?.portfolio&&!lead.research_brief?.footprint&&!lead.research_brief?.context?.length)missing.push('company detail');
 if(p?.status!=='complete'||p?.match!=='name_company_match'||p?.stale)missing.push('contact role');
 if(lead.property_address&&(lead.property_context?.status!=='matched'||lead.property_context?.stale))missing.push('property address match');
 return missing.length?{kind:'limited',label:'Research finished · limited evidence',detail:'Available facts are shown. Still unverified: '+missing.join(', ')+'.',action:'View research details'}:{kind:'finished',label:lead.company_snapshot?'Saved research available':'Research finished',detail:'Review the sourced facts below. Completed checks do not establish buying intent.'};
}

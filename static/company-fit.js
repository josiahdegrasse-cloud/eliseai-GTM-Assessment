// Shared UI/API/export eligibility: sourced housing operations, outside focus, or unclear.
// Company size, contact role and buying intent are separate facts.
export function sourceHasOldDate(source,time=Date.now()){
 const cutoff=new Date(time).getUTCFullYear()-1;
 // Retrieval time is not publication time. Archived article URLs/titles can
 // carry the only reporting-period evidence when a provider omits metadata.
 const years=[...String((source?.url||'')+' '+(source?.title||'')).matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>Number(m[1]));
 const published=Date.parse(source?.published_at);
 return years.some(y=>y<cutoff||y>new Date(time).getUTCFullYear())||!!source?.published_at&&(!Number.isFinite(published)||published>time||time-published>548*86400000);
}
function classifyFit(lead,brief=lead.research_brief,time=Date.now()){
 const c=brief?.classification, sources=brief?.sources||[];
 const matched=new Set(sources.filter(s=>s.name_matched).map(s=>s.id));
 const evidence=(c?.evidence||[]).filter(e=>matched.has(e.source_id));
 const pending=lead.company_stale||lead.automation_pending||['pending','blocked'].includes(lead.research_state)||!lead.processed_at;
 const base={saved:!!(lead.company_stale||lead.company_snapshot||(lead.company_fresh_until&&Date.parse(lead.company_fresh_until)<=time)),research_status:pending?'pending':'complete',evidence};
 if(!evidence.length||c?.conflict||c?.kind==='unclassified')return {...base,label:'Fit unclear',tone:'unknown',rank:null,reason:c?.conflict?'Published sources disagree about residential operations; review their scope and dates.':'Available evidence does not establish a clear operating model.',evidence:c?.conflict?evidence:[]};
 if(c.kind==='housing_operator'&&evidence.some(e=>e.kind==='housing_operator'))return {...base,label:'High fit',tone:'high',rank:2,reason:'The company describes owning, managing or operating residential housing.'+(c.mixed_business?' Its other business lines do not remove that housing fit.':''),evidence:evidence.filter(e=>e.kind==='housing_operator')};
 if(['software_vendor','advisor','broker','service_provider','commercial_operator'].includes(c.kind))return {...base,label:'Low fit',tone:'low',rank:0,reason:`The published business model is ${c.label.toLowerCase()}, outside this assignment’s residential-owner and operator focus.`,evidence:evidence.filter(e=>e.kind===c.kind)};
 return {...base,label:'Fit unclear',tone:'unknown',rank:null,reason:'Company fit is still open.',evidence:[]};
}

// Current public role verification is separate from company eligibility.
const normalize=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const roleText=s=>normalize(s).replace(/\bceo\b/g,'chief executive officer').replace(/\bcoo\b/g,'chief operating officer').replace(/\bcfo\b/g,'chief financial officer').replace(/\bcto\b/g,'chief technology officer').replace(/\bcio\b/g,'chief information officer');
export function verifiedScoringRole(lead,time=Date.now()){
 const p=lead.professional_context,age=time-Date.parse(p?.checked_at);
 let host;try{host=new URL(String(lead.website||'').includes('://')?lead.website:'https://'+lead.website).hostname.replace(/^www\./,'')}catch{return null}
 if(!p||p.version<9||p.status!=='complete'||p.match!=='name_company_match'||p.stale||p.snapshot||!Number.isFinite(age)||age<0||age>30*86400000||p.input_key!==[normalize(lead.name),normalize(lead.company),host].join('|')||/\bTEST\b/i.test(lead.name||''))return null;
 const candidates=(p.people||[]).filter(r=>r.official&&!r.historical&&normalize(r.name)===normalize(lead.name)&&normalize(r.company)===normalize(lead.company)&&r.role&&r.quote&&(!r.published_at||(Number.isFinite(Date.parse(r.published_at))&&Date.parse(r.published_at)<=time))&&(()=>{try{const u=new URL(r.url);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname===host||u.hostname.endsWith('.'+host))}catch{return false}})());
 return candidates.every(r=>roleText(r.quote).includes(roleText(r.role)))&&new Set(candidates.map(r=>normalize(r.role))).size===1?candidates[0]:null;
}
// Company fit is a categorical eligibility rule, not a point estimate of a sale.
export function companyFit(lead,brief=lead.research_brief,time=Date.now()){
 const fit=classifyFit(lead,brief,time);
 return {...fit,model:'housing-fit-v3',scope:'Company fit',score:null,max:null,upper:null,coverage:null,unassessed:null,criteria:[],score_status:fit.rank===null?'unresolved':'classified'};
}
export const fitScoreText=fit=>fit.label;

// A review-order rule, not a conversion probability. Keep its inputs and reason
// in saved assessments so outcomes can be compared by tier during the pilot.
export function leadPriority(lead,brief=lead.research_brief,time=Date.now()){
 const fit=companyFit(lead,brief,time);
 const result=(tier,rank,rule,reason,inquiry='')=>{
  const rubric=priorityRubric(lead,brief,{tier,inquiry,rule},time);
  return {model:'inbound-priority-v2',tier,rank,label:({A:'High priority',B:'Medium priority',C:'Low priority'})[tier]||'Needs review',rule,reason,evidence:fit.evidence,inquiry,illustrative:!!lead.sample_lead&&!!lead.inquiry,...rubric};
 };
 if(fit.rank===null||lead.company_stale||!lead.processed_at||['pending','blocked'].includes(lead.research_state))return result(null,0,'research_needed','Company evidence needs review before assigning a priority tier.');
 if(fit.rank===0)return result('C',1,'outside_housing','The sourced company model is outside the residential owner/operator focus.');
 const inquiry=String(lead.inquiry||'').replace(/[’‘]/g,"'").trim();
 const noActive=/\b(?:no active (?:need|project|request)|not (?:ready|interested|looking|considering|a (?:demo |sales )?request)|do not (?:need|want|have (?:an? )?active)|don't (?:need|want|have (?:an? )?active)|no (?:demo|inbound) (?:request|inquiry)|just (?:researching|exploring)|demo prospect)\b/i.test(inquiry);
 const unsafe=/\b(?:ignore (?:all|previous|prior)|system prompt|assign (?:me |us )?(?:priority|tier)|override|pretend)\b/i.test(inquiry);
 const sentences=inquiry.split(/(?<=[.!?])\s+|\n+/).filter(s=>! /\b(?:no|not|never|don't|isn't|aren't|without)\b/i.test(s));
 const hook=!noActive&&!unsafe&&sentences.find(s=>
  /\b(?:demo|walkthrough)\b/i.test(s)&&/\b(?:request|schedule|book|show|like|want|can|could)\b/i.test(s)||
  /\b(?:leasing|resident (?:communication|messages?|calls?)|maintenance requests?|renewals?|payment (?:reminders?|follow.up)|(?:missed|missing) calls?|response times?|after.hours|tours?)\b/i.test(s)&&/\b(?:need|want|missing|looking for|struggl|help|improv|automat|evaluat|can you|could you|how (?:can|could|would)|what would|can your|could your)\w*/i.test(s));
 if(hook){
  const topic=[['after-hours leasing',/after.hours/i],['maintenance requests',/maintenance/i],['tour coordination',/tours?/i],['renewal follow-up',/renewals?/i],['payment follow-up',/payment/i],['call coverage',/calls?/i],['leasing follow-up',/leasing|response times?/i]].find(([,re])=>re.test(hook))?.[0];
  return result('A',3,'specific_inquiry',topic?'Housing operator requesting help with '+topic+'.':'Housing operator with an explicit demo request.',hook);
 }
 return result('B',2,noActive?'no_active_request':'general_inquiry',noActive?'Housing operator with no active request stated in the inquiry.':'Housing operator; the inquiry is general or a specific need is not yet recorded.');
}

// Five inspectable questions. Missing context never becomes a negative fact.
// Only segment + submitted request determine the tier. Other facts explain
// account context and routing; none is a probability or purchasing authority.
export function priorityRubric(lead,brief=lead.research_brief,decision={},time=Date.now()){
 const fit=companyFit(lead,brief,time),sources=brief?.sources||[];
 const sourceFor=(id,quote)=>sources.find(s=>s.id===id&&s.name_matched&&(s.excerpt?.includes(quote)||s.title===quote));
 const evidence=fit.evidence.map(e=>({...e,source:sourceFor(e.source_id,e.quote)})).filter(e=>e.source);
 const basis=evidence[0],source=basis?.source;
 const quoteText=evidence.filter(e=>e.kind==='housing_operator').map(e=>e.quote).join(' ');
 const segment=fit.rank===2?[/student housing/i.test(quoteText)&&'Student housing',/affordable housing/i.test(quoteText)&&'Affordable housing',/single.family/i.test(quoteText)&&'Single-family rentals',/multifamily|multi-family|apartments?/i.test(quoteText)&&'Multifamily housing'].filter(Boolean).join(' / ')||'Residential housing':brief?.classification?.label||'Not established';
 const item=(key,question,value,note,proof=null)=>({key,question,value,note,source_id:proof?.source?.id||null,url:proof?.source?.url||null,quote:proof?.quote||'',retrieved_at:proof?.source?.retrieved_at||null});
 const p=brief?.portfolio,ps=p&&sourceFor(p.source_id,p.quote),dated=Date.parse(p?.as_of);
 // Bands describe the published figure, not a claimed current deployment size.
 // Beds, buildings, historical totals and conflicting scopes are not comparable homes.
 const match=p?.value?.match(/^(?:(?:approximately|about|more than|over|at least)\s+)?([\d,.]+)(\+)?(?:\s+(million|thousand))?\s+(?:(?:residential|rental|multifamily|multi-family|apartment)\s+){0,2}(?:units|homes|apartment homes)$/i);
 const datedYears=[...(p?.quote||'').matchAll(/\b(?:in|during|as of)\s+(20\d{2})\b/gi)].map(m=>Number(m[1]));
 const historical=datedYears.some(y=>y<new Date(time).getUTCFullYear()-1)||p?.as_of&&(!Number.isFinite(dated)||dated>time||time-dated>548*86400000);
 const count=match?Number(match[1].replaceAll(',',''))*({million:1e6,thousand:1e3}[match[3]?.toLowerCase()]||1):null;
 const comparable=ps&&fit.rank===2&&match&&!/beds|square feet|sq\.? ft/i.test(p.value)&&!p.alternatives?.length&&!historical&&!sourceHasOldDate(ps,time)&&count>0;
 const lowerBound=!!match?.[2]||/^(?:more than|over|at least)\b/i.test(p?.value||'');
 const band=comparable?(lowerBound?'At least '+count.toLocaleString('en-US'):count>=5000?'5,000+':count>=1000?'1,000–4,999':count>=200?'200–999':'Under 200'):null;
 const savedRole=lead.sample_lead&&lead.sample_grounded_draft&&lead.professional_context?.snapshot?verifiedScoringRole({...lead,professional_context:{...lead.professional_context,snapshot:false}},time):null;
 const role=verifiedScoringRole(lead,time)||savedRole,relevance=role?contactRelevance(lead,time):null;
 const q=lead.qualifications||{},account=lead.qualification_evidence?.account,recorded=Date.parse(account?.recorded_at);
 const accountCurrent=Number.isFinite(recorded)&&recorded<=time&&time-recorded<=90*86400000&&account.input===JSON.stringify([q.account_status||'unknown',q.account_note||''])&&String(q.account_note||'').trim().length>=5;
 const accountLabels={new:'New prospect',existing:'Existing customer',open_opportunity:'Open opportunity',duplicate:'Duplicate record'};
 const status=accountCurrent&&accountLabels[q.account_status]?q.account_status:'unknown';
 const routing={status,label:({existing:'Account team',open_opportunity:'Opportunity owner',duplicate:'Review duplicate'})[status]||'Sales review',basis:status==='unknown'?'Account relationship not checked. No CRM is connected.':q.account_note,recorded_at:accountCurrent?account.recorded_at:null};
 const criteria=[
  item('segment','Relevant housing operator?',fit.rank===null?'Not established':segment,fit.rank===2?'Eligible housing segment.':fit.rank===0?'Outside the residential operator sales focus.':'Unresolved evidence does not mean low fit.',basis),
  item('inquiry','What prompted the inquiry?',decision.inquiry?'Specific relevant request':decision.rule==='no_active_request'?'No active request stated':lead.inquiry?'General or unresolved request':'No inquiry supplied',lead.inquiry?(lead.sample_lead?'Illustrative inquiry: ':'Submitted inquiry: ')+(decision.inquiry||lead.inquiry):'Buying intent is not inferred from a website.'),
  item('portfolio','Reported portfolio size?',ps?p.value:'Not established',ps?[band?'Reported band: '+band+' homes.':'No comparable home band.',p.as_of?'As of '+p.as_of:'Reporting date not stated.',p.scope||'',p.alternatives?.length?'Other totals differ.':'','Company scale is not rollout scope.'].filter(Boolean).join(' '):'Optional context; no deduction for missing data.',ps?{source:ps,quote:p.quote}:null),
  item('contact','Relevant contact function?',role?role.role:'Not established',role?(savedRole?'Saved public role · ':'')+(relevance?.function||'Role sourced')+'. A title does not establish buying authority.':'Optional context; no deduction for a missing role.',role?{source:{url:role.url,retrieved_at:lead.professional_context.checked_at},quote:role.quote}:null),
  item('account','Existing account relationship?',accountLabels[status]||'Not checked',status==='unknown'?routing.basis:'Rep-recorded check · '+routing.label+': '+q.account_note)
 ];
 const recent=s=>{const at=Date.parse(s?.retrieved_at);return Number.isFinite(at)&&at<=time&&time-at<=30*86400000&&!sourceHasOldDate(s,time)};
 const saved=lead.company_snapshot||lead.company_stale||fit.saved||!evidence.every(e=>recent(e.source));
 const confidence=decision.tier===null||fit.rank===null||!evidence.length?{level:'limited',label:'Limited evidence',reason:'Essential operating evidence is unresolved; no low-fit conclusion is drawn.'}:saved?{level:'saved',label:'Saved evidence',reason:'The decision uses dated saved evidence. Recheck it before treating it as current.'}:{level:'supported',label:'Supported evidence',reason:'Matched, recently retrieved sources support the operating model. The request is lead-provided. This is not independently verified accuracy or a win probability.'};
 return {criteria,confidence,routing,portfolio_band:band};
}

// Coverage describes evidence availability, never sales readiness or win probability.
export const isDemoProspect=lead=>/\bdemo prospect\b|\bno inbound inquiry\b/i.test(lead.inquiry||'');
export function contactRelevance(lead,time=Date.now()){
 const p=lead.professional_context,person=p?.match==='name_company_match'?p.people?.find(x=>!x.historical&&x.official&&x.role):null;
 const age=time-Date.parse(p?.checked_at);
 const current=person&&p.status==='complete'&&!p.stale&&(p.snapshot||Number.isFinite(age)&&age>=0&&age<=30*86400000);
 if(!current)return {label:person?'Saved role':p?.match==='review'?'Role needs review':'Role not established',function:null,supported:false};
 const roles=[['Leasing / marketing',/leasing|marketing/i],['Operations',/operations|operating|property manager|portfolio (?:director|manager)|regional manager|centralization/i],['Technology',/technology|information systems|\b(?:IT|CTO|CIO)\b/i],['Maintenance',/maintenance|facilities/i],['Ownership / asset management',/asset management|asset manager|investments?|acquisitions/i],['Executive leadership',/president|chief executive|\bCEO\b|founder|owner/i]];
 const fn=roles.find(([,re])=>re.test(person.role))?.[0];
 return {label:fn?'Relevant function':'Role sourced',function:fn||null,supported:true,snapshot:!!p.snapshot};
}
export function researchCoverage(lead,{busy=false,contactBusy=false}={}){
 const matched=lead.research_brief?.sources?.some(s=>s.name_matched),p=lead.professional_context;
 return [
 {key:'company',label:'Company',value:busy?'Updating':matched?lead.company_stale?'Saved sources':'Sources matched':lead.company_stale?'Needs attention':lead.processed_at?'Not established':'Queued'},
 {key:'contact',label:'Contact',value:contactBusy||p?.status==='pending'?'Updating':contactRelevance(lead).supported?p.snapshot?'Saved role':'Role sourced':p?.match==='review'?'Needs review':p?.people?.length?'Saved role':lead.email_context?.reported_role?'Email-provided role':'Not established'},
 ...(lead.property_address?[{key:'property',label:'Property',value:lead.property_context?.status==='matched'?'Address matched':'Submitted address'}]:[])
 ];
}

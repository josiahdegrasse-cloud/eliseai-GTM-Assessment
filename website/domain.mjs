import {applyEmailPolicy,DEFAULT_EMAIL_POLICY} from './email-policy.mjs';
import {companyFit,leadPriority} from '../static/company-fit.js';
import {verifyCompanyIdentity} from './company-identity.mjs';
import {professionalKey} from './professional-research.mjs';
import {buildBrief,cleanText,sourceURL} from './brief.mjs';
import {scoreLead} from './scoring.mjs';
import {assessLead} from './lead-assessment.mjs';
import {salesDecision} from './decision.mjs';
import {evidenceState,REVIEW_DAYS} from './qualification-evidence.mjs';
import {professionalDraftSignature} from './professional-personalization.mjs';
import {outreachCopy,DRAFT_VERSION} from './outreach.mjs';
import {buildSalesInsights} from './sales-insights.mjs';
import {groundDraft} from './draft-grounding.mjs';
import {DISCOVERY_FIELDS,qualificationAnswers,nextQuestion} from '../static/sales-context.js';
export const REQUIRED=['name','email','company','city','state','property_address'];
export const OPTIONAL=['country','website','inquiry','postal_code','research_url'];
export const cleanInquiry=value=>String(value||'').replace(/^\s*\[TEST INQUIRY\]\s*/i,'').replace(/^\s*\[SYNTHETIC INBOUND EMAIL[^\]]*\]\s*(?:Subject:\s*[^.\n]+[.\n]\s*)?/i,'');
const FREE_MAIL=new Set(['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','aol.com','proton.me','live.com']);
export const now=()=>new Date().toISOString();
export function safeDomain(value='') {
  try {
    const url=new URL(value.includes('://')?value:'https://'+value);
    const host=url.hostname.toLowerCase().replace(/^www\./,'');
    if(url.protocol!=='https:'||url.username||url.password||url.port) return '';
    if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))return '';
    if(/\.(localhost|local|internal|example|test|invalid)$/.test(host)||['example.com','example.org','example.net'].includes(host))return '';
    return host;
  }catch{return ''}
}
export function domain(lead){const mail=lead.email.split('@').at(-1).toLowerCase();return lead.website?safeDomain(lead.website):FREE_MAIL.has(mail)?'':safeDomain(mail)}
export function validate(lead){
  const issues=REQUIRED.filter(k=>!lead[k]).map(k=>'Missing '+k.replaceAll('_',' '));
  if(lead.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))issues.push('Email format needs review');
  if(lead.website&&!safeDomain(lead.website))issues.push('Company website must be a public domain');
  if(lead.research_url&&!sourceURL(lead.research_url,domain(lead)))issues.push('Research page must be an HTTPS page on the company website or its subdomains');
  return issues;
}
export function draftSignature(lead,brief=buildBrief(lead,domain(lead))){
  const action=salesDecision(lead,brief,scoreLead(lead,brief)).action;
  return JSON.stringify([DRAFT_VERSION,professionalDraftSignature(lead),action.code,action.question,lead.name,lead.email,lead.company,domain(lead),brief.sources.map(s=>[s.url,s.excerpt,s.retrieved_at,s.published_at,s.name_matched,s.identity?.version]),lead.inquiry||'',qualificationAnswers(lead.qualifications),nextQuestion(lead,brief).question,Object.keys(REVIEW_DAYS).map(key=>evidenceState(lead,key).status)]);
}
function greetingName(name){
  const value=String(name||'').trim();
  return !value||/^TEST\b/i.test(value)?'there':value.split(/\s+/)[0];
}
export function draftFor(lead,fit=false,multi=false,brief=null,policy=DEFAULT_EMAIL_POLICY){
  const first=greetingName(lead.name);
  const {context_basis,...copy}=groundDraft(lead,brief,applyEmailPolicy(outreachCopy(lead,brief,first,fit),policy));
  return {...copy,
    would_send:'',feedback_reason:'',reviewed_draft_id:null,
    draft_basis:context_basis,draft_professional_signature:professionalDraftSignature(lead),draft_version:DRAFT_VERSION,draft_stale:false,draft_edited:false,
    draft_research_signature:draftSignature(lead,brief||buildBrief(lead,domain(lead)))};
}
export function intake(row){
  const lead=Object.fromEntries([...REQUIRED,...OPTIONAL].map(k=>[k,String(row[k]??'').trim().slice(0,k==='inquiry'?2000:1000)]));
  lead.inquiry=cleanInquiry(lead.inquiry);
  lead.country||='US';
  return {...lead,id:crypto.randomUUID(),demo:false,status:'New',score:null,evidence:[],issues:validate(lead),notes:'',feedback:'',reviewed:false,created_at:now(),automation_pending:true,research_state:'pending',research_note:'Ready for live research.',confidence:'Not researched',...draftFor(lead)};
}
export const identity=lead=>[lead.email,lead.company,lead.property_address].join('|').toLowerCase();
export function companyEvidence(lead,result,provider='Exa'){
  const d=domain(lead),seen=new Set(),evidence=[];

  for(const item of result.results){
    const url=sourceURL(item.url,d);if(!url||seen.has(url))continue;
    seen.add(url);
    if(!Array.isArray(item.highlights))continue;
    const snippets=item.highlights.filter(v=>typeof v==='string').map(cleanText).filter(v=>v.length>30).slice(0,2);
    const title=typeof item.title==='string'?cleanText(item.title):d;
    const identity=verifyCompanyIdentity({company:lead.company,title,text:snippets.join(' '),url,companyDomain:d}),matched=identity.status==='confirmed';
    const quotes=(item.ranked_quotes||[]).filter(q=>typeof q==='string'&&(item.passages||item.highlights||[]).some(p=>p.includes(q))).slice(0,2);
    for(const text of [...snippets,...quotes.filter(q=>!snippets.some(s=>s.includes(q)))])evidence.push({title:title.slice(0,300),text:text.trim().slice(0,2400),url,date:Number.isFinite(Date.parse(item.retrieved_at))?item.retrieved_at:now(),published_date:typeof item.publishedDate==='string'?item.publishedDate:null,verified:matched,identity,kind:'Company website',provider});
  }
  // Provider synthesis is only a candidate: require a citation and a verbatim match
  // in an accepted page excerpt before using its selected sentence in the brief.
  let content=result.output?.content;try{if(typeof content==='string')content=JSON.parse(content)}catch{content=null}
  const grounded=new Set((Array.isArray(result.output?.grounding)?result.output.grounding:[]).flatMap(g=>Array.isArray(g.citations)?g.citations:[]).map(c=>sourceURL(c.url,d)).filter(Boolean));
  for(const observation of (Array.isArray(content?.observations)?content.observations:[]).slice(0,6)){
    const url=sourceURL(observation.url,d),quote=typeof observation.quote==='string'?cleanText(observation.quote):'';
    if(!quote||quote.length<30||quote.length>1200||!grounded.has(url))continue;
    const match=evidence.find(e=>e.url===url&&e.text.replace(/\s+/g,' ').includes(quote.replace(/\s+/g,' ')));
    if(match)(match.focus_quotes??=[]).push(quote);
  }
  const matched=evidence.some(e=>e.verified);
  return {evidence,matched,cached:false,message:matched?'Company name and domain corroborated. Property relationship remains unverified.':'No corroborated company excerpts found. Confirm the website or ask the contact for context.'};
}
export function presentLead(lead){
  lead={...lead,inquiry:cleanInquiry(lead.inquiry)};
  // A saved geocoder result never substitutes for a removed property input.
  if(!String(lead.property_address||'').trim())lead={...lead,property_context:lead.property_context?.status==='matched'||lead.property_context?.coordinates?{}:lead.property_context||{},area_context:{}};
  if(lead.professional_context?.input_key!==professionalKey(lead))lead.professional_context=null;
  // Pending edits invalidate legacy processed_at as well as newly stored records.
  const pending=lead.research_state==='pending'||!lead.processed_at;
  if(pending)lead={...lead,processed_at:null,company_fetched_at:null,company_fresh_until:null,company_retry_after:null,company_retry_code:null,company_error:null,company_stale:false,evidence:[],company_locations:[],cached:false,company_snapshot:false,property_context:{},area_context:{},registry_context:{},score:null};
  // An old provider cooldown must not prevent the first keyless lookup after migration.
  if(lead.company_engine!=='reader-v2')lead={...lead,company_fresh_until:null,company_retry_after:null};
  if(lead.company_stale&&lead.company_recovery_version!==1)lead={...lead,company_retry_after:null,company_retry_code:null};
  // Request one location-aware refresh without changing the age of saved evidence.
  lead={...lead,needs_location_refresh:!!lead.processed_at&&lead.company_engine==='reader-v2'&&lead.company_location_version!==1};
  lead.needs_brief_refresh=!!lead.processed_at&&lead.company_engine==='reader-v2'&&![3,4].includes(lead.company_brief_version);
  lead.needs_area_refresh=lead.property_context?.status==='matched'&&/^\d{11}$/.test(lead.property_context.tract||'')&&lead.area_context?.version!==1;
  const research_brief=buildBrief(lead,domain(lead)),matched=research_brief.sources.some(s=>s.name_matched);
  if(lead.processed_at&&lead.company_engine==='reader-v2'&&lead.company_brief_version!==4&&research_brief.company_kind==='housing_operator'&&!research_brief.portfolio)lead.needs_brief_refresh=true;
  const [residential,leasing]=research_brief.signals;
  let research_state=!domain(lead)?'needs_website':pending?'pending':lead.company_stale?'partial':!matched?'needs_confirmation':'complete';
  const fit=!lead.processed_at?{label:'Not researched',rank:0,reason:'Run research to establish company fit.'}:!matched?{label:lead.company_stale?'Research pending':'Check company',rank:0,reason:lead.company_stale?'Company sources are temporarily unavailable.':'Company identity is not established.'}:residential.supported&&leasing.supported?{label:'Strong fit',rank:2,reason:'Published residential operations and leasing or community context.'}:residential.supported?{label:'Possible fit',rank:1,reason:'Residential operations are described; the leasing workflow needs confirmation.'}:{label:'Fit not established',rank:0,reason:'These sources do not establish residential operations.'};
  const qualifications=qualificationAnswers(lead.qualifications);
  const qualification={recorded:DISCOVERY_FIELDS.filter(f=>qualifications[f.key]).length,total:DISCOVERY_FIELDS.length};
  const propertyNote=lead.property_context?.message||'';
  const companyNote=propertyNote?String(lead.research_note||'').replaceAll(propertyNote,'').replace(/\s+/g,' ').trim():lead.research_note;
  const research_note=research_state==='needs_website'?'Add the company’s public website. A personal email or name alone cannot identify it.':research_state==='needs_confirmation'?'The supplied domain did not establish this company. Check the company name and website before using specific claims.':lead.company_stale?(lead.company_error||companyNote):companyNote;
  if(!lead.reviewed&&!lead.draft_edited&&((lead.draft_version||0)<DRAFT_VERSION||lead.draft_professional_signature!==professionalDraftSignature(lead)))lead={...lead,...draftFor(lead,research_brief.signals[0].supported,research_brief.signals[1].supported,research_brief)};
  const priority=scoreLead(lead,research_brief);
  const decision=salesDecision(lead,research_brief,priority);
  const draft_stale=!!lead.draft_stale||!!(lead.draft_research_signature&&lead.draft_research_signature!==draftSignature(lead,research_brief));
  const status=draft_stale?'Recheck draft':lead.reviewed?'Draft reviewed':pending?'New':'Draft to review';
  const lead_fit=companyFit(lead,research_brief);
  return {...lead,lead_fit,company_fit:lead_fit,lead_priority:leadPriority({...lead,research_state},research_brief),research_brief,research_state,research_note,score:lead_fit.score,priority,lead_assessment:assessLead(lead,research_brief,priority),decision,sales_insights:buildSalesInsights(lead,research_brief,priority,decision),fit,status,qualifications,qualification,reviewed:!!lead.reviewed&&!draft_stale,
    next_question:nextQuestion(lead,research_brief),
    company_identity:{status:matched?'confirmed':research_brief.sources.length?'needs_confirmation':'unresolved',basis:matched?'Company name corroborated on supplied domain':'Confirm the company name and official website',sources:research_brief.sources.filter(s=>s.name_matched).map(s=>s.id)},
    confidence:matched?'Name + domain match':'Needs confirmation',
    draft_stale};
}
export function censusParams(lead){
 const common={benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'},zip=String(lead.postal_code||'').trim();
 if(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/i.test(lead.property_address||''))return {address:lead.property_address,...common};
 if(lead.city&&lead.state||zip)return {street:lead.property_address,city:lead.city,state:lead.state,...(zip?{zip}:{}),...common};
 return {address:[lead.property_address,lead.city,lead.state].filter(Boolean).join(', '),...common};
}
export function censusFallbackParams(lead){
 const street=String(lead.property_address||'').replace(/,?\s+(?:Apt\.?|Apartment|Suite|Ste\.?|Unit|#)\s*[A-Za-z0-9-]+\b/ig,'').trim();
 if(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/i.test(street))return {address:street,benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'};
 return {address:[street,lead.city,lead.state,lead.postal_code].filter(Boolean).join(', '),benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'};
}
export function propertyEvidence(matches,source){
  const out={provider:'U.S. Census Bureau',date:now(),url:source,cached:false};
  if(matches.length!==1)return {...out,status:matches.length?'ambiguous':'unmatched',message:matches.length?'Multiple address matches. Confirm the property details.':'No Census address match. Check the street, city and state.'};
  const match=matches[0],geo=match.geographies||{};
  const parts=match.addressComponents||{};
  return {...out,status:'matched',address:match.matchedAddress||'',city:parts.city||'',state:parts.state||'',postal_code:parts.zip||'',county:geo.Counties?.[0]?.NAME||'',tract:geo['Census Tracts']?.[0]?.GEOID||'',coordinates:match.coordinates||{},message:'Address-range match. Does not establish building existence, ownership, unit count, or a link to this company.'};
}
export function qualify(lead,company,location,failures){
  const evidence=company.evidence,brief=buildBrief({...lead,evidence,cached:company.cached},domain(lead));
  const updated={...lead,evidence,property_context:location,issues:validate(lead),processed_at:now(),cached:company.cached||false,company_stale:!!company.stale,company_snapshot:!!company.sample_snapshot,
    automation_pending:!!company.stale,
    company_retrieval:company.retrieval||null,
    company_locations:company.locations||(company.stale?lead.company_locations:[])||[],
    company_brief_version:company.brief_version||lead.company_brief_version||0,
    company_location_version:company.location_version||lead.company_location_version||0,company_recovery_version:1,
    company_engine:company.engine||lead.company_engine||null,company_fetched_at:company.cache_fetched_at||lead.company_fetched_at||evidence[0]?.date||null,company_fresh_until:company.cache_fresh_until||null,company_retry_after:company.stale?company.retry_after||null:null,
    company_retry_code:company.stale?company.retry_code||null:null,company_error:company.stale?company.refresh_error||null:null,
    research_state:failures.length?'partial':'complete',research_note:[company.message,...failures].join(' ')};
  if(lead.reviewed||lead.draft_edited){
    updated.draft_stale=!!lead.draft_stale||lead.draft_research_signature!==draftSignature(updated,brief);
    updated.draft_edited=true;if(updated.draft_stale)updated.reviewed=false;
  }else Object.assign(updated,draftFor(updated,brief.signals[0].supported,brief.signals[1].supported,brief));
  return presentLead(updated);
}

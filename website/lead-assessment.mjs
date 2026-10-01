import {sourceStatements,operatorStatement} from './company-classification.mjs';

// Public-evidence fit, not buying intent. Unknown criteria contribute a range,
// never a zero or an invented positive. Weights are explicit MVP assumptions.
export const ASSESSMENT_VERSION='public-lead-fit-v1';
const DAY=86400000;
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const address=s=>norm(s).replace(/\b(street|avenue|road|boulevard|drive|lane|court|place|parkway|north|south|east|west)\b/g,w=>({street:'st',avenue:'ave',road:'rd',boulevard:'blvd',drive:'dr',lane:'ln',court:'ct',place:'pl',parkway:'pkwy',north:'n',south:'s',east:'e',west:'w'})[w]);
const criterion=(key,label,max,points,reason,sources=[],value='')=>({key,label,max,points,status:points===null?'unverified':'assessed',reason,sources,value});
const group=(key,label,criteria)=>{
 const assessed=criteria.filter(c=>c.points!==null),earned=assessed.reduce((n,c)=>n+c.points,0),max=criteria.reduce((n,c)=>n+c.max,0),unknown=criteria.filter(c=>c.points===null).reduce((n,c)=>n+c.max,0);
 return {key,label,criteria,max,earned,possible:earned+unknown,assessed:assessed.length,total:criteria.length,complete:unknown===0};
};
function propertyFindings(lead,brief,time){
 const street=address(String(lead.property_address||'').split(',')[0]).replace(/\b(?:apt|apartment|suite|ste|unit)\s+\S+.*$/,'').trim(),city=norm(lead.city);
 if(!/^\d+\s+\S+/.test(street)||!city||lead.company_stale||lead.company_snapshot)return [];
 const findings=[];
 for(const source of brief.sources.filter(s=>s.name_matched)){
  const published=Date.parse(source.published_at),retrieved=Date.parse(source.retrieved_at);
  if(Number.isFinite(published)&&(published>time+DAY||time-published>548*DAY)||!Number.isFinite(retrieved)||time-retrieved>30*DAY||retrieved>time+DAY)continue;
  for(const quote of sourceStatements(source)){
   const text=address(quote);
   if(quote.length>800||!(' '+text+' ').includes(' '+street+' ')||!(' '+norm(quote)+' ').includes(' '+city+' '))continue;
   if(/\b(headquarters|office|registered address|near|nearby|adjacent|across from|next to|former|previously|sold|no longer|customer|client|planned|proposed|under construction)\b/i.test(quote))continue;
   // Reject directory paragraphs containing multiple street addresses.
   if((quote.match(/\b\d{1,6}\s+(?:[A-Za-z]+\s+){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/gi)||[]).length>1)continue;
   const residential=/\b(?:apartment (?:community|building|homes)|residential (?:property|building|community)|multifamily (?:property|community|building)|rental housing|student housing)\b/i.test(quote)&&!/\b(?:not|no)\s+(?:an?\s+)?(?:apartment|residential|multifamily)/i.test(quote);
   if(!residential)continue;
   findings.push({source,quote,relationship:operatorStatement(quote,lead.company)});
  }
 }
 return findings;
}
export function assessLead(lead,brief,priority,time=Date.now()){
 const source=id=>{const s=brief.sources.find(s=>s.id===id);return s?{id:s.id,url:s.url,title:s.title,quote:s.excerpt,retrieved_at:s.retrieved_at}:null};
 const weights={housing:30,workflow:20,scale:10};
 const company=group('company','Company',priority.criteria.filter(c=>c.basis==='Company sources').map(c=>criterion(c.key,c.label,weights[c.key],c.points===null?null:Math.round(c.points/c.max*weights[c.key]),c.points===null?'Not established by the available company evidence.':c.reason,c.source_ids.map(source).filter(Boolean))));
 const p=lead.professional_context,checked=Date.parse(p?.checked_at);
 const current=p?.status==='complete'&&p.match==='name_company_match'&&!p.stale&&Number.isFinite(checked)&&checked<=time+DAY&&time-checked<=30*DAY?(p.people||[]).filter(x=>!x.historical&&!/\bTEST\b/i.test(lead.name)&&norm(x.name)===norm(lead.name)&&norm(x.company)===norm(lead.company)&&x.role&&x.quote&&/^https:\/\//.test(x.url||'')&&norm(x.quote).includes(norm(lead.name))&&norm(x.quote).includes(norm(x.role))&&Number.isFinite(Date.parse(x.retrieved_at))&&time-Date.parse(x.retrieved_at)<=30*DAY&&Date.parse(x.retrieved_at)<=time+DAY):[];
 const person=current[0],personSource=person?[{url:person.url,title:person.title,quote:person.quote,retrieved_at:person.retrieved_at}]:[];
 const role=person?.role||'',relevant=/\b(?:leasing|property|community|resident|operations?|asset management|portfolio|multifamily|housing|technology|information|IT|digital|innovation|finance|financial|procurement|purchasing|marketing|CEO|COO|CFO|CTO|CIO|chief executive|president|owner|founder)\b/i.test(role),outside=/\b(?:human resources|HR|talent acquisition|recruiting|legal counsel|general counsel)\b/i.test(role);
 const contact=group('contact','Contact',[
  criterion('affiliation','Current company affiliation',10,person?10:null,person?'Public source associates this name with the submitted company.':'Current name, employer and role are not corroborated together.',personSource,role),
  criterion('role_relevance','Role relevance',15,person?(outside?0:relevant?15:null):null,person&&relevant&&!outside?'The listed function relates to housing operations, technology, finance or executive leadership. This does not establish decision authority.':person&&outside?'The listed function is outside this MVP’s operational buyer-role assumptions.':'Functional relevance remains unverified.',personSource,role)
 ]);
 const findings=propertyFindings(lead,brief,time),residential=findings[0],relationship=findings.find(f=>f.relationship);
 const ref=f=>f?[{id:f.source.id,url:f.source.url,title:f.source.title,quote:f.quote,retrieved_at:f.source.retrieved_at}]:[];
 const property=group('property','Property',[
  criterion('property_use','Residential building use',10,residential?10:null,residential?'An official company source describes housing at the submitted street address and city.':'The address alone does not establish the building’s use.',ref(residential),residential?.quote||''),
  criterion('property_relationship','Company–property relationship',5,relationship?5:null,relationship?'The company describes operating housing at this address.':'Company ownership or management of this specific property is not corroborated.',ref(relationship),relationship?.quote||'')
 ]);
 const groups=[company,contact,property],earned=groups.reduce((n,g)=>n+g.earned,0),possible=groups.reduce((n,g)=>n+g.possible,0),assessed=groups.reduce((n,g)=>n+g.assessed,0),total=groups.reduce((n,g)=>n+g.total,0),complete=groups.every(g=>g.complete);
 const geography=lead.property_context?.status==='matched'?{status:'matched',address:lead.property_context.address,county:lead.property_context.county,source_url:lead.property_context.url,stale:!!lead.property_context.stale}:null;
 return {version:ASSESSMENT_VERSION,groups,earned,possible,max:100,assessed,total,complete,score:assessed?earned:null,range:assessed?`${earned}${complete?'':'–'+possible}`:null,label:!assessed?'Unscored':earned>=80?'High fit':possible<50?'Low fit':complete?'Potential fit':'Partial assessment',provisional:!!priority.provisional,geography,notes:['Weights are MVP assumptions, not EliseAI’s validated ICP.','Unverified criteria remain open; the range is not a statistical confidence interval.','Public roles do not establish authority, budget or intent. Census and area demographics add no fit points.']};
}

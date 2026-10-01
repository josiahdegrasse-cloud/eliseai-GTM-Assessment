import {portfolioStatStatements} from './portfolio-statements.mjs';
import {verifyCompanyIdentity} from './company-identity.mjs';
import {DISCOVERY_FIELDS} from '../static/sales-context.js';
import {sourceHasOldDate} from '../static/company-fit.js';
import {classifyCompany,operatorStatement,sourceStatements,nonOperatorKind,NON_OPERATORS} from './company-classification.mjs';
// Extractive account briefs: every displayed company fact retains its source text.
// These rules organize evidence; they do not establish buying intent or ownership.
const norm=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function cleanText(value){
  return String(value||'').replace(/```[\s\S]*?(?:```|$)/g,'').replace(/\{\s*"@context"[\s\S]*$/g,'')
    .replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').replace(/^\s*#{1,6}\s*/gm,'')
    .replace(/\n[ \t]*[-•][ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function sourceURL(value,companyDomain){
  try{
    const url=new URL(value),host=url.hostname.toLowerCase(),d=companyDomain.replace(/^www\./,'');
    if(url.protocol!=='https:'||url.username||url.password||url.port||!d||!(host===d||host.endsWith('.'+d)))return '';
    if(host.split('.').some(p=>['dev','development','staging','stage','preview','test','testing','qa','sandbox'].includes(p)))return '';
    if(/\/(careers?|jobs?|privacy|terms|cookies?)(?:\/|$)/i.test(url.pathname))return '';
    for(const key of [...url.searchParams.keys()])if(/^(utm_|y_source$|gclid$|fbclid$|mc_)/i.test(key))url.searchParams.delete(key);
    url.hash='';return url.href;
  }catch{return ''}
}
function sourceType(url){
  if(/investor|annual-report|quarterly|financial-results/i.test(url))return {type:'Investor relations',rank:0};
  if(/about|company|who-we-are/i.test(url))return {type:'Company overview',rank:1};
  if(/services|management|portfolio/i.test(url))return {type:'Company services',rank:2};
  return {type:'Company website',rank:3};
}
export function organizeSources(evidence,companyDomain,cached=false,company=''){
  const sources=[],byURL=new Map();
  for(const item of evidence||[]){
    const url=sourceURL(item.url,companyDomain),text=cleanText(item.text);if(!url||text.length<25)continue;
    const identity=company?verifyCompanyIdentity({company,title:item.title,text,url,companyDomain}):null,verified=(item.verified===true||item.identity?.version===1)&&(!identity||identity.status==='confirmed');
    const u=new URL(url),key=u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;
    if(byURL.has(key)){
      const current=byURL.get(key);if(!current.excerpt.includes(text))current.excerpt+='\n\n'+text;
      current.name_matched||=verified;current.focus_quotes.push(...(item.focus_quotes||[]));continue;
    }
    const source={id:'',url,host:u.hostname.replace(/^www\./,''),title:cleanText(item.title)||u.hostname,
      provider:item.provider||'Company website',excerpt:text,retrieved_at:item.date||null,published_at:item.published_date||null,cached,
      name_matched:verified,identity,focus_quotes:item.focus_quotes||[],...sourceType(url)};
    sources.push(source);byURL.set(key,source);
  }
  return sources.sort((a,b)=>Number(b.name_matched)-Number(a.name_matched)||a.rank-b.rank).map((s,i)=>({...s,id:'S'+(i+1)}));
}
const statements=sourceStatements;
const lowValue=q=>/\b(?:philanthrop\w*|social impact|give back|giving back|volunteer\w*|COVID|lockdowns?|grand reopening|anniversary|swag|core values|mission|believes that|at our heart|spirit in our values|our history includes|landmark addresses)\b/i.test(q);
function conciseContext(key,quote){
 if(key==='ownership'&&!/\b(?:not|no longer|formerly|previously|was owned|will|plans?|proposed)\b/i.test(quote)){
  const owner=quote.match(/\b(?:now )?owned by ([^,.]{3,120})/i)?.[1]?.trim();
  const manager=quote.match(/\bmanaged by ([^,.]{3,100})/i)?.[1]?.trim();
  if(owner)return 'Owned by '+owner+(manager?', managed by '+manager:'')+'.';
 }
 return quote;
}
const vendorOnly=text=>!!nonOperatorKind(text);
const residential=operatorStatement;
const leasing=text=>/\b(leasing|communities|tour scheduling|prospect inquiries)\b/i.test(text);
const quantity=/(?:(?:more than|over|approximately|about|nearly|at least)\s+)?(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\+)?(?:\s+(?:million|thousand))?(?:\s+(?:multifamily|multi-family|residential|rental|apartment)){0,2}\s+(?:apartment homes|apartments|residences|units?(?: and student beds)?|student beds|homes|properties|communities)\b/gi;
function asOf(text){return text.match(/\bas of\s+([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2}|(?:the\s+)?(?:end of\s+)?20\d{2})/i)?.[1]||null}
function scaleCandidates(sources){
  const candidates=[];
  for(const source of sources.filter(s=>s.name_matched))for(const quote of [...statements(source),...portfolioStatStatements(source.excerpt)]){
    if(vendorOnly(quote)||norm(quote)===norm(source.title)||/\b(?:our clients|our customers|their portfolio|on behalf of our customers)\b/i.test(quote))continue;
    if(!/\b(own\w*|operat\w*|manag\w*|portfolio)\b/i.test(quote))continue;
    // A transaction or development-pipeline count is not a company-wide portfolio.
    if(/\b(acquir\w*|purchas\w*|sold|built|developed|planned|pipeline|under construction)\b/i.test(quote)&&!/\b(total|currently|as of|under management)\b/i.test(quote))continue;
    if(/\b(this (?:property|community|building)|at (?:the )?[A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/.test(quote))continue;
    const matchText=quote.replace(/^((?:(?:residential|rental|multifamily|apartment)\s+)?(?:residences|apartments|apartment homes|homes|units|properties|communities))\s+(?:managed|under management|owned|operated)\s+(\d[\d,.]*\+?)$/i,'$2 $1');
    for(const match of matchText.matchAll(quantity)){
      const before=matchText.slice(0,match.index),after=matchText.slice(match.index+match[0].length);
      if(/\b(?:built|developed|sold|acquired)\b[^.!?]*$/i.test(before)&&!/\b(?:manages?|owns?|operates?|currently)\b[^.!?]*$/i.test(before.split(/\b(?:built|developed|sold|acquired)\b/i).at(-1)))continue;
      if(/^\s+(?:developed|built|sold|acquired)\b/i.test(after))continue;
      if(/(?:does not|do not|no longer|not)\s+(?:own|manage|operate)/i.test(quote))continue;
      const value=match[0],unit=/units|homes|beds|apartments|residences/i.test(value)?'homes':'properties';
      candidates.push({value,unit,quote,source_id:source.id,as_of:asOf(quote),published_at:source.published_at,rank:source.rank,historical:sourceHasOldDate(source),
        scope:/\bglobally\b/i.test(quote)?'Global company portfolio':/\b(across|in) the United States\b/i.test(quote)?'U.S. company portfolio':'Company-wide portfolio'});
    }
  }
  return candidates.sort((a,b)=>Number(b.unit==='homes')-Number(a.unit==='homes')||Number(a.historical)-Number(b.historical)||(Date.parse(b.as_of)||Date.parse(b.published_at)||0)-(Date.parse(a.as_of)||Date.parse(a.published_at)||0)||a.rank-b.rank);
}
function separatePortfolioFacts(sources,kind){
 for(const source of sources.filter(s=>s.name_matched).sort((a,b)=>Number(sourceHasOldDate(a))-Number(sourceHasOldDate(b))||a.rank-b.rank))for(const quote of [...statements(source),...portfolioStatStatements(source.excerpt)]){
  if(vendorOnly(quote)||/\b(?:our clients|our customers|their portfolio|does not|no longer|planned|pipeline|will)\b/i.test(quote))continue;
  const value=kind==='retail'?quote.match(/(?:(?:over|more than|approximately|about|nearly|at least)\s+)?\d[\d,.]*\+?(?:\s+(?:million|thousand))?\s+(?:square feet|sq\.?\s*ft\.?)(?:\s+of)?\s+(?:retail|commercial)\s*(?:space)?/i)?.[0]:quote.match(/\d[\d,.]*\+?\s+(?:homes and apartments|apartments|residences|homes|units)\s+(?:developed|built)(?:,?\s+(?:acquired|and|built|developed))*/i)?.[0];
  if(!value||kind==='retail'&&!/\b(?:manag\w*|own\w*|operat\w*|portfolio)\b/i.test(quote))continue;
  return {value:value.trim(),quote,source_id:source.id,as_of:asOf(quote),published_at:source.published_at,scope:kind==='retail'?'Non-residential area; not a home count':'Development total; not currently managed homes'};
 }
 return null;
}
function footprint(sources){
  for(const source of sources.filter(s=>s.name_matched&&!sourceHasOldDate(s)))for(const quote of statements(source)){
    const value=quote.match(/(?:(?:more than|over|approximately|about|nearly|at least)\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:\s+(?:U\.S\.|US|United States|international|global))?\s+(?:markets|countries|states)\b/i)?.[0];
    if(value&&/\b(apartments?|homes|communities|own\w*|manag\w*|operat\w*|locat\w*)\b/i.test(quote))return {value,quote,source_id:source.id,as_of:asOf(quote)};
    if(/\b(?:across|in|throughout) (?:the )?(?:United States\b|U\.S\.(?:A\.)?|US\b)/i.test(quote)&&/\b(own\w*|manag\w*|operat\w*)\b/i.test(quote))return {value:'United States',quote,source_id:source.id,as_of:asOf(quote)};
    // Extract a named operating region only from an explicit ongoing claim.
    const region=quote.match(/\b(?:throughout|across|in)\s+((?:(?:Northern|Southern|Eastern|Western|Central|Greater)\s+)?[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|and)){0,5})(?=[.,;]|$)/)?.[1];
    if(region&&/\b(?:manages?|operates?|owns?)\b/.test(quote)&&!/\b(?:announced?|expan\w*|acquir\w*|plans?|will|previously|formerly)\b/i.test(quote))return {value:region,quote,source_id:source.id,as_of:asOf(quote)};
    if(/\bglobally\b/i.test(quote)&&/\b(rental housing|under management|own\w*|operat\w*)\b/i.test(quote))return {value:'Global operations',quote,source_id:source.id,as_of:asOf(quote)};
  }
  return null;
}
export function buildBrief(lead,companyDomain){
  const sources=organizeSources(lead.evidence,companyDomain,!!lead.cached,lead.company);
  const classification=classifyCompany(sources,lead.company);
  const vendorSource=NON_OPERATORS.has(classification.kind)?sources.find(s=>s.id===classification.evidence[0]?.source_id):null;
  // A vendor's product pages describe customer workflows, not owned operations.
  const eligible=sources.filter(s=>s.name_matched&&(classification.kind==='housing_operator'||sourceStatements(s,true).some(q=>operatorStatement(q,lead.company)))),all=eligible.flatMap(s=>statements(s).filter(q=>!vendorOnly(q)).map(quote=>({quote,source:s})));
  const profile=all.filter(x=>/^(?:we\b|our\b|the company\b)/i.test(x.quote)||x.quote.toLowerCase().startsWith(norm(lead.company).toLowerCase()+' ')).filter(x=>/\b(?:is|are|was|were|has|have|focuses|specializes|specialize|owns|own|manages|manage|operates|operate|provides|provide|develops|develop|serves|serve)\b/i.test(x.quote)&&!lowValue(x.quote)&&!/\b(?:Headline|Grid)\b/.test(x.quote)&&!/\b(?:announced|launched|expanded|acquired)\b/i.test(x.quote)&&x.quote.length<550&&/\b(company|focuses|specializ\w*|own\w*|manag\w*|operat\w*)\b/i.test(x.quote)&&/\b(apartments?|multifamily|real estate|rental housing|residential)\b/i.test(x.quote)&&!/^With (?:more than|over)/.test(x.quote)).sort((a,b)=>Number(/\b(is a|focuses on|specializes in|structured as)\b/i.test(b.quote))-Number(/\b(is a|focuses on|specializes in|structured as)\b/i.test(a.quote)))[0];
  const candidates=scaleCandidates(eligible),portfolio=candidates[0]||null;
  const retail=separatePortfolioFacts(eligible,'retail'),development=separatePortfolioFacts(eligible,'development');
  const alternatives=portfolio?candidates.filter(c=>c.unit===portfolio.unit&&norm(c.value).toLowerCase()!==norm(portfolio.value).toLowerCase()).filter((c,i,a)=>a.findIndex(x=>x.value===c.value)===i).slice(0,2):[];
  const signals=[{key:'residential',label:'Residential operations',test:residential,supported:'Residential or multifamily operations are described.',unknown:'Residential operations are not established by these sources.'},{key:'leasing',label:'Leasing / community operations',test:leasing,supported:'Leasing or multiple communities are mentioned.',unknown:'Leasing activity is not established by these sources.'}].map(({test,supported,unknown,...s})=>{
    const matches=eligible.filter(e=>statements(e,s.key==='residential').some(q=>test(q,lead.company)&&!/(?:does not|do not|no longer|not)\s+(?:own|manage|operate|offer|provide|focus|specialize)/i.test(q)));return {...s,supported:matches.length>0,description:matches.length?supported:unknown,source_ids:matches.map(m=>m.id)};
  });
  const fit=signals[0].supported,markets=footprint(eligible);
  const global=markets?.value==='Global operations';
  const question=!fit?'What is your role, and what prompted your inquiry?':global?'How much of the leasing response process is shared across regions, and where would an initial rollout make sense?':markets&&/markets|countries|states/i.test(markets.value)&&markets.value!=='United States'?'Are leasing responses coordinated across your markets, or managed by each local team?':portfolio?'Which properties would be in scope first, and how do you handle inquiries outside office hours?':'How does your team handle rental inquiries when the leasing team is unavailable?';
  const shortProfile=profile&&profile.quote.length<=500?{text:profile.quote.replace(/\b(?:leading|world.class|best.in.class|premier|trusted)[, ]+/gi,'').replace(/^We[’']re not just a /i,'A ').replace(/--we[’']re.*$/i,'.').replace(/\btrusted /i,''),source_ids:[profile.source.id]}:fit?{text:profile&&/\bglobally\b/i.test(profile.quote)&&!/\b(?:not|never|no longer)\b/i.test(profile.quote)?'Global residential property operations.':'Residential property operations.',source_ids:profile?[profile.source.id]:signals[0].source_ids.slice(0,1)}:vendorSource?{text:'Software or technology provider; property operations are not established.',source_ids:[vendorSource.id]}:null;
  // Useful company statements can be displayed without turning them into housing
  // fit or buyer intent. Keep original quotes beside concise display text.
  const companyName=norm(lead.company).toLowerCase(),brand=companyName.split(' ')[0],used=new Set([portfolio?.quote,markets?.quote,shortProfile?.text]);
  const topics=[
    ['ownership','Ownership',/\b(?:owned by|subsidiary of|part of|publicly.traded|privately.held|REIT|investment trust)\b/i],

    ['team','Team & headquarters',/\b(?:employees|workforce|headquartered|headquarters|based in)\b/i],
    ['operations','Operating model',/\b(?:managing our own|own(?:ing)? our|centraliz\w*|regional teams|in.house|third.party management|fee management|owner.operator|manage on behalf)\b/i],
    ['segments','Housing focus',/\b(?:student housing|affordable housing|single.family rental|senior living|active adult|mixed.use|luxury apartment)\b/i],
    ['workflow','Leasing & resident services',/\b(?:leasing teams?|resident services?|maintenance requests?|prospect inquiries|tour scheduling|resident communication)\b/i],
    ['technology','Software in use',/\b(?:uses?|using|runs? on|implemented|adopted|migrated to)\b.{0,70}\b(?:Yardi|Entrata|RealPage|ResMan|AppFolio|Salesforce|EliseAI)\b/i],
    ['initiative','Published initiatives',/\b(?:announced|launched|opened|acquired|expanded|expanding|centralizing)\b/i],
    ['markets','Operating footprint',/\b(?:communities|properties|offices|operations)\b.{0,60}\b(?:in|across|throughout)\b/i]
  ];
  const context=[];
  for(const [key,label,test] of topics){
    for(const source of sources.filter(s=>s.name_matched)){
      const quote=statements(source).find(quote=>{
        if(lowValue(quote)||quote.length>600||used.has(quote)||!companyName||!test.test(quote)||/[:;]$/.test(quote))return false;
        if(key==='markets'&&markets)return false;
        if(key==='markets'&&(/\b(?:announce\w*|expan\w*|addition|acquir\w*)\b/i.test(quote)||/\b(?:pipeline|development|construction|billion|million dollars)\b/i.test(quote)||!/(?:\b(?:in|across|throughout)\s+(?:[A-Z][a-z]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))/.test(quote)))return false;
        if(key==='ownership'&&/\b(?:acquir\w*|portfolio|community|communities|properties)\b/i.test(quote)&&!/\b(?:owned by|subsidiary|REIT|investment trust)\b/i.test(quote))return false;
        if(['operations','team'].includes(key)&&/\b20(?:0\d|1\d|2[0-3])\b/.test(quote))return false;
        if(key==='technology'&&(/\b(?:don[’']t|doesn[’']t|didn[’']t)\b/i.test(quote)||/\b(?:not|never|no longer|plan|plans|planning|considering|may|might|could|will|would|should|if|customers?|clients?|integrat\w*|experience|familiarity|requirements?)\b/i.test(quote)||NON_OPERATORS.has(classification.kind)))return false;
        if(key==='initiative'&&(!source.published_at||!Number.isFinite(Date.parse(source.published_at))||Date.now()-Date.parse(source.published_at)>365*86400000||Date.parse(source.published_at)>Date.now()||/\b(?:customers?|clients?|may|might|could|if)\b/i.test(quote)))return false;
        const normalized=norm(quote).toLowerCase(),named=(' '+normalized.replace(/[,.’']/g,' ')+' ').includes(' '+companyName+' ');
        const possessive=brand.length>=4&&!/^(?:the|first|national|united|american|general)$/.test(brand)&&[brand+"’s ",brand+"'s "].some(prefix=>normalized.startsWith(prefix));
        if(['technology','initiative'].includes(key)&&!normalized.startsWith(companyName+' ')&&!possessive&&!/^(?:we|our|the company)\b/i.test(quote))return false;
        if(!named&&!possessive&&!/^(?:we|our|the company|owning our|managing our)\b/i.test(quote))return false;
        return !/\b(?:our clients|our customers|customer story|privacy|cookies|copyright|sign up|subscribe|proudly|believes that|mission|core values)\b/i.test(quote);
      });
      if(quote){context.push({key,label,text:conciseContext(key,quote),quote,source_id:source.id,published_at:source.published_at});used.add(quote);break}
    }
  }

  return {version:3,company_kind:classification.kind,classification,sources,profile:profile?{text:profile.quote,source_id:profile.source.id}:null,summary:vendorSource?{text:classification.label+'.',source_ids:[vendorSource.id]}:shortProfile,
    portfolio:portfolio?{...portfolio,alternatives,conflict:alternatives.length>0}:null,retail_area:retail,development_total:development,property_count:candidates.find(c=>c.unit==='properties')||null,footprint:markets,context,signals,
    recommendation:{label:'Outreach hypothesis',title:fit?'Explore the leasing workflow':'Establish the operating context',
      reason:fit?'Use the published operating context to ask about the current workflow. Pain, scope and buying intent still need confirmation.':'Start with the contact’s responsibilities and operating model before suggesting a solution.',question},
    gaps:DISCOVERY_FIELDS,
    limitations:['Company statements are self-reported; a matching name and domain is an identity check, not independent verification.','Portfolio figures describe the company, not this property or a confirmed sales opportunity.','No source establishes this contact’s authority, budget, buying intent or connection to the submitted property.']};
}

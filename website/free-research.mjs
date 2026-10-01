import {portfolioStatStatements} from './portfolio-statements.mjs';
import {buildBrief,cleanText,sourceURL} from './brief.mjs';
import {companyEvidence,safeDomain} from './domain.mjs';
import {NON_OPERATORS} from './company-classification.mjs';

export const RESEARCH_ENGINE='reader-v2';
export function retainCompanyEvidence(fresh=[],previous=[],stale=false){
 const current=Array.isArray(fresh)?fresh:[],prior=Array.isArray(previous)?previous:[];
 if(!stale)return current;
 // A partial refresh may replace a page, but cannot erase unfetched pages.
 const replaced=new Set(current.map(e=>e.url));
 return [...current,...prior.filter(e=>!replaced.has(e.url))].slice(0,20);
}
// Free-only: anonymous Reader requests never attach credentials, even if a caller supplies one.
export function readerRequest(target,companyDomain,apiKey=''){
 const url=sourceURL(target,companyDomain);
 if(!safeDomain(companyDomain)||!url)throw Error('Invalid company URL');
 const headers={Accept:'application/json','X-Respond-With':'markdown','X-Retain-Images':'none','X-Cache-Tolerance':'3600','X-Timeout':'10','X-Robots-Txt':'InboundDesk'};
 return {url:'https://r.jina.ai/'+url,options:{method:'GET',redirect:'manual',headers,signal:AbortSignal.timeout(12000)}};
}
// Search is discovery only. Its summaries never enter the score or email.
export function discoveryRequest(){throw Error('Paid discovery is disabled; use public company links.')}
export function discoveryURLs(result,companyDomain){
 if(result?.code!==200||!Array.isArray(result.data))return [];
 return [...new Set(result.data.map(item=>sourceURL(item.url,companyDomain)).filter(url=>url&&!/\.(?:pdf|png|jpg|zip|svg)$/i.test(new URL(url).pathname)))].slice(0,3);
}
// Continue beyond a thin homepage; select only safe, unvisited official pages.
export function nextCompanyPage({domain,preferred='',pages=[],visited=new Set(),alternatives=[],enough=false}){
 const canonical=url=>url.replace('://www.','://').replace(/\/$/,'');
 const housingLinks=pages.flatMap(p=>p.links||[]).filter(url=>/multifamily|multi-family|residential|apartment|rental-housing/i.test(url));
 const candidates=enough?[...housingLinks,...(pages.flatMap(p=>p.locations||[]).length?[]:pages.flatMap(p=>p.location_links||[]))]:[preferred,...pages.flatMap(p=>p.links||[]).sort((a,b)=>Number(/about|overview|management|portfolio/i.test(b))-Number(/about|overview|management|portfolio/i.test(a))),'https://'+domain+'/',...alternatives];
 return candidates.map(url=>sourceURL(url,domain)).find(url=>url&&!visited.has(canonical(url)))||null;
}
function plain(markdown){
 return cleanText(markdown.replace(/!\[[^\]]*\]\([^\n]*?\)/g,'').replace(/\[([^\]]*)\]\([^\n]*?\)/g,'$1').replace(/[*_`]/g,''));
}
export function readerPage(result,companyDomain,company=''){
 const data=result?.data,url=sourceURL(data?.url,companyDomain);
 if(result?.code!==200||!url||typeof data.content!=='string'||(data.httpStatus&&data.httpStatus!==200))throw Error('Invalid Reader page');
 if(/access denied|just a moment|security (?:check|verification)|robot check|page not found/i.test(data.title||''))throw Error('Unavailable page');
 const content=data.content.slice(0,500000).replace(/^\[Company page\]\([^\n]*\)\s*$/gm,'');
 // Keep complete paragraphs and qualifiers; rank operating context above navigation.
 const statisticBlocks=portfolioStatStatements(plain(content));
 const candidates=plain(content).split(/\n\s*\n/).flatMap(s=>s.length>2200?s.split(/(?<=[.!?])\s+(?=[A-Z])/):[s]).map(s=>s.replace(/\s+/g,' ').trim()).filter(s=>s.length>=35&&s.length<=2200&&!/^[-=|]+$/.test(s)).concat(statisticBlocks);
 const rank=s=>Number(/\b(own\w*|manag\w*|operat\w*|portfolio)\b/i.test(s))*3+Number(/\b(apartment|residential|multifamily|rental|leasing|communities)\b/i.test(s))*2+Number(/\b\d[\d,]*\s+(?:apartments?|residences|homes|units|properties|markets)/i.test(s))*3+Number(/\b(headquartered|based in|provides|specializes|REIT|employees|workforce|owned by|integrated approach|managing our own|owning our|centraliz\w*|third.party management|fee management|Yardi|Entrata|RealPage|ResMan|AppFolio|Salesforce|EliseAI|announced|acquired|expanded)\b/i.test(s))*2-Number(/cookies?|privacy|all rights reserved|subscribe/i.test(s))*10;
 const selected=[...new Set(candidates)].sort((a,b)=>rank(b)-rank(a)).filter(s=>rank(s)>0).slice(0,8);
 const tokens=(company.match(/[A-Za-z]+/g)||[]).filter(t=>t.length>2&&!['llc','inc','the','group'].includes(t.toLowerCase()));
 const names=text=>tokens.length&&tokens.every(t=>new RegExp('\\b'+t+'\\b','i').test(text));
 // Legal names often appear only in the footer. Retain that line as identity evidence,
 // without treating copyright text as an operating fact.
 const identity=plain(content).split(/\n/).map(s=>s.trim()).find(s=>s.length<300&&names(s));
 if(identity&&!names(String(data.title)+' '+selected.join(' ')))selected.unshift(identity);
 const highlights=[''];for(const text of selected){let i=highlights.length-1;if(highlights[i].length+text.length+2>2300){if(highlights.length===2)continue;highlights.push('');i++}highlights[i]+=(highlights[i]?'\n\n':'')+text}
 const links=[];
 const discoveryContent=content+'\n'+(Array.isArray(data.links)?data.links:[]).map(l=>'['+String(l.text||'Company page').replace(/[\[\]\n\r]/g,' ')+']('+l.url+')').join('\n');
 for(const match of discoveryContent.matchAll(/(?<!!)\[([^\]\n]{1,120})\]\(([^\s)]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\)/g)){
  try{
   const candidate=sourceURL(new URL(match[2],url).href,companyDomain);if(!candidate)continue;
   const u=new URL(candidate);if(u.search||candidate===url||/\.(?:pdf|jpg|png|zip|svg|webp|gif|ico)$/i.test(u.pathname)||/^(?:media|images|cdn|assets)\./i.test(u.hostname))continue;
   const label=match[1]+' '+u.hostname+' '+u.pathname;
   if(/\/(?:blog|authors?|news|events|login|residents?)(?:\/|$)|portal|sign.in|belonging|diversity|culture|brand-promises|history|values|awards|recognition/i.test(label))continue;
   const score=/multifamily|multi-family|residential|apartment|rental-housing|apartment-living/i.test(label)&&/management|operations|services|portfolio|business|apartment-living/i.test(label)?6:/corporate[-/](?:overview|profile)|company-information/i.test(label)||/^investors?(?: relations)?$/i.test(match[1].trim())||/^investors?\./i.test(u.hostname)?5:/about|who-we-are|our-company|company-overview|our-story|what-we-do/i.test(label)?4:/contact|offices|headquarters/i.test(label)?1:/services|management|portfolio|business|corporate/i.test(label)?3:/investor/i.test(label)?2:0;
   if(score)links.push({url:candidate,score});
  }catch{/* Ignore malformed or unrelated links. */}
 }
 const nextLinks=[...new Set(links.sort((a,b)=>b.score-a.score).map(l=>l.url))].slice(0,6);
 const locationLinks=[...new Set(links.filter(l=>/contact|offices|headquarters/i.test(l.url)).sort((a,b)=>Number(/offices|headquarters/i.test(b.url))-Number(/offices|headquarters/i.test(a.url))).map(l=>l.url))].slice(0,3);
 return {extraction_version:2,passages:candidates.slice(0,40).map(s=>s.slice(0,1200)),publishedDate:typeof data.publishedDate==='string'&&Number.isFinite(Date.parse(data.publishedDate))?data.publishedDate:null,title:plain(String(data.title||companyDomain)).slice(0,300),url,highlights:highlights.filter(Boolean),next:nextLinks[0]||null,links:nextLinks,location_links:locationLinks};
}
export function researchHasContext(lead,pages){
 const result=readerEvidence(lead,pages),brief=buildBrief({...lead,evidence:result.evidence},safeDomain(lead.website||lead.email.split('@').at(-1)));
 const canonical=url=>url.replace('://www.','://').replace(/\/$/,'');
 const fetched=new Set(pages.map(p=>canonical(p.url)));
 const housingUnseen=pages.flatMap(p=>p.links||[]).some(url=>/multifamily|multi-family|residential|apartment|rental-housing/i.test(url)&&!fetched.has(canonical(url)));
 // A commercial/software page cannot end research while an observed housing
 // business page remains unread. This also enables the free HTML fallback.
 if(NON_OPERATORS.has(brief.company_kind)&&housingUnseen)return false;
 return !!(brief.summary&&(brief.portfolio||NON_OPERATORS.has(brief.company_kind)));
}
export function readerEvidence(lead,pages){
 const result=companyEvidence(lead,{results:pages},'Jina Reader');
 result.evidence=result.evidence.map(e=>({...e,provider:pages.find(p=>p.url===e.url)?.provider||'Jina Reader'}));
 return {...result,engine:RESEARCH_ENGINE};
}
export function registryRequest(company){
 const params=new URLSearchParams({'filter[entity.legalName]':company.slice(0,200),'page[size]':'5'});
 return 'https://api.gleif.org/api/v1/lei-records?'+params;
}
const legalName=value=>String(value||'').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function registryEvidence(company,result){
 if(!Array.isArray(result?.data))throw Error('Invalid registry response');
 const matches=result.data.filter(r=>legalName(r.attributes?.entity?.legalName?.name)===legalName(company));
 // Never resolve a partial name, parent company or ambiguous match automatically.
 if(matches.length!==1||Number(result.meta?.pagination?.total||result.data.length)>5)return {status:'unmatched',provider:'GLEIF',message:'No unique exact legal-name match.'};
 const a=matches[0].attributes,lei=a.lei,entity=a.entity;
 if(!/^[A-Z0-9]{20}$/.test(lei||''))throw Error('Invalid LEI');
 const hq=entity.headquartersAddress||{};
 return {status:'name_match',provider:'GLEIF',legal_name:entity.legalName.name,lei,entity_status:entity.status||'',registration_status:a.registration?.status||'',headquarters:[...(hq.addressLines||[]),hq.city,hq.region,hq.postalCode,hq.country].filter(Boolean).join(', '),updated_at:a.registration?.lastUpdateDate||null,date:new Date().toISOString(),url:'https://api.gleif.org/api/v1/lei-records/'+lei,message:'Exact legal-name match only. Confirm this is the same business; no domain, contact or property relationship has been verified.'};
}

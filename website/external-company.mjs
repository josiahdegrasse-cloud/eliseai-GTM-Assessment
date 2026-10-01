import {professionalURL} from './professional-research.mjs';
import {cleanText} from './brief.mjs';
const normalize=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function externalCompanyFacts(company,domain,results,time=Date.now()){
 const facts=[];
 for(const page of (Array.isArray(results)?results:[])){
  const url=professionalURL(page.url);if(!url)continue;
  const host=new URL(url).hostname;if(host===domain||host.endsWith('.'+domain))continue;
  const text=cleanText(page.text||'');
  if(!text.toLowerCase().includes(domain))continue;
  const quote=text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/).map(s=>s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_#]/g,'').replace(/\s+/g,' ').trim()).find(s=>s.length>=35&&s.length<=450&&(' '+normalize(s)+' ').includes(' '+normalize(company)+' ')&&/\b(owns?|manages?|operates?|founded|headquartered|is (?:a|an))\b/i.test(s)&&!/@|\b(born|married|children|subscribe|cookies|log in|sign in|free trial|profile preview)\b/i.test(s));
  if(!quote)continue;
  const announcement=/businesswire|prnewswire|globenewswire|(?:^|\.)sec.gov$/i.test(host)||/press release/i.test(page.title||'');
  facts.push({url,quote,title:String(page.title||host).slice(0,180),official:false,published_at:Number.isFinite(Date.parse(page.publishedDate))?page.publishedDate:null,retrieved_at:new Date(time).toISOString(),basis:announcement?'Company announcement on an external site':'External published source'});
  if(facts.length===2)break;
 }
 return facts;
}

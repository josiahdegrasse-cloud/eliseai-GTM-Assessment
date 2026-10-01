// Local extraction and link discovery. No search provider, inference or credentials.
import {norm,compatibleName,namePattern,reverseProfileCandidates,namedBiographyPassage} from './professional-evidence.mjs';
import {safeDomain} from './domain.mjs';
import {sourceURL} from './brief.mjs';
const clean=s=>String(s||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_#]/g,'').trim();
const roleStart=/^(?:(?:senior|sr|junior|jr|executive|regional|national|global|group|assistant|associate|managing|co|vice|property|portfolio|residential|commercial|asset|account|pricing|systems|and|operations|financial|human|resources|marketing|leasing|maintenance|business|software|technology)\s+){0,8}(?:chief|ceo|cfo|coo|cto|president|director|manager|officer|supervisor|partner|founder|chairman|chairwoman|chair|vp|svp|evp|head|administrator|engineer|analyst|specialist|coordinator|consultant|lead)\b/i;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function personPublicationDate(data){
 for(const value of [data.publishedDate,data.publishedTime])if(value&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
 if(!/news|press/i.test(new URL(data.url).pathname))return null;
 const date=String(data.content||'').slice(0,180000).match(/(?:^|\n)\s*(\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})\s*(?:\n|$)/)?.[1];
 const parts=date?.split('/'),iso=parts?.length===3?parts[2]+'-'+parts[0].padStart(2,'0')+'-'+parts[1].padStart(2,'0'):date;
 return iso&&Number.isFinite(Date.parse(iso))?new Date(iso).toISOString():null;
}
export function freePersonCandidates(lead,page){
 if(String(page.text||'').includes('\u241e')){const parts=page.text.split('\u241e').map(text=>freePersonCandidates(lead,{...page,text,profile_blocks:(page.profile_blocks||[]).filter(b=>norm(text).includes(norm(b)))}));return {people:parts.flatMap(p=>p.people).slice(0,3),insights:parts.flatMap(p=>p.insights).slice(0,2)}}
 const body=clean(page.text||''),lines=body.split(/\n+/).map(s=>s.trim()).filter(Boolean),people=[],insights=[];
 const isName=s=>norm(s).split(' ').length<=5&&compatibleName(s,lead.name);
 const trimRole=s=>s.replace(new RegExp('\\s+(?:of|at|for)\\s+(?:the\\s+)?'+esc(lead.company)+'(?:[.,]|$).*','i'),'').split(/\s+(?:where|leading|overseeing)\s+|,?\s+and\s+(?:leads|oversees|manages|joined)\s+/i)[0].replace(/[,;:.|–—-]+$/,'').trim();
 const add=(role,quote)=>{role=trimRole(role);if(!roleStart.test(norm(role))||role.length>160||quote.length>650||people.some(p=>p.role===role))return;people.push({name:lead.name,company:lead.company,role,quote,url:page.url,historical:false});};
 for(const p of reverseProfileCandidates(lead,page))add(p.role,p.quote);
 // Explicit company-authored attribution, e.g. "From our President, Jordan Lee".
 const attribution=new RegExp('\\bFrom our ([^\\n.!?]{3,140}?),\\s*('+namePattern(lead.name).replaceAll(' ','[\\s.\\-]+')+')\\b','giu');
 for(const m of body.matchAll(attribution))add(m[1],m[0]);
 for(let i=0;i<lines.length;i++){
  if(isName(lines[i])&&lines[i+1])add(lines[i+1],lines[i]+'\n'+lines[i+1]);
  else if(lines[i+1]&&isName(lines[i]+' '+lines[i+1])&&lines[i+2])add(lines[i+2],lines[i]+'\n'+lines[i+1]+'\n'+lines[i+2]);
 }
 const names=new RegExp('\\b'+namePattern(lead.name).replaceAll(' ','[\\s.\\-]+')+'\\b','giu');
 for(const match of body.matchAll(names)){
  const tail=body.slice(match.index+match[0].length,match.index+650);
  const title=tail.match(/^[\s,|:–—-]+(?:(?:co[ -]?)?founder of the company,\s*)?(?:(?:is|serves as|has served as|currently serves as|is currently|has been promoted to|will now serve as|now serves as)\s+(?:(?:a|an|the)\s+)?)?([^\n.!?]{3,200})/i);
  if(title){const sentence=tail.split(/(?<=[.!?])\s+(?=[A-Z])/)[0],quote=match[0]+(sentence.length+match[0].length<=650?sentence:title[0]);add(title[1],quote.trim());}
 }
 // Keep a name-led passage and its adjoining sentences together. This lets
 // a biography's "she oversees…" retain explicit attribution to the full name.
 for(const paragraph of body.split(/\n\s*\n/)){
  const sentences=paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);
  for(let i=0;i<sentences.length;i++){
   const namedBio=namedBiographyPassage(lead,page,sentences[i]);
   if(sentences[i].includes('\n')||!namedBio&&!new RegExp('^'+namePattern(lead.name)+'(?: |$)').test(norm(sentences[i])))continue;
   let quote=sentences[i].trim();
   for(let j=i+1;j<Math.min(sentences.length,i+3);j++){
    const next=sentences[j].trim();
    if(!/^(?:He|She|They|His|Her|Their|As |Recognized for |In (?:this|that|her|his|their) |With )\b/.test(next)||quote.length+next.length+1>650||/\b(?:family|children|married|spouse|hobbies|spare time)\b/i.test(next))break;
    quote+=' '+next;
   }
   const work=/\b(?:oversees|responsible for|leads|manages|oversight|leading|experience|expertise|joined|tenure)\b/i;
   if(quote.length>650||!work.test(quote))continue;
   const historical=/\b(?:prior to|previously|formerly|until 20\d\d|served .{0,50} at)\b/i.test(quote);
   const responsibility=!historical&&/\b(?:oversees|responsible for|leads|manages|oversight|leading.{0,70}teams)\b/i.test(quote);
   insights.push({name:lead.name,company:lead.company,kind:responsibility?'responsibility':'experience',quote,url:page.url,...(namedBio?{subject_basis:'named_biography'}:{})});
  }
 }
 return {people:people.slice(0,3),insights:insights.slice(0,2)};
}
export function personLinks(lead,page){
 const host=safeDomain(lead.website)||new URL(page.url).hostname.replace(/^www\./,''),name=norm(lead.name).split(' '),first=name[0],last=name.at(-1);
 const links=[...(page.links||[])];
 for(const m of String(page.text||'').matchAll(/(?<!!)\[([^\]\n]{1,160})\]\(([^\s)]+)\)/g))try{links.push({url:new URL(m[2],page.url).href,text:m[1]})}catch{}
 const ranked=[];
 for(const item of links){
  const url=sourceURL(item.url,host);if(!url)continue;const u=new URL(url);u.hash='';
  if([...u.searchParams.keys()].some(k=>!/^itemid$|^id$/i.test(k))||/\.(?:xml|pdf|png|jpe?g|zip|svg|webp|gif|ico)$/i.test(u.pathname)||/\/(?:login|privacy|jobs|residents|properties|communities|storybook|components|authors|corporate-apartments)(?:\/|$)/i.test(u.pathname))continue;
  if(/^(?:jobs|login|portal|resident)\./i.test(u.hostname))continue;
  const careers=/^careers\./i.test(u.hostname)||/\/careers(?:\/|$)/i.test(u.pathname),careerCulture=/\b(?:inclusion|culture|belonging|about|leadership)\b/i.test(u.pathname),careerHome=/^\/(?:[a-z]{2}\/[a-z]{2}\/?)?$/i.test(u.pathname)||/^\/careers\/?$/.test(u.pathname);
  if(careers&&!careerCulture&&!careerHome)continue;
  let decoded;try{decoded=decodeURI(u.pathname)}catch{continue}
  if(/[{}]/.test(decoded))continue;
  const label=norm(item.text),path=norm(decoded),hay=label+' '+path;
  const exact=compatibleName(item.text,lead.name)||((' '+hay+' ').includes(' '+first+' ')&&(' '+hay+' ').includes(' '+last+' '));
  const editorial=/\/(?:blog|news|newsroom|press|events|stories|resources)(?:\/|$)/i.test(u.pathname);
  const directory=/\b(?:leadership|our people|our team|team|management team|officers|trustees|directors and management|executive officers|senior management)\b/.test(hay);
  const leadershipNews=/promotions?|succession|changes.{0,25}leadership|appoint/.test(hay)&&/(?:leadership|executive|officer|president|ceo|chair)/.test(hay);
  const newsIndex=(/\b(?:news|press releases|newsroom)\b/.test(label)||/\/(?:news|press-releases|newsroom)\/?(?:default\.aspx)?$/i.test(u.pathname))&&!/news.details|\/20\d\d|blog|stories/i.test(u.pathname)&&!/(?:webcasts?|presentations?|upcoming events)/.test(label);
  const investorEntry=/investors?|corporate profile|corporate overview/.test(hay)&&!/(?:governance|stock|financial|presentation|events|resources|faq|email|alerts)/.test(hay);
  const score=exact?100:careers?(careerCulture?60:35):leadershipNews?80:editorial&&!newsIndex?0:directory?70:/^(?:about(?: us)?|who we are|our company|company overview)$/.test(label)?65:/\b(?:tenant|resident) resources\b|contact.{0,15}(?:team|management)/.test(hay)?55:newsIndex?50:investorEntry?45:/about|who we are|our company|company overview|business/.test(hay)?30:/corporate responsibility|governance/.test(hay)?15:/contact/.test(hay)?5:0;
  if(score)ranked.push({url:u.href,score});
 }
 // A plain URL repeated in the footer must not erase a labeled team link's rank.
 const unique=new Map();for(const item of ranked.sort((a,b)=>b.score-a.score))if(!unique.has(item.url))unique.set(item.url,item);
 return [...unique.values()];
}
export function sitemapLinks(xml,base,domain){
 if(!/<(?:urlset|sitemapindex)\b/i.test(xml))return [];
 const links=[];for(const m of xml.matchAll(/<loc(?:\s[^>]*)?>\s*(?:<!\[CDATA\[)?([^<]+?)(?:\]\]>)?\s*<\/loc>/gi)){
  const value=m[1].replace(/&amp;/g,'&').trim(),url=sourceURL(value,domain);if(url)links.push({url,text:''});if(links.length>=3000)break;
 }
 return links;
}

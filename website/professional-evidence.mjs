// Extractive person matching. Provider suggestions are candidates, never evidence.
import {safeDomain,domain} from './domain.mjs';
export const norm=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const roleWords=s=>norm(s).replace(/\bceo\b/g,'chief executive officer').replace(/\bcfo\b/g,'chief financial officer').replace(/\bcoo\b/g,'chief operating officer').replace(/\bcto\b/g,'chief technology officer').replace(/\bsvp\b/g,'senior vice president').replace(/\bevp\b/g,'executive vice president').replace(/\bvp\b/g,'vice president').replace(/\bsr\b/g,'senior').replace(/\bjr\b/g,'junior');
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const contains=(s,v)=>!!norm(v)&&(' '+norm(s)+' ').includes(' '+norm(v)+' ');
const clean=s=>String(s||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]+>/g,'').replace(/[*_#]/g,'');
const text=s=>clean(s).replace(/\s+/g,' ').trim();
const sensitive=s=>/\b(born|married|spouse|children|wife|husband|religion|diagnosed|home address)\b|\S+@\S+/i.test(s);
export function professionalURL(value){try{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^gclid$|^fbclid$/i.test(key))u.searchParams.delete(key);return safeDomain(u.href)?u.href:''}catch{return ''}}
export const professionalKey=lead=>[norm(lead.name),norm(lead.company),domain(lead)].join('|');
export function namedBiographyPassage(lead,page,quote){
 const parts=norm(lead.name).split(' '),path=norm(new URL(page.url).pathname);
 return (' '+path+' ').includes(' '+parts[0]+' ')&&(' '+path+' ').includes(' '+parts.at(-1)+' ')
  &&new RegExp('^(?:'+esc(parts[0])+"(?:['’]s)?\\b|As [^.!?]{1,100}, "+esc(parts[0])+'\\b)','i').test(quote.trim());
}
export function compatibleName(a,b){const x=norm(a).split(' '),y=norm(b).split(' ');return x.length>=2&&y.length>=2&&x[0]===y[0]&&x.at(-1)===y.at(-1)&&(x.length===2||y.length===2||x.slice(1,-1).length===y.slice(1,-1).length&&x.slice(1,-1).every((v,i)=>v===y[i+1]||(v.length===1||y[i+1].length===1)&&v[0]===y[i+1][0]));}
export function namePattern(name){const a=norm(name).split(' '),middle=a.slice(1,-1);return esc(a[0])+' '+(middle.length?'(?:'+middle.map(v=>v.length===1?esc(v)+'[a-z]*':esc(v)+'|'+esc(v[0])).map(v=>'(?:'+v+')').join(' ')+' )?':'(?:[a-z] )?')+esc(a.at(-1));}
const hasName=(s,name)=>new RegExp('(?:^| )'+namePattern(name)+'(?: |$)').test(norm(s));
export function reverseProfileCandidates(lead,page){
 // Reverse title/name order is accepted only inside a single HTML paragraph or
 // profile card with exactly two lines. Never infer it from flattened neighbors.
 return (page.profile_blocks||[]).flatMap(block=>{
  const lines=block.split(/\n+/).map(s=>s.trim()).filter(Boolean);if(lines.length!==2||lines[0].length>160)return [];
  const m=lines[1].match(/^([^|\d]+?)(?:\s*\|?\s*\+?[\d ().+-]{7,})?$/);
  if(!m||!compatibleName(m[1].trim(),lead.name))return [];
  return [{role:lines[0],quote:lines[0]+'\n'+m[1].trim()}];
 });
}
function associated(quote,name,role,page){const n=namePattern(name),r=esc(roleWords(role)),q=roleWords(quote);return new RegExp('(?:^| )'+n+' (?:(?:co founder|founder) of the company )?(?:(?:is|is a|is an|is the|serves as|serves as the|has been|has served as|currently serves as|is currently|has been promoted to|will now serve as|now serves as|was|formerly served as) )?'+r+'(?: |$)').test(q)||new RegExp('^from our '+r+' '+n+'$').test(q)||!!page&&reverseProfileCandidates({name},page).some(p=>norm(p.quote)===norm(quote)&&roleWords(p.role)===roleWords(role));}
function employerIn(page,lead){const d=domain(lead),brand=d.split('.')[0];return contains(page.title+' '+page.text,lead.company)||(brand.length>=4&&norm(lead.company).replaceAll(' ','').startsWith(brand)&&contains(page.title+' '+page.text,brand));}
// Recover only consecutive heading lines, or an explicit name-role sentence.
// Never bridge a different person's card or synthesize an excerpt.
function recoverQuote(page,lead,role){
 const raw=clean(page.text||''),lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
 // Some readers flatten an entire biography into one long line. Locate an
 // actual name-led sentence before considering directory heading pairs.
 const names=new RegExp('\\b'+namePattern(lead.name).replaceAll(' ','[\\s.\\-]+')+'\\b','giu');
 for(const match of raw.matchAll(names)){
  const tail=raw.slice(match.index+match[0].length,match.index+650),sentence=match[0]+tail.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  if(!sentence.includes('\n')&&new RegExp('^'+namePattern(lead.name)+' (?:is|serves|has|currently|was|formerly) ').test(norm(sentence))&&associated(sentence,lead.name,role))return sentence.trim();
 }

 for(let i=0;i<lines.length;i++){
  if(!hasName(lines[i],lead.name)||lines[i].length>650)continue;
  if(associated(lines[i],lead.name,role))return lines[i];
  if(norm(lines[i]).split(' ').length>norm(lead.name).split(' ').length+2)continue;
  const next=lines[i+1];if(next&&roleWords(next).startsWith(roleWords(role))&&next.length<=180)return lines[i]+'\n'+next;
 }
 return '';
}
const historic=(q,published,time)=>/\b(former|formerly|previously|retired|resigned|departed|stepped down|until 20\d\d|will (?:join|become))\b/i.test(q)||/\bwas\b(?! (?:appointed|promoted|named))/i.test(q)||!!(published&&(time-Date.parse(published)>548*86400000||Date.parse(published)>time));
export function professionalEmployerConflict(lead,s,role){
 // A company publishing a customer/partner story is not the person's employer.
  if(s.official&&/customer[\s/-]*(?:stor|spotlight|success)|client[\s/-]*(?:stor|spotlight)|case[\s/-]*stud|testimonials?|partner[\s/-]*spotlight/i.test(new URL(s.url).pathname+' '+s.title))return 'non_employer_source';
  const roleText=roleWords(role),quoteText=roleWords(s.quote);
  const suffix=roleText.match(/\b(?:at|for) (.+)$|\b(?:chief (?:executive|financial|operating|technology) officer|ceo|cfo|coo|cto|president|founder|partner|chairman|chairwoman) of (.+)$/);
  const claimed=suffix?.[1]||suffix?.[2];
  // Unremoved employer language cannot be promoted as part of a job title.
  // Department titles such as President of Operations remain ordinary roles.
  if(claimed&&!/^(?:operations|finance|marketing|leasing|technology|property management|(?:the )?board(?: of (?:directors|trustees|trust managers))?)$/.test(claimed)&&!contains(lead.company,claimed))return 'explicit_other_employer';
  const after=quoteText.match(new RegExp(esc(roleText)+' (?:at|for|of) (.+)$'))?.[1];
  if(after&&!after.startsWith(norm(lead.company)))return 'explicit_other_employer';
 return null;
}
// A generic directory title and a fuller department title on current official
// employer pages are compatible. Different departments still need review.
function officialRoleDetail(a,b){
 if(!a.official||!b.official||norm(a.company)!==norm(b.company))return false;
 const x=roleWords(a.role),y=roleWords(b.role),generic=/^(?:(?:senior|executive|regional|assistant) )?(?:vice president|director|manager|president)$/;
 return [[x,y],[y,x]].some(([short,long])=>generic.test(short)&&long.startsWith(short+' ')&&!/\b(?:and|chief|officer|president|founder|partner|at|for)\b/.test(long.slice(short.length).trim()));
}
export function professionalEvidence(lead,run,pages,time=Date.now()){
 const base={version:3,input_key:professionalKey(lead),status:'complete',partial:run.stopReason==='budget_reached',people:[],insights:[],company_facts:[],checked_at:new Date(time).toISOString(),cost_dollars:Number.isFinite(run.costDollars?.total)?run.costDollars.total:null,research_diagnostics:{candidates:0,accepted:0,rejections:[]}};
 const reject=(reason,item={})=>base.research_diagnostics.rejections.push({reason,url:professionalURL(item.url),role:text(item.role).slice(0,160)});
 if(run.status!=='completed'||['error','cancelled'].includes(run.stopReason)){reject('provider_incomplete');return {...base,status:'unavailable'};}
 const d=domain(lead),grounded=new Set((run.output?.grounding||[]).flatMap(g=>g.citations||[]).map(c=>professionalURL(c.url)).filter(Boolean));
 function sourceFor(item,{recover=false}={}){
  const url=professionalURL(item.url);if(!url){reject('unsafe_source',item);return null;}if(!grounded.has(url)){reject('missing_citation',item);return null;}
  const page=pages.find(p=>professionalURL(p.url)===url);if(typeof page?.text!=='string'||!page.text.trim()){reject('page_unavailable',item);return null;}
  const host=new URL(url).hostname,official=host===d||host.endsWith('.'+d);
  let quote=text(item.quote),recovered=false;
  if(recover&&official&&employerIn(page,lead)&&(!norm(clean(page.text)).includes(norm(quote))||!associated(quote,lead.name,item.role,page))){const extracted=recoverQuote(page,lead,item.role);if(extracted){quote=extracted;recovered=true;}}
  if(quote.length<15||quote.length>650||sensitive(quote)){reject('unsuitable_excerpt',item);return null;}
  if(!norm(clean(page.text)).includes(norm(quote))){reject('excerpt_not_on_page',item);return null;}
  const published=Number.isFinite(Date.parse(page.publishedDate))?page.publishedDate:null;
  return {url,quote,title:text(page.title).slice(0,180)||host,official,published_at:published,retrieved_at:Number.isFinite(Date.parse(page.retrieved_at))?page.retrieved_at:base.checked_at,recovered,employer_supported:employerIn(page,lead)};
 }
 const candidates=Array.isArray(run.output?.structured?.people)?run.output.structured.people:[];
 if(!candidates.length)reject('no_candidate');
 for(const item of candidates.slice(0,3)){
  base.research_diagnostics.candidates++;
  if(!compatibleName(item.name,lead.name)){reject('name_mismatch',item);continue;}
  const s=sourceFor(item,{recover:true}),role=text(item.role).slice(0,160);if(!s)continue;
  const employerConflict=professionalEmployerConflict(lead,s,role);if(employerConflict){reject(employerConflict,item);continue;}
  const shortEmployer=norm(item.company),officialBrand=s.official&&s.employer_supported&&shortEmployer.length>=3&&!['the','group','property','real estate'].includes(shortEmployer)&&norm(lead.company).startsWith(shortEmployer+' ');
  if(!(contains(item.company,lead.company)||contains(s.quote,lead.company)||officialBrand)||(!s.official&&!contains(s.quote,lead.company))||(s.official&&!s.employer_supported)){reject('employer_mismatch',item);continue;}
  if(!hasName(s.quote,lead.name)){reject('name_missing_from_excerpt',item);continue;}
  if(!role||!contains(roleWords(s.quote),roleWords(role))||!/\b(chief|ceo|cfo|coo|cto|president|director|manager|head|founder|chair|partner|officer|vp|vice|associate|specialist|executive|engineer|analyst|coordinator|lead|consultant|supervisor|administrator)\b/i.test(role)){reject('title_missing_from_excerpt',item);continue;}
  if(!associated(s.quote,lead.name,role,pages.find(p=>professionalURL(p.url)===s.url))){reject('name_role_not_associated',item);continue;}
  const path=new URL(s.url).pathname,liveDirectory=s.official&&/team|leadership|our.people|biograph|executive.officers/i.test(path+' '+s.title)&&!/(?:news|press|20\d{2})/i.test(path);
  // A directory's original creation date is not the date of its current entries.
  const historical=!!item.historical||/news|press/i.test(path)&&!s.published_at||historic(s.quote,liveDirectory?null:s.published_at,time);
  s.freshness_basis=liveDirectory?'Current official directory listing; page publication date may predate this role':'Source publication date and wording';
  base.people.push({...s,name:lead.name,company:lead.company,role,historical});base.research_diagnostics.accepted++;
 }
 const current=base.people.filter(p=>!p.historical);
 // A directory's CEO and a biography's Founder and CEO can describe the same
 // position. Distinct executive functions still require review.
 const compatibleRoles=(a,b)=>{const x=roleWords(a),y=roleWords(b);return x===y||['chief executive officer','chief operating officer','chief financial officer','chief technology officer'].some(core=>x.includes(core)&&y.includes(core)&&!['chief executive officer','chief operating officer','chief financial officer','chief technology officer'].some(other=>other!==core&&(x.includes(other)!==y.includes(other))));};
 const conflict=current.some(a=>current.some(b=>!compatibleRoles(a.role,b.role)&&!officialRoleDetail(a,b)));
 base.match=current.length?(conflict?'review':'name_company_match'):base.people.length?'historical':'unresolved';
 // Insights are shown only for a matched current person, with their own evidence.
 if(current.length&&base.match!=='review')for(const item of (run.output?.structured?.insights||[]).slice(0,3)){
  if(!['responsibility','experience','activity'].includes(item.kind)||!compatibleName(item.name,lead.name))continue;
  const s=sourceFor(item);if(!s||!(s.official?s.employer_supported:contains(s.quote,lead.company)))continue;
  const page=pages.find(p=>professionalURL(p.url)===s.url);
  const namedBio=item.subject_basis==='named_biography'&&s.official&&current.some(person=>person.url===s.url)&&namedBiographyPassage(lead,page,s.quote);
  if(!hasName(s.quote,lead.name)&&!namedBio)continue;
  if(item.kind==='activity'&&(!s.published_at||time-Date.parse(s.published_at)>365*86400000||Date.parse(s.published_at)>time))continue;
  if(!base.insights.some(i=>norm(i.quote)===norm(s.quote)))base.insights.push({...s,kind:item.kind});
 }
 for(const item of (run.output?.structured?.company_facts||[]).slice(0,2)){
  const s=sourceFor(item);if(!s||s.official||norm(item.company)!==norm(lead.company)||!contains(s.quote,lead.company))continue;
  const page=pages.find(p=>professionalURL(p.url)===s.url);if(!String(page.text).toLowerCase().includes(d))continue;
  const selfPublished=/businesswire|prnewswire|globenewswire|(?:^|\.)sec.gov$/i.test(new URL(s.url).hostname)||/press release/i.test(s.title);
  base.company_facts.push({...s,basis:selfPublished?'Company announcement on an external site':'External published source'});
 }
 // Collapse duplicate descriptions of the same current position, preferring
 // the descriptive role and then its fuller supporting biography excerpt.
 if(current.length>1&&base.match!=='review')base.people=[...current.sort((a,b)=>roleWords(b.role).length-roleWords(a.role).length||b.quote.length-a.quote.length).slice(0,1),...base.people.filter(p=>p.historical)];
 if(current.length&&base.match!=='review')base.conversation_starter={text:'In your role as '+current[0].role+', which operational process would you most like to improve?',source_url:current[0].url,basis:'Suggested question based on the listed role; responsibilities are not assumed.'};
 return base;
}

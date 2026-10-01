import {structuredProfiles} from './structured-profiles.mjs';
import {safeDomain} from './domain.mjs';
import {sourceURL} from './brief.mjs';

// A separate retrieval path for public HTML. Never forwards visitor/provider credentials,
// executes page scripts, follows off-domain redirects, or retries access challenges.
const retrievalError=(message,code)=>Object.assign(Error(message),{code});
const headers={Accept:'text/html,text/plain;q=0.9','User-Agent':'InboundDesk/1.0'};
export function publicAddress(ip){
 if(ip.includes(':'))return /^2[0-9a-f]{3}:/i.test(ip)&&!/^200[12]:|^2001:db8:/i.test(ip);
 const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 return !([0,10,127].includes(p[0])||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&(p[1]===168||p[1]===0||p[1]===2)||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&[18,19,51].includes(p[1])||p[0]===203&&p[1]===0);
}
export async function boundedText(response,max){
 const reader=response.body?.getReader();if(!reader)throw Error('Empty response');
 const parts=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw retrievalError('Response too large','response_too_large')}parts.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return new TextDecoder().decode(bytes);
}
export function robotsAllowed(text,path){
 const groups=[];let current=null,rulesStarted=false;
 for(const line of text.split(/\r?\n/)){
  const m=line.replace(/#.*/,'').trim().match(/^([^:]+):\s*(.*)$/);if(!m)continue;
  const key=m[1].trim().toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){if(!current||rulesStarted){current={agents:[],rules:[]};groups.push(current);rulesStarted=false}current.agents.push(value.toLowerCase())}
  else if(current&&['allow','disallow'].includes(key)){rulesStarted=true;if(value)current.rules.push({allow:key==='allow',path:value})}
 }
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&'inbounddesk'.startsWith(a))),selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const rules=selected.flatMap(g=>g.rules).filter(r=>{
  const end=r.path.endsWith('$'),pattern=(end?r.path.slice(0,-1):r.path).split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
  return new RegExp('^'+pattern+(end?'$':'')).test(path);
 }).sort((a,b)=>b.path.replace(/\*/g,'').length-a.path.replace(/\*/g,'').length||Number(b.allow)-Number(a.allow));
 return !rules.length||rules[0].allow;
}
export async function directPage(target,domain,{fetcher=fetch,signal=AbortSignal.timeout(10000),memo=new Map(),format='html'}={}){
 const safe=value=>{const url=sourceURL(value,domain);if(!url||!safeDomain(url))throw Error('Unsafe company URL');return url};
 const publicHost=async host=>{
  if(memo.has('dns:'+host))return;
  const records=await Promise.all(['A','AAAA'].map(async type=>{
   const r=await fetcher('https://dns.google/resolve?'+new URLSearchParams({name:host,type}),{headers:{Accept:'application/dns-json'},redirect:'manual',signal});
   if(!r.ok)throw retrievalError('DNS unavailable','dns_unavailable');const data=JSON.parse(await boundedText(r,30000));if(data.Status!==0)throw retrievalError('DNS unavailable','dns_unavailable');return data.Answer||[];
  }));
  const addresses=records.flat().filter(r=>[1,28].includes(r.type));if(!addresses.length||addresses.some(r=>!publicAddress(r.data)))throw retrievalError('Non-public company host','unsafe_host');
  memo.set('dns:'+host,true);
 };
 const get=async value=>{
  let url=safe(value);
  for(let redirects=0;redirects<=2;redirects++){
   await publicHost(new URL(url).hostname);
   const response=await fetcher(url,{method:'GET',headers,redirect:'manual',signal});
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('Location');await response.body?.cancel();if(!location)throw Error('Invalid redirect');url=safe(new URL(location,url).href);continue}
   return {response,url};
  }
  throw Error('Too many redirects');
 };
 const allowed=async url=>{
  const origin=new URL(url).origin,key='robots:'+origin;
  if(!memo.has(key)){
   const {response}=await get(origin+'/robots.txt');
   if(response.status===404||response.status===410)memo.set(key,'');
   else if(response.ok)memo.set(key,await boundedText(response,65000));
   else {await response.body?.cancel();throw retrievalError('Robots unavailable','robots_unavailable')}
  }
  if(!robotsAllowed(memo.get(key),new URL(url).pathname+new URL(url).search))throw retrievalError('Robots disallow','robots_disallowed');
 };
 // Validate robots on every redirect before fetching the next page.
 let url=safe(target);
 for(let redirects=0;redirects<=2;redirects++){
  await allowed(url);await publicHost(new URL(url).hostname);
  const response=await fetcher(url,{method:'GET',headers,redirect:'manual',signal});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('Location');await response.body?.cancel();if(!location)throw Error('Invalid redirect');url=safe(new URL(location,url).href);continue}
  if(!response.ok||!(format==='xml'?/^(?:text\/(?:xml|plain)|application\/xml)(?:;|$)/i:/^text\/html(?:;|$)/i).test(response.headers.get('Content-Type')||'')){await response.body?.cancel();throw retrievalError('Public HTML unavailable','public_html_unavailable')}
  const body=await boundedText(response,1500000);
  return format==='xml'?{url,body}:htmlPage(body,url);
 }
 throw Error('Too many redirects');
}
export async function htmlPage(html,url){
 let title='',content='',skip=0,inTitle=0,anchor=null,publishedDate=null;const links=[],profileBlocks=[],activeBlocks=new Set();
 // Phenom career sites declare a public navigation base and ph-href anchors.
 // Read only the JSON string value; never execute the surrounding script.
 let careerBase='';
 const config=html.match(/\bvar\s+phApp\s*=\s*phApp\s*\|\|\s*\{([^<]{0,1600})/)?.[1],baseValue=config?.match(/"baseUrl"\s*:\s*("(?:[^"\\]|\\.)*")/)?.[1];
 try{const b=new URL(JSON.parse(baseValue));if(b.protocol==='https:'&&b.origin===new URL(url).origin)careerBase=b.href}catch{}
 const block=/^(?:p|div|section|article|h[1-6]|li|tr|dt|dd|footer|address)$/;
 const rewriter=new HTMLRewriter().on('*',{element(el){
  const tag=el.tagName,excluded=/^(?:script|style|noscript|template|svg|nav|form|button)$/.test(tag)||el.hasAttribute('hidden')||el.getAttribute('aria-hidden')==='true';
  if(tag==='meta'&&/^(?:article:published_time|date|pubdate|DC.date.issued)$/i.test(el.getAttribute('property')||el.getAttribute('name')||'')){const value=el.getAttribute('content');if(Number.isFinite(Date.parse(value)))publishedDate=value;}
  if(excluded&&!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)){skip++;el.onEndTag(()=>skip--)}
  if(tag==='title'&&!skip){inTitle++;el.onEndTag(()=>inTitle--)}
  if(tag==='a'&&links.length<300){try{const ordinary=el.getAttribute('href'),value=ordinary||careerBase&&el.getAttribute('ph-href');if(value){const href=new URL(value,ordinary?url:careerBase);if(href.protocol==='https:'){anchor={url:href.href,text:''};links.push(anchor);el.onEndTag(()=>{anchor=null})}}}catch{}}
  if(!skip&&block.test(tag)){const card=/^(?:div|article|li)$/.test(tag)&&/(?:^|\s)(?:[\w-]*[-_])?(?:card|team-member|person|profile)(?:\s|$)/i.test(el.getAttribute('class')||'');content+='\n\n'+(card?'\u241e':'');for(const b of activeBlocks)b.text+='\n';let ownBlock=null;el.onEndTag(()=>{content+=(card?'\u241e':'')+'\n\n';for(const b of activeBlocks)b.text+='\n';if(ownBlock)activeBlocks.delete(ownBlock)});
   if((tag==='p'||card)&&profileBlocks.length<500){const b={text:''};profileBlocks.push(b);activeBlocks.add(b);ownBlock=b;}
  }
  if(!skip&&tag==='br'){content+='\n';for(const b of activeBlocks)b.text+='\n';}
 }}).onDocument({text(chunk){if(anchor)anchor.text=(anchor.text+chunk.text).slice(0,160);if(inTitle)title+=chunk.text;else if(!skip){content+=chunk.text;for(const b of activeBlocks)if(b.text.length<1000)b.text+=chunk.text}}});
 await rewriter.transform(new Response(html)).arrayBuffer();
 if(/access denied|just a moment|security (?:check|verification)|robot check|page not found/i.test(title))throw retrievalError('Unavailable page','page_unavailable');
 const decode=s=>s.replace(/&(?:amp|quot|apos|nbsp|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{
  const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' ','&lt;':'<','&gt;':'>'};if(named[m.toLowerCase()])return named[m.toLowerCase()];const n=m.slice(2,-1),code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
 });
 content=decode(content).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();
 const structured=structuredProfiles(html);
 for(const item of structured.links){try{links.push({...item,url:new URL(item.url,url).href})}catch{}}
 const navigation=[...new Set(links.map(l=>l.url))].map(href=>'[Company page]('+href+')').join('\n');
 return {code:200,data:{title:decode(title).trim(),url,httpStatus:200,publishedDate,content:content.replaceAll('\u241e','')+'\n\n'+navigation,profile_text:content+'\n\n'+navigation,profile_blocks:profileBlocks.filter(b=>b.text.length<=650).map(b=>decode(b.text).trim()),html,profiles:structured.profiles,links:links.map(l=>({...l,text:decode(l.text).trim()}))},retrieval:'Direct company website'};
}

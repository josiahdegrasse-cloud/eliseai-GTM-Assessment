import {safeDomain} from './domain.mjs';
import {sourceURL} from './brief.mjs';

const decode=s=>String(s||'').replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi,m=>{
 const names={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};
 if(names[m.toLowerCase()])return names[m.toLowerCase()];
 const n=m.slice(2,-1);const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);
 return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
});
function attributes(tag){
 const out={};for(const m of tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))out[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return out;
}
export function safeLogoURL(value,base){
 if(typeof value!=='string'||!value.trim())return '';
 try{const u=new URL(decode(value),base);if(!safeDomain(u.href)||u.href.length>1600||u.hash||/\.(?:html?|pdf|js|json|css)(?:$)/i.test(u.pathname))return '';return u.href}catch{return ''}
}
// Only explicit logo or site-icon declarations on the supplied company's page.
// No image search, generated branding, social-card images or arbitrary first photo.
export function logoCandidates(result,companyDomain,company){
 const data=result?.data,page=sourceURL(data?.url,companyDomain),html=data?.html;
 if(result?.code!==200||!page||typeof html!=='string'||(data.httpStatus&&data.httpStatus!==200))throw Error('No usable company page');
 const body=html.slice(0,1500000),candidates=[],brand=String(company||'').toLowerCase().match(/[a-z0-9]+/g)?.filter(t=>t.length>2&&!['the','property','management','residential','trust','group','llc','inc'].includes(t))||[];
 const named=s=>brand.length&&brand.some(t=>String(s).toLowerCase().includes(t));
 const add=(value,kind,score,label='')=>{const url=safeLogoURL(value,page);if(url&&!/onetrust|powered.by|equal.housing|accessibility|facebook|instagram|linkedin|youtube|tiktok/i.test(label+' '+url))candidates.push({url,page_url:page,kind,score,theme:/white|reversed|inverse/i.test(label+' '+new URL(url).pathname)?'dark':'light'})};
 for(const m of body.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const visit=(v,depth=0)=>{if(depth>8||!v||typeof v!=='object')return;if(Array.isArray(v)){v.slice(0,40).forEach(x=>visit(x,depth+1));return}
    const types=[v['@type']].flat().join(' '),entityURL=sourceURL(typeof v.url==='string'?v.url:'',companyDomain);
    if(/Organization|Corporation|LocalBusiness|RealEstateAgent/i.test(types)&&(named(v.name)||entityURL))add(typeof v.logo==='string'?v.logo:v.logo?.url||v.logo?.contentUrl,'logo',100,String(v.name));
    if(v['@graph'])visit(v['@graph'],depth+1);
   };visit(JSON.parse(m[1]));
  }catch{/* Malformed metadata does not prevent icon fallback. */}
 }
 for(const m of body.matchAll(/<img\b[^>]{0,6000}>/gi)){
  const a=attributes(m[0]),label=[a.alt,a.id,a.class,a['data-testid']].filter(Boolean).join(' '),src=[a.src,a['data-src'],a['data-lazy-src']].find(s=>safeLogoURL(s,page));
  if(!src)continue;
  const logo=/logo|brandmark|wordmark/i.test(label+' '+src);
  const branded=named(label+' '+new URL(src,page).pathname);
  if(logo&&(branded||/^(?:company\s+)?logo$/i.test(a.alt||'')||/header[-_ ]?logo|nav(?:igation)?[-_ ]?logo/i.test(label)))add(src,'logo',70+Number(branded)*10-Number(/footer|white/i.test(label+' '+src))*5,label);
 }
 for(const m of body.matchAll(/<link\b[^>]{0,4000}>/gi)){
  const a=attributes(m[0]);if(/^(?:shortcut\s+)?icon$|^apple-touch-icon(?:-precomposed)?$/i.test(a.rel||''))add(a.href,'icon',/apple/i.test(a.rel)?40:30,a.type||'');
 }
 const seen=new Set(),sorted=candidates.sort((a,b)=>b.score-a.score).filter(c=>!seen.has(c.url)&&seen.add(c.url));
 return [...sorted.filter(c=>c.kind==='logo').slice(0,3),...sorted.filter(c=>c.kind==='icon').slice(0,2)];
}
export function logoImageRequest(candidate){
 const url=safeLogoURL(candidate.url,candidate.page_url);if(!url)throw Error('Invalid image');
 return {url:'https://wsrv.nl/?'+new URLSearchParams({url,w:'480',h:'192',fit:'inside',we:'',output:'png',n:'1',page:'-1',maxage:'7d'}),options:{method:'GET',redirect:'manual',headers:{Accept:'image/png'},signal:AbortSignal.timeout(5000)}};
}
export async function logoImage(response){
 if(!response.ok||!/^image\/png(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('No safe logo');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty logo');
 const parts=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>120000){await reader.cancel();throw Error('Logo too large')}parts.push(value)}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}
 if(size<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('Invalid PNG');
 const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(width<8||height<8||width>480||height>192)throw Error('Invalid logo dimensions');
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return 'data:image/png;base64,'+btoa(binary);
}
export async function retrieveLogo(candidates,fetchImage){
 const logos=candidates.filter(c=>c.kind==='logo').slice(0,3);
 for(const candidate of logos){
  try{return {status:'found',image:await logoImage(await fetchImage(logoImageRequest(candidate))),source_url:candidate.url,page_url:candidate.page_url,kind:candidate.kind,theme:candidate.theme}}
  catch{/* A blocked logo may still have a usable site icon. */}
 }
 // Reserve one fallback for a site icon when the preferred logos fail.
 const icon=candidates.find(c=>c.kind==='icon');
 if(icon){try{return {status:'found',image:await logoImage(await fetchImage(logoImageRequest(icon))),source_url:icon.url,page_url:icon.page_url,kind:'icon',theme:'light'}}catch{}}
 return {status:'missing'};
}

import {sourceURL,cleanText} from './brief.mjs';

const regions='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Puerto Rico|[A-Z]{2}';
const text=value=>typeof value==='string'?cleanText(value).replace(/\s+/g,' ').trim().slice(0,220):'';
const normalize=value=>text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=value=>normalize(value).split(' ').filter(v=>v.length>2&&!['the','llc','inc','corporation','property','properties','trust','living','communities','residential','real','estate','partners'].includes(v));
const namesMatch=(name,company)=>tokens(company).length&&tokens(company).every(t=>normalize(name).split(' ').includes(t));
export function mergeCompanyLocations(locations){
 const seen=new Set();return locations.filter(l=>l?.address&&l.source_url&&!seen.has(normalize(l.address))&&seen.add(normalize(l.address))).slice(0,3);
}
// Organization-scoped metadata and explicitly labeled office addresses only.
// An address alone, a portfolio property or a city name never establishes an HQ.
export function companyLocations(raw,domain,company){
 const data=raw?.data,url=sourceURL(data?.url,domain);if(raw?.code!==200||!url||data.httpStatus&&data.httpStatus!==200)return [];
 const locations=[],html=String(data.html||'').slice(0,1500000);
 const add=(fields,kind,method,quote)=>{
  const street=text(fields.streetAddress),city=text(fields.addressLocality),region=text(fields.addressRegion),postal=text(fields.postalCode),country=text(typeof fields.addressCountry==='object'?fields.addressCountry?.name:fields.addressCountry);
  if(!street||!city||!region||!/\d/.test(street))return;
  const address=[street,city,[region,postal].filter(Boolean).join(' '),country].filter(Boolean).join(', ');
  locations.push({kind,address,street,city,region,postal_code:postal,country,source_url:url,source_title:text(data.title)||domain,method,quote:cleanText(quote).replace(/\s+/g,' ').trim().slice(0,700),retrieved_at:new Date().toISOString()});
 };
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const walk=(node,depth=0)=>{
    if(depth>7||!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.slice(0,40).forEach(v=>walk(v,depth+1));return}
    const types=[node['@type']].flat().join(' ');
    if(/\b(?:Organization|Corporation|RealEstateAgent|LocalBusiness)\b/.test(types)&&namesMatch(node.name||node.legalName,company)&&(!node.url||sourceURL(node.url,domain))){
     for(const address of [node.address].flat().slice(0,4))if(address&&typeof address==='object')add(address,'Company address','Website metadata',[node.name||node.legalName,address.streetAddress,address.addressLocality,address.addressRegion,address.postalCode].map(text).filter(Boolean).join(' · '));
    }
    for(const key of ['@graph','mainEntity','publisher'])if(node[key])walk(node[key],depth+1);
   };walk(JSON.parse(match[1]));
  }catch{/* Invalid metadata is ignored; it is never executed. */}
 }
 const content=cleanText(String(data.content||'').slice(0,500000).replace(/!\[[^\]]*\]\([^\n]*?\)/g,'').replace(/\[([^\]]*)\]\([^\n]*?\)/g,'$1'));
 if(namesMatch(data.title+' '+content.slice(-1500),company)){
  for(const match of content.matchAll(new RegExp(String.raw`\b(?:headquartered|based) in ([A-Za-z][A-Za-z .'-]{1,45}?),\s*(${regions})\b`,'gi'))){
   if(/\b(not|formerly|previously|until)\b/i.test(content.slice(Math.max(0,match.index-30),match.index)))continue;
   const before=content.slice(Math.max(0,match.index-140),match.index).split(/[.!?]\s+|\n/).at(-1);
   const after=content.slice(match.index+match[0].length,match.index+match[0].length+160).split(/[.!?]\s+|\n/)[0];
   if(!namesMatch(before+' '+after,company)&&!/^\s*(?:we are|our company is|the company is)\s*$/i.test(before))continue;
   const city=text(match[1]),region=text(match[2]);
   locations.push({kind:/^based/i.test(match[0])?'Company base':'Headquarters',precision:'city',address:city+', '+region,street:'',city,region,postal_code:'',country:'',source_url:url,source_title:text(data.title)||domain,method:'Company website',quote:match[0],retrieved_at:new Date().toISOString()});
  }
  const lines=content.split(/\n/).map(v=>v.trim()).filter(Boolean);
  const directory=lines.findIndex(line=>/corporate offices/i.test(line)&&line.length<100);
  for(let i=0;i<lines.length;i++){
   const officeHeading=directory>=0&&i>directory&&i-directory<100&&/^[A-Za-z .'-]{2,50} Office$/i.test(lines[i]);
   if((!officeHeading&&!/\b(headquarters|head office|corporate offices?|principal executive offices)\b/i.test(lines[i]))||lines[i].length>150)continue;
   const quote=lines.slice(i,i+5).join(' ').slice(0,600);
   const match=quote.match(new RegExp(String.raw`\b(\d{1,6}\s+[A-Za-z0-9 .'-]{2,75}?\s(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Parkway|Pkwy|Way|Plaza|Place|Court|Ct|Circle|Cir)\.?(?:\s+(?:NW|NE|SW|SE|N|S|E|W))?)(?:[,\s]+((?:Suite|Ste\.?|Floor|Unit|#)\s*[A-Za-z0-9-]+))?[,\s]+([A-Za-z][A-Za-z .'-]{1,40}?),?\s+(${regions})\s+(\d{5}(?:-\d{4})?)\b`,'i'));
   if(match)add({streetAddress:[match[1],match[2]].filter(Boolean).join(', '),addressLocality:match[3],addressRegion:match[4],postalCode:match[5]},/headquarters|head office|principal executive/i.test(lines[i])?'Headquarters':'Corporate office','Company website',quote);
  }
 }
 // A full address is more useful than a city-only reference to the same office.
 return mergeCompanyLocations(locations.filter(l=>l.precision!=='city'||!locations.some(other=>other.street&&normalize(other.city)===normalize(l.city))));
}

// Identity evidence is separate from housing fit and buyer intent.
const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const name=value=>normalize(value).replace(/^(?:the) /,'').replace(/(?: (?:incorporated|inc|llc|ltd|limited|corporation|corp))+$/,'');
const contains=(text,phrase)=>!!phrase&&(' '+normalize(text)+' ').includes(' '+phrase+' ');
export function verifyCompanyIdentity({company,title,text,url,companyDomain}){
 const result=(status,reason,signals=[])=>({version:2,status,reason,signals});
 let page;
 try{page=new URL(url)}catch{return result('unresolved','A valid company source is required.')}
 const d=String(companyDomain||'').toLowerCase().replace(/^www\./,''),host=page.hostname.toLowerCase().replace(/^www\./,'');
 if(!d||page.protocol!=='https:'||page.username||page.password||page.port||!(host===d||host.endsWith('.'+d)))return result('unresolved','The page is outside the supplied company domain.');
 const expected=name(company);
 if(!expected||expected.replace(/\s/g,'').length<2)return result('unresolved','A company name is required.');
 const signals=['supplied_domain'];
 // Customer stories and directories may name a customer without belonging to it.
 if(/\/(?:case-stud(?:y|ies)|customer-stories|testimonials|directory|partners)(?:\/|$)/i.test(page.pathname)||/\b(?:case study|customer story|customer spotlight|client spotlight)\b/i.test(title))return result('needs_confirmation','This page describes a customer or partner; confirm the company website.',signals);
 // Separate appended navigation labels and decode copyright markers without fuzzy brand matching.
 title=String(title||'').replace(/(?<=[a-z])(?=Go to our|Equal housing opportunity)/g,' ');
 text=String(text||'').replace(/&copy;|&#169;|&#x0*a9;/gi,'©');
 const titleMatch=contains(title,expected),bodyMatch=contains(text,expected);
 if(titleMatch)signals.push('name_in_page_title');
 if(bodyMatch)signals.push('name_in_source_text');
 const normalized=normalize(text),escaped=expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const selfDescription=new RegExp('(?:^| )'+escaped+' (?:inc |llc |ltd |corp )?(?:(?:currently|directly|also) )?(?:is|are|owns|owned|manages|managed|operates|operated|provides|develops|specializes|offers|focuses)\\b').test(normalized)&&!new RegExp(escaped+' (?:is|are) (?:a |an |our )?(?:client|customer|partner)\\b').test(normalized);
 const footer=String(text||'').split(/\n/).some(line=>line.length<300&&/©|copyright/i.test(line)&&name(line.replace(/©|copyright|all rights reserved|\b\d{4}\b/gi,' '))===expected);
 if(footer)signals.push('copyright_owner');
 // A full name plus a first-person description on a matching brand domain is
 // stronger than a mere mention. Do not accept arbitrary brand substrings.
 const brand=expected.split(' ')[0],domainName=d.split('.')[0],brandDomain=brand.length>=4&&(domainName===expected.replace(/ /g,'')||domainName===expected.replace(/ /g,'')+'corp'||domainName===brand+'company'||domainName===brand+'properties');
 const atSelf=new RegExp('(?:^| )at '+escaped+' (?:corporation |corp )?we (?:strive|manage|operate|provide|offer|specialize|focus)\\b').test(normalized);
 const possessive=new RegExp('\\b'+escaped+'[’\']s\\s+(?:many\\s+)?(?:residences|apartments|communities|homes)\\b.{0,80}\\b(?:rent|leasing)\\b','i').test(text);
 if(bodyMatch&&brandDomain&&(atSelf||possessive&&contains(title,brand)))return result('confirmed','Full company name and an explicit self-description agree with the supplied brand domain.',[...signals,'brand_domain','company_self_description']);
 if(titleMatch||footer||(bodyMatch&&selfDescription))return result('confirmed','Company name is corroborated on the supplied domain.',[...signals,...(selfDescription?['company_self_description']:[])]);
 return result('needs_confirmation',bodyMatch?'The company is mentioned, but the page does not establish its identity.':'The page does not corroborate the complete company name.',signals);
}

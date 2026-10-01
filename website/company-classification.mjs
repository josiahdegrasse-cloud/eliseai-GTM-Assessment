// Conservative, extractive ICP classification. Customer language is not evidence
// that a vendor owns or operates its customers' properties.
export const NON_OPERATORS=new Set(['software_vendor','advisor','broker','service_provider','commercial_operator']);
const housing=/\b(multifamily|multi-family|multi-unit rental|residential|apartments?|rental housing|rental homes?|homes for rent|single-family homes|condos|student housing|affordable housing|single[- ]family rentals?)\b/i;
const negated=/\b(?:does not|do not|don't|doesn't|no longer|not)\s+(?:own|manage|operate|provide|offer)|\b(?:not|no longer) (?:a |an |the )?(?:regional |national |residential |multifamily |property ){0,3}(?:owner|operator|manager|management company)\b/i;
export const sourceStatements=(source,includeContext=false)=>[...new Set([
 ...(source.focus_quotes||[]).filter(q=>source.excerpt.replace(/\s+/g,' ').includes(q.replace(/\s+/g,' '))),
 ...source.excerpt.split(/\n\s*\.\.\.\s*\n|\n{2,}|(?<=[.!?])\s+(?=[A-Z])/),
 ...(includeContext?source.excerpt.split(/\n\s*\.\.\.\s*\n|\n{2,}/).filter(q=>q.length<=700):[])
].map(q=>q.replace(/\s+/g,' ').trim()))].filter(q=>q.length>30&&!/^[\[{]/.test(q));
export function nonOperatorKind(text){
 // A person's prior career is not the company's current operating model.
 if(/\b(?:began (?:his|her|their) .{0,30}career|previously|formerly|prior to joining)\b/i.test(text))return null;
 const usesSoftware=/\b(?:uses?|using|runs? on|implemented|adopted|migrated to)\b.{0,70}\b(?:software|Yardi|Entrata|RealPage|AppFolio|Salesforce)\b/i.test(text);
 // Giving owners or residents access to operating software is a service detail,
 // not a statement that the company sells software. An explicit vendor claim
 // in another sentence/title can still establish its business model.
 const portalAccess=/\b(?:owners?|residents?|tenants?|investors?)\s+(?:have|get|receive)\s+access\s+to\b.{0,70}\b(?:software|technology platform|SaaS)\b/i.test(text);
 if(!usesSoftware&&!portalAccess&&/\b(?:software|technology platform|technology provider|SaaS)\b/i.test(text))return 'software_vendor';
 if(/\b(?:shopping centers?|commercial office (?:properties|buildings)|retail (?:properties|centers)|industrial (?:properties|buildings|warehouses?)|logistics (?:real estate|facilities))\b/i.test(text)&&/\b(?:owns?|manages?|operates?|invest(?:s|ing)? exclusively|sole investment strategy)\b/i.test(text)&&!housing.test(text)&&!negated.test(text))return 'commercial_operator';
 if(/\bbrokerage\b|\b(?:is|are|as) (?:a |an |the )?(?:real estate |commercial |residential )?broker\b/i.test(text))return 'broker';
 if(/\b(?:cleaning|janitorial|landscaping|maintenance|marketing|construction) services? (?:for|to)\b/i.test(text)||/\b(?:service provider|contractor)\b/i.test(text))return 'service_provider';
 if(/\b(?:advises? (?:clients|(?:apartment|property|residential|multifamily) owners)|advisor|advisory|consulting|consultant|helps? (?:apartment|property|residential|multifamily|rental)|supports? (?:residential |multifamily )?property management teams)\b/i.test(text))return 'advisor';
 return null;
}
export function operatorStatement(text,company=''){
 const full=String(company).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if(full&&!/\b(?:clients?|customers?|software|helps?|does not|no longer)\b/i.test(text)&&new RegExp('\\b'+full+'[’\']s\\s+(?:many\\s+)?(?:residences|apartments|communities|homes)\\b.{0,80}\\b(?:available for rent|for rent|leasing)\\b','i').test(text))return true;
 if(!housing.test(text)||negated.test(text))return false;
 // "X is ideal for a manager who manages apartments" describes the buyer,
 // not X's own operations. An is/manager keyword pair is insufficient.
 if(/\b(?:ideal|designed|built|intended|suitable) for\b|\b(?:solution|product|platform|tool) (?:for|used by)\b/i.test(text))return false;
 // Exclude a customer's operating claims, imperatives and advisory transactions.
 if(/\b(?:our (?:clients|customers)|their portfolio|helps? |enables? |supports? |advises? |(?<!management )services? (?:for|to) |software|brokerage|consulting|advisors?|advisory|consultants?|helping)\b/i.test(text))return false;
 // A named company's explicit service description can follow an introductory
 // clause. Keep the operating verb attached to that company, never a customer.
 if(full&&new RegExp('\\b(?:'+full+'|We)\\s+(?:provides?|offers?)\\s+(?:(?:full.service|professional|comprehensive|residential|rental)\\s+){0,3}property management(?:\\s+services)?\\b','i').test(text))return true;
 if(full&&new RegExp('^'+full+',\\s+(?:one of )?(?:the |a |an )?(?:nation[’\']s )?(?:leading |largest |national |regional |trusted ){0,3}(?:multifamily|residential|apartment) property management compan(?:y|ies)\\b','i').test(text))return true;
 // A named company or first-person business description must own the claim.
 // Keep this bounded; a housing keyword elsewhere on a vendor page is insufficient.
 const self=full?'(?:'+full+'|We|Our (?:company|business|firm))':'(?:We|Our (?:company|business|firm))';
 const ownStatement=new RegExp('^(?:Based in [^.!?]{1,90}, )?'+self+'\\b','i').test(text);
 if(ownStatement&&!/\b(?:not|never|no longer|formerly|previously|clients?|customers?|partners?)\b/i.test(text)){
  if(new RegExp('^'+self+'\\s+(?:is|are)\\s+(?:a |an |the )?(?:leading |national |publicly traded |residential |multifamily |apartment ){1,5}(?:REIT|real estate investment trust)\\b','i').test(text))return true;
  if(new RegExp('^'+self+'\\s+(?:is|are)\\s+(?:a |an |one of the (?:largest |leading )?)?[^.!?]{0,85}\\b(?:owners?|operators?|managers?|property management company)\\b','i').test(text))return true;
  if(/\bour (?:company|business|firm) (?:has been |is )?providing\b.{0,100}\b(?:multifamily|residential|apartment)\b.{0,45}\bproperty management services\b/i.test(text))return true;
 }
 // Short self-descriptive headings are evidence too, not only full sentences.
 if(text.length<180&&/^(?:(?:[\w’' -]{1,70}[’']s (?:trusted )?|[\w &-]{1,60}: ))?(?:multifamily|multi-family|residential|rental housing|apartment) (?:owner|operator|manager|property management company)\b/i.test(text))return true;
 if(/\bwe(?:['’]re| are) (?:not just )?(?:a |an )?(?:regional |national |multifamily |residential ){0,3}(?:developer\s*(?:&|and)\s*)?(?:owner|operator|manager)\b/i.test(text))return true;
 // Explicit institutional ownership remains relevant even when management is outsourced.
 const escapedCompany=String(company).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if(escapedCompany&&new RegExp('^(?:'+escapedCompany+'|We)\\b.{0,90}\\binvests? in and owns?\\b','i').test(text))return true;
 const distinctive=(String(company).match(/[A-Za-z0-9]+/g)||[]).find(word=>!['the','inc','llc','group','company'].includes(word.toLowerCase()));
 const subject=text.match(/\b(we|[A-Z][\w&'-]*(?: [A-Z][\w&'-]*)*)\s+(?:(?:currently|directly|jointly|also)\s+)?(?:owns?|owned|manages?|managed|operates?|operated|oversees?|develops?)\b/)?.[1]||text.match(/^([A-Z][\w&'-]*(?: [A-Z][\w&'-]*)*)\s+(?:is|are)\b/)?.[1];
 if(distinctive&&subject&&!/^we$/i.test(subject)&&!new RegExp('\\b'+distinctive+'\\b','i').test(subject))return false;
 // A named residential REIT can describe its own operations with gerunds
 // ("is a REIT focused on ... managing apartment communities"). Keep the
 // company as the subject; references to a customer's REIT do not qualify.
 const escaped=distinctive?.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if(escaped&&new RegExp('^(?:'+escaped+'(?:\\s+[A-Z][\\w&\'-]*){0,5}|We)\\s+provides?\\s+(?:professional |full.service |comprehensive )?property management services\\b','i').test(text))return true;
 if(escaped&&new RegExp('^'+escaped+'\\b.{0,100}\\bis\\b.{0,100}\\b(?:real estate investment trust|REIT)\\b.{0,180}\\b(?:owning|managing|operating)\\b','i').test(text))return true;
 return /\b(?:[Ww]e|[A-Z][\w&'-]*(?: [A-Z][\w&'-]*)*)\s+(?:(?:currently|directly|jointly|also)\s+)?(?:owns?|owned|manages?|managed|operates?|operated|oversees?|develops?)(?:\s+and\s+(?:owns?|owned|manages?|managed|operates?|operated|develops?))?\b/.test(text)
  ||/\b(?:we (?:are|have)|is (?:a|an)|as (?:a|an))\b.{0,90}\b(?:owners?|operators?|managers?)\b/i.test(text)
  ||/\b(?:focuses on|specializes in|specialises in|we specialize in|we specialise in)\b.{0,100}\bmanagement\b/i.test(text)
  ||/\bwe\s+speciali[sz]e\s+in\s+apartment\s+(?:complex\s+)?developments?\b/i.test(text)
  ||/\b(?:units|homes|beds) under management\b/i.test(text);
}
export function classifyCompany(sources,company=''){
 const evidence=[];
 for(const source of sources.filter(s=>s.name_matched)){
  const titleKind=nonOperatorKind(source.title);
  if(titleKind)evidence.push({kind:titleKind,quote:source.title,source_id:source.id});
  // An explicit business-line page title on the matched company site is also
  // a sourced self-description; avoid customer stories, advice and software.
  const escaped=String(company).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(escaped&&!titleKind&&new RegExp('^'+escaped+'\\s*[|:—–-]\\s*(?:Multifamily|Multi-family|Residential|Apartment) Property Management(?:\\s*[|:—–-]|$)','i').test(source.title))evidence.push({kind:'housing_operator',quote:source.title,source_id:source.id});
  for(const quote of sourceStatements(source,true)){
   const kind=operatorStatement(quote,company)?'housing_operator':nonOperatorKind(quote);
   if(kind&&!negated.test(quote))evidence.push({kind,quote,source_id:source.id});
  }
 }
 const operators=evidence.filter(e=>e.kind==='housing_operator'),others=evidence.filter(e=>NON_OPERATORS.has(e.kind));
 // Additional commercial or service divisions do not contradict the company's
 // own residential operations. Explicit denials do; keep those open for review.
 const denied=sources.filter(s=>s.name_matched).flatMap(source=>sourceStatements(source).filter(q=>housing.test(q)&&negated.test(q)&&/\b(?:own\w*|manag\w*|operat\w*)\b/i.test(q)&&(/^(?:we|our company|the company)\b/i.test(q)||q.toLowerCase().startsWith(String(company).toLowerCase()+' '))).map(quote=>({kind:'operating_denial',quote,source_id:source.id})));
 const conflict=operators.length>0&&denied.length>0;
 const kind=conflict?'unclassified':operators.length?'housing_operator':others[0]?.kind||'unclassified';
 const labels={housing_operator:'Housing operator',software_vendor:'Software provider',advisor:'Advisor / consultant',broker:'Brokerage',service_provider:'Service provider',commercial_operator:'Commercial property operator',unclassified:conflict?'Conflicting operating evidence':'Operating model unconfirmed'};
 return {kind,label:labels[kind],conflict,mixed_business:operators.length>0&&others.length>0,evidence:[...operators,...denied,...others].filter((e,i,a)=>a.findIndex(x=>x.kind===e.kind&&x.quote===e.quote)===i).slice(0,8),reason:conflict?'Published sources both establish and explicitly deny residential operations. Review their scope and dates.':kind==='housing_operator'?'The company explicitly describes residential ownership, management or operations.':kind==='commercial_operator'?'Sources describe commercial property operations rather than residential housing operations.':others.length?'Sources describe services supplied to property companies; this does not establish property operations.':'No explicit residential operating claim was found.'};
}

import {operatorStatement,sourceStatements} from './company-classification.mjs';
import {sourceHasOldDate} from '../static/company-fit.js';

// Select one bounded observation, never arbitrary website prose, for an intro.
// All interpretations remain hypotheses; no public source establishes buyer pain.
export function companyObservation(lead,brief,time=Date.now()){
 if(!lead.processed_at||!brief?.signals?.find(s=>s.key==='residential')?.supported)return null;
 const savedDemo=lead.sample_lead&&lead.sample_grounded_draft;
 if(lead.company_stale||lead.company_snapshot&&!savedDemo||(lead.company_fresh_until&&Date.parse(lead.company_fresh_until)<=time))return null;
 const sources=(brief.sources||[]).filter(s=>s.name_matched&&!sourceHasOldDate(s,time)&&(!savedDemo||Number.isFinite(Date.parse(s.retrieved_at))&&Date.parse(s.retrieved_at)<=time&&time-Date.parse(s.retrieved_at)<=30*86400000));
 const datedClaim=q=>[...q.matchAll(/(?:^|\b(?:in|during|as of)\s+)(20\d{2})\b/gi)].map(m=>Number(m[1]));
 const operations=sources.flatMap(source=>sourceStatements(source).filter(q=>operatorStatement(q,lead.company)&&datedClaim(q).every(year=>year>=new Date(time).getUTCFullYear()-1&&year<=new Date(time).getUTCFullYear())).map(quote=>({source,quote})));
 if(!operations.length)return null;
 const make=(basis,sentence,angle,question)=>({usage:'company_observation',source_id:basis.source.id,quote:basis.quote,source:basis.source,sentence,angle,question});
 const footprint=brief.footprint,footSource=sources.find(s=>s.id===footprint?.source_id);
 const dated=footprint?.as_of?Date.parse(footprint.as_of):null;
 const comparable=footSource&&operatorStatement(footprint.quote,lead.company)&&!(/\b(?:not|never|no longer)\b/i.test(footprint.quote))&&(!dated||(dated<=time&&time-dated<=548*86400000));
 if(comparable&&footprint.value==='Global operations')return make({source:footSource,quote:footprint.quote},`I noticed ${lead.company} operates rental housing across multiple countries.`,'Explore how central and regional teams share prospect follow-up.','Is prospect follow-up coordinated centrally or by regional teams?');
 if(comparable&&/^(?:(?:more than|over|approximately|about|nearly|at least) )?(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?: (?:U\.S\.|US|United States|international|global))? (?:markets|states|countries)$/i.test(footprint.value))return make({source:footSource,quote:footprint.quote},`I noticed ${lead.company} operates across ${footprint.value}.`,'Explore whether teams coordinate prospect follow-up across markets.','Is prospect follow-up shared across your markets or handled by each community?');
 if(comparable&&/^[A-Z][A-Za-z .-]{1,70}$/.test(footprint.value)&&footprint.quote.includes(footprint.value))return make({source:footSource,quote:footprint.quote},`I noticed ${lead.company} operates housing in ${footprint.value}.`,'Explore how local teams coordinate prospect follow-up.','How does your team coordinate prospect follow-up across communities?');
 const student=operations.find(x=>/\bstudent (?:housing|beds|communities)\b/i.test(x.quote));
 if(student)return make(student,`I noticed ${lead.company} manages student housing.`,'Explore how the team handles leasing questions during its busiest periods.','How does your team handle prospect follow-up during your busiest leasing periods?');
 const affordable=operations.find(x=>/\baffordable (?:housing|apartment|residential)\b/i.test(x.quote));
 if(affordable)return make(affordable,`I noticed ${lead.company} manages affordable housing.`,'Explore routine prospect communication; confirm any eligibility and compliance requirements separately.','Which prospect questions take the most time for your team to answer?');
 const thirdParty=operations.find(x=>/\b(?:third.party (?:property )?management|manage on behalf of|fee management)\b/i.test(x.quote));
 if(thirdParty)return make(thirdParty,`I noticed ${lead.company} manages properties for other owners.`,'Explore how owner and on-site teams coordinate leasing communication.','How is prospect follow-up coordinated between your on-site teams and the owners you work with?');
 // Only describe an operating model supported by a matched original-page quote.
 const multifamily=operations.find(x=>/\b(?:multifamily|multi-family)\b/i.test(x.quote));
 if(multifamily)return make(multifamily,`I noticed ${lead.company} works in multifamily housing management.`,'Explore how leasing inquiries are handled across communities.','How do your communities handle leasing inquiries today?');
 const rentals=operations.find(x=>/\b(?:single-family|homes for rent|rental homes)\b/i.test(x.quote));
 if(rentals)return make(rentals,`I noticed ${lead.company} manages rental homes.`,'Explore how rental inquiries and tour requests reach the team.','How does your team handle rental inquiries and tour requests today?');
 const basis=operations[0];
 return make(basis,`I noticed ${lead.company} describes residential housing operations on its website.`,'Explore how leasing inquiries reach the operating team.','How does your team handle leasing inquiries today?');
}

export function buildSalesInsights(lead,brief,priority,decision){
 const rows=[],housing=priority.criteria.find(c=>c.key==='housing'),need=priority.criteria.find(c=>c.key==='need');
 const observation=companyObservation(lead,brief);
 const add=(key,title,fact,meaning,source_ids=[],basis='Company-published evidence')=>rows.push({key,title,fact,meaning,source_ids,basis});
 if(housing?.points===25){
  add('fit','Why this account fits',brief.summary?.text||'Residential housing operations are described.','Leasing and resident communication are relevant discovery areas. Operating a portfolio does not establish an active project.',housing.source_ids);
  if(brief.portfolio){const p=brief.portfolio;add('scale','Potential scope',`${p.value}${p.as_of?' · as of '+p.as_of:' · reporting date not stated'}`,p.alternatives?.length?'Published totals differ. Confirm the current comparable portfolio before estimating scope.':'This is company-wide context. Establish the properties in a first rollout and their inquiry volume before sizing an opportunity.',[p.source_id]);}
  if(decision.opportunity.status==='suggested')add('angle','Conversation angle',decision.opportunity.product,decision.opportunity.reason,[],'Current rep-confirmed need and workflow');
  else if(observation&&need?.points!==0&&decision.action.code==='discover')add('angle','Conversation hypothesis',observation.angle,'Validate this with the buyer; it is not a confirmed pain point or a product recommendation.',[observation.source_id]);
 }else add('fit','Establish the operating model',priority.reason,'Confirm whether this contact represents a residential operator before selecting a housing use case.',[...new Set((brief.classification?.evidence||[]).map(e=>e.source_id))],'Company research · operating fit not established');
 const missing=priority.criteria.filter(c=>c.basis==='Rep assessment'&&c.points===null).map(c=>({need:'the buyer’s need',timing:'timing',role:'decision involvement',scope:'starting scope'})[c.key]);
 add('readiness','What is still unknown',need?.points===0?'No active need is recorded.':missing.length?`Confirm ${missing.join(', ')}.`:'Need, timing, decision involvement and starting scope are assessed.',need?.points===0?'Agree whether to revisit; avoid a new product pitch.':missing.length?'Ask the buyer before treating this account as an active opportunity. Public company research cannot fill these gaps.':'Use the agreed next action and recheck assessments when the buyer’s plans change.',[],'Buyer qualification');
 if(lead.property_address)add('property','Property relationship',lead.property_context?.status==='matched'?'The submitted address has a Census geography match.':'The submitted property has not been matched.','Confirm that the contact manages this property and whether it is in scope. Geography and neighborhood rent do not establish ownership, budget or urgency.',[],'Submitted details / Census');
 return {version:1,items:rows,next_action:decision.action.label,next_question:decision.action.question};
}

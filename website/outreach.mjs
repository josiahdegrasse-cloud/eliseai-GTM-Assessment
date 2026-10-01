import {isDemoProspect} from '../static/company-fit.js';
import {qualificationAnswers} from '../static/sales-context.js';
import {evidenceState} from './qualification-evidence.mjs';
import {scoreLead} from './scoring.mjs';
import {salesDecision} from './decision.mjs';
import {professionalObservation} from './professional-personalization.mjs';
import {NON_OPERATORS} from './company-classification.mjs';
import {companyObservation} from './sales-insights.mjs';

export const DRAFT_VERSION=20;
// Reviewed capability language; no invented pain, outcomes or integration claims.
const themes=[
 {key:'voice',match:/missed calls?|unanswered calls?|calls? (?:go|going) unanswered|voicemail|phone coverage/i,topic:'missed calls',subject:'Covering missed calls',value:'EliseAI can answer routine prospect and resident calls when your team is unavailable.'},
 {key:'maintenance',match:/maintenance|work orders?/i,topic:'maintenance requests',subject:'A simpler maintenance handoff',value:'EliseAI can capture maintenance requests and route them to your team.'},
 {key:'renewals',match:/renewals?|renewing/i,topic:'renewal follow-up',subject:'Keeping renewal conversations moving',value:'EliseAI can handle routine renewal follow-ups, with your team handling questions that need personal attention.'},
 {key:'payments',match:/delinquen|rent collection|late payments|payment reminders/i,topic:'payment follow-up',subject:'Supporting your payment follow-up',value:'EliseAI can help with payment reminders and resident follow-up, with your team handling sensitive situations.'},
 {key:'after_hours',match:/after.hours|outside (?:office|business) hours|evenings|weekends/i,topic:'after-hours leasing coverage',subject:'Leasing support after hours',value:'EliseAI can answer leasing questions and help prospects book tours outside office hours.'},
 {key:'tours',match:/tours?|scheduling/i,topic:'tour coordination',subject:'Making tour coordination easier',value:'EliseAI can answer prospect questions and coordinate tour scheduling.'},
 {key:'response',match:/response times?|respond|replies|follow.up|inquir(?:y|ies)/i,topic:'prospect follow-up',subject:'Following up on your leasing inquiry',value:'EliseAI can answer prospect questions and keep inquiry follow-up moving between conversations with your team.'}
];
const topicQuestions={
 voice:'How does your team handle calls that staff cannot answer?',
 maintenance:'How are maintenance requests captured and handed to your team today?',
 renewals:'Which part of renewal follow-up takes the most time for your team?',
 payments:'How does your team handle payment reminders and follow-up today?',
 after_hours:'What happens to leasing inquiries that arrive outside office hours?',
 tours:'Which part of coordinating tours takes the most manual work?',
 response:'How does your team handle prospect follow-up today?'
};
function companyContext(brief){
 const ids=[...(brief?.signals?.find(s=>s.key==='residential')?.source_ids||[]).slice(0,1),...(brief?.footprint?.source_id?[brief.footprint.source_id]:[])];
 return [...new Set(ids)].map(id=>brief.sources.find(s=>s.id===id)).filter(Boolean).map(source=>({usage:'workflow_context',source_id:source.id,quote:source.excerpt,source}));
}
function buyerBaseline(lead,q,theme){
 if(evidenceState(lead,'impact').status!=='current'||q.impact_note.length<5||q.impact_value===''||Number(q.impact_value)<=0)return null;
 const n=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(q.impact_value));
 const text=q.impact_metric==='missed_calls_week'&&theme?.key==='voice'?`${n} missed calls in a week`:q.impact_metric==='inquiries_month'&&['response','after_hours','tours'].includes(theme?.key)?`${n} inquiries in a month`:q.impact_metric==='response_minutes'&&theme?.key==='response'?`a ${n}-minute response time`:q.impact_metric==='manual_hours_week'?`${n} hours of manual work in a week`:null;
 if(!text)return null;
 return {usage:'buyer_baseline',sentence:`You mentioned ${text}.`,quote:q.impact_note,source:{title:'Buyer-reported operational baseline',provider:'Rep assessment',type:'Buyer notes',retrieved_at:evidenceState(lead,'impact').recorded_at,excerpt:q.impact_note}};
}
export function outreachCopy(lead,brief,first,fit){
 if(brief?.classification?.conflict)fit=false;
 const demo=isDemoProspect(lead),q=qualificationAnswers(lead.qualifications),inquiry=demo?'':String(lead.inquiry||'').trim();
 const decision=brief?.sources&&lead.processed_at?salesDecision(lead,brief,scoreLead(lead,brief)):null;
 const observation=fit?companyObservation(lead,brief):null,contact=professionalObservation(lead);
 const ask=topic=>`Would a quick walkthrough of ${topic} be useful?`;
 const build=(subject,paragraphs,question,theme,context=false,buyerBasis=null,companyBasis=null)=>{
  const person=context?contact:null;
  const basis=context?[...(companyBasis?[companyBasis]:companyContext(brief)),...(person?[person]:[]),...(buyerBasis?[buyerBasis]:[])]:[];
  return {subject,question,theme,uses_fact:!!(buyerBasis||companyBasis||person),context_basis:basis,draft_method:'Rules v20 · One detail, one relevant reply, one ask',draft_strategy:buyerBasis?'buyer_measurement':person?'contact_research':companyBasis?'company_research':context?'buyer_request':'discovery',draft_rationale:buyerBasis?'Uses the current buyer-reported baseline and selected workflow.':person?'Uses contact context to choose a relevant workflow question without repeating a job title or assuming buying authority.':companyBasis?'Uses one company-published observation to frame a discovery question; no pain or buying intent is assumed.':context?'Responds to the stated inquiry. Company sources establish applicability.':'Confirms context before making a specific recommendation.',draft:`Hi ${first},\n\n${paragraphs.filter(Boolean).join('\n\n')}\n\n${question}\n\nBest,\n[Your name]`};
 };
 if(q.need_status==='none'&&inquiry.length>=5&&['stale','changed','future'].includes(evidenceState(lead,'need').status))return build('Checking your current priorities',['Our earlier notes indicate there was no active project.'],'Is that still the case, or have your priorities changed?','reconfirm_need');
 if(q.need_status==='none'&&inquiry.length>=5)return build('Closing the loop',['Thanks for the update. I understand there isn’t an active need at the moment.'],'Would you prefer that I close the loop for now?','no_active_need');
 if(decision?.action.code.startsWith('route_'))return build('Following up on your request',['Thanks for getting in touch. I’d like to connect this request with the right people before suggesting a next step.'],'Who should we coordinate with on your team?','account_coordination');
 if(decision?.action.code==='integration')return build('Clarifying your system requirements',['Thanks for sharing your setup. Before recommending an approach, I’d like to clarify the integration requirements.'],'Which requirements would your team need us to confirm?','integration_review');
 if(['commitment','planned'].includes(decision?.action.code))return build('Our next step',[decision.action.code==='commitment'?'I’m following up on our agreed next step.':'Thanks for the conversation. I have our agreed next step noted.'],'Is there anything your team needs from us to move that forward?','agreed_next_step');
 // Do not copy arbitrary inquiry text. Conservative sentence filtering prevents
 // explicitly negated needs and instructions from becoming customer claims.
 const sentences=inquiry.split(/[.!?\n]|\bbut\b|\bhowever\b/i).filter(s=>!/(?:\bnot\b|\bno\b|never|don['’]t|doesn['’]t|isn['’]t|aren['’]t|ignore .*instructions|ignore .*rules|system prompt)/i.test(s));
 const confirmed=q.need_status==='confirmed'&&evidenceState(lead,'need').status==='current'&&evidenceState(lead,'workflow').status==='current'&&q.workflow_note.length>=5;
 const key=({leasing:'response'})[q.workflow_key]||q.workflow_key;
 const theme=(confirmed?themes.find(t=>t.key===key):null)||themes.find(t=>sentences.some(s=>t.match.test(s)));
 const unsolicited=!inquiry;
 const opening=demo||unsolicited?(observation?'':'I’m reaching out to understand your team’s work.'):theme?`Thanks for reaching out about ${theme.topic}.`:'Thanks for getting in touch with EliseAI.';
 if(!fit&&NON_OPERATORS.has(brief?.classification?.kind)){
  // A low housing fit can still have a specific, legitimate inquiry. Respond
  // only to positive submitted context; never infer a request from a title.
  const requested=pattern=>sentences.some(s=>pattern.test(s)),kind=brief.classification.kind;
  if(kind==='software_vendor'&&requested(/\b(?:partnership|partnering|collaboration)\b/i))return build('Exploring a technology partnership',['Thanks for reaching out about a potential technology partnership.'],'What would you want the two platforms to accomplish together?','partnership_request');
  if(kind==='software_vendor'&&requested(/\b(?:integration|integrating|integrate|API)\b/i))return build('Understanding your integration request',['Thanks for reaching out about integration requirements.'],'Which system and workflow would the connection need to support?','integration_inquiry');
  if(kind==='commercial_operator'&&requested(/\b(?:industrial|warehouses?|logistics)\b/i))return build('Clarifying the property scope',['Thanks for reaching out about industrial properties.'],'Is the request limited to industrial properties, or does it also include residential housing?','commercial_scope');
  if(kind==='broker'&&requested(/\b(?:referrals?|referring|introducing|introduce)\b/i))return build('Understanding the introduction',['Thanks for reaching out about your brokerage request.'],'Which residential owner or operator would you like to introduce?','brokerage_referral');
  return build(unsolicited?'A question about '+lead.company:'Clarifying your inquiry',[opening], unsolicited?'Does your team manage residential housing operations?':'Are you exploring EliseAI for housing operations, a partnership, or another use case?','operating_context',!!contact);
 }
 if(!fit)return build(demo||unsolicited?'A question about your company':'A quick question about your inquiry',[opening],theme&&!q.process?topicQuestions[theme.key]:'What kind of properties or services does your team manage?','operating_context');
 if(!theme){
  // A sparse inbound still receives an enriched intro, without claiming a pain.
  const noPositiveNeed=inquiry&&/\b(?:not|no|never|don['’]t|doesn['’]t)\b/i.test(inquiry);
  const question=noPositiveNeed?'What would be useful for you to know?':contact?.cta||ask('leasing follow-up');
  return build('Leasing support for '+lead.company,[observation?.sentence||opening,!noPositiveNeed?'EliseAI can answer leasing questions and help prospects book tours, with your team handling conversations that need a person.':'I’d be happy to share information relevant to your priorities.'],question,'general',true,null,observation);
 }
 const baseline=confirmed?buyerBaseline(lead,q,theme):null;
 return build(theme.subject,[baseline?baseline.sentence:opening,observation?.sentence,theme.value],theme.key==='response'&&contact?.cta?contact.cta:ask(theme.topic),theme.key,true,baseline,observation);
}

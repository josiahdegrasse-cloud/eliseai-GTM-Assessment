import {qualificationAnswers} from '../static/sales-context.js';
import {evidenceState} from './qualification-evidence.mjs';
import {NON_OPERATORS} from './company-classification.mjs';

// Assessment assumptions, not EliseAI's internal ICP or a conversion probability.
export const SCORE_VERSION='housing-balanced-v3';
const item=(key,label,max,points,reason,source_ids=[],basis='Company sources')=>({key,label,max,points,status:points===null?'unknown':'assessed',reason,source_ids,basis});
function scalePoints(portfolio,time){
 if(!portfolio)return [null,'Portfolio size is not established.'];
 if(portfolio.alternatives?.length)return [null,'Published totals differ; confirm a comparable figure.'];
 const dated=portfolio.as_of&&Date.parse(portfolio.as_of);
 if(dated&&dated>time+86400000)return [null,'The reported date is in the future; confirm the figure.'];
 if(dated&&time-dated>548*86400000)return [null,'The reported total is over 18 months old.'];
 // Communities, beds and countries are not interchangeable with apartment homes.
 if(/beds|properties|communities/i.test(portfolio.value))return [null,'Mixed beds or property counts are not converted into apartment homes.'];
 const m=portfolio.value.match(/(\d[\d,.]*)\s*(million|thousand)?/i);
 if(!m)return [null,'A comparable apartment-home count is not established.'];
 const n=Number(m[1].replaceAll(',',''))*(m[2]?.toLowerCase()==='million'?1e6:m[2]?.toLowerCase()==='thousand'?1e3:1);
 // An upper-bound phrase can straddle a threshold; do not round it up.
 if(/nearly|under|up to|fewer than|less than/i.test(portfolio.value))return [null,'Confirm the actual count; the source gives an upper bound.'];
 const points=n>=5000?10:n>=1000?7:n>=200?4:1;
 return [points,portfolio.value+(portfolio.as_of?' · as of '+portfolio.as_of:' · reporting date not stated')];
}
export function scoreLead(lead,brief,time=Date.now()){
 const matched=!!lead.processed_at&&brief.sources.some(s=>s.name_matched),housing=brief.signals.find(s=>s.key==='residential'),workflow=brief.signals.find(s=>s.key==='leasing');
 const vendor=NON_OPERATORS.has(brief.company_kind),q=qualificationAnswers(lead.qualifications);
 const scale=matched&&housing?.supported?scalePoints(brief.portfolio,time):[null,'Establish housing operations before assigning size points.'];
 const criteria=[
  item('housing','Housing operator',25,matched?(housing?.supported?25:vendor?0:null):null,vendor?brief.classification?.reason||'Service-provider evidence does not establish housing operations.':housing?.supported?'Residential ownership, management or operations are described.':'Housing operations are not established.',housing?.source_ids||[]),
  item('workflow','Relevant operating workflow',15,matched&&housing?.supported?(workflow?.supported?15:null):vendor?0:null,workflow?.supported&&housing?.supported?'Leasing or community operations appear in company sources.':'Confirm the leasing or resident workflow.',workflow?.source_ids||[]),
  item('scale','Reported apartment-home scale',10,vendor?0:scale[0],scale[1],brief.portfolio?[brief.portfolio.source_id]:[])
 ];
 const supported=(status,note,key)=>status!=='unknown'&&String(note||'').trim().length>=5&&evidenceState(lead,key,time).status==='current';
 const buyer=[
  item('need','Buyer-confirmed need',20,supported(q.need_status,lead.inquiry,'need')?q.need_status==='confirmed'?20:0:null,supported(q.need_status,lead.inquiry,'need')?q.need_status==='confirmed'?'Rep confirmed an active need; see the recorded inquiry.':'Rep recorded no active need.':'Confirm the need and record the buyer’s words.',[],'Rep assessment'),
  item('timing','Buying timeline',15,supported(q.timing_status,q.timing,'timing')?({'30_days':15,'90_days':10,later:0})[q.timing_status]:null,supported(q.timing_status,q.timing,'timing')?({'30_days':'Within 30 days','90_days':'Within 90 days',later:'Later or exploratory'})[q.timing_status]:'Confirm timing with the buyer.',[],'Rep assessment'),
  item('role','Decision involvement',10,supported(q.role_status,q.role,'role')?q.role_status==='decision_maker'?10:5:null,supported(q.role_status,q.role,'role')?q.role_status==='decision_maker'?'Decision-maker identified by the rep.':'Evaluator or champion identified by the rep.':'Confirm who is involved in the decision.',[],'Rep assessment'),
  item('scope','Agreed starting scope',5,supported(q.scope_status,q.scope,'scope')?5:null,supported(q.scope_status,q.scope,'scope')?'Rep confirmed the initial rollout scope.':'Agree on the first properties or communities.',[],'Rep assessment')
 ];
 for(const c of buyer){
  c.note=String(({need:lead.inquiry,timing:q.timing,role:q.role,scope:q.scope})[c.key]||'').slice(0,600);
  c.evidence=evidenceState(lead,c.key,time);
  if(c.points===null&&c.note&&c.evidence.status!=='current')c.reason='Reconfirm this assessment: '+({undated:'no recorded assessment date',changed:'the supporting note changed',future:'the recorded date is invalid',stale:'the assessment is past its review window'})[c.evidence.status]+'.';
 }
 for(const c of criteria)c.sources=c.source_ids.map(id=>brief.sources.find(s=>s.id===id)).filter(Boolean).map(s=>({id:s.id,url:s.url,retrieved_at:s.retrieved_at,published_at:s.published_at,basis:'Company-published evidence'}));
 const all=[...criteria,...buyer],sum=xs=>xs.reduce((n,c)=>n+(c.points??0),0),fit=sum(criteria),readiness=sum(buyer),total=matched?fit+readiness:null,unassessed=all.filter(c=>c.points===null).reduce((n,c)=>n+c.max,0);
 const provisional=!!(lead.company_stale||lead.company_snapshot||(lead.company_fresh_until&&Date.parse(lead.company_fresh_until)<=time)),active=buyer[0].points===20;
 let tier='Discovery needed',rank=2,reason='Confirm the buyer’s need, timing and decision involvement.';
 if(!matched){tier=lead.company_stale?'Research pending':'Verify company';rank=0;reason=lead.company_stale?'Company sources are unavailable. Keep the lead unscored until research returns.':'Confirm the company website before prioritizing this lead.'}
 else if(vendor){tier='Outside housing ICP';rank=0;reason=brief.classification?.reason||'Service-provider evidence does not establish a housing operator.'}
 else if(!housing?.supported){tier='Confirm operating model';rank=1;reason='Sources do not yet establish residential operations.'}
 else if(buyer[0].points===0){tier='No active need';rank=1;reason='Rep recorded no current need; agree on whether to revisit.'}
 else if(provisional){tier='Recheck sources';rank=2;reason='Refresh the saved company evidence before advancing priority.'}
 else if(total>=80&&active&&buyer[1].points>=10&&buyer[2].points>=5){tier='Prioritize conversation';rank=4;reason='Housing fit, a confirmed need and a near-term buying process are supported.'}
 else if(total>=60&&active){tier='Qualify next';rank=3;reason='A need is confirmed. Close the remaining timing, decision or scope gaps.'}
 const assessed=xs=>xs.filter(c=>c.points!==null).reduce((n,c)=>n+c.max,0);
 const fit_assessment={points:matched?fit:null,max:50,assessed:assessed(criteria),label:!matched?'Not assessed':vendor?'Outside housing fit':!housing?.supported?'Not established':fit>=40?'Strong company fit':'Potential company fit'};
 const readiness_assessment={points:assessed(buyer)?readiness:null,max:50,assessed:assessed(buyer),label:!assessed(buyer)?buyer.some(c=>c.note&&['stale','changed','future'].includes(c.evidence.status))?'Needs reconfirmation':'Needs qualification':buyer[0].points===0?'No active need':active&&buyer[1].points>=10&&buyer[2].points>=5?'Near-term buying process':'More discovery needed'};
 return {model:SCORE_VERSION,total,fit,readiness,unassessed,assessed_weight:100-unassessed,provisional,tier,rank,reason,criteria:all,fit_assessment,readiness_assessment};
}

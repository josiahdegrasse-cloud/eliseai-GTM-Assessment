import {qualificationAnswers,WORKFLOWS,SALES_CHOICES,nextQuestion} from '../static/sales-context.js';
import {evidenceState} from './qualification-evidence.mjs';
import {companyObservation} from './sales-insights.mjs';

export const DECISION_VERSION='sales-action-v1';
export const ACTION_TIMEZONE='America/New_York';
export function salesDecision(lead,brief,priority,time=Date.now()){
 const q=qualificationAnswers(lead.qualifications),e=key=>evidenceState(lead,key,time);
 const current=(key,note)=>e(key).status==='current'&&String(note||'').trim().length>=5;
 const workflow=WORKFLOWS.find(w=>w.key===q.workflow_key),workflowKnown=!!workflow&&current('workflow',q.workflow_note);
 const need=priority.criteria.find(c=>c.key==='need'),housing=priority.criteria.find(c=>c.key==='housing')?.points===25;
 const active=need?.points===20;
 const integrationKnown=q.integration_status!=='unknown'&&workflowKnown&&q.pms_name&&q.pms_edition&&q.integration_source_url&&current('integration',q.integration_note);
 const accountKnown=q.account_status!=='unknown'&&current('account',q.account_note);
 const impactKnown=q.impact_metric!=='unknown'&&q.impact_value!==''&&current('impact',q.impact_note);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:ACTION_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
 const commitmentKnown=current('commitment',q.next_step)&&!!q.owner&&!!q.next_due;
 const due=commitmentKnown&&q.next_due<=today;
 const integrationQuestion=q.pms_name&&q.pms_edition?`Are there integration requirements for your ${q.pms_name} ${q.pms_edition} setup that we should review together?`:'Which PMS/CRM and edition would this workflow need to connect with?';
 const fact=(key,label,value,known,note)=>({key,label,value:known?value:'Not assessed',note:note||'',...e(key),confirmed:!!known});
 const signals=[
  fact('workflow','Buyer workflow',workflow?.label,workflowKnown,q.workflow_note),
  fact('impact','Operational baseline',`${q.impact_value} ${SALES_CHOICES.impact_metric.find(([id])=>id===q.impact_metric)?.[1]||''}`,impactKnown,q.impact_note),
  fact('integration','System compatibility',integrationKnown?(q.integration_status==='supported'?'Supported · rep checked':'Blocker · rep checked'):'Not assessed',integrationKnown,q.integration_note),
  fact('account','Account relationship',SALES_CHOICES.account_status.find(([id])=>id===q.account_status)?.[1],accountKnown,q.account_note),
  fact('trigger','Reason to act',q.trigger_note,current('trigger',q.trigger_note),q.trigger_note),
  fact('commitment','Next commitment',q.next_step,commitmentKnown,q.next_step)
 ];
 const opportunity=workflowKnown&&housing&&active&&!priority.provisional?{status:'suggested',product:workflow.product,workflow:workflow.label,reason:q.workflow_note,basis:'Rule-based suggestion from a rep-confirmed workflow',url:'https://eliseai.com/platform-overview',recorded_at:e('workflow').recorded_at}:{status:'unassessed',product:'Confirm the buyer workflow',reason:need?.points===0?'No active need is recorded.':!housing?'Establish housing operations before recommending a product.':priority.provisional?'Refresh the company evidence before recommending a product.':'Confirm the need and a specific workflow in buyer notes.',basis:'No product recommendation yet'};
 const blockers=[];
 if(!accountKnown)blockers.push('Check account relationship');
 if(!workflowKnown)blockers.push('Confirm a buyer workflow');
 if(!integrationKnown)blockers.push('Check product-specific integration');
 if(!impactKnown)blockers.push('Measure the operational baseline');
 for(const c of priority.criteria.filter(c=>c.points===null&&['need','timing','role','scope'].includes(c.key)))blockers.push(c.label);
 let action={code:'discover',label:'Qualify next',rank:3,reason:priority.reason,question:nextQuestion(lead,brief).question,target:'notes'};
 const set=(code,label,rank,reason,question,target='notes')=>{action={code,label,rank,reason,question,target}};
 // Ordered routing gates; additional context never adds points to the fit score.
 if(['existing','open_opportunity','duplicate'].includes(q.account_status)){
  const labels={existing:'Route to account owner',open_opportunity:'Continue the open opportunity',duplicate:'Review duplicate record'};
  set('route_'+q.account_status,accountKnown?labels[q.account_status]:'Recheck account relationship',q.account_status==='duplicate'?0:4,accountKnown?q.account_note:'The previous account assessment needs confirmation. Check ownership before new outreach.','Confirm the owner and continue from the existing account record.');
 }else if(priority.total===null&&lead.company_stale)set('research_pending','Research pending',1,priority.reason,'Buyer notes remain available while company sources refresh.','research');
 else if(priority.total===null)set('verify','Verify company',1,priority.reason,'Confirm the company website and identity.','lead');
 else if(!housing)set('operating_model','Confirm operating model',1,priority.reason,'Does this company own or operate residential housing?');
 else if(need?.points===0)set('nurture','Nurture',2,'The rep recorded no active need.','Agree whether and when to revisit; avoid a new sales pitch.');
 else if(priority.provisional)set('refresh','Recheck company sources',2,priority.reason,'Refresh the company evidence before using it to prioritize.','research');
 else if(q.integration_status==='blocked')set('integration','Resolve integration question',3,integrationKnown?q.integration_note:'An integration blocker is selected but its evidence needs confirmation.','Confirm the product, system edition and a supported path with the solutions team.');
 else if(due)set('commitment','Follow up today',6,`Recorded commitment ${q.next_due<today?'overdue since':'due'} ${q.next_due}.`,q.next_step);
 else if(commitmentKnown)set('planned','Follow the agreed next step',3,`Next commitment is due ${q.next_due}.`,q.next_step);
 else if(priority.tier==='Prioritize conversation'&&accountKnown)set('respond','Respond today',5,'Company fit and a near-term buying process are supported.',!workflowKnown?'Which workflow would you want to improve first?':!integrationKnown?integrationQuestion:!impactKnown?workflow.question:nextQuestion(lead,brief).question,'draft');
 else if(priority.tier==='Prioritize conversation')set('ownership','Confirm account ownership',3,'The lead is qualified; check whether the account is already being worked.','Check for an existing customer, open opportunity or duplicate before outreach.');
 else if(active&&workflowKnown&&!impactKnown)action.question=workflow.question;
 if(action.code==='discover'&&!String(lead.inquiry||'').trim())action.question=companyObservation(lead,brief,time)?.question||action.question;
 action.owner=q.owner||'Unassigned';action.due_date=commitmentKnown?q.next_due:null;action.due_status=commitmentKnown?(q.next_due<today?'overdue':q.next_due===today?'today':'upcoming'):'not_set';action.timezone=ACTION_TIMEZONE;
 return {model:DECISION_VERSION,evaluated_at:new Date(time).toISOString(),action,opportunity,signals,blockers,system:{name:q.pms_name,edition:q.pms_edition,source_url:q.integration_source_url,status:integrationKnown?q.integration_status:'unknown'},trigger_date:q.trigger_date,scope:q.scope||'',history:(lead.qualification_history||[]).slice(-5).map(h=>({recorded_at:h.recorded_at,reason:h.reason,fields:h.changes.map(c=>c.key)}))};
}

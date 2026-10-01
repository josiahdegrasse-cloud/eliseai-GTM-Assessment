import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake} from '../website/domain.mjs';
import {buildBrief} from '../website/brief.mjs';
import {scoreLead} from '../website/scoring.mjs';
import {salesDecision} from '../website/decision.mjs';
import {recordQualification,evidenceState} from '../website/qualification-evidence.mjs';
import {qualificationAnswers,WORKFLOWS} from '../static/sales-context.js';
import {scoreMarkup,sourcePanelMarkup} from '../static/research.js';
import {qualificationFormMarkup} from '../static/decision-ui.js';
import {leadsCSV} from '../static/export.js';
import Papa from 'papaparse';

const time=Date.parse('2026-09-29T16:00:00Z');
const answers={need_status:'confirmed',scope_status:'defined',timing_status:'30_days',role_status:'decision_maker',scope:'Pilot at three communities',timing:'Launch within 30 days',role:'Buyer owns the approval',workflow_key:'voice',workflow_note:'Buyer confirms missed calls after office hours',account_status:'new',account_note:'Rep checked the account directory; no current relationship'};
function make(q=answers){
 const l={...intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'We need help with missed calls.'}),processed_at:new Date(time).toISOString(),company_fresh_until:new Date(time+3600000).toISOString(),evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',date:new Date(time).toISOString(),text:'Acme Housing owns and manages residential communities and leasing operations. We currently manage 5,000 apartment homes.'}],qualifications:q};
 return recordQualification(l,{qualifications:{}},{time});
}
function evaluate(l,t=time){const brief=buildBrief(l,'acmehousing.com'),priority=scoreLead(l,brief,t);return {...l,research_brief:brief,priority,decision:salesDecision(l,brief,priority,t)}}
function edit(l,patch,t=time+1000,reconfirm=false){return recordQualification({...l,qualifications:{...l.qualifications,...patch}},l,{time:t,reconfirm})}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('identical evidence, inputs and evaluation time yield identical decisions',()=>{
 const l=make();assert.deepEqual(evaluate(l),evaluate(structuredClone(l)));
 const x=evaluate(l);assert.equal(x.priority.total,100);assert.equal(x.decision.action.label,'Respond today');assert.equal(x.decision.opportunity.product,'VoiceAI');
});
test('missing buyer evidence is unassessed; a company website cannot establish intent or a product',()=>{
 const l=evaluate(make({}));assert.equal(l.priority.readiness_assessment.points,null);assert.equal(l.priority.readiness_assessment.label,'Needs qualification');assert.equal(l.decision.opportunity.status,'unassessed');assert.equal(l.decision.action.label,'Qualify next');
});
test('provider outages request research recovery rather than treating the company as the wrong identity',()=>{
 const l=make();l.evidence=[];l.company_stale=true;
 const x=evaluate(l);assert.equal(x.priority.total,null);assert.equal(x.decision.action.label,'Research pending');assert.equal(x.decision.action.target,'research');
});
test('all product suggestions require an explicit workflow, supporting note, housing fit and current need',()=>{
 for(const workflow of WORKFLOWS){const l=evaluate(make({...answers,workflow_key:workflow.key}));assert.equal(l.decision.opportunity.product,workflow.product)}
 for(const patch of [{workflow_key:'anything'},{workflow_note:''},{need_status:'unknown'},{need_status:'none'}])assert.equal(evaluate(make({...answers,...patch})).decision.opportunity.status,'unassessed');
 const l=make();l.evidence[0].text='Acme Housing provides software for leasing teams.';assert.equal(evaluate(l).decision.opportunity.status,'unassessed');
});
test('old, undated, future and changed buyer assessments cannot earn readiness points',()=>{
 const l=make();
 const legacy={...l,qualification_evidence:{}};assert.equal(evaluate(legacy).priority.readiness,0);
 const changed={...l,inquiry:'Different buyer need entered without assessment'};assert.equal(evaluate(changed).priority.criteria.find(c=>c.key==='need').points,null);
 const future=make();for(const e of Object.values(future.qualification_evidence))e.recorded_at=new Date(time+1).toISOString();assert.equal(evaluate(future).priority.readiness,0);
 const stale=evaluate(l,time+31*86400000);assert.equal(stale.priority.readiness,10);assert.equal(stale.decision.opportunity.status,'unassessed');
 assert.equal(evaluate(l,time+91*86400000).priority.readiness,0);
});
test('unrelated edits never renew assessment dates; explicit reconfirmation does',()=>{
 const l=make(),t=time+31*86400000,edited=edit(l,{owner:'Assigned rep'},t);
 assert.deepEqual(edited.qualification_evidence.need,l.qualification_evidence.need);assert.equal(evidenceState(edited,'need',t).status,'stale');
 const confirmed=edit(edited,{},t+1,true);assert.equal(evidenceState(confirmed,'need',t+1).status,'current');assert.equal(confirmed.qualification_history.at(-1).reason,'Reconfirmed by rep');
});
test('positive integration assessment requires product, edition, note and official reference',()=>{
 const q={...answers,pms_name:'Example PMS',pms_edition:'Enterprise',integration_status:'supported',integration_note:'Rep checked VoiceAI support and prerequisites',integration_source_url:'https://eliseai.com/integrations'};
 assert.equal(evaluate(make(q)).decision.system.status,'supported');
 for(const patch of [{pms_name:''},{pms_edition:''},{integration_note:''},{workflow_key:'unknown'},{integration_source_url:'https://eliseai.com.evil.invalid/docs'},{integration_source_url:'javascript:alert(1)'},{integration_source_url:'https://eliseai.com/'+ 'a'.repeat(3000)}])assert.equal(evaluate(make({...q,...patch})).decision.system.status,'unknown');
 const l=make(q),changed=edit(l,{pms_edition:'Different edition'});assert.equal(changed.qualifications.integration_status,'unknown');
 const workflow=edit(l,{workflow_key:'maintenance'});assert.equal(workflow.qualifications.integration_status,'unknown');
});
test('account routing outranks urgency and size, and stale account flags require rechecking',()=>{
 for(const [status,expected] of [['existing','Route to account owner'],['open_opportunity','Continue the open opportunity'],['duplicate','Review duplicate record']]){
  const l=make({...answers,account_status:status});assert.equal(evaluate(l).decision.action.label,expected);assert.equal(evaluate(l,time+91*86400000).decision.action.label,'Recheck account relationship');
 }
 assert.equal(evaluate(make({...answers,account_status:'unknown'})).decision.action.label,'Confirm account ownership');
});
test('no-need and integration blockers precede scheduled commitments',()=>{
 const q={...answers,owner:'Rep A',next_step:'Call the buyer to agree on scope',next_due:'2026-09-28'};
 assert.equal(evaluate(make({...q,need_status:'none'})).decision.action.label,'Nurture');
 assert.equal(evaluate(make({...q,integration_status:'blocked'})).decision.action.label,'Resolve integration question');
 assert.equal(evaluate(make(q)).decision.action.label,'Follow up today');
});
test('due dates use Eastern Time across a UTC date boundary and do not add points',()=>{
 const l=make({...answers,owner:'Rep A',next_step:'Confirm the pilot communities',next_due:'2026-09-30'});
 const t=Date.parse('2026-09-30T02:00:00Z');l.company_fresh_until=new Date(t+3600000).toISOString();
 assert.equal(evaluate(l,t).decision.action.due_status,'upcoming');assert.equal(evaluate(l,t).decision.action.label,'Follow the agreed next step');assert.equal(evaluate(l,t).priority.total,100);
 const t2=Date.parse('2026-09-30T04:00:00Z');l.company_fresh_until=new Date(t2+3600000).toISOString();assert.equal(evaluate(l,t2).decision.action.due_status,'today');
});
test('the suggested question does not request the PMS and edition already recorded',()=>{
 const d=evaluate(make({...answers,pms_name:'Example PMS',pms_edition:'Enterprise'})).decision;
 assert.equal(d.action.code,'respond');assert.match(d.action.question,/Example PMS Enterprise/);assert.doesNotMatch(d.action.question,/Which PMS/);
});
test('incomplete commitments and invalid calendar dates cannot create due work',()=>{
 for(const patch of [{owner:''},{next_step:''},{next_due:'2026-02-30'},{next_due:'yesterday'}])assert.equal(evaluate(make({...answers,owner:'Rep A',next_step:'Confirm the pilot communities',next_due:'2026-09-28',...patch})).decision.action.due_status,'not_set');
});
test('measured zero is valid; arbitrary values and unsupported metrics stay unassessed',()=>{
 const q={...answers,impact_metric:'missed_calls_week',impact_value:0,impact_note:'Buyer reports zero missed calls during the last week'};
 assert.match(evaluate(make(q)).decision.signals.find(s=>s.key==='impact').value,/^0 /);
 for(const patch of [{impact_value:-1},{impact_value:'Infinity'},{impact_value:'1e6'},{impact_value:{}},{impact_value:[25]},{impact_metric:'invented'},{impact_note:''}])assert.equal(evaluate(make({...q,...patch})).decision.signals.find(s=>s.key==='impact').confirmed,false);
});
test('added context never inflates score, even when the operational metric is large',()=>{
 const l=evaluate(make()),r=evaluate(make({...answers,impact_metric:'inquiries_month',impact_value:99999999,impact_note:'Large buyer-reported monthly count',trigger_note:'Buyer reports a new launch next month',trigger_date:'2026-10-10',pms_name:'Popular PMS',pms_edition:'Enterprise'}));
 assert.equal(l.priority.total,r.priority.total);assert.equal(l.priority.fit,r.priority.fit);
});
test('history is bounded and preserves changed inputs, with new metadata outside editable fields',()=>{
 let l=make();for(let n=0;n<15;n++)l=edit(l,{owner:'Rep '+n},time+n*1000);
 assert.equal(l.qualification_history.length,10);assert.ok(l.qualification_history.at(-1).changes[0].after.includes('Rep 14'));
 assert.equal(qualificationAnswers({score:100,qualification_evidence:{need:{recorded_at:'2099-01-01'}}}).qualification_evidence,undefined);
 const cleared=edit(l,{workflow_key:'unknown',workflow_note:''});assert.ok(cleared.qualification_history.at(-1).changes.some(c=>c.key==='workflow'));assert.equal(evaluate(cleared).decision.opportunity.status,'unassessed');
});
test('decision UI escapes evidence, shows unknown separately and provides accessible editing tabs',()=>{
 const l=evaluate(make({...answers,workflow_note:'<script>unsafe()</script>',owner:'<img onerror=x>'}));
 const html=scoreMarkup(l,{esc})+sourcePanelMarkup(l,{esc,icon:()=>'',date:v=>v},'score')+qualificationFormMarkup(l,esc);
 assert.doesNotMatch(html,/<script>|<img /);assert.match(html,/&lt;script&gt;/);assert.match(html,/role="tablist"/);assert.match(html,/data-notes-pane="opportunity" hidden/);assert.match(html,/data-notes-pane="handoff" hidden/);
 assert.doesNotMatch(scoreMarkup(evaluate(make({})),{esc}),/Discovery needed|NEXT ACTION|BUYING READINESS/);
});
test('CSV retains the action, score version and assessment evidence without losing injection protection',()=>{
 const l=evaluate(make({...answers,owner:'=HYPERLINK("bad")'})),row=Papa.parse(leadsCSV([l]),{header:true}).data[0];
 assert.equal(row.next_action,'Respond today');assert.equal(row.suggested_product,'VoiceAI');assert.equal(row.scoring_model,'housing-fit-v3');assert.ok(row.rep_owner.startsWith("'="));assert.ok(JSON.parse(row.assessment_evidence).need.recorded_at);
});

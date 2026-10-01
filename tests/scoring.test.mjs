import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify,presentLead} from '../website/domain.mjs';
import {scoreLead} from '../website/scoring.mjs';
import {recordQualification} from '../website/qualification-evidence.mjs';
import {qualificationAnswers} from '../static/sales-context.js';
import {scoreMarkup,sourcePanelMarkup} from '../static/research.js';

const text='Acme Housing owns and manages residential communities and leasing operations. We currently own and manage 5,000 apartment homes.';
const qualified={need_status:'confirmed',scope_status:'defined',timing_status:'30_days',role_status:'decision_maker',scope:'Pilot at three communities',timing:'Start next month',role:'Buyer owns the final decision'};
const make=(quote=text,extra={})=>qualify(recordQualification({...intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'We need better after-hours leasing coverage.'}),...extra},{qualifications:{}}),{evidence:[{title:'Acme Housing',url:'https://acmehousing.com/about',verified:true,text:quote,date:new Date().toISOString()}],engine:'reader-v2',message:'Company sources found.'},{status:'incomplete'},[]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('company size and an inbound message alone cannot create a hot lead',()=>{
 const p=make().priority;assert.equal(p.total,50);assert.equal(p.fit,50);assert.equal(p.readiness,0);assert.equal(p.unassessed,50);assert.equal(p.tier,'Discovery needed');
 const massive=make(text.replace('5,000','500,000')).priority;assert.equal(massive.total,p.total);assert.equal(massive.rank,p.rank);
});
test('buyer-confirmed need, timeline, authority and scope produce an explained priority',()=>{
 const p=make(text,{qualifications:qualified}).priority;
 assert.equal(p.total,100);assert.equal(p.readiness,50);assert.equal(p.unassessed,0);assert.equal(p.tier,'Prioritize conversation');
 assert.equal(p.criteria.reduce((sum,c)=>sum+(c.points??0),0),p.total);assert.equal(p.criteria.reduce((sum,c)=>sum+c.max,0),100);
});
test('a smaller ready operator can outrank a large unqualified company',()=>{
 const small=make(text.replace('5,000','100'),{qualifications:qualified}).priority,large=make().priority;
 assert.equal(small.total,91);assert.ok(small.rank>large.rank);assert.ok(small.total>large.total);
});
test('explicit no-need overrides company fit, timing and role',()=>{
 const p=make(text,{qualifications:{...qualified,need_status:'none'}}).priority;
 assert.equal(p.tier,'No active need');assert.equal(p.criteria.find(c=>c.key==='need').points,0);
 assert.equal(p.unassessed,0);
});
test('unanswered need is distinct from an explicit negative answer',()=>{
 const unknown=make().priority,no=make(text,{qualifications:{need_status:'none'}}).priority;
 assert.equal(unknown.total,no.total);assert.equal(unknown.unassessed,50);assert.equal(no.unassessed,30);assert.notEqual(unknown.tier,no.tier);
});
test('readiness selections without supporting buyer notes earn no points',()=>{
 const p=make(text,{inquiry:'',qualifications:{need_status:'confirmed',scope_status:'defined',timing_status:'30_days',role_status:'decision_maker'}}).priority;
 assert.equal(p.readiness,0);assert.equal(p.unassessed,50);
});
test('free text and arbitrary scoring payloads cannot promote readiness',()=>{
 const p=make(text,{score:100,qualifications:{scope:'All sites',timing:'Urgent, tomorrow',role:'CEO, final decision-maker',need_status:'100',scope_status:true,timing_status:'ASAP',role_status:{points:10}}}).priority;
 assert.equal(p.readiness,0);assert.equal(qualificationAnswers({need_status:'100'}).need_status,'unknown');
});
test('missing identity and pending research suppress a total',()=>{
 const l=make(text,{qualifications:qualified});
 for(const candidate of [{...l,research_state:'pending'},{...l,processed_at:null},{...l,evidence:l.evidence.map(e=>({...e,verified:false}))}])assert.equal(presentLead(candidate).priority.total,null);
});
test('software and commercial descriptions cannot become priority housing opportunities',()=>{
 for(const quote of ['Acme Housing provides software for apartment management and leasing.','Acme Housing owns and operates commercial office properties.','Acme Housing does not manage multifamily communities or offer leasing services.']){
  const p=make(quote,{qualifications:qualified}).priority;assert.equal(p.fit,0);assert.ok(p.rank<3);
 }
});
test('stale and saved-sample evidence blocks top-priority promotion',()=>{
 const l=make(text,{qualifications:qualified});
 for(const flags of [{company_stale:true},{company_snapshot:true},{company_fresh_until:'2020-01-01T00:00:00Z'}]){const p=presentLead({...l,...flags}).priority;assert.equal(p.tier,'Recheck sources');assert.ok(p.provisional)}
});
test('mixed beds, conflicting totals and dated scale cannot silently earn size points',()=>{
 for(const quote of [text.replace('5,000 apartment homes','5,000 units and student beds'),text+' We currently own and manage 8,000 apartment homes.',text.replace('We currently','As of January 1, 2020, we'),text.replace('We currently','As of January 1, 2030, we')]){
  const p=make(quote).priority;assert.equal(p.criteria.find(c=>c.key==='scale').points,null,quote);assert.equal(p.unassessed,60);
 }
});
test('score thresholds behave consistently and never exceed the documented bounds',()=>{
 for(const [homes,expected] of [[199,1],[200,4],[999,4],[1000,7],[4999,7],[5000,10],[1000000,10]]){
  const l=make(text.replace('5,000',homes.toLocaleString('en-US'))),p=l.priority;
  assert.equal(p.criteria.find(c=>c.key==='scale').points,expected);assert.ok(p.total>=0&&p.total<=100);
  assert.equal(scoreLead(l,l.research_brief).total,p.total);
 }
});
test('logo, country, footprint, registry and address match do not add score points',()=>{
 const l=make(),other={...l,country:'CA',property_context:{status:'matched'},registry_context:{status:'name_match'},logo:'found'};
 assert.equal(presentLead(other).score,l.score);
 assert.equal(scoreLead(l,{...l.research_brief,footprint:{value:'100 countries'}}).total,l.priority.total);
});
test('late timing prevents a top-priority label even with strong company fit',()=>{
 const p=make(text,{qualifications:{...qualified,timing_status:'later'}}).priority;assert.equal(p.total,85);assert.equal(p.tier,'Qualify next');
});
test('score explanation stays accessible and escapes source text',()=>{
 const l=make();l.priority.reason='<script>bad()</script>';
 const html=scoreMarkup(l,{esc})+sourcePanelMarkup(l,{esc,icon:()=>'',date:v=>v},'score');
 assert.match(html,/aria-label="Lead priority"/);assert.match(html,/PRIORITY RUBRIC/);assert.match(html,/Company/);assert.match(html,/data-panel-source="S1"/);assert.doesNotMatch(html,/<script>/);
});


test('automatic fit gives factual evidence without prescribing qualification',()=>{
 const l=make(),html=scoreMarkup(l,{esc});
 assert.match(html,/High priority/);assert.doesNotMatch(html,/60–100/);assert.doesNotMatch(html,/class="priority-number"/);assert.match(html,/Why this priority/);assert.doesNotMatch(html,/Discovery needed|Record buyer answers|data-decision-action/);
 assert.doesNotMatch(html,/0 of 50|Not assessed|<meter/);
 assert.equal(l.priority.readiness_assessment.points,null);
});
test('a negative readiness answer remains a real zero, separate from strong company fit',()=>{
 const l=make(text,{qualifications:{need_status:'none'}}),html=scoreMarkup(l,{esc});
 assert.equal(l.priority.readiness,0);assert.doesNotMatch(html,/No active need|BUYING READINESS|buyer-confirmed criteria|<meter/);
 assert.match(html,/High priority/);assert.doesNotMatch(html,/60–100/);assert.doesNotMatch(html,/class="priority-number"/);
});

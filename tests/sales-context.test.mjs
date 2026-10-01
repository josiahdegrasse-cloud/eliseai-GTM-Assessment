import {readerRequest,registryRequest} from '../website/free-research.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,presentLead,draftFor,censusParams,domain} from '../website/domain.mjs';
import {nextQuestion,qualificationAnswers} from '../static/sales-context.js';
import {needsResearch} from '../static/workflow.js';
import {buyerContextMarkup,researchMarkup} from '../static/research.js';
const base={name:'TEST Contact',email:'test@example.invalid',company:'Acme Housing',website:'acmehousing.com',city:'Raleigh',state:'NC',property_address:'12 Test Street'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,icon:()=>'',date:v=>v||'',nextAction:()=>'',busy:false};
test('buyer need comes before discovery; answered fields are not asked again',()=>{
 const lead=intake(base);assert.equal(nextQuestion(lead).key,'inquiry');
 lead.inquiry='Slow follow-up after hours';
 for(const key of ['scope','process','timing','role']){
  assert.equal(nextQuestion(lead).key,key);
  lead.qualifications={...lead.qualifications,[key]:'Recorded answer'};
 }
 assert.equal(nextQuestion(lead).key,'meeting');assert.match(draftFor(lead).draft,/What kind of properties or services/);
 assert.doesNotMatch(draftFor(lead).draft,/What prompted|Which communities|which tools|When would/);
});
test('legacy combined notes remain intact without guessing workflow or timing',()=>{
 const answers=qualificationAnswers({process_timing:'Yardi, next quarter',extra:'ignored'});
 assert.equal(answers.process_timing,'Yardi, next quarter');assert.equal(answers.process,'');assert.equal(answers.timing,'');assert.equal(answers.extra,undefined);
 assert.match(buyerContextMarkup({...intake(base),qualifications:answers},ui),/Yardi, next quarter/);
});
test('company fit does not label a lead urgent or imply a reviewed draft was sent',()=>{
 const lead={...intake(base),processed_at:'2026-09-29',research_state:'complete',draft_research_signature:null,evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',text:'Acme Housing manages residential multifamily communities and leasing inquiries.'}],property_context:{status:'matched'}};
 assert.equal(presentLead(lead).fit.label,'Strong fit');assert.equal(presentLead(lead).status,'Draft to review');
 assert.equal(presentLead({...lead,reviewed:true}).status,'Draft reviewed');
});
test('missing, unmatched and unsupported addresses do not queue repeat research',()=>{
 for(const status of ['incomplete','unmatched','ambiguous','unsupported']){
  const lead={...intake(base),research_state:'partial',processed_at:'2026-09-29',property_context:{status}};
  assert.equal(needsResearch(lead),false,status);
  const withNote={...lead,research_note:'Company retrieved.',property_context:{status,message:'Check the address.'}};assert.equal(presentLead(presentLead(withNote)).research_note,presentLead(withNote).research_note);
  const html=researchMarkup(presentLead(lead),ui);assert.match(html,/12 Test Street/);assert.doesNotMatch(html,/id="view-draft"/);assert.doesNotMatch(html.split('<section class="research-details"')[0],/outside Census coverage|Check the address/);
 }
 assert.equal(needsResearch({research_state:'partial',company_stale:true}),true);
});
test('buyer context stays visible without accordions; unsaved editing remains available',()=>{
 const lead={...intake(base),inquiry:'<img src=x onerror=alert(1)>',qualifications:{scope:'<script>bad()</script>'}};
 const html=researchMarkup(presentLead(lead),{...ui,contextDirty:true});
 assert.match(html,/Inquiry and buyer notes/);assert.doesNotMatch(html,/<details[^>]*class="qualification/);
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/id="context-editor" hidden/);assert.match(html,/Unsaved buyer notes/);
});
test('inquiry and discovery text never enter provider queries',()=>{
 const lead={...intake(base),inquiry:'PRIVATE_REQUEST_MARKER',qualifications:{role:'PRIVATE_ROLE_MARKER',timing:'PRIVATE_TIMING_MARKER'}};
 assert.doesNotMatch(JSON.stringify([readerRequest('https://'+domain(lead)+'/',domain(lead)),registryRequest(lead.company),censusParams(lead)]),/PRIVATE_/);
});

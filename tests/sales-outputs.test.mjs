import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify,draftFor,presentLead} from '../website/domain.mjs';
import {recordQualification} from '../website/qualification-evidence.mjs';
import {companyObservation} from '../website/sales-insights.mjs';
import {researchMarkup,draftEvidenceMarkup} from '../static/research.js';
import {leadsCSV} from '../static/export.js';
import Papa from 'papaparse';

const regional='Acme Housing manages multifamily communities. We currently own and manage over 25,000 apartment homes in eight U.S. markets.';
const make=(text=regional,extra={},evidenceExtra={})=>qualify({...intake({name:'Jordan Lee',email:'test@example.invalid',company:'Acme Housing',website:'acmehousing.com'}),...extra},{evidence:[{verified:true,title:'Acme Housing overview',url:'https://acmehousing.com/about',text,...evidenceExtra}],message:'Fixture company source.'},{status:'incomplete'},[]);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('assignment-minimum intake produces sourced personalization with no invented readiness',()=>{
 const l=make();assert.equal(l.priority.total,50);assert.equal(l.priority.readiness_assessment.points,null);assert.equal(l.priority.unassessed,50);
 assert.match(l.draft,/eight U\.S\. markets/);assert.match(l.draft,/EliseAI can answer leasing questions/);assert.match(l.question,/quick walkthrough/);
 assert.equal(l.draft_strategy,'company_research');assert.equal(l.draft_basis[0].sentence,'I noticed Acme Housing operates across eight U.S. markets.');
 assert.ok(l.draft_basis[0].source.excerpt.includes(l.draft_basis[0].quote));
 assert.doesNotMatch(l.draft,/25,000|struggling|budget|urgent|guarantee|save \d/i);
});
test('different operating evidence changes the intro and useful discovery angle',()=>{
 const cases=[
  [regional,/eight U\.S\. markets/,/quick walkthrough/],
  ['Acme Housing operates rental housing globally.',/multiple countries/,/quick walkthrough/],
  ['Acme Housing manages student housing communities.',/manages student housing/,/quick walkthrough/],
  ['Acme Housing owns and manages affordable housing communities.',/manages affordable housing/,/quick walkthrough/],
  ['Acme Housing owns and manages 12 residential apartments.',/EliseAI can answer/,/quick walkthrough/]
 ];
 for(const [text,claim,question] of cases){const l=make(text);assert.match(l.draft,claim);assert.match(l.question,question);assert.equal((l.draft.match(/\?/g)||[]).length,1);assert.ok(l.draft.split(/\s+/).length<=120)}
});
test('stale, failed, sample and expired research cannot be asserted as fresh in an intro',()=>{
 const l=make();
 for(const patch of [{company_stale:true},{company_snapshot:true},{company_fresh_until:'2020-01-01T00:00:00Z'}]){
  const copy=draftFor({...l,...patch},true,false,l.research_brief);assert.doesNotMatch(copy.draft,/eight U.S. markets|Your company overview/);assert.equal(copy.uses_fact,false);
 }
 for(const date of ['2020-01-01','2099-01-01'])assert.doesNotMatch(make(regional,{}, {published_date:date}).draft,/eight U.S. markets/);
});
test('old or negated footprint figures fall back to the supported operating model',()=>{
 for(const text of ['Acme Housing manages multifamily communities. As of January 1, 2020, we managed apartments in eight U.S. markets.','Acme Housing manages apartments but not in eight U.S. markets.']){
  const l=make(text);assert.doesNotMatch(l.draft,/eight U.S. markets/);
 }
});
test('unmatched entities and service providers do not receive operator personalization',()=>{
 for(const [text,extra] of [[regional,{verified:false}],['Acme Housing provides software for apartment leasing.',{}],['Acme Housing advises clients on residential property management.',{}]]){
  const l=make(text,{},extra);assert.doesNotMatch(l.draft,/Your company overview|EliseAI can/);assert.equal(companyObservation(l,l.research_brief),null);
 }
});
test('contrast clauses preserve a positive need without repeating a negated one',()=>{
 const l=make(regional,{inquiry:'We do not need tours, but we need maintenance support.'});assert.equal(l.theme,'maintenance');assert.match(l.draft,/maintenance requests/);assert.doesNotMatch(l.draft,/schedule tours/);
});
test('current buyer workflow overrides inquiry keywords and the next ask matches the action',()=>{
 const raw=make(regional,{inquiry:'We first asked about tours; the active project is maintenance.'});
 const l=recordQualification({...raw,qualifications:{need_status:'confirmed',workflow_key:'maintenance',workflow_note:'Buyer confirms maintenance intake is the project'}},raw);
 const current=presentLead(l),copy=draftFor(current,true,false,current.research_brief);assert.equal(copy.theme,'maintenance');assert.match(copy.question,/walkthrough of maintenance requests/);
});
test('an expired negative assessment asks for updated priorities instead of asserting no need',()=>{
 const raw=make(regional,{inquiry:'No active project this year.'});
 const l=recordQualification({...raw,qualifications:{need_status:'none'}},raw,{time:Date.parse('2020-01-01')});
 // Stamp an intentionally old assessment using its exact bound input.
 l.qualification_evidence.need.recorded_at='2020-01-01T00:00:00Z';
 const copy=draftFor(l,true,false,l.research_brief);assert.equal(copy.theme,'reconfirm_need');assert.match(copy.draft,/priorities changed/);assert.doesNotMatch(copy.draft,/EliseAI can/);
});
test('agreed commitments are not replaced by a new discovery pitch',()=>{
 const raw=make(regional,{inquiry:'We need missed-call support.'});
 const l=recordQualification({...raw,qualifications:{owner:'Test rep',next_step:'Confirm pilot communities',next_due:'2099-01-01'}},raw);
 const copy=draftFor(l,true,false,l.research_brief);assert.equal(copy.theme,'agreed_next_step');assert.match(copy.draft,/agreed next step/);assert.doesNotMatch(copy.draft,/Which communities|EliseAI can/);
});
test('sales insights connect cited facts to implications without using area demographics as intent',()=>{
 const l=make(regional,{property_address:'12 Test Street',area_context:{median_gross_rent:99999}}),items=l.sales_insights.items;
 assert.ok(items.find(i=>i.key==='fit').source_ids.length);assert.match(items.find(i=>i.key==='scale').meaning,/first rollout/);
 assert.match(items.find(i=>i.key==='angle').meaning,/not a confirmed pain/);assert.match(items.find(i=>i.key==='readiness').fact,/the buyer’s need/);
 assert.match(items.find(i=>i.key==='property').meaning,/do not establish ownership/);assert.doesNotMatch(JSON.stringify(l.sales_insights),/99999/);
});
test('sales insight facts, draft rationale and source evidence survive CSV export',()=>{
 const l=make(),row=Papa.parse(leadsCSV([l]),{header:true}).data[0];
 assert.match(row.sales_insights,/Acme Housing manages multifamily communities/);assert.equal(row.draft_strategy,'company_research');assert.match(row.draft_evidence,/https:\/\/acmehousing.com\/about/);
 assert.match(row.draft_rationale,/no pain or buying intent/);assert.equal(row.scoring_model,l.company_fit.model);
});
test('new insight and rationale rendering escapes text and exposes source controls',()=>{
 const l=make();l.research_brief.summary.text='<script>bad()</script>';l.draft_rationale='<img src=x onerror=alert(1)>';
 const html=researchMarkup(l,{esc,icon:()=>'',date:v=>v||'',nextAction:()=>''})+draftEvidenceMarkup(l,{esc});assert.doesNotMatch(html,/<script|<img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/data-source="S1"/);assert.match(html,/Why this reply/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify} from '../website/domain.mjs';
import {leadPriority} from '../static/company-fit.js';
import {recordQualification} from '../website/qualification-evidence.mjs';
import {sourcePanelMarkup,buyerContextMarkup} from '../static/research.js';
const make=(text='Acme Housing manages 2,000 residential apartment homes.',inquiry='We need help with after-hours leasing.')=>qualify(intake({name:'Jordan Lee',email:'jordan@acmehousing.com',company:'Acme Housing',website:'acmehousing.com',inquiry}),{evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',text,date:new Date().toISOString()}]},{},[]);
test('five sourced questions explain the tier without a numeric score',()=>{
 const l=make(),p=leadPriority(l);
 assert.equal(p.label,'High priority');assert.equal(p.model,'inbound-priority-v2');assert.match(p.reason,/after-hours/);
 assert.deepEqual(p.criteria.map(c=>c.key),['segment','inquiry','portfolio','contact','account']);
 const scale=p.criteria.find(c=>c.key==='portfolio');assert.equal(p.portfolio_band,'1,000–4,999');assert.ok(scale.quote.includes('2,000'));assert.ok(scale.url.startsWith('https://acmehousing.com'));
 assert.equal(p.confidence.level,'supported');assert.equal(p.routing.status,'unknown');assert.equal(l.score,null);
 assert.equal(leadPriority(make(undefined,'')).label,'Medium priority');
});
test('unknown facts, stale sources and non-fits remain distinct',()=>{
 const l=make();assert.equal(leadPriority({...l,research_brief:{}}).label,'Needs review');
 assert.equal(leadPriority({...l,company_snapshot:true}).confidence.level,'saved');
 assert.equal(leadPriority({...l,company_stale:true}).tier,null);
 const vendor=make('Acme Housing provides property management software for apartment operators.');assert.equal(vendor.lead_priority.label,'Low priority');assert.equal(vendor.lead_priority.confidence.level,'supported');
 assert.equal(leadPriority({...l,research_brief:{...l.research_brief,sources:l.research_brief.sources.map(s=>({...s,retrieved_at:'2001-01-01'}))}}).confidence.level,'saved');
});
test('beds, property counts, historic figures and unsourced numbers never become comparable home bands',()=>{
 for(const text of ['Acme Housing manages 20 apartment communities.','Acme Housing manages 2,000 residential units and student beds.','In 2010 Acme Housing managed 2,000 residential apartment homes.'])assert.equal(leadPriority(make(text)).portfolio_band,null,text);
 const l=make();assert.equal(leadPriority({...l,research_brief:{...l.research_brief,portfolio:{value:'50,000 homes',quote:'invented',source_id:'S1'}}}).portfolio_band,null);
 assert.equal(leadPriority(make('Acme Housing manages over 2,000 residential apartment homes.')).portfolio_band,'At least 2,000');
});
test('account relationship uses a dated, input-bound rep check and changes routing, not priority',()=>{
 const l=make(),next={...l,qualifications:{...l.qualifications,account_status:'existing',account_note:'Checked customer account with RevOps.'}};
 assert.equal(leadPriority(next).routing.status,'unknown');recordQualification(next,l);
 const p=leadPriority(next);assert.equal(p.routing.label,'Account team');assert.equal(p.tier,'A');assert.equal(p.criteria.find(c=>c.key==='account').value,'Existing customer');
 assert.equal(leadPriority({...next,qualifications:{...next.qualifications,account_note:'Different unchecked claim'}}).routing.status,'unknown');
 assert.equal(leadPriority(next,next.research_brief,Date.now()+91*86400000).routing.status,'unknown');
});
test('rubric escapes buyer content and exposes sources plus the account evidence editor',()=>{
 const l=make(undefined,'We need help with leasing <script>bad</script>.'),ui={esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),date:String,icon:()=>''};
 const html=sourcePanelMarkup(l,ui,'score');assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/View source/);assert.match(html,/not predict conversion/);
 const form=buyerContextMarkup(l,ui);assert.match(form,/name="account_status"/);assert.match(form,/name="account_note"/);
});

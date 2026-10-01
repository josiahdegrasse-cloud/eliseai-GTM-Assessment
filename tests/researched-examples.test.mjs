import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intake,presentLead} from '../website/domain.mjs';
import {autoResearchDue} from '../static/workflow.js';
import {validHook} from '../website/draft-grounding.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../test-data/'+name,import.meta.url)));
const rows=read('researched-examples.json'),inputs=read('sheet-example-inputs.json');
test('ten examples preserve nine Sheet inputs and add one explicitly synthetic vendor inquiry',()=>{
 assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.sample_key)).size,10);
 assert.equal(rows.filter(r=>r.inquiry).length,4);
 for(const row of rows){
  if(row.sample_key==='rubric-yardi'){
   assert.equal(row.company,'Yardi');assert.match(row.name,/TEST/);assert.match(row.email,/@example.invalid$/);assert.equal(row.property_address,'');
  }else{
   const original=inputs.find(r=>r.email===row.email&&r.company===row.company);assert.ok(original);
   for(const key of ['name','email','company','website','property_address','city','state','country','research_url'])assert.equal(row[key],original[key],key);
   assert.ok(row.property_address&&row.city&&row.state);
  }
  for(const key of ['draft','subject','company_fit','score','priority'])assert.equal(row[key],undefined);
  assert.equal(row.sample_lead,true);
 }
});
test('saved source facts generate fit and drafts without claiming nonexistent inquiries',()=>{
 for(const row of rows){
  const l=presentLead({...intake(row),...row});
  assert.equal(autoResearchDue(l),false);assert.equal(l.sample_lead,true);assert.ok(l.evidence.length);
  if(row.property_address)assert.ok(l.sample_property.url.startsWith('https://'));else assert.notEqual(l.property_context.status,'matched');assert.ok(l.draft);
  assert.ok(l.draft_hooks.every(h=>validHook(h,l.draft_facts)));
  assert.equal((l.draft.match(/\?/g)||[]).length,1);
  if(!row.inquiry)assert.doesNotMatch(l.draft,/Thanks for|your inquiry|reaching out about|you mentioned/i);
  if(row.name.includes('(TEST)'))assert.equal(l.professional_context?.people?.length||0,0);
 }
});

test('a prior brokerage job cannot classify the contact’s current company as a broker',async()=>{
 const {classifyCompany}=await import('../website/company-classification.mjs');
 const result=classifyCompany([{id:'S1',name_matched:true,title:'Example Property Management',excerpt:'Alex began his Real Estate career as a Real Estate Broker providing leasing and sales services for industrial properties.'}],'Example Property Management');
 assert.equal(result.kind,'unclassified');
});

test('CPManagement uses its operating statement instead of the conflicting SEO title',()=>{
 const r=rows.find(r=>r.company==='CPManagement'),l=presentLead({...intake(r),...r});
 assert.equal(l.research_brief.portfolio.value,'over 2,000 multifamily apartment units');
 assert.equal(l.research_brief.footprint.value,'Northern New England');
 assert.deepEqual(l.research_brief.portfolio.alternatives,[]);
 assert.ok(!l.research_brief.context.some(c=>c.key==='markets'&&c.text.includes('April 3, 2025')));
});
test('legacy demo prefixes are cleaned without stripping real email subjects',async()=>{
 const {cleanInquiry}=await import('../website/domain.mjs');
 const text='[SYNTHETIC INBOUND EMAIL — DEMO ONLY; not a real message from this person] Subject: Exploring a leasing pilot. Hello, we would like a demo.';
 assert.equal(cleanInquiry(text),'Hello, we would like a demo.');
 assert.equal(cleanInquiry('Subject: My real inquiry. Hello'),'Subject: My real inquiry. Hello');
});

test('demo demonstrates all priority outcomes without preset answers',()=>{
 const leads=rows.map(r=>presentLead({...intake(r),...r}));
 assert.deepEqual(new Set(leads.map(l=>l.lead_priority.tier)),new Set(['A','B','C',null]));
 const vendor=leads.find(l=>l.company==='Yardi');assert.equal(vendor.lead_priority.tier,'C');assert.equal(vendor.inquiry,'');assert.doesNotMatch(vendor.draft,/EliseAI can/);
 const grounded=leads.filter(l=>l.draft_hooks.some(h=>h.kind==='company_observation'));assert.ok(grounded.length>=3);for(const l of grounded)assert.equal(l.lead_priority.confidence.level,'saved');
});

 test('medium and low demo leads have no sample inquiry',()=>{
 for(const row of rows){const l=presentLead({...intake(row),...row});if(['B','C'].includes(l.lead_priority.tier))assert.equal(l.inquiry,'');}
 });

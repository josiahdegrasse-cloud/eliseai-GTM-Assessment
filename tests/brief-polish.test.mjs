import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intake,presentLead} from '../website/domain.mjs';
import {buildBrief} from '../website/brief.mjs';
import {researchMarkup,fitHeaderMarkup} from '../static/research.js';
import {autoResearchDue,autoResearchPlan,emailStatusLabel} from '../static/workflow.js';
const examples=JSON.parse(readFileSync(new URL('../test-data/researched-examples.json',import.meta.url)));
const ui={esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'',date:s=>s};
const base={company:'AMLI',website:'amli.com',name:'Example Person',email:'person@example.invalid'};
const evidence=text=>[{title:'About AMLI',url:'https://amli.com/about',text,verified:true}];
test('ownership is concise with its complete supporting quote retained',()=>{
 const quote='Founded in 1980 as AMLI Realty Co. and now owned by PRIME Property Fund, a core, open-ended, institutional real estate fund managed by Morgan Stanley, AMLI Residential has grown to be a prominent multifamily developer and owner.';
 const b=buildBrief({...base,evidence:evidence('AMLI manages residential apartments. '+quote)},'amli.com'),owner=b.context.find(x=>x.key==='ownership');
 assert.equal(owner.text,'Owned by PRIME Property Fund, managed by Morgan Stanley.');assert.equal(owner.quote,quote);assert.ok(b.sources.some(s=>s.id===owner.source_id&&s.excerpt.includes(owner.quote)));
});
test('marketing-only operating prose is omitted but concrete centralization remains',()=>{
 const b=buildBrief({...base,evidence:evidence('AMLI manages residential apartments. AMLI’s integrated approach leverages our development and management teams’ expertise and strong collaboration to provide innovative apartment homes that enhance residents’ lives. AMLI centralizes leasing support across its communities.')},'amli.com');
 assert.equal(b.context.find(x=>x.key==='operations').text,'AMLI centralizes leasing support across its communities.');assert.ok(!b.context.some(x=>x.text.includes('integrated approach')));
});
test('ownership compression does not turn past or negated ownership into current ownership',()=>{
 for(const quote of ['AMLI was previously owned by Example Fund.','AMLI is not owned by Example Fund.']){
  const b=buildBrief({...base,evidence:evidence('AMLI manages apartments. '+quote)},'amli.com');assert.ok(!b.context.some(x=>x.text==='Owned by Example Fund.'));
 }
});
test('account and contact briefs have consistent labels, compact facts and retained sources',()=>{
 const row=examples.find(r=>r.name==='Asia Connors'),lead=presentLead({...intake(row),...row}),markup=researchMarkup(lead,ui);
 assert.equal((markup.match(/aria-label="Contact brief"/g)||[]).length,1);
 assert.ok(markup.indexOf('contact-name')<markup.indexOf('Reported portfolio'));
 assert.match(markup,/class="account-contact"[^>]*><h3 class="detail-kicker">Contact brief<\/h3><strong class="contact-name">Asia Connors/);
 assert.match(markup,/contact-sources/);assert.match(markup,/<ul class="source-list">/);assert.doesNotMatch(markup,/class="source-cite"|<details class="research-details"/);assert.doesNotMatch(markup,/research-coverage|Example inquiry & buyer notes|contact-remit|contact-function|Supporting excerpt/);assert.doesNotMatch(markup,/id="view-draft"/);
 assert.ok(lead.professional_context.people.some(p=>p.role.includes('Director')));
 for(const row of examples){const html=researchMarkup(presentLead({...intake(row),...row}),ui);assert.match(html,/aria-label="Sources"/);if(row.property_address)assert.match(html,/aria-label="Around this property"/);if(row.professional_context?.people?.length)assert.match(html,/>Contact brief<\/h3>/);if(row.inquiry)assert.match(html,/>Inquiry and buyer notes<\/h3>/);assert.doesNotMatch(html,/research-coverage|Example inquiry & buyer notes|fact-number/);}
});
test('examples are marked snapshots and do not trigger research merely by opening',()=>{
 for(const row of examples){const lead=presentLead({...intake(row),...row});assert.equal(lead.sample_lead,true);if(lead.professional_context?.people?.length)assert.equal(lead.professional_context.snapshot,true);assert.equal(autoResearchPlan(lead),null);assert.equal(autoResearchDue(lead),false);assert.ok(lead.email.includes('@'));assert.ok((lead.professional_context?.people||[]).every(p=>p.url.startsWith('https://')&&p.retrieved_at));}
});
test('email review labels are distinct from unknown company fit',()=>{
 assert.equal(emailStatusLabel('Draft to review'),'Email · Review draft');assert.equal(emailStatusLabel('Recheck draft'),'Email · Recheck');assert.match(fitHeaderMarkup({research_brief:{}},ui),/Needs review/);
});

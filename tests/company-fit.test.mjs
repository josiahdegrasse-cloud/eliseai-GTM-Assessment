import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companyFit} from '../static/company-fit.js';
import {buildBrief} from '../website/brief.mjs';
import {researchMarkup,sourcePanelMarkup} from '../static/research.js';
const make=(text,patch={})=>{const lead={name:'Test Contact',company:'Acme Housing',website:'acmehousing.com',processed_at:'2026-09-30',evidence:[{text,title:'Acme Housing',url:'https://acmehousing.com/about',verified:true,date:'2026-09-30'}],...patch};return {...lead,research_brief:buildBrief(lead,'acmehousing.com')}};
for(const text of ['Acme Housing manages residential apartment communities.','Acme Housing owns rental housing across the United States.','Acme Housing operates student housing communities.','Acme Housing manages single-family rental homes.'])test('confirmed housing operations receive high company fit without size, person or property: '+text,()=>{
 const fit=companyFit(make(text));assert.equal(fit.label,'High fit');assert.equal(fit.rank,2);assert.ok(fit.evidence.every(e=>text.includes(e.quote)));
});
for(const text of ['Acme Housing provides software for apartment management and leasing.','Acme Housing advises clients on residential leasing.','Acme Housing provides cleaning services for apartment managers.','Acme Housing provides residential leasing brokerage services.'])test('service businesses stay separate from housing operators: '+text,()=>assert.equal(companyFit(make(text)).label,'Low fit'));
for(const text of ['Welcome to Acme Housing and our business.','Other Company manages residential apartments. Acme Housing serves clients.'])test('inconclusive or conflicting operations require review: '+text,()=>assert.equal(companyFit(make(text)).label,'Fit unclear'));
test('saved evidence stays labeled and contact or Census data cannot change company fit',()=>{
 const lead=make('Acme Housing manages residential apartment communities.');
 assert.equal(companyFit({...lead,company_snapshot:true}).saved,true);
 const other={...lead,professional_context:{status:'complete',people:[{role:'CEO'}]},property_context:{status:'matched'},lead_assessment:{score:100}};
 assert.deepEqual(companyFit(lead),companyFit(other));
 const unmatched={...lead,research_brief:{...lead.research_brief,sources:lead.research_brief.sources.map(s=>({...s,name_matched:false}))}};
 assert.equal(companyFit(unmatched).label,'Fit unclear');
});
test('fit explanation escapes source text and never resurrects legacy points',()=>{
 const lead=make('Acme Housing manages residential apartment communities.');lead.research_brief.classification.evidence[0].quote='<script>alert(1)</script>';lead.research_brief.sources[0].excerpt+='<script>alert(1)</script>';
 const ui={esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),icon:()=>'',date:String};
 const html=sourcePanelMarkup({...lead,lead_assessment:{range:'60–100',groups:[]}},ui,'score');
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|60–100|Unverified|possible points/);
});
test('compact property uses the pulled address and does not substitute a nearby panorama',()=>{
 const lead=make('Acme Housing manages residential apartment communities.',{property_address:'123 Main Street',city:'Raleigh',state:'NC',property_context:{status:'matched',coordinates:{x:-78.6382,y:35.7796}}});
 const ui={esc:String,icon:()=>'',date:String};
 const html=researchMarkup(lead,ui);assert.match(html,/Google Maps/);assert.match(html,/Confirm the building in Google Maps/);assert.match(html,/Explore Street View/);assert.doesNotMatch(html,/<iframe[^>]+map_action=pano|svembed/);assert.match(html,/<iframe/);assert.doesNotMatch(html,/property-aerial/);
 const noMatch=researchMarkup({...lead,property_context:{status:'unmatched'}},ui);assert.match(noMatch,/Google Maps/);assert.doesNotMatch(noMatch,/map_action=pano/);
});

test('header shows one priority label with its explanation and no separate fit badge',async()=>{
 const {fitHeaderMarkup,fitReasonMarkup}=await import('../static/research.js');
 const l=make('Acme Housing manages residential apartment communities.'),ui={esc:String};
 assert.match(fitHeaderMarkup(l,ui),/Medium priority/);assert.doesNotMatch(fitHeaderMarkup(l,ui)+fitReasonMarkup(l,ui),/High fit|Company fit/);assert.match(fitReasonMarkup(l,ui),/Housing operator/);assert.match(fitReasonMarkup(l,ui),/data-source="score"/);
 assert.match(fitHeaderMarkup({...l,research_brief:{}},ui),/Needs review/);
});
test('contact demo is explicitly fictional and never changes actual lead data or drafts',async()=>{
 const {contactDemoMarkup}=await import('../static/research.js');
 const l=make('Acme Housing manages residential apartment communities.',{draft:'Preserve my saved wording',reviewed:true});
 const before=JSON.stringify(l),ui={esc:String,icon:()=>''};
 const html=contactDemoMarkup(l,ui);
 for(const text of ['FICTIONAL EXAMPLE','Jordan Example','Example Residential','Eight apartment communities','Company fit','High fit','without repeating the contact’s job title','does not change the selected lead'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/https?:|id="save|id="refresh-draft|data-panel-source=/);
 assert.equal(JSON.stringify(l),before);
 assert.match(sourcePanelMarkup(l,{...ui,date:String},'contact-demo'),/id="close-sources"/);
});

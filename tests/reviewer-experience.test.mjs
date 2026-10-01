import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify} from '../website/domain.mjs';
import {discoveryRequest,discoveryURLs} from '../website/free-research.mjs';
import {readResearchStream} from '../static/research-stream.js';
import {researchMarkup} from '../static/research.js';
import {autoResearchPlan} from '../static/workflow.js';

const input={name:'Maya Test',email:'maya@example.invalid',company:'Acme Housing',website:'acmehousing.com'};
const make=(text,title='Acme Housing')=>qualify(intake(input),{engine:'reader-v2',evidence:[{text,title,url:'https://acmehousing.com/about',verified:true,date:new Date().toISOString()}],matched:true,message:'Synthetic test evidence',cache_fresh_until:new Date(Date.now()+86400000).toISOString()},{status:'incomplete'},[]);
for(const [label,text,kind,points] of [
 ['operator','Acme Housing manages residential apartments and oversees leasing at its communities.','housing_operator',40],
 ['advisor','Acme Housing helps apartment owners improve residential management and leasing across communities.','advisor',0],
 ['contractor','Acme Housing provides cleaning services for apartment managers and supports residential property management teams.','service_provider',0],
 ['broker','Acme Housing advises clients on buying apartment communities and provides residential leasing brokerage services.','broker',0],
 ['software','Acme Housing provides property management software for apartment owners.','software_vendor',0],
 ['unknown','Acme Housing is a business serving customers in the United States.','unclassified',0],
 ['negative','Acme Housing does not own, manage or operate residential apartment communities.','unclassified',0],
 ['mixed','Acme Housing manages residential communities. Acme Housing provides software for apartment owners.','housing_operator',40]
])test('classification: '+label+' has defensible fit and outreach',()=>{
 const lead=make(text);assert.equal(lead.research_brief.company_kind,kind);assert.equal(lead.priority.fit,points);
 assert.ok(lead.research_brief.classification.evidence.every(e=>text.includes(e.quote)));
 if(points===0){assert.notEqual(lead.fit.label,'Strong fit');assert.notEqual(lead.decision.opportunity.status,'suggested');assert.equal(lead.research_brief.portfolio,null)}
 assert.equal(lead.priority.readiness,0);
});
test('service customer portfolio numbers never become operator scale',()=>{
 const lead=make('Acme Housing helps apartment owners manage a portfolio of 50,000 apartment homes and residential leasing teams.');
 assert.equal(lead.priority.fit,0);assert.equal(lead.research_brief.portfolio,null);
});
test('another company mentioned on the accepted domain does not establish this company as an operator',()=>{
 const lead=make('Beta Holdings manages residential apartment communities. Acme Housing serves clients in the United States.');
 assert.equal(lead.priority.fit,0);assert.equal(lead.research_brief.company_kind,'unclassified');
});
test('search discovery keeps actual safe company URLs and discards synthesized facts',()=>{
 assert.throws(()=>discoveryRequest('Acme Housing','acmehousing.com','test-key'),/Paid discovery is disabled/);
 assert.deepEqual(discoveryURLs({code:200,data:[{url:'https://acmehousing.com/about',content:'Invented 9 million homes'},{url:'https://evil.test/claim'},{url:'http://acmehousing.com/about'},{url:'https://acmehousing.com@evil.test/'},{url:'https://acmehousing.com:9443/'},{url:'https://acmehousing.com/about'},{url:'https://investors.acmehousing.com/overview'}]},'acmehousing.com'),['https://acmehousing.com/about','https://investors.acmehousing.com/overview']);
 assert.throws(()=>discoveryRequest('Acme','127.0.0.1','test-key'));
});
test('stream delivers company data before context, including split UTF-8 chunks',async()=>{
 let controller;const raw=new ReadableStream({start(c){controller=c}}),seen=[];
 const lead={id:'one',company:'Mañana'},result=readResearchStream(new Response(raw,{headers:{'content-type':'application/x-ndjson'}}),'one',l=>seen.push(l));
 const bytes=new TextEncoder().encode(JSON.stringify({type:'company',lead})+'\n');
 for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(seen,[lead]);
 controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'complete',lead:{...lead,area_context:{status:'available'}}})+'\n'));controller.close();
 assert.equal((await result).area_context.status,'available');
});
test('stream rejects another contact and retains an early result on interruption',async()=>{
 const response=events=>new Response(events.map(x=>JSON.stringify(x)).join('\n'),{headers:{'content-type':'application/x-ndjson'}});
 await assert.rejects(readResearchStream(response([{type:'complete',lead:{id:'wrong'}}]),'right'),/Unexpected/);
 let early;await assert.rejects(readResearchStream(response([{type:'company',lead:{id:'one'}}]),'one',l=>early=l),/ended early/);assert.equal(early.id,'one');
 await assert.rejects(readResearchStream(response([{type:'error',error:'Queued',status:429,code:'provider_queue'}]),'one'),e=>e.status===429&&e.code==='provider_queue');
});
test('access failures offer an official page without suggesting a timer will restore access',()=>{
 const lead={...make('Acme Housing manages residential apartment communities.'),company_stale:true,company_retry_code:'site_blocked',company_retry_after:new Date(Date.now()+3600000).toISOString()};
 const ui={esc:String,icon:()=>'',date:String,nextAction:()=>''};const html=researchMarkup(lead,ui);
 assert.match(html,/Add official company page/);assert.match(html,/does not identify/);assert.doesNotMatch(html,/Next check available at|Next automatic attempt|Waiting until/);
 assert.equal(autoResearchPlan(lead),null);assert.equal(autoResearchPlan({...lead,company_retry_code:'source_unavailable'}),null);
});

test('company-page failure foregrounds submitted and independent facts without empty company fields',()=>{
 const lead={...make('Acme Housing manages residential apartment communities.'),company_stale:true,company_retry_code:'site_blocked',inquiry:'We need faster leasing replies.',property_address:'12 Main Street',city:'Raleigh',research_brief:{sources:[],signals:[]},company_locations:[],registry_context:{status:'name_match',legal_name:'Acme Housing LLC',headquarters:'Raleigh'},property_context:{status:'unavailable'},area_context:{status:'unavailable'}};
 const html=researchMarkup(lead,{esc:String,icon:()=>'',date:String,nextAction:()=>''});
 const visible=html.split('<section class="research-details"')[0];
 assert.match(html,/Legal entity candidate · Acme Housing LLC/);assert.match(visible,/12 Main Street/);assert.match(visible,/We need faster leasing replies/);
 assert.match(visible,/Research interrupted/);assert.doesNotMatch(visible,/Not recorded|No usable|Reported portfolio/);
 assert.match(html,/<section class="research-details" aria-label="Sources" tabindex="-1"><h3 class="detail-kicker">Sources/);
 assert.match(html,/id="record-context"/);assert.doesNotMatch(html,/id="view-draft"/);
});
test('a named residential REIT describing its own management establishes operator fit',()=>{
 const l=make('Acme Housing is a leading multifamily real estate investment trust (REIT) focused on developing, acquiring and managing apartment communities across 12 states.');
 assert.equal(l.research_brief.company_kind,'housing_operator');assert.ok(l.priority.fit>0);
});
for(const text of [
 'Other Company is a multifamily real estate investment trust focused on owning and managing apartments. Acme Housing provides its investor portal.',
 'Acme Housing is a software provider for a multifamily real estate investment trust focused on managing apartments.',
 'Acme Housing is a REIT advisor helping clients with managing apartments.',
 'Acme Housing is a commercial real estate investment trust focused on managing office buildings.'
])test('REIT mentions cannot assign customer, advisory or commercial operations: '+text,()=>{
 const l=make(text);assert.notEqual(l.research_brief.company_kind,'housing_operator');
});

test('contact updates can precede the company update and survive an interrupted stream',async()=>{
 const contact={id:'one',professional_context:{people:[{role:'COO'}]}};
 const events=[{type:'professional',lead:contact},{type:'company',lead:{...contact,company:'Acme'}}];
 const seen=[];
 const response=new Response(events.map(e=>JSON.stringify(e)).join('\n'),{headers:{'content-type':'application/x-ndjson'}});
 await assert.rejects(readResearchStream(response,'one',(lead,type)=>seen.push({lead,type})),/ended early/);
 assert.deepEqual(seen.map(e=>e.type),['professional','company']);
 assert.equal(seen[1].lead.professional_context.people[0].role,'COO');
});

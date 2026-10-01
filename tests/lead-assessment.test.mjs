import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessLead} from '../website/lead-assessment.mjs';
import {buildBrief} from '../website/brief.mjs';
import {scoreLead} from '../website/scoring.mjs';
import {contactFit,sortContacts} from '../static/workflow.js';
import {researchMarkup,sourcePanelMarkup} from '../static/research.js';
const time=Date.parse('2026-09-30T12:00:00Z'),date=new Date(time).toISOString();
const company='Acme Housing',overview='Acme Housing manages multifamily communities and leasing inquiries. We own and manage 10,000 apartment homes.';
const lead=(patch={})=>({id:'a',name:'Jordan Lee',company,website:'acmehousing.com',property_address:'123 Main St',city:'Raleigh',state:'NC',processed_at:date,evidence:[{verified:true,title:company,url:'https://acmehousing.com/about',text:overview,date}],...patch});
const person=(role='Director of Property Operations',patch={})=>({status:'complete',match:'name_company_match',checked_at:date,people:[{name:'Jordan Lee',company,role,quote:`Jordan Lee is the ${role} at Acme Housing.`,url:'https://acmehousing.com/leadership',retrieved_at:date}],...patch});
const compute=l=>{const b=buildBrief(l,'acmehousing.com');return assessLead(l,b,scoreLead(l,b,time),time)};
const propertyLead=text=>lead({evidence:[...lead().evidence,{verified:true,title:company,url:'https://acmehousing.com/properties/main',text,date}]});
test('every dimension is evaluated while absent contact and property evidence leaves a range',()=>{
 const a=compute(lead());assert.deepEqual(a.groups.map(g=>[g.key,g.max]),[['company',60],['contact',25],['property',15]]);
 assert.equal(a.total,7);assert.equal(a.assessed,3);assert.equal(a.earned,60);assert.equal(a.possible,100);assert.equal(a.range,'60–100');assert.equal(a.label,'Partial assessment');
 assert.ok(a.groups.slice(1).every(g=>g.criteria.every(c=>c.points===null)));
});
test('Census geography and affluent area statistics never imply property fit',()=>{
 const a=compute(lead({property_context:{status:'matched',address:'123 MAIN ST',county:'Wake County'},area_context:{median_gross_rent:99999,renter_share:95}}));
 assert.equal(a.groups[2].assessed,0);assert.equal(a.geography.status,'matched');assert.equal(a.earned,60);
});
test('current matched public role adds contact relevance, not buying authority',()=>{
 const a=compute(lead({professional_context:person()}));assert.equal(a.groups[1].earned,25);assert.equal(a.range,'85–100');assert.match(a.groups[1].criteria[1].reason,/does not establish decision authority/);
});
test('historical, conflicting, stale, future, sample and mismatched contact evidence stays unresolved',()=>{
 const base=person();
 for(const p of [person('',{match:'review'}),person('',{stale:true}),person('',{checked_at:'2020-01-01'}),person('',{checked_at:'2099-01-01'}),{...base,people:[{...base.people[0],historical:true}]},{...base,people:[{...base.people[0],name:'Other Person'}]},{...base,people:[{...base.people[0],company:'Other Company'}]},{...base,people:[{...base.people[0],retrieved_at:'2099-01-01'}]}])assert.equal(compute(lead({professional_context:p})).groups[1].assessed,0);
 assert.equal(compute(lead({name:'Jordan Lee TEST',professional_context:person()})).groups[1].assessed,0);
});
test('an unknown function is distinct from an explicitly outside-model role',()=>{
 const generic=compute(lead({professional_context:person('Senior Director')}));assert.equal(generic.groups[1].earned,10);assert.equal(generic.groups[1].possible,25);
 const hr=compute(lead({professional_context:person('Vice President of Human Resources')}));assert.equal(hr.groups[1].earned,10);assert.equal(hr.groups[1].complete,true);
});
test('exact-address company operating evidence supports both property criteria with sources',()=>{
 const a=compute({...propertyLead('Acme Housing manages a multifamily community at 123 Main Street in Raleigh.'),professional_context:person()});
 assert.equal(a.groups[2].earned,15);assert.equal(a.range,'100');assert.equal(a.complete,true);
 for(const c of a.groups[2].criteria){assert.ok(c.sources[0].quote.includes('123 Main Street'));assert.equal(c.sources[0].url,'https://acmehousing.com/properties/main')}
});
test('housing at the address does not by itself establish company management',()=>{
 const a=compute(propertyLead('A residential building is located at 123 Main Street in Raleigh.'));
 assert.equal(a.groups[2].criteria[0].points,10);assert.equal(a.groups[2].criteria[1].points,null);
});
test('different buildings, cities, office addresses and former properties cannot earn property fit',()=>{
 for(const text of ['Acme Housing manages a commercial building at 123 Main Street in Raleigh near a multifamily community.','Acme Housing manages a multifamily community at 124 Main Street in Raleigh.','Acme Housing manages a multifamily community at 123 Main Street in Charlotte.','Acme Housing manages multifamily communities from its office at 123 Main Street in Raleigh.','Acme Housing previously managed a multifamily community at 123 Main Street in Raleigh.','Acme Housing no longer manages a multifamily community at 123 Main Street in Raleigh.','Acme Housing manages a multifamily community at 123 Main Street in Raleigh and another at 456 Oak Street.'])assert.equal(compute(propertyLead(text)).groups[2].assessed,0,text);
 for(const patch of [{company_snapshot:true},{company_stale:true}])assert.equal(compute({...propertyLead('Acme Housing manages a multifamily community at 123 Main Street in Raleigh.'),...patch}).groups[2].assessed,0);
});
test('company fit ignores contact and property completeness in sorting and display',()=>{
 const raw=lead(),brief=buildBrief(raw,'acmehousing.com'),a={...raw,name:'Alpha',research_brief:brief,lead_assessment:compute(raw)},b={...raw,id:'b',name:'Beta',research_brief:brief,lead_assessment:compute(lead({professional_context:person()}))},u={id:'u',name:'Unknown'};
 assert.deepEqual(sortContacts([u,b,a],'fit-desc').map(l=>l.id),['a','b','u']);
 assert.deepEqual(sortContacts([u,b,a],'fit-asc').map(l=>l.id),['a','b','u']);
 assert.equal(contactFit(a).label,'High fit');assert.equal(contactFit(a).score,contactFit(b).score);
});
test('company fit explanation uses actual quotes without the unresolved point checklist',()=>{
 const l=lead(),b=buildBrief(l,'acmehousing.com'),p=scoreLead(l,b,time);Object.assign(l,{research_brief:b,priority:p,lead_assessment:assessLead(l,b,p,time)});
 const esc=v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),ui={esc,date:v=>v,icon:()=>'',nextAction:()=>''};
 const html=researchMarkup(l,ui)+sourcePanelMarkup(l,ui,'score');
 assert.match(html,/PRIORITY RUBRIC/);assert.match(html,/View source/);assert.match(html,/manages multifamily communities/);
 assert.doesNotMatch(html,/60–100|possible points|Unverified|Current company affiliation|Role relevance|ASK NEXT|NEXT ACTION|BUYING READINESS/);
});

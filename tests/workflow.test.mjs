import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesLead} from '../static/workflow.js';
import {intake,qualify,presentLead} from '../website/domain.mjs';
const base={name:'TEST José Morgan',email:'qa@example.invalid',company:'Acme Housing',website:'acmehousing.com',property_address:'12 Oak Street',city:'Raleigh',state:'NC',country:'US'};
const evidence=(text,verified=true)=>({url:'https://acmehousing.com/about',title:'Acme Housing',text,verified,date:'2026-09-29'});
const researched=(text,overrides={},verified=true)=>qualify(intake({...base,...overrides}),{evidence:text?[evidence(text,verified)]:[],matched:verified,message:'Research returned.',cached:true},{status:'matched'},[]);

test('search normalizes accents, whitespace, word order and all address fields',()=>{
 for(const query of ['  ACME   ','Morgan Jose','Raleigh acme','Street 12','NC Oak','qa@example.invalid','acmehousing.com'])assert.ok(matchesLead(base,query),query);
 assert.ok(matchesLead({...base,company:'Greystar'},'Greyster'));assert.ok(!matchesLead(base,'Camden'));
});
test('small misspellings cannot ignore an unrelated search term',()=>{assert.ok(!matchesLead({...base,company:'Greystar'},'Greyster Miami'));assert.ok(matchesLead(base,''))});

const scenarios=[
 ['regional operator','Acme Housing manages multifamily communities. We currently own and manage over 25,000 apartment homes in eight U.S. markets.','Strong fit'],
 ['global operator','Acme Housing manages residential communities. With more than 1.1 million multifamily units and student beds under management globally, we operate rental housing.','Strong fit'],
 ['dated portfolio','Acme Housing manages multifamily communities. As of July 31, 2026, Acme Housing owned and operated 167 properties containing 56,695 apartment homes across the United States.','Strong fit'],
 ['small operator','Acme Housing owns and manages 12 residential apartments in Raleigh.','Possible fit'],
 ['commercial operator','Acme Housing owns and manages commercial office properties in Raleigh.','Fit not established'],
 ['software vendor','Acme Housing provides software for multifamily property management and leasing across communities.','Fit not established'],
 ['negated residential operations','Acme Housing does not manage multifamily communities or offer leasing services.','Fit not established'],
 ['ambiguous identity','Another Housing manages multifamily communities and leasing inquiries.','Check company',{},false],
 ['personal email without website','', 'Check company',{email:'test@gmail.com',website:''}],
 ['conflicting totals','Acme Housing manages multifamily communities. We currently own and manage 500 apartment homes. We currently own and manage 800 apartment homes.','Strong fit']
];
for(const [name,text,expected,overrides,matched] of scenarios)test('mixed-lead evaluation: '+name,()=>{
 const lead=researched(text,overrides,matched);assert.equal(lead.fit.label,expected);assert.equal(lead.score,null);assert.equal(lead.priority.readiness,0);assert.ok(lead.score===null||lead.score<=50);assert.equal(lead.qualification.recorded,0);
 if(!text)assert.equal(lead.research_state,'needs_website');
 if(matched===false)assert.equal(lead.research_state,'needs_confirmation');
 if(expected==='Fit not established'||expected==='Check company'){assert.equal(lead.draft_basis.length,0);assert.ok(!lead.draft.includes('Your website reports'));}
 if(name==='conflicting totals'){assert.ok(lead.research_brief.portfolio.alternatives.length);assert.doesNotMatch(lead.draft,/500|800/);}
});
test('company scope shapes discovery questions without restating portfolio statistics',()=>{
 const leads=scenarios.slice(0,3).map(([,text])=>researched(text,{inquiry:'Please send information.'}));
 assert.ok(leads.every(l=>/^Would a quick walkthrough/.test(l.question)));
 assert.equal(new Set(leads.map(l=>l.draft)).size,3);
 for(const lead of leads){assert.equal(lead.draft_basis.length,1);assert.ok(['company_observation','workflow_context'].includes(lead.draft_basis[0].usage));assert.ok(lead.draft_basis[0].source.excerpt.includes(lead.draft_basis[0].quote));assert.doesNotMatch(lead.draft,/Your company overview describes residential property operations/);}
 for(const lead of leads)assert.doesNotMatch(lead.draft,/25,000|1.1 million|student beds|56,695|July 31|Your company reports/);
});
test('legacy pending timestamps cannot restore a score or researched UI',()=>{
 const l=presentLead({...researched(scenarios[0][1]),research_state:'pending'});assert.equal(l.processed_at,null);assert.equal(l.fit.label,'Not researched');assert.equal(l.research_brief.sources.length,0);assert.equal(l.status,'Recheck draft');
});
test('commercial and missing research use a useful neutral reply',()=>{
 const l=researched(scenarios[4][1]);assert.match(l.draft,/Does your team manage residential housing operations/i);assert.doesNotMatch(l.draft,/Thanks for|your inquiry/i);assert.ok(!l.draft.includes('Your website describes residential'));
});
test('changed evidence removes reviewed status without replacing reviewed wording',()=>{
 const prior=researched(scenarios[0][1]);prior.reviewed=true;prior.draft='Approved text';
 const changed=qualify(prior,{evidence:[evidence(scenarios[1][1])],matched:true,message:'Updated research.'},{status:'matched'},[]);
 assert.equal(changed.draft,'Approved text');assert.equal(changed.draft_stale,true);assert.equal(changed.reviewed,false);assert.equal(changed.draft_edited,true);
 const repeat=qualify(changed,{evidence:[evidence(scenarios[1][1])],matched:true,message:'Cached research.'},{status:'matched'},[]);
 assert.equal(repeat.draft,'Approved text');assert.equal(repeat.reviewed,false);
});

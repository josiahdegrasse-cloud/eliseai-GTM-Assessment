import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildBrief} from '../website/brief.mjs';
import {classifyCompany} from '../website/company-classification.mjs';
import {freePersonCandidates,personLinks} from '../website/person-discovery.mjs';
import {professionalEvidence,professionalKey} from '../website/professional-evidence.mjs';
import {qualify,intake,presentLead} from '../website/domain.mjs';
const company='Acme Housing',lead={name:'Jordan Lee',email:'jordan@example.invalid',company,website:'acmehousing.com'},url='https://acmehousing.com/team/jordan-lee';
const classify=text=>classifyCompany([{id:'S1',name_matched:true,title:company,excerpt:text}],company);
for(const text of ["Denver’s trusted Multifamily Owner & Operator.","Denver's Multifamily Owner, Developer & Manager","We’re not just a regional developer & manager of luxury apartments--we’re a creative team."])test('self-described housing operations include headings and contractions: '+text,()=>assert.equal(classify(text).kind,'housing_operator'));
for(const text of ['We provide software for multifamily owners and operators.','Our clients are multifamily owners and managers.','Other Company manages residential apartments. Acme Housing offers services.'])test('broader operator wording still rejects customer and other-company operations: '+text,()=>assert.notEqual(classify(text).kind,'housing_operator'));
test('working with brokers does not make a shopping-center owner a brokerage',()=>{
 assert.equal(classify('By investing exclusively in Neighborhood Shopping Centers, Acme Housing has become experts in the field. Our in-house leasing team works with local and regional brokers.').kind,'commercial_operator');
 assert.equal(classify('Acme Housing manages commercial office properties.').kind,'commercial_operator');
 assert.equal(classify('Acme Housing provides residential leasing brokerage services.').kind,'broker');
});
test('brief rejects philanthropy, old office history and a mislabeled development pipeline',()=>{
 const text='Acme Housing manages residential apartments. Acme Housing has an ongoing development pipeline of more than $2 billion in properties across the nation. Acme Housing gives employees opportunities to give back through our social impact program. Acme Housing moved its central office in 2019 before COVID lockdowns. Acme Housing uses Yardi for its property operations.';
 const b=buildBrief({...lead,evidence:[{verified:true,url,title:company,text}]},lead.website);
 assert.equal(b.classification.kind,'housing_operator');assert.ok(b.context.some(c=>c.key==='technology'));assert.ok(!b.context.some(c=>['markets','team','operations'].includes(c.key)));
});
const evidence=(page,l=lead)=>{const c=freePersonCandidates(l,page);return {...professionalEvidence(l,{status:'completed',output:{structured:c,grounding:[{citations:[{url:page.url}]}]}},[page]),version:9,cost_dollars:0}};
test('a name-led biography preserves adjacent responsibility sentences with attribution',()=>{
 const page={url,title:company,text:'Jordan Lee\nDirector of Operations\n\nJordan Lee brings 20 years of experience to Acme Housing. She oversees leasing and resident operations across eight communities. She enjoys time with her children.'};
 const p=evidence(page);assert.ok(p.insights.some(i=>i.quote.includes('eight communities')));assert.ok(!p.insights.some(i=>i.quote.includes('children')));
 assert.ok(p.insights.every(i=>page.text.replace(/\s+/g,' ').includes(i.quote.replace(/\s+/g,' '))));
});
test('responsibility prose on a uniquely named biography retains name-title context',()=>{
 const p=evidence({url,title:company,text:'Jordan Lee\n\nDirector of Operations\n\nJordan oversees leasing operations across eight communities.'});assert.equal(p.insights[0].kind,'responsibility');
 const other=evidence({url:'https://acmehousing.com/team/alex-smith',title:company,text:'Jordan Lee\n\nDirector of Operations\n\nJordan oversees leasing operations across eight communities.'});assert.equal(other.insights.length,0);
});
test('company overview links outrank unrelated resource articles about teams',()=>{
 const links=personLinks(lead,{url,links:[{url:'https://acmehousing.com/resources/capital-insights/who-should-be-on-team/',text:'Who should be on your team?'},{url:'https://acmehousing.com/company/who-we-are/',text:'Who we are'}]});assert.equal(links[0].url,'https://acmehousing.com/company/who-we-are/');assert.equal(links.length,1);
});
function enriched(role){
 const p=evidence({url,title:company,text:`Jordan Lee\n${role}\n\nJordan Lee oversees leasing operations at Acme Housing.`});
 return qualify({...intake({...lead,inquiry:'Interested in leasing inquiries.'}),professional_context:p},{evidence:[{verified:true,url:'https://acmehousing.com/about',title:company,text:'Acme Housing manages residential apartment communities.'}]},{},[]);
}
test('verified roles personalize drafts without awarding readiness or changing company fit',()=>{
 const regional=enriched('Regional Property Manager'),operations=enriched('Director of Operations');
 assert.doesNotMatch(regional.draft,/Regional Property Manager|website lists you/);assert.doesNotMatch(operations.draft,/Director of Operations/);assert.match(regional.question,/property teams/);assert.match(operations.question,/across properties/);assert.notEqual(regional.draft,operations.draft);
 assert.equal(regional.priority.readiness,0);assert.equal(regional.company_fit.label,'High fit');assert.ok(regional.draft_basis.some(b=>b.usage==='professional_role'&&b.source.url===url));
 for(const patch of [{stale:true},{match:'review'},{checked_at:'2020-01-01'},{input_key:'wrong-person'}]){
  const changed=presentLead({...regional,professional_context:{...regional.professional_context,...patch}});assert.doesNotMatch(changed.draft,/website lists you/);
 }
});
test('new contact evidence updates untouched drafts and flags saved wording without overwriting it',()=>{
 const l=enriched('Director of Operations'),p=enriched('Regional Property Manager').professional_context;
 const untouched=presentLead({...l,professional_context:p});assert.doesNotMatch(untouched.draft,/Regional Property Manager/);assert.match(untouched.question,/property teams/);assert.equal(untouched.draft_stale,false);
 const edited=presentLead({...l,draft:'My saved email',draft_edited:true,reviewed:true,professional_context:p});assert.equal(edited.draft,'My saved email');assert.equal(edited.draft_stale,true);assert.equal(edited.reviewed,false);
});
test('first-name passages require a named biography and a matching role on that same page',()=>{
 const page={url,title:company,text:'Jordan Lee\nDirector of Operations\n\nJordan leads leasing and resident services across eight communities.'};
 const p=evidence(page);assert.equal(p.insights.length,1);assert.equal(p.insights[0].quote,'Jordan leads leasing and resident services across eight communities.');
 for(const change of [{url:'https://acmehousing.com/team/alex-smith'},{text:'Alex Smith\nDirector of Operations\n\nJordan leads leasing across eight communities.'}])assert.equal(evidence({...page,...change}).insights.length,0);
});
test('duplicate directory and biography roles collapse while distinct roles still require review',()=>{
 const page={url,title:company,text:'Jordan Lee\nChief Operating Officer\n\nJordan Lee is Chief Operating Officer at Acme Housing. Jordan leads leasing operations.'};
 const p=evidence(page);assert.equal(p.people.length,1);assert.equal(p.match,'name_company_match');assert.ok(p.insights.length);
});

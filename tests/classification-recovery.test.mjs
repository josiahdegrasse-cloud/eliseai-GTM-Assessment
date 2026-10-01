import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyCompany} from '../website/company-classification.mjs';
import {verifyCompanyIdentity} from '../website/company-identity.mjs';
import {buildBrief} from '../website/brief.mjs';
import {intake,qualify} from '../website/domain.mjs';
const cases=JSON.parse(readFileSync('test-data/quality-holdout-inputs.json')).cases;
const rows=JSON.parse(readFileSync('test-data/quality-holdout-results.json')).results;
const recovery=new Set(['Q02','Q04','Q07','Q09']);
for(const row of rows.slice(0,16))test('captured company regression '+row.id+' '+row.company,()=>{
 const input=cases.find(c=>c.id===row.id).input;
 const evidence=row.sources.map(s=>({url:s.url,title:s.title,text:s.excerpt,date:s.retrieved_at,verified:s.name_matched,identity:s.identity}));
 const lead=qualify(intake(input),{evidence,matched:true},{},[]);
 const expected=recovery.has(row.id)?'housing_operator':row.actual==='housing_operator'?'housing_operator':row.actual==='non_operator'?null:'unclassified';
 if(expected)assert.equal(lead.research_brief.classification.kind,expected);
 else assert.equal(lead.lead_fit.rank,0);
 if(recovery.has(row.id)){
  assert.equal(lead.lead_fit.label,'High fit');
  for(const fact of lead.research_brief.classification.evidence)assert.ok(lead.research_brief.sources.find(s=>s.id===fact.source_id).excerpt.replace(/\s+/g,' ').includes(fact.quote));
 }
});
const classify=text=>classifyCompany([{id:'S1',name_matched:true,title:'Acme Housing',excerpt:text}],'Acme Housing');
for(const text of [
 'Acme Housing is a real estate investment and property management company focused on multifamily and hospitality properties.',
 'Acme Housing is one of the largest managers of affordable housing in the country.',
 'We are a national multifamily operator pursuing asset value creation.',
 'Our business has been providing multifamily and commercial property management services for more than 20 years.'
])test('recognizes explicit operating wording: '+text,()=>assert.equal(classify(text).kind,'housing_operator'));
for(const text of [
 'Other Firm is a residential operator serving apartment owners.',
 'Other Firm is one of the largest managers of affordable housing.',
 'Our customers are national multifamily operators.',
 'Acme Housing is a software company for multifamily property managers.',
 'Acme Housing is an advisor to one of the largest managers of affordable housing.',
 'We are not a national multifamily operator.',
 'Acme Housing is not a property management company for residential apartments.',
 'Our business provides cleaning services for multifamily property management companies.',
 'Acme Housing invests in funds whose clients manage multifamily housing.'
])test('does not promote customer, denied or vendor operations: '+text,()=>assert.notEqual(classify(text).kind,'housing_operator'));
test('encoded footer identifies the full copyright owner without accepting a mere mention',()=>{
 const base={company:'Acme Housing',companyDomain:'liveacme.com',url:'https://liveacme.com/',title:'Welcome',text:'&copy; 2026 Acme Housing, LLC.'};
 assert.equal(verifyCompanyIdentity(base).status,'confirmed');
 for(const text of ['Our customer is Acme Housing.','&copy; 2026 Other Firm LLC. Acme Housing is a client.','&copy; 2026 Acme Housing Services LLC.'])assert.notEqual(verifyCompanyIdentity({...base,text}).status,'confirmed');
 assert.notEqual(verifyCompanyIdentity({...base,url:'https://liveacme.com/customer-stories/acme'}).status,'confirmed');
});
test('appended navigation title cannot authorize arbitrary partial brand names',()=>{
 const base={company:'Acme Housing',companyDomain:'liveacme.com',url:'https://liveacme.com/',text:'Public company information.'};
 assert.equal(verifyCompanyIdentity({...base,title:'Acme HousingGo to our LinkedIn profile'}).status,'confirmed');
 assert.notEqual(verifyCompanyIdentity({...base,title:'Acme HousingServices'}).status,'confirmed');
});

test('explicit housing REIT, residential business title and inline we manage are recognized',()=>{
 assert.equal(classify('Acme Housing is a leading multifamily REIT with a portfolio across the country.').kind,'housing_operator');
 assert.equal(classify('From single-family homes and condos to multi-unit rental properties, we manage every aspect of the rental process.').kind,'housing_operator');
 const sources=[{id:'S1',name_matched:true,title:'Acme Housing | Multifamily Property Management',excerpt:'Proudly managing 250 communities nationwide.'}];
 assert.equal(classifyCompany(sources,'Acme Housing').kind,'housing_operator');
 for(const title of ['Acme Housing | Multifamily Property Management Software','Acme Housing | How to choose Multifamily Property Management','Other Firm | Multifamily Property Management'])assert.notEqual(classifyCompany([{...sources[0],title}],'Acme Housing').kind,'housing_operator');
 for(const text of ['Our clients are leading multifamily REITs.','Other Firm is a leading multifamily REIT.','Acme Housing is software for leading multifamily REITs.','We do not manage single-family homes and condos.'])assert.notEqual(classify(text).kind,'housing_operator');
});
test('official self descriptions accept appositions and alphanumeric brands, not customer references',()=>{
 assert.equal(classify('Acme Housing, one of the nation’s leading multifamily property management companies, has announced a new executive.').kind,'housing_operator');
 const make=text=>classifyCompany([{id:'S1',name_matched:true,title:'Avenue5 Residential',excerpt:text}],'Avenue5 Residential');
 assert.equal(make('Avenue5 provides professional property management services for over 800 multifamily properties.').kind,'housing_operator');
 for(const text of ['Other Firm provides professional property management services for multifamily properties.','Avenue5 provides software for multifamily property management services.','Our customer Avenue5 provides professional property management services for multifamily properties.'])assert.notEqual(make(text).kind,'housing_operator');
});
test('a product described as ideal for property managers does not inherit their operating model',()=>{
 for(const text of ['Acme Housing is ideal for any landlord or property manager who manages residential or commercial properties.','Acme Housing is designed for multifamily property managers.','We built a platform for managers of residential communities.'])assert.notEqual(classify(text).kind,'housing_operator');
 assert.equal(classify('Acme Housing is a residential property manager serving local landlords.').kind,'housing_operator');
});

test('explicit home-rental operations and named management services survive introductory clauses',()=>{
 for(const text of ['We manage homes for rent in Tacoma and surrounding communities.','With 20 years of experience, Acme Housing provides full-service Property Management for single-family homes.'])assert.equal(classify(text).kind,'housing_operator');
 for(const text of ['Acme Housing provides software for companies offering property management for single-family homes.','Our customer Other Housing provides full-service Property Management for single-family homes.','Acme Housing does not provide property management for single-family homes.'])assert.notEqual(classify(text).kind,'housing_operator');
});

test('an owner reporting portal does not establish a software vendor',()=>{
 const paragraph='Acme Housing currently manages over 1000 properties with a full-time property management staff Owners have access to proprietary web based software to track their cash flow';
 assert.equal(classify(paragraph).kind,'unclassified');
 assert.equal(classify('We manage residential apartments. Owners have access to proprietary software to track their cash flow.').kind,'housing_operator');
 assert.equal(classify('Acme Housing is a software provider. Owners have access to software to view cash flow.').kind,'software_vendor');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intake,companyEvidence,qualify,presentLead} from '../website/domain.mjs';
const snapshots=JSON.parse(readFileSync(new URL('../test-data/public-research-snapshots.json',import.meta.url)));
const lead=(company='Example Operator',website='exampleoperator.com')=>intake({name:'TEST Contact',email:'qa@example.invalid',company,website,city:'Seattle',state:'WA',country:'US',property_address:'12 Test Street'});
const result=(l,text,url='https://exampleoperator.com/about')=>companyEvidence(l,{results:[{title:l.company,url,highlights:[text]}]});
const assess=(l,c)=>qualify(l,c,{status:'matched'},[]);

test('E01 | Greystar captured excerpt retains mixed unit types and global scope',()=>{
 const out=assess(lead('Greystar','greystar.com'),snapshots['exa:greystar.com|greystar']);
 assert.equal(out.research_brief.portfolio.value,'more than 1.1 million multifamily units and student beds');
 assert.equal(out.research_brief.portfolio.scope,'Global company portfolio');assert.equal(out.fit.label,'Possible fit');
 assert.ok(out.draft_basis.every(f=>out.evidence.some(e=>e.text.includes(f.quote))));
});
test('E02 | AMLI captured excerpt preserves its qualifier and markets',()=>{
 const out=assess(lead('AMLI','amli.com'),snapshots['exa:amli.com|amli']);
 assert.equal(out.research_brief.portfolio.value,'over 25,000 apartment homes');assert.equal(out.research_brief.footprint.value,'eight U.S. markets');
 assert.equal(out.fit.label,'Possible fit');assert.doesNotMatch(out.draft,/25,000|eight U.S. markets/);assert.ok(out.draft_basis.length);
});
test('E03 | Camden scale remains in research without being recited in the email',()=>{
 const out=assess(lead('Camden Property Trust','camdenliving.com'),snapshots['exa:camdenliving.com|camden property trust']);
 assert.equal(out.fit.label,'Strong fit');assert.equal(out.research_brief.portfolio.value,'56,995 apartment homes');assert.equal(out.research_brief.portfolio.as_of,'August 31, 2026');assert.doesNotMatch(out.draft,/56,995|August 31|Your company reports/);assert.ok(out.draft_basis.length);
});
test('a contact-only company excerpt still cannot establish operations or fit',()=>{
 const l=lead(),out=assess(l,result(l,'Contact Example Operator for more information about our company.'));
 assert.equal(out.fit.label,'Fit not established');assert.equal(out.research_brief.portfolio,null);assert.equal(out.draft_basis.length,0);
});
test('E04 | Commercial-only operator receives no residential fit or leasing pitch',()=>{
 const l=lead(),out=assess(l,result(l,'Example Operator owns and manages commercial office buildings in New York.'));
 assert.equal(out.fit.label,'Fit not established');assert.equal(out.draft_basis.length,0);assert.ok(!out.draft.includes('tour scheduling'));
});
test('E05 | A software vendor serving apartments is not an apartment operator',()=>{
 const l=lead(),out=assess(l,result(l,'Example Operator provides software for apartment management, leasing and communities.'));
 assert.equal(out.fit.label,'Fit not established');assert.equal(out.draft_basis.length,0);
});
test('E06 | A similar company on a different domain contributes no claims',()=>{
 const l=lead(),out=assess(l,result(l,'Example Operator manages residential communities and leasing.','https://unrelated-company.com/about'));
 assert.equal(out.fit.label,'Check company');assert.equal(out.evidence.length,0);assert.equal(out.draft_basis.length,0);
});
test('E07 | A personal email without a website asks for identity, not a guess',()=>{
 const l=presentLead({...lead(),email:'qa@gmail.com',website:''});
 assert.equal(l.research_state,'needs_website');assert.equal(l.fit.label,'Not researched');assert.equal(l.research_brief.sources.length,0);
});
test('E08 | Positive residential and leasing evidence earns explainable Strong fit',()=>{
 const l=lead(),out=assess(l,result(l,'Example Operator manages residential communities and leasing inquiries.'));
 assert.equal(out.fit.label,'Strong fit');assert.ok(out.research_brief.signals.every(s=>s.supported&&s.source_ids.length));
 assert.match(out.fit.reason,/residential operations/);
});
test('E09 | An enriched intro retains the qualifier on a reported market count',()=>{
 const l=lead(),out=assess(l,result(l,'Example Operator manages multifamily communities in approximately 20 U.S. markets.'));
 assert.equal(out.research_brief.footprint.value,'approximately 20 U.S. markets');assert.match(out.draft,/approximately 20 U.S. markets/);assert.equal(out.draft_basis[0].usage,'company_observation');
});
test('E10 | Changed research preserves a reviewed email and requests re-review',()=>{
 const l=lead(),first=assess(l,result(l,'Example Operator owns and manages 200 apartment homes.'));
 const out=assess({...first,draft:'My reviewed wording',reviewed:true},result(l,'Example Operator owns and manages 400 apartment homes.'));
 assert.equal(out.draft,'My reviewed wording');assert.equal(out.reviewed,false);assert.equal(out.draft_stale,true);
});

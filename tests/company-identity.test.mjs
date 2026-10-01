import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCompanyIdentity} from '../website/company-identity.mjs';
import {intake,companyEvidence,qualify,presentLead,domain} from '../website/domain.mjs';
const corpus=JSON.parse(readFileSync(new URL('../test-data/identity-benchmark.json',import.meta.url)));
for(const c of corpus.cases)test(c.id+' identity: '+c.category,()=>{
 const l=intake(c.lead),identity=verifyCompanyIdentity({...c.source,company:l.company,companyDomain:domain(l)});
 assert.equal(identity.status,c.expected_identity);
 const result=qualify(l,companyEvidence(l,{results:[{...c.source,highlights:[c.source.text]}]}),{status:'incomplete'},[]);
 if(c.expected_identity!=='confirmed'){assert.equal(result.priority.fit_assessment.points,null);assert.equal(result.draft_basis.length,0)}
});
test('cached verification is rechecked and reviewed wording is preserved when identity fails',()=>{
 const l=intake({name:'TEST Person',email:'test@example.invalid',company:'Acme Housing',website:'acmehousing.com'});
 const prior=qualify(l,{evidence:[{url:'https://acmehousing.com/about',title:'Acme Housing',text:'Acme Housing manages residential apartments and leasing inquiries.',verified:true}],matched:true},{status:'incomplete'},[]);
 const result=presentLead({...prior,reviewed:true,draft:'My approved wording',evidence:[{url:'https://acmehousing.com/case-studies/customer',title:'Acme Housing customer story',text:'Acme Housing manages residential apartments and leasing inquiries.',verified:true}]});
 assert.equal(result.company_identity.status,'needs_confirmation');assert.equal(result.priority.fit_assessment.points,null);assert.equal(result.draft,'My approved wording');assert.equal(result.draft_stale,true);
});
test('accents, legal suffixes and short brands match without allowing substring matches',()=>{
 for(const [company,title] of [['Élan Housing','Elan Housing LLC'],['JLL','JLL | About'],['A & B Housing','A and B Housing']])assert.equal(verifyCompanyIdentity({company,title,text:'Corporate overview and contact information.',url:'https://companysite.com/about',companyDomain:'companysite.com'}).status,'confirmed');
 assert.equal(verifyCompanyIdentity({company:'MAA',title:'Maastricht Housing',text:'A regional company with apartment operations.',url:'https://companysite.com/about',companyDomain:'companysite.com'}).status,'needs_confirmation');
});

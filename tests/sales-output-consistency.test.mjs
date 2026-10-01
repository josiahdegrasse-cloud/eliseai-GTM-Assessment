import {test} from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import {intake,qualify} from '../website/domain.mjs';
import {companyFit,leadPriority} from '../static/company-fit.js';
import {fitHeaderMarkup,fitReasonMarkup,sourcePanelMarkup} from '../static/research.js';
import {leadsCSV} from '../static/export.js';
import {sortContacts} from '../static/workflow.js';
const ui={esc:String,icon:()=>'',date:String};
const make=text=>qualify(intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'We need help with after-hours leasing inquiries.'}),{evidence:text?[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',text,date:new Date().toISOString()}]:[],message:'Test fixture.'},{status:'incomplete'},[]);
const cases=[
 ['large operator','Acme Housing manages residential communities and leasing inquiries. We own and manage 5,000 apartment homes.',80,'High fit'],
 ['small operator','Acme Housing manages residential communities and leasing inquiries. We own and manage 100 apartment homes.',55,'High fit'],
 ['unrelated business','Acme Housing provides software for apartment management and leasing.',0,'Low fit'],
 ['missing research','',null,'Fit unclear']
];
for(const [name,text,score,label] of cases)test(name+': UI, API, CSV and draft agree on evidence',()=>{
 const l=make(text),fit=companyFit(l),row=Papa.parse(leadsCSV([l]),{header:true}).data[0];
 assert.equal(fit.score,null);assert.equal(fit.label,label);assert.deepEqual(l.company_fit,fit);
 assert.equal(row.company_fit_points,'');assert.equal(row.company_fit,label);assert.equal(row.lead_fit_upper,fit.upper===null?'':String(fit.upper));assert.equal(row.evidence_coverage_pct,'');assert.equal(row.company_fit_max,'');assert.equal(row.scoring_model,fit.model);
 assert.ok(fitHeaderMarkup(l,ui).includes(leadPriority(l).label));
 assert.ok(l.draft.split(/\s+/).length<=120);assert.equal((l.draft.match(/\?/g)||[]).length,1);
 if(score===null||score===0)assert.doesNotMatch(l.draft,/Your company overview describes|EliseAI can/);
 else {assert.match(l.draft,/outside office hours/);assert.ok(l.draft_basis.some(b=>b.source?.excerpt.includes(b.quote)));}
});
test('missing optional evidence stays explicit and cannot be filled by a forged saved score',()=>{
 const l=make('Acme Housing owns residential housing.');l.priority={total:100,fit_assessment:{points:50}};
 const fit=companyFit(l);assert.equal(fit.score,null);assert.equal(fit.label,'High fit');
 assert.doesNotMatch(fitReasonMarkup(l,ui),/unresolved points|evidence coverage/);assert.match(sourcePanelMarkup(l,ui,'score'),/Missing context does not lower the tier/);
 const row=Papa.parse(leadsCSV([l]),{header:true}).data[0];assert.equal(row.company_fit_points,'');assert.equal(row.unassessed_points,'');assert.equal(row.legacy_priority_score,'100');
 assert.doesNotMatch(sourcePanelMarkup(l,ui,'score'),/\/ 100|possible points|evidence coverage/);
});
test('fit sorting follows category with stable ties with unresolved accounts last',()=>{
 const rows=cases.map(([id,text])=>({...make(text),id}));
 assert.deepEqual(sortContacts(rows,'fit-desc').map(x=>x.id),['large operator','small operator','unrelated business','missing research']);
 assert.deepEqual(sortContacts(rows,'fit-asc').map(x=>x.id),['unrelated business','large operator','small operator','missing research']);
});
test('portfolio-count uncertainty does not change company eligibility',()=>{
 const l=make(cases[0][1]);
 for(const patch of [{alternatives:[{value:'6,000 apartment homes'}]},{as_of:'2020-01-01'},{as_of:'invalid'},{value:'10,000 beds'},{value:'nearly 5,000 apartment homes'}]){
  const fit=companyFit({...l,research_brief:{...l.research_brief,portfolio:{...l.research_brief.portfolio,...patch}}});assert.equal(fit.score,null);assert.equal(fit.label,'High fit');
 }
});
test('CSV sales insights use visible brief context instead of legacy coaching',()=>{
 const l=make('Acme Housing manages residential apartments. Acme Housing uses Yardi for property management.');
 l.sales_insights={items:[{title:'Old coaching',fact:'Confirm budget',meaning:'Ask next'}]};
 const row=Papa.parse(leadsCSV([l]),{header:true}).data[0];assert.match(row.sales_insights,/Yardi/);assert.doesNotMatch(row.sales_insights,/Old coaching|Confirm budget/);
});

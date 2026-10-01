import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companyFit,contactRelevance,researchCoverage} from '../static/company-fit.js';
import {researchMarkup} from '../static/research.js';
import {buildBrief} from '../website/brief.mjs';
import {outreachCopy} from '../website/outreach.mjs';
import {presentLead,intake} from '../website/domain.mjs';
const ui={esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),date:String,icon:()=>''};
const lead=(text='Acme Housing owns and manages residential apartment communities.',extra={})=>{
 const l={company:'Acme Housing',name:'Jordan Lee',email:'jordan@acmehousing.com',website:'acmehousing.com',processed_at:new Date().toISOString(),research_state:'complete',evidence:[{url:'https://acmehousing.com/about',title:'Acme Housing',text,verified:true,date:new Date().toISOString()}],...extra};
 return {...l,research_brief:buildBrief(l,'acmehousing.com')};
};
test('institutional ownership establishes market fit without claiming property management',()=>{
 const l=lead('Acme Housing invests in and owns residential apartment communities. We outsource property management to third-party operators.');
 assert.equal(companyFit(l).label,'High fit');
 for(const text of ['Acme Housing advises clients who invest in and own apartment communities.','Acme Housing does not own residential housing.','Acme Housing provides software to institutional owners of residential housing.'])assert.notEqual(companyFit(lead(text)).label,'High fit');
});
test('research coverage and company fit remain independent',()=>{
 const l=lead(undefined,{company_stale:true,property_address:'12 Main Street',property_context:{status:'matched'}});
 assert.equal(companyFit(l).label,'High fit');assert.equal(researchCoverage(l)[0].value,'Saved sources');
 assert.equal(researchCoverage(l)[1].value,'Not established');assert.equal(researchCoverage(l)[2].value,'Address matched');
 assert.equal(companyFit({}).label,'Fit unclear');assert.equal(researchCoverage({})[0].value,'Queued');
});
test('contact function requires a current unambiguous official role and never establishes authority',()=>{
 const l=lead(undefined,{professional_context:{status:'complete',match:'name_company_match',checked_at:new Date().toISOString(),people:[{role:'Director of Operations',official:true}]}});
 assert.equal(contactRelevance(l).function,'Operations');assert.equal(contactRelevance(l).supported,true);
 for(const p of [{stale:true},{match:'review'},{checked_at:'2020-01-01'}])assert.equal(contactRelevance({...l,professional_context:{...l.professional_context,...p}}).supported,false);
 assert.equal(contactRelevance({...l,professional_context:{...l.professional_context,people:[{role:'CEO',official:false}]}}).supported,false);
 assert.ok(!JSON.stringify(contactRelevance(l)).includes('authority'));
});
test('dated developments exclude old, future, undated and invalid publication dates',()=>{
 const text='Acme Housing manages residential apartments. Acme Housing announced an expansion into new markets.';
 for(const published_date of [null,'invalid','2020-01-01',new Date(Date.now()+86400000).toISOString()]){
 const l=lead(text);l.evidence[0].published_date=published_date;assert.ok(!buildBrief(l,'acmehousing.com').context.some(f=>f.key==='initiative'));
 }
 const l=lead(text);l.evidence[0].published_date=new Date(Date.now()-86400000).toISOString();assert.ok(buildBrief(l,'acmehousing.com').context.some(f=>f.key==='initiative'));
});
test('inquiry precedes account and contact; software evidence appears once; map stays below',()=>{
 const l=lead('Acme Housing manages 2,000 apartment homes. Acme Housing uses Yardi for property management.',{inquiry:'We need help with after-hours inquiries.',property_address:'12 Main Street',professional_context:{status:'complete',match:'name_company_match',checked_at:new Date().toISOString(),people:[{role:'Director of Operations',official:true,url:'https://acmehousing.com/team'}],insights:[]}});
 const html=researchMarkup(l,ui);
 assert.ok(html.indexOf('Inbound message')<html.indexOf('aria-label="Account brief"'));
 assert.ok(html.indexOf('class="account-contact"')<html.indexOf('Reported portfolio'));
 assert.ok(html.indexOf('Software in use')<html.indexOf('Submitted property'));
 assert.ok(html.indexOf('class="account-contact"')<html.indexOf('Submitted property'));
 assert.equal((html.match(/Acme Housing uses Yardi/g)||[]).length,1);
 assert.doesNotMatch(html,/ASK NEXT|NEXT ACTION|possible points/);
});
test('demo provenance is not an inbound request or a thanks-for-contacting-us email',()=>{
 const l=lead(undefined,{inquiry:'Demo prospect; no inbound inquiry or buying intent. Contact: https://acmehousing.com/team Property: https://acmehousing.com/apartments'});
 const html=researchMarkup(l,ui),draft=outreachCopy(l,l.research_brief,'Jordan',true);
 assert.match(html,/Inquiry and buyer notes/);assert.match(html,/Publicly sourced demo prospect/);assert.doesNotMatch(html,/<blockquote>Demo prospect/);
 assert.doesNotMatch(draft.draft,/Thanks|prompted your inquiry|no inbound inquiry|Contact:/);
 assert.match(draft.draft,/EliseAI can/);
});
test('reviewed drafts survive presentation migration',()=>{
 const l=lead(undefined,{draft:'My approved wording',draft_edited:true,reviewed:true,draft_version:11});
 assert.equal(presentLead({...intake(l),...l}).draft,'My approved wording');
});
test('contact brief omits trivia when no documented responsibility is found',()=>{
 const l=lead(undefined,{professional_context:{match:'name_company_match',people:[{role:'Director',url:'https://acmehousing.com/team'}],insights:[{kind:'background',quote:'Jordan enjoys golf.',url:'https://acmehousing.com/team'}]}});
 assert.doesNotMatch(researchMarkup(l,ui),/enjoys golf/);
});

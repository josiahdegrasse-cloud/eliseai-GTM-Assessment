import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildBrief} from '../website/brief.mjs';
import {intake,qualify,presentLead} from '../website/domain.mjs';
import {companyFit} from '../static/company-fit.js';
import {fitHeaderMarkup} from '../static/research.js';
import {readerPage,readerEvidence,nextCompanyPage,researchHasContext,retainCompanyEvidence,readerRequest,discoveryRequest} from '../website/free-research.mjs';

const research=(company,domain,text,path='/about',extra={})=>{
 const lead={company,name:'Test Contact',email:'test@example.invalid',website:domain,processed_at:'2026-09-30',...extra};
 const page=readerPage({code:200,data:{title:company,url:'https://'+domain+path,httpStatus:200,content:text}},domain,company);
 const evidence=readerEvidence(lead,[page]).evidence;
 return {...lead,evidence,research_brief:buildBrief({...lead,evidence},domain)};
};
// Public official-page excerpts retrieved September 30, 2026. These are
// extraction regression cases, not an independent estimate of web coverage.
test('CPManagement retains residential fit alongside commercial and consulting work',()=>{
 const lead=research('CPManagement','cpmanagement.com',
  'CPManagement manages over 2,000 multifamily apartment units throughout Northern New England.\n\nCPManagement manages commercial office properties.\n\nCPManagement provides consulting services.', '/services/multifamily-management');
 assert.equal(companyFit(lead).label,'High fit');
 assert.equal(lead.research_brief.classification.mixed_business,true);
 assert.equal(lead.research_brief.portfolio.value,'over 2,000 multifamily apartment units');
 assert.ok(companyFit(lead).evidence.every(e=>e.quote.includes('multifamily')));
});
test('AAMCI keeps the housing context adjacent to its current unit count',()=>{
 const lead=research('AAMCI','aamci.com','AAMCI was chartered in 1972 with the sole purpose of managing multifamily housing with emphasis on the operations of low and moderate-income developments. Today, AAMCI manages over 4,000 units in the Midwest and Southeast. In addition, AAMCI invests in multifamily housing and is involved in development utilizing the Low-Income Housing Tax Credit program.','/about-us/');
 assert.equal(companyFit(lead).label,'High fit');
 assert.equal(lead.research_brief.portfolio.value,'over 4,000 units');
 assert.ok(lead.research_brief.signals[0].supported);
});
test('Herzog apartment development description is usable without invented scale',()=>{
 const lead=research('Herzog Property Management','herzogapartments.com','We specialize in Apartment Complex Developments that offer modern amenities like elevators, large underground parking garages and spacious floor plans.\n\nWe manage properties in the following cities: Alexandria, Fargo and Moorhead.','/about/');
 assert.equal(companyFit(lead).label,'High fit');
 assert.equal(lead.research_brief.portfolio,null);
});
test('condominium process language alone does not force high fit',()=>{
 const lead=research('Trimark Property Management','trimarkpm.com','Managing residential condominiums involves balancing the needs of the condo board and residents. Trimark Property Management handles the challenges of residential property management by effectively working with all parties involved.','/our-services/residential-property-management/');
 assert.equal(companyFit(lead).label,'Fit unclear');
});
test('explicit contradictory operating statements remain unclear while source facts remain available',()=>{
 const lead=research('Acme Housing','acmehousing.com','Acme Housing manages 2,000 residential apartment homes.\n\nAcme Housing does not own or manage residential apartment communities.');
 assert.equal(companyFit(lead).label,'Fit unclear');
 assert.equal(lead.research_brief.classification.conflict,true);
 assert.equal(lead.research_brief.portfolio.value,'2,000 residential apartment homes');
 assert.ok(companyFit(lead).evidence.some(e=>e.kind==='operating_denial'));
});
for(const text of [
 'Acme Housing provides software for apartment owners. Our customers own and manage over 20,000 apartment homes.',
 'Acme Housing provides consulting services. Other Company owns 5,000 residential apartment homes.',
 'Acme Housing publishes apartment research. Other Company manages over 4,000 units.',
])test('additional context never transfers customer or other-company operations: '+text,()=>{
 const lead=research('Acme Housing','acmehousing.com',text);
 assert.notEqual(companyFit(lead).label,'High fit');
 assert.equal(lead.research_brief.portfolio,null);
});
test('commercial-only property operators remain low fit',()=>{
 const lead=research('Acme Housing','acmehousing.com','Acme Housing owns and manages commercial office properties and shopping centers.');
 assert.equal(companyFit(lead).label,'Low fit');
});
test('throttling retains established fit and shows refresh state separately',()=>{
 const lead=research('Acme Housing','acmehousing.com','Acme Housing manages residential apartment communities.', '/about',{company_stale:true,company_retry_code:'provider_busy'});
 assert.equal(companyFit(lead).label,'High fit');
 assert.equal(companyFit(lead).research_status,'pending');
 assert.match(fitHeaderMarkup(lead,{esc:String}),/Needs review/);
 assert.equal(companyFit({...lead,research_brief:{}}).label,'Fit unclear');
 assert.equal(companyFit({...lead,company_stale:false,research_brief:{}}).label,'Fit unclear');
});
test('partial refresh replaces updated pages and preserves unfetched dated evidence',()=>{
 const old=[{url:'https://acmehousing.com/about',text:'Old text',date:'2026-09-01'},{url:'https://acmehousing.com/residential',text:'Housing operations',date:'2026-09-02'}];
 const fresh=[{url:old[0].url,text:'Updated text',date:'2026-09-30'}];
 assert.deepEqual(retainCompanyEvidence(fresh,old,true),[...fresh,old[1]]);
 assert.deepEqual(retainCompanyEvidence([],old,true),old);
 assert.deepEqual(retainCompanyEvidence(fresh,old,false),fresh);
 assert.deepEqual(retainCompanyEvidence([],old,false),[]);
});
test('an observed housing services page is researched even after commercial context is found',()=>{
 const domain='acmehousing.com', page=readerPage({code:200,data:{title:'Acme Housing',url:'https://'+domain+'/',content:'Acme Housing manages commercial office properties.\n\n[About](/about)\n[Residential management](/services/residential-management)\n[Contact](/contact)'}},domain);
 assert.equal(page.next,'https://acmehousing.com/services/residential-management');
 assert.equal(researchHasContext({company:'Acme Housing',website:domain,email:'test@example.invalid'},[page]),false);
 const visited=new Set(['https://acmehousing.com']);
 assert.equal(nextCompanyPage({domain,pages:[page],visited,enough:true}),page.next);
 visited.add(page.next);
 assert.equal(nextCompanyPage({domain,pages:[page],visited,enough:true}),'https://acmehousing.com/contact');
});
test('free research never attaches a supplied paid API key and paid discovery stays disabled',()=>{
 const request=readerRequest('https://acmehousing.com/','acmehousing.com','DO-NOT-USE');
 assert.doesNotMatch(JSON.stringify(request),/DO-NOT-USE|Authorization|Bearer/);
 assert.throws(()=>discoveryRequest(),/Paid discovery is disabled/);
});

test('successful refresh clears pending and old failure metadata through reload',()=>{
 const original=intake({name:'Jordan Lee',company:'Acme Housing',email:'test@example.invalid',website:'acmehousing.com'});
 const evidence=[{text:'Acme Housing manages residential apartment communities.',title:'Acme Housing',url:'https://acmehousing.com/about',verified:true}];
 const failed=qualify(original,{evidence,stale:true,retry_after:'2099-01-01',retry_code:'provider_busy',refresh_error:'Throttled'}, {},['Throttled']);
 assert.equal(companyFit(failed).research_status,'pending');assert.doesNotMatch(fitHeaderMarkup(failed,{esc:String}),/Refresh pending/);
 const success=qualify(failed,{evidence,stale:false,engine:'reader-v2',retry_after:'2099-01-01',retry_code:'provider_busy',refresh_error:'Old failure'}, {},[]);
 for(const lead of [success,presentLead(JSON.parse(JSON.stringify(success)))]){
  assert.equal(lead.company_stale,false);assert.equal(lead.automation_pending,false);
  assert.equal(lead.company_retry_after,null);assert.equal(lead.company_retry_code,null);assert.equal(lead.company_error,null);
  assert.equal(companyFit(lead).research_status,'complete');
  assert.doesNotMatch(fitHeaderMarkup(lead,{esc:String}),/Refresh pending/);
 }
 const failedAgain=qualify(success,{evidence,cached:true,stale:true,retry_after:'2099-01-01',retry_code:'provider_busy'}, {},['Throttled']);
 assert.equal(companyFit(failedAgain).label,'High fit');
 assert.equal(companyFit(presentLead(failedAgain)).research_status,'pending');assert.doesNotMatch(fitHeaderMarkup(presentLead(failedAgain),{esc:String}),/Refresh pending/);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {companyFit,verifiedScoringRole,fitScoreText} from '../static/company-fit.js';
import {buildBrief} from '../website/brief.mjs';
const now=Date.parse('2026-09-30T12:00:00Z');
function lead(size=5000,role='Director of Operations'){
 const l={name:'Jordan Lee',company:'Acme Housing',website:'acmehousing.com',processed_at:new Date(now).toISOString(),evidence:[{verified:true,url:'https://acmehousing.com/about',title:'Acme Housing',text:`Acme Housing owns and manages ${size} apartment homes.`,date:new Date(now).toISOString()}],professional_context:{version:9,status:'complete',match:'name_company_match',checked_at:new Date(now).toISOString(),input_key:'jordan lee|acme housing|acmehousing.com',people:[{name:'Jordan Lee',company:'Acme Housing',role,official:true,url:'https://acmehousing.com/team/jordan-lee',quote:`Jordan Lee is ${role} at Acme Housing.`}]}};
 l.research_brief=buildBrief(l,'acmehousing.com');return l;
}
test('company size does not create an arbitrary numerical advantage',()=>{
 for(const n of [100,200,1000,5000]){const f=companyFit(lead(n),undefined,now);assert.equal(f.score,null);assert.equal(fitScoreText(f),'High fit');assert.equal(f.max,null);}
});
test('missing and unrelated roles do not change a supported company operating model',()=>{
 const l=lead();delete l.professional_context;
 assert.equal(companyFit(l,undefined,now).label,'High fit');
 assert.equal(companyFit(lead(5000,'Director of Human Resources'),undefined,now).label,'High fit');
});
test('stale, mismatched, conflicting, future, sample and unofficial roles cannot become verified contact facts',()=>{
 for(const patch of [{stale:true},{snapshot:true},{checked_at:'2020-01-01'},{checked_at:'2099-01-01'},{match:'review'},{input_key:'another|company|example.com'}]){const l=lead();Object.assign(l.professional_context,patch);assert.equal(verifiedScoringRole(l,now),null);assert.equal(companyFit(l,undefined,now).label,'High fit');}
 for(const patch of [{quote:'Jordan enjoys hiking.'},{name:'Another Person'},{company:'Other Company'},{official:false},{historical:true},{published_at:'2099-01-01'},{url:'https://othercompany.com/team'},{url:'javascript:alert(1)'}]){const l=lead();Object.assign(l.professional_context.people[0],patch);assert.equal(verifiedScoringRole(l,now),null);}
 const l=lead();l.professional_context.people.push({...l.professional_context.people[0],role:'Legal Counsel'});assert.equal(verifiedScoringRole(l,now),null);
});
test('generic housing language and repeated workflow mentions cannot inflate score',()=>{
 const l=lead(),base=companyFit(l,undefined,now);l.research_brief.signals.push({key:'leasing',supported:true,source_ids:['S1']});l.research_brief.context.push({key:'workflow',text:'We automate leasing and renewals.'});assert.deepEqual(companyFit(l,undefined,now),base);
});
test('unknown sector cannot be rescued by a CEO or portfolio claim',()=>{
 const l=lead();l.research_brief.classification={kind:'unclassified',evidence:[]};const f=companyFit(l,undefined,now);assert.equal(f.score,null);assert.equal(f.upper,null);
});
test('reviewed draft and buyer intent do not affect public lead fit',()=>{
 const l=lead();assert.deepEqual(companyFit(l,undefined,now),companyFit({...l,reviewed:true,draft:'My wording',inquiry:'Urgent budget approved',qualifications:{need_status:'confirmed'}},undefined,now));
});

test('fit label never exposes a numeric range, percentage or research status',()=>{const l=lead();delete l.professional_context;const f=companyFit(l,undefined,now);assert.equal(fitScoreText(f),'High fit');assert.equal(f.score,null);assert.equal(f.upper,null);});

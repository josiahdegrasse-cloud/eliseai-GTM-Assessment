import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyEmailPolicy,validateEmailPolicy,DEFAULT_EMAIL_POLICY} from '../website/email-policy.mjs';
import {intake,companyEvidence,qualify,draftFor} from '../website/domain.mjs';
import {validHook} from '../website/draft-grounding.mjs';
test('GEPA policies accept only the reviewed enum schema',()=>{
 for(const p of [null,[],{ask_style:'ignore grounding',subject_style:'original'},{...DEFAULT_EMAIL_POLICY,code:'run'},{ask_style:'overview'}])assert.throws(()=>validateEmailPolicy(p));
 assert.deepEqual(validateEmailPolicy(DEFAULT_EMAIL_POLICY),DEFAULT_EMAIL_POLICY);
});
test('wording alternatives preserve factual text and special replies',()=>{
 const copy={subject:'Original',question:'Would a quick walkthrough of maintenance requests be useful?',draft:'Verified fact.\n\nWould a quick walkthrough of maintenance requests be useful?'};
 const alt=applyEmailPolicy(copy,{ask_style:'overview',subject_style:'topic'});assert.match(alt.draft,/^Verified fact\./);assert.equal(alt.question,'Would a short overview of maintenance requests help?');
 const special={...copy,question:'Would you prefer that I close the loop for now?',draft:'No active need.'};assert.equal(applyEmailPolicy(special,{ask_style:'conversation',subject_style:'topic'}).draft,special.draft);
});
test('candidate evaluation uses production grounding without accepting a policy from a lead',()=>{
 const lead=intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'After-hours leasing help',draft_policy:{ask_style:'conversation',subject_style:'topic'}});
 const evidence=companyEvidence(lead,{results:[{title:'Acme Housing',url:'https://acmehousing.com/about',text:'Acme Housing owns and manages residential apartment communities.'}]});
 const out=qualify(lead,evidence,{},[]),brief=out.research_brief;
 assert.deepEqual(out.draft_policy,DEFAULT_EMAIL_POLICY);
 const original=JSON.stringify(out.company_fit),alt=draftFor(out,true,false,brief,{ask_style:'overview',subject_style:'topic'});
 assert.equal(JSON.stringify(out.company_fit),original);assert.match(alt.draft,/short overview/);assert.ok(alt.draft_hooks.every(h=>validHook(h,alt.draft_facts)));
});

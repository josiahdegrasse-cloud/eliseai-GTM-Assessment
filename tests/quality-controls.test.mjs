import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify,draftFor} from '../website/domain.mjs';
import {groundDraft,validHook} from '../website/draft-grounding.mjs';
import {assessmentSnapshot,resultState} from '../website/quality-history.mjs';
const make=()=>qualify(intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com'}),{evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',date:new Date().toISOString(),text:'Acme Housing manages residential communities in eight U.S. markets.'}]},{},[]);
test('hooks cannot cite missing IDs, detached quotes or a different URL',()=>{
 const facts=[{id:'F1',url:'https://acmehousing.com',text:'Stored source quote'}],base={text:'Claim',quote:'Stored source quote',url:'https://acmehousing.com',fact_ids:['F1']};
 assert.equal(validHook(base,facts),true);for(const bad of [{fact_ids:[]},{fact_ids:['invented']},{quote:'Invented quote'},{url:'https://othercompany.com'}])assert.equal(validHook({...base,...bad},facts),false);
});
test('a tampered company hook falls back even if it points to a real stored quote',()=>{
 const lead=make(),source=lead.research_brief.sources[0],text='Your company doubled conversion by 90%.';
 const out=groundDraft(lead,lead.research_brief,{draft:'Hi Jordan,\n\n'+text+'\n\nWould an introduction help?',question:'Would an introduction help?',context_basis:[{usage:'company_observation',sentence:text,quote:source.excerpt,source}]});
 assert.equal(out.draft_guard.status,'fallback');assert.doesNotMatch(out.draft,/90%|doubled/);assert.equal(out.draft_hooks.length,0);
});
test('stored assessment keeps scoring inputs, rule fingerprint and exact edited draft',()=>{
 const lead={...make(),draft:'My reviewed email',draft_edited:true,would_send:'Would send'},snapshot=assessmentSnapshot(lead,'review');
 assert.equal(snapshot.email.text,lead.draft);assert.equal(snapshot.result.label,'High fit');assert.equal(snapshot.evidence[0].text,lead.evidence[0].text);assert.match(snapshot.rules_sha256,/^[a-f0-9]{64}$/);
 assert.equal(snapshot.inputs.website,'acmehousing.com');assert.equal(snapshot.email.edited,true);
});
test('refresh failures, empty matches and skipped inputs have distinct log states',()=>{
 assert.equal(resultState('company',{stale:true,evidence:[{}]}).status,'failed');assert.equal(resultState('contact',{status:'complete',people:[]}).status,'no_match');assert.equal(resultState('property',{status:'incomplete'}).status,'skipped');assert.equal(resultState('company',{evidence:[{}],cached:true}).status,'cached');assert.equal(resultState('logo',{status:'missing'}).status,'no_match');
});
test('regeneration clears feedback tied to a previous message',()=>{
 const lead=make(),out=draftFor({...lead,would_send:'Would send',reviewed_draft_id:'old'},true,false,lead.research_brief);assert.equal(out.would_send,'');assert.equal(out.reviewed_draft_id,null);assert.ok(out.draft_hooks.every(h=>validHook(h,out.draft_facts)));
});

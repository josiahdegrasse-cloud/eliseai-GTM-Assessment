import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchProgress} from '../static/workflow.js';
import {intake,qualify,presentLead} from '../website/domain.mjs';
import {researchMarkup} from '../static/research.js';
const complete={processed_at:'2026-09-30',research_state:'complete',research_brief:{portfolio:{value:'2,000 homes'}},professional_context:{status:'complete',match:'name_company_match'}};
test('finished, limited, interrupted and queued research are distinct from score',()=>{
 assert.equal(researchProgress(complete).kind,'finished');
 assert.equal(researchProgress({...complete,professional_context:{status:'complete',match:'none'}}).kind,'limited');
 assert.equal(researchProgress({...complete,professional_context:{status:'unavailable'}}).kind,'interrupted');
 assert.equal(researchProgress({...complete,property_address:'Test address',property_context:{status:'unmatched'}}).kind,'limited');
 assert.equal(researchProgress({...complete,property_address:'Test address',property_context:{status:'unavailable'}}).kind,'interrupted');
 assert.equal(researchProgress({research_state:'pending'}).kind,'queued');
 assert.equal(researchProgress(complete,{busy:true}).kind,'running');
 assert.equal(researchProgress({...complete,context_pending_until:new Date(Date.now()+10000).toISOString()}).kind,'running');
});
test('failed refresh retains saved evidence and never claims a retry unless scheduled',()=>{
 const failed={...complete,company_stale:true,company_retry_code:'provider_quota',research_brief:{sources:[{id:'S1'}]}};
 const s=researchProgress(failed);assert.match(s.label,/saved research/);assert.match(s.detail,/exhausted/);assert.doesNotMatch(s.detail,/scheduled/);
 assert.equal(researchProgress({...failed,company_stale:false,company_retry_code:null}).kind,'limited');
});
test('brief omits limited-evidence banner while retaining sources and saved drafts',()=>{
 const raw=intake({name:'Jordan Example',company:'Acme Housing',website:'acmehousing.com',email:'quality@example.invalid',inquiry:'Demo prospect; no inbound inquiry.'});
 const lead=qualify(raw,{evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/',text:'Acme Housing manages residential apartment communities.'}]},{status:'incomplete'},[]);
 assert.doesNotMatch(lead.draft,/Thanks for|I’m reaching out|Your company overview describes residential property operations/);
 assert.equal((lead.draft.match(/\?/g)||[]).length,1);
 const html=researchMarkup(lead,{esc:String,date:String,icon:()=>''});assert.doesNotMatch(html,/research-completion|Research finished · limited evidence|Available facts are shown|View research details/);assert.match(html,/research-details/);assert.doesNotMatch(html,/research-coverage/);
 const edited=presentLead({...lead,draft_version:12,draft:'My reviewed wording',draft_edited:true});assert.equal(edited.draft,'My reviewed wording');
});

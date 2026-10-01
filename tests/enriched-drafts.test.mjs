import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify,draftFor} from '../website/domain.mjs';
const make=(text,inquiry='We would like a demo of after-hours leasing coverage.')=>qualify(intake({name:'Jordan Lee',email:'jordan@acmehousing.com',company:'Acme Housing',website:'acmehousing.com',inquiry}),{evidence:[{verified:true,title:'Acme Housing',url:'https://acmehousing.com/about',text,date:new Date().toISOString()}]},{},[]);
test('a relevant inquiry includes one grounded company fact, capability and one ask',()=>{
 const lead=make('Acme Housing manages multifamily apartment communities.');
 assert.match(lead.draft,/Acme Housing works in multifamily housing management/);assert.match(lead.draft,/outside office hours/);assert.equal((lead.draft.match(/\?/g)||[]).length,1);
 assert.equal(lead.draft_personalization,'Company-personalized');assert.equal(lead.draft_hooks.filter(x=>x.kind==='company_observation').length,1);
 assert.equal(lead.score,null);assert.equal(lead.company_fit.label,'High fit');
});
test('unresolved or old company context stays a labeled basic response',()=>{
 const lead=make('Welcome to Acme Housing.');assert.equal(lead.draft_personalization,'Basic response');assert.doesNotMatch(lead.draft,/I noticed/);
 const old=make('In 2010 Acme Housing manages residential apartment communities.');assert.doesNotMatch(old.draft,/I noticed/);
});
test('stale sources cannot personalize and another contact keeps their own inquiry',()=>{
 const lead=make('Acme Housing manages multifamily apartment communities.');
 const stale=draftFor({...lead,company_stale:true},true,false,lead.research_brief);assert.equal(stale.draft_personalization,'Basic response');
 const other=draftFor({...lead,name:'Taylor Park',inquiry:'We need help with maintenance requests.'},true,false,lead.research_brief);
 assert.match(other.draft,/Hi Taylor/);assert.match(other.draft,/capture maintenance requests/);assert.doesNotMatch(other.draft,/after-hours|Hi Jordan/);
});


test('an apartment count is not mistaken for a historical year',()=>{
 const lead=make('Acme Housing manages 2000 multifamily apartment homes.');
 assert.equal(lead.draft_personalization,'Company-personalized');assert.match(lead.draft,/multifamily housing management/);
});

test('named operating geography becomes a sourced hook without inventing pain',()=>{
 const lead=make('Acme Housing manages 2,000 multifamily apartment units throughout Northern New England.');
 assert.match(lead.draft,/operates housing in Northern New England/);assert.ok(lead.draft_hooks.some(h=>h.quote.includes('Northern New England')));assert.doesNotMatch(lead.draft,/struggling|losing leads|2,000/);
});
test('only explicitly enabled, recent saved demo evidence can personalize a snapshot',()=>{
 const lead=make('Acme Housing manages multifamily apartment communities.');
 const ordinary=draftFor({...lead,company_snapshot:true},true,false,lead.research_brief);assert.equal(ordinary.draft_personalization,'Basic response');
 const demo={...lead,company_snapshot:true,sample_lead:true,sample_grounded_draft:true};
 assert.equal(draftFor(demo,true,false,lead.research_brief).draft_personalization,'Company-personalized');
 const old={...lead.research_brief,sources:lead.research_brief.sources.map(s=>({...s,retrieved_at:'2001-01-01'}))};
 assert.equal(draftFor(demo,true,false,old).draft_personalization,'Basic response');
 assert.equal(draftFor({...demo,company_stale:true},true,false,lead.research_brief).draft_personalization,'Basic response');
});

test('a fresh retrieval of an old article cannot supply a current-company email hook',()=>{
 const lead=make('Acme Housing manages multifamily apartment communities across 10 states.');
 for(const patch of [{url:'https://acmehousing.com/news/acquisitions-in-2020'},{title:'Acme Housing 2020 acquisitions'}]){
  const brief={...lead.research_brief,sources:lead.research_brief.sources.map(s=>({...s,...patch}))};
  const out=draftFor(lead,true,false,brief);assert.equal(out.draft_personalization,'Basic response');assert.doesNotMatch(out.draft,/10 states|I noticed/);
 }
});
test('current company evidence remains usable when an old article is also retrieved',()=>{
 const l=intake({name:'Jordan Lee',email:'jordan@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'We need help with after-hours leasing.'});
 const out=qualify(l,{evidence:[{title:'Acme Housing',url:'https://acmehousing.com/news/acquisitions-in-2020',text:'Acme Housing manages multifamily apartment communities across 10 states.',date:new Date().toISOString(),verified:true},{title:'Acme Housing',url:'https://acmehousing.com/about',text:'Acme Housing manages multifamily apartment communities across 12 states.',date:new Date().toISOString(),verified:true}]},{},[]);
 assert.equal(out.research_brief.footprint.value,'12 states');assert.match(out.draft,/12 states/);assert.doesNotMatch(out.draft,/10 states/);
});

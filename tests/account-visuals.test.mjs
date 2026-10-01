import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locationPoint,locationMapMarkup,accountInitials} from '../static/account-visuals.js';
import {sourcePanelMarkup,buyerContextMarkup,researchMarkup} from '../static/research.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,date:v=>v||'Not available',icon:()=>''};
const lead={company:'Acme Housing',city:'Raleigh',state:'NC',property_context:{status:'matched',coordinates:{x:-78.6382,y:35.7796}}};
test('regional locator uses a matched coordinate and keeps ownership unverified',()=>{
 const html=locationMapMarkup(lead,ui);assert.match(html,/North Carolina/);assert.match(html,/Approximate address location/);assert.match(html,/class="map-pin"/);assert.doesNotMatch(html,/https?:|<image|<script/);
});
test('missing, invalid or unsupported coordinates cannot produce a fabricated map pin',()=>{
 for(const context of [{},{status:'unmatched',coordinates:{x:-78,y:35}},{status:'matched',coordinates:{x:null,y:null}},{status:'matched',coordinates:{x:0,y:0}},{status:'matched',coordinates:{x:Infinity,y:35}},{status:'matched',coordinates:{x:'-78',y:35}},{status:'unsupported',coordinates:{x:-78,y:35}}]){
  assert.equal(locationPoint(context),null);assert.doesNotMatch(locationMapMarkup({...lead,property_context:context},ui),/class="map-pin"/);
 }
});
test('saved map results stay labeled saved; hostile place names are escaped',()=>{
 const html=locationMapMarkup({...lead,city:'"><script>bad()</script>',property_context:{...lead.property_context,stale:true}},ui);assert.match(html,/Saved address location/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('a source panel escapes excerpts and rejects executable source URLs',()=>{
 const l={...lead,research_brief:{sources:[{id:'S1',title:'<img src=x>',url:'javascript:alert(1)',excerpt:'<script>bad()</script>'}]}};
 const html=sourcePanelMarkup(l,ui,'S1');assert.doesNotMatch(html,/<img|<script|href="javascript:/);assert.match(html,/&lt;script&gt;/);
});
test('draft evidence opens the retained draft source, not a newer conflicting account source',()=>{
 const l={...lead,research_brief:{sources:[{id:'S1',title:'New source',excerpt:'New evidence'}]},draft_basis:[{quote:'Original evidence',source:{title:'Original source',url:'https://acmehousing.com/about',retrieved_at:'2025-01-01'}}]};
 const html=sourcePanelMarkup(l,ui,'draft-0');assert.match(html,/Original evidence/);assert.match(html,/Original source/);assert.doesNotMatch(html,/New evidence/);
});
test('lead notes show recorded facts without progress or coaching',()=>{
 const html=buyerContextMarkup({...lead,qualifications:{scope:'Two communities',timing:'This quarter'}},ui);assert.match(html,/Two communities/);assert.match(html,/This quarter/);assert.doesNotMatch(html,/discovery-progress|ASK NEXT|Not recorded/);for(const field of ['Rollout scope','Current workflow &amp; tools','Timing','Role &amp; decision team'])assert.ok(html.includes(field));assert.doesNotMatch(html,/<details/);assert.equal(accountInitials('Camden Property Trust'),'CP');
});
test('company delays show a retry action without mixing in missing address instructions',()=>{
 const retry=Date.now()+75000,l={...lead,processed_at:new Date().toISOString(),research_state:'partial',company_stale:true,company_retry_code:'provider_busy',company_retry_after:new Date(retry).toISOString(),company_error:'The provider is busy.',research_note:'Company evidence is not yet available. Add street, city and state.',property_context:{status:'incomplete'},research_brief:{sources:[]},qualifications:{}};
 const html=researchMarkup(l,{...ui,nextAction:()=>'',retryAt:retry});assert.match(html,/Research waiting/);assert.match(html,/Next automatic attempt at/);assert.doesNotMatch(html,/Partial results|Company evidence is not yet available|Add street, city and state/);assert.match(html,/<section class="research-details"/);assert.doesNotMatch(html.split('<section class="research-details"')[0],/Research waiting|Next automatic attempt/);
 const paused=researchMarkup(l,{...ui,nextAction:()=>'',retryAt:null});assert.match(paused,/Next check available at/);assert.doesNotMatch(paused,/Next automatic attempt at/);
});
test('credential and quota failures explain owner action without promising automatic recovery',()=>{
 for(const code of ['provider_auth','provider_quota']){
  const html=researchMarkup({...lead,company_stale:true,company_retry_code:code,company_retry_after:new Date(Date.now()+3600000).toISOString(),research_brief:{sources:[]}}, {...ui,nextAction:()=>'',retryAt:null});
  assert.match(html,/site owner/);assert.match(html,/Automatic retries are paused/);assert.doesNotMatch(html,/Next automatic attempt|renews at midnight|rate-limiting company/);
 }
});

test('property preserves the submitted address and suppresses a panorama for a different building',async()=>{
 const {streetViewMarkup,propertyViewLinks,propertyAddress}=await import('../static/account-visuals.js');
 const l={...lead,name:'PRIVATE CONTACT',email:'private@example.invalid',property_address:'123 Main Street, Apt 4 & 5',postal_code:'27601',country:'US',property_context:{...lead.property_context,address:'125 MAIN ST, RALEIGH, NC'}};
 const address='123 Main Street, Apt 4 & 5, Raleigh, NC, 27601, US';
 assert.equal(propertyAddress(l),address);
 const html=streetViewMarkup(l,ui);
 assert.equal(new URL(propertyViewLinks(l).search).searchParams.get('query'),address);
 assert.doesNotMatch(html,/<iframe/);assert.match(html,/Street View is not available/);
 assert.doesNotMatch(html,/svembed|cbll|cbp|125 MAIN|PRIVATE CONTACT|private@example/);
 const brief=researchMarkup(l,ui);assert.match(brief,/123 Main Street, Apt 4 &amp; 5, Raleigh, NC, 27601, US/);assert.doesNotMatch(brief,/125 MAIN/);
 for(const property_context of [{status:'unmatched'},{status:'matched',coordinates:{x:Infinity,y:35}}])assert.equal(streetViewMarkup({...l,property_context},ui),html);
 assert.equal(streetViewMarkup({...l,property_address:' '},ui),'');
 const edited={...l,property_address:'999 New Road'};
 assert.match(new URL(propertyViewLinks(edited).search).searchParams.get('query'),/^999 New Road/);
 const hostile=researchMarkup({...l,property_address:'<script>bad()</script>'},ui);assert.doesNotMatch(hostile,/<script>/);assert.match(hostile,/&lt;script&gt;/);
});


test('Street View exploration uses a fresh matched point and never asserts an exact panorama',async()=>{
 const {propertyViewLinks}=await import('../static/account-visuals.js');
 const l={...lead,property_address:'123 Main St',property_context:{...lead.property_context,address:'123 MAIN ST, RALEIGH, NC'}};
 const url=new URL(propertyViewLinks(l).street);assert.equal(url.searchParams.get('map_action'),'pano');assert.equal(url.searchParams.get('viewpoint'),'35.7796,-78.6382');
 for(const patch of [{status:'ambiguous'},{stale:true},{address:'125 MAIN ST, RALEIGH, NC'},{coordinates:{x:NaN,y:35}}])assert.equal(propertyViewLinks({...l,property_context:{...l.property_context,...patch}}).street,undefined);
 const html=researchMarkup(l,ui);assert.match(html,/Google Street View near 123 Main St/);assert.match(html,/output=svembed/);assert.match(html,/cbll=35.7796%2C-78.6382/);assert.doesNotMatch(html,/Explore Street View|street-view-form|property-map-fallback|Census address match|Edit address/);
});

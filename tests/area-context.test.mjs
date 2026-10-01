import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {areaRequest,areaEvidence} from '../website/area-context.mjs';
import {areaMarkup,areaSourceMarkup,marketContextMarkup} from '../static/area.js';
import {automaticCandidate,autoResearchDue} from '../static/workflow.js';
import {intake,qualify} from '../website/domain.mjs';
const fixture=JSON.parse(await readFile(new URL('../test-data/area-fixture.json',import.meta.url),'utf8'));
const property={status:'matched',tract:'37183000100',state:'NC'};
const ui={esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),date:v=>v};
test('area request uses only a validated tract and fixed provider, never contact or address details',()=>{
 const r=areaRequest({...property,email:'private@example.com',address:'Private address'});assert.equal(new URL(r.url).host,'api.censusreporter.org');assert.doesNotMatch(r.url,/private|address/i);assert.equal(r.options.redirect,'manual');
 for(const p of [{status:'ambiguous',tract:property.tract},{status:'matched',tract:'https://internal.test'},{status:'matched',tract:''}])assert.equal(areaRequest(p),null);
});
test('area rent, tenure, housing mix and burden use distinct correct universes',()=>{
 const a=areaEvidence(fixture,property);assert.equal(a.median_gross_rent,1500);assert.equal(a.rent_moe,75);assert.equal(a.renter_share,60);assert.equal(a.rent_burden_base,580);assert.equal(a.rent_burden_share,39.7);assert.equal(a.housing_mix.find(x=>x.key==='apartments').count,450);assert.equal(a.period,'2020-2024');assert.ok(a.estimates.B25003.error.B25003003);assert.equal(a.tract,property.tract);
});
test('missing, sentinel and nonnumeric values remain unknown rather than zero or a negative price',()=>{
 const raw=structuredClone(fixture),r=raw.data['14000US37183000100'];r.B25064.estimate.B25064001=-666666666;r.B25003.estimate.B25003001=0;r.B25024.estimate.B25024006=null;r.B25070.estimate.B25070011=null;
 const a=areaEvidence(raw,property);assert.equal(a.median_gross_rent,null);assert.equal(a.renter_share,null);assert.equal(a.housing_mix[2].share,null);assert.equal(a.rent_burden_share,null);
 r.B25064.estimate.B25064001='1500';assert.equal(areaEvidence(raw,property).median_gross_rent,null);
});
test('wrong geography, one-year data and absent data cannot populate a tract brief',()=>{
 assert.throws(()=>areaEvidence(fixture,{...property,tract:'53033007302'}));
 const raw=structuredClone(fixture);raw.release.id='acs2024_1yr';assert.throws(()=>areaEvidence(raw,property));assert.throws(()=>areaEvidence({},property));
});
test('market presentation labels area estimates, restrictions and sampling uncertainty',()=>{
 const lead={property_context:property,area_context:areaEvidence(fixture,property)},html=areaMarkup(lead,ui),source=areaSourceMarkup(lead,ui);
 for(const text of ['Local rental market','$1,500','2020-2024','Property restrictions unverified','Includes utilities','5+ units'])assert.ok(html.includes(text));
 assert.match(source,/90% margin of error/);assert.match(source,/not determined the number of restricted units/);assert.equal(areaMarkup({property_context:{status:'unmatched'}},ui),'');
 assert.doesNotMatch(html,/style=/);assert.match(html,/<svg[^>]+housing-mix-bar/);
});
test('area data cannot add score points or rent claims to a generated email',()=>{
 const lead=intake({name:'Jordan',company:'Acme Housing',website:'acmehousing.com',email:'qa@example.invalid'}),company={evidence:[],matched:false,message:'Unknown'};
 const baseline=qualify(lead,company,property,[]),withArea=qualify({...lead,area_context:areaEvidence(fixture,property)},company,property,[]);
 assert.deepEqual(withArea.priority,baseline.priority);assert.equal(withArea.draft,baseline.draft);
});
test('automatic upload queue includes every pending lead, respects cooldowns and resumes after reload',()=>{
 const time=Date.now(),newLead=id=>({id,automation_pending:true,research_state:'pending',created_at:new Date(time).toISOString()});
 const leads=[{...newLead('a'),company_retry_after:new Date(time+65000).toISOString()},newLead('b'),{id:'unrelated',company_fresh_until:'2000-01-01'}];
 assert.equal(automaticCandidate(leads,'a',new Map(),time).lead.id,'b');
 const attempts=new Map([['b',{count:3}]]);assert.equal(automaticCandidate(leads,'a',attempts,time).at,time+65000);
 assert.equal(automaticCandidate(leads,null,new Map(),time).lead.id,'b');
 assert.equal(automaticCandidate([{...newLead('a'),company_retry_code:'daily_limit'}],null,new Map(),time),null);
 assert.equal(automaticCandidate([{...newLead('a'),research_state:'needs_website'}],null,new Map(),time),null);
});
test('one-time area upgrade preserves fresh company cache and triggers only the selected record',()=>{
 const lead={id:'existing',needs_area_refresh:true,company_fresh_until:'2099-01-01'};assert.ok(autoResearchDue(lead));assert.equal(automaticCandidate([lead],null),null);assert.equal(automaticCandidate([lead],'existing').lead.id,'existing');
});


test('around-property section remains visible without substituting headquarters or unrelated tract data',()=>{
 const cases=[
  [{company_locations:[{address:'999 Corporate Office Road'}]},'Add or confirm a property address'],
  [{property_address:'123 Main St',property_context:{status:'ambiguous'}},'unique Census address match'],
  [{property_address:'123 Main St',country:'GB',property_context:{status:'unsupported'}},'U.S. and Puerto Rico'],
  [{property_address:'123 Main St',property_context:property,area_context:{status:'unavailable'}},'temporarily unavailable']
 ];
 for(const [lead,message] of cases){assert.equal(marketContextMarkup(lead,ui),'');const html=marketContextMarkup(lead,{...ui,property:'<p>Submitted property</p>'});assert.match(html,/Submitted property/);assert.ok(!html.includes(message));assert.doesNotMatch(html,/market-metrics|999 Corporate Office Road/)}
});

test('saved examples without neighborhood estimates do not promise a future load',()=>{
 const html=marketContextMarkup({sample_lead:true,property_address:'123 Main St',property_context:property,area_context:{status:'not_assessed'}},{...ui,property:'<p>Submitted property</p>'});
 assert.match(html,/Submitted property/);assert.doesNotMatch(html,/will load|Neighborhood context|market-metrics/);
});

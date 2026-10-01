import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companyLocations,mergeCompanyLocations} from '../website/company-locations.mjs';
import {censusParams,censusFallbackParams,intake,presentLead,qualify} from '../website/domain.mjs';
import {companyLocationsMarkup,sourcePanelMarkup} from '../static/research.js';
const address={streetAddress:'12 Main Street, Suite 300',addressLocality:'Raleigh',addressRegion:'NC',postalCode:'27601',addressCountry:'US'};
const raw=(metadata,content='')=>({code:200,data:{url:'https://acmehousing.com/contact',title:'Acme Housing',httpStatus:200,content,html:'<script type="application/ld+json">'+JSON.stringify(metadata)+'</script>'}});
const org={'@type':'Organization',name:'Acme Housing',url:'https://acmehousing.com/',address};
const ui={esc:v=>String(v||'').replaceAll('<','&lt;').replaceAll('"','&quot;'),date:v=>v,icon:()=>''};
test('organization metadata provides a sourced company address, not an assumed HQ or property',()=>{
 const [l]=companyLocations(raw({'@graph':[org]}),'acmehousing.com','Acme Housing');assert.equal(l.kind,'Company address');assert.equal(l.city,'Raleigh');assert.match(l.address,/Suite 300/);assert.equal(l.source_url,'https://acmehousing.com/contact');assert.match(l.quote,/12 Main Street/);assert.equal(l.coordinates,undefined);
});
test('unrelated organizations, unscoped addresses and unrelated final domains cannot become company locations',()=>{
 for(const node of [{...org,name:'Another Company'},{...org,url:'https://unrelated.com'}, {'@type':'ApartmentComplex',name:'Acme Housing',address},address])assert.deepEqual(companyLocations(raw(node),'acmehousing.com','Acme Housing'),[]);
 const r=raw(org);r.data.url='https://unrelated.com/contact';assert.deepEqual(companyLocations(r,'acmehousing.com','Acme Housing'),[]);
});
test('labeled office text supports abbreviated and full state names and keeps suite details',()=>{
 for(const region of ['SC','South Carolina']){const [l]=companyLocations(raw({},'Acme Housing\n\nGlobal Headquarters\n465 Meeting Street, Suite 500\nCharleston, '+region+' 29403\nPhone 555-555-0100'),'acmehousing.com','Acme Housing');assert.equal(l.kind,'Headquarters');assert.equal(l.city,'Charleston');assert.match(l.address,/Suite 500/);assert.equal(l.region,region)}
 assert.deepEqual(companyLocations(raw({},'Acme Housing operates communities in Charleston and Dallas.\n12 Main Street, Raleigh, NC 27601'),'acmehousing.com','Acme Housing'),[]);
});
test('a published headquarters city stays city-level and cannot create a property pin',()=>{
 const [l]=companyLocations(raw({},'Acme Housing is headquartered in Charleston, South Carolina, and manages residential communities.'),'acmehousing.com','Acme Housing');
 assert.equal(l.city,'Charleston');assert.equal(l.region,'South Carolina');assert.equal(l.precision,'city');assert.equal(l.street,'');assert.equal(l.coordinates,undefined);
 assert.deepEqual(companyLocations(raw({},'Acme Housing was formerly headquartered in Charleston, South Carolina.'),'acmehousing.com','Acme Housing'),[]);
 assert.deepEqual(companyLocations(raw({},'Acme Housing news. Another Business is headquartered in Charleston, South Carolina.'),'acmehousing.com','Acme Housing'),[]);
 const [base]=companyLocations(raw({},'Based in Memphis, TN, Acme Housing owns and operates its properties.'),'acmehousing.com','Acme Housing');
 assert.equal(base.kind,'Company base');assert.equal(base.city,'Memphis');
 assert.deepEqual(companyLocations(raw({},'Acme Housing news. Another Business is based in Memphis, TN.'),'acmehousing.com','Acme Housing'),[]);
});
test('duplicate addresses are collapsed and source links remain safe in the UI',()=>{
 const l=companyLocations(raw(org),'acmehousing.com','Acme Housing')[0];assert.equal(mergeCompanyLocations([l,l]).length,1);
 const lead={company_locations:[l],research_brief:{sources:[]}};const html=companyLocationsMarkup(lead,ui);assert.match(html,/Company locations/);assert.match(html,/Separate from the property/);assert.match(html,/maps\/search\/\?/);assert.doesNotMatch(html,/Street View|satellite|iframe/);
 const panel=sourcePanelMarkup(lead,ui,'location-0');assert.match(panel,/Open company source/);assert.match(panel,/Self-published company location/);
});
test('a corporate-office directory keeps directional street suffixes and distinct offices',()=>{
 const locations=companyLocations(raw({},'Acme Housing Corporate Offices\n\nAtlanta Office\n260 Peachtree St. NW, Suite 1700 Atlanta, GA 30303\n\nChicago Office\n141 West Jackson Blvd., Suite 300 Chicago, IL 60604'),'acmehousing.com','Acme Housing');
 assert.equal(locations.length,2);assert.equal(locations[0].city,'Atlanta');assert.match(locations[0].street,/NW/);assert.equal(locations[1].city,'Chicago');assert.ok(locations.every(l=>l.kind==='Corporate office'));
});
test('property lookup accepts split fields, street plus ZIP, or a pasted full address',()=>{
 assert.equal(censusParams({property_address:'12 Main Street',city:'Raleigh',state:'NC'}).street,'12 Main Street');
 assert.equal(censusParams({property_address:'12 Main Street',postal_code:'27601'}).zip,'27601');
 assert.equal(censusParams({property_address:'12 Main Street, Raleigh, NC 27601',postal_code:'27601'}).address,'12 Main Street, Raleigh, NC 27601');
 const fallback=censusFallbackParams({property_address:'12 Main Street, Suite 300',city:'Raleigh',state:'NC',postal_code:'27601'});assert.equal(fallback.address,'12 Main Street, Raleigh, NC, 27601');
});
test('legacy and newly imported inquiry markers disappear without erasing the inquiry or saved draft',()=>{
 const lead=intake({name:'Jordan (TEST)',email:'qa@example.invalid',company:'Acme Housing',website:'acmehousing.com',inquiry:'[TEST INQUIRY] Help with tours.'});assert.equal(lead.inquiry,'Help with tours.');
 const out=presentLead({...lead,inquiry:'[TEST INQUIRY] Help with tours.',draft:'My edited wording',draft_edited:true});assert.equal(out.inquiry,'Help with tours.');assert.equal(out.draft,'My edited wording');assert.match(out.name,/TEST/);
 const real=intake({...lead,inquiry:'Our test inquiry routing needs improvement.'});assert.equal(real.inquiry,'Our test inquiry routing needs improvement.');
});
test('location refresh migration preserves company freshness and a provider cooldown',()=>{
 const current=qualify(intake({name:'Jordan',company:'Acme Housing',website:'acmehousing.com',email:'qa@example.invalid'}),{engine:'reader-v2',evidence:[],cache_fresh_until:'2099-01-01',retry_after:'2099-01-01',stale:true},{status:'incomplete'},[]);
 assert.equal(current.needs_location_refresh,true);assert.equal(current.company_fresh_until,'2099-01-01');assert.equal(current.company_retry_after,'2099-01-01');
});

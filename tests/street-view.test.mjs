import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleStreetViewEmbed,propertyViewKey,savedStreetView} from '../static/street-view.js';
import {streetViewMarkup} from '../static/account-visuals.js';
const url='https://www.google.com/maps/embed?pb=!4v1790879893138!6m8!1m7!1sCAoSFkNJSE0wb2dLRUlDQWdJQ0VuWnZ6YUE.!2m2!1d35.77958967369189!2d-78.63817874258267!3f0!4f0!5f0.4000000000000002';
test('Google-generated Street View iframe is reduced to a safe Google embed URL',()=>{
 const safe=googleStreetViewEmbed(`<iframe src="${url}" onload="evil()"></iframe>`);
 assert.equal(new URL(safe).searchParams.get('pb'),new URL(url).searchParams.get('pb'));
 assert.doesNotMatch(safe,/iframe|onload|evil/);
 for(const input of ['javascript:alert(1)',url.replace('www.google.com','evil.com'),url.replace('https:','http:'),url.replace('www.google.com','www.google.com.evil.com'),url.replace('/maps/embed','/redirect'),'https://www.google.com/maps/embed?pb=!1m18','x'.repeat(4097)])assert.equal(googleStreetViewEmbed(input),'');
});
test('selected panorama follows only the saved address and never changes to a nearby geocoder match',()=>{
 const lead={property_address:'123 Main St',city:'Raleigh',state:'NC'};lead.street_view={url,address_key:propertyViewKey(lead)};
 assert.ok(savedStreetView(lead));assert.equal(savedStreetView({...lead,property_address:'125 Main St'}),'');assert.equal(savedStreetView({...lead,city:'Denver'}),'');assert.equal(savedStreetView({...lead,property_address:''}),'');
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');
 const html=streetViewMarkup(lead,{esc});assert.match(html,/street-view-preview/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/Add Street View|Paste Google|Save preview|Remove preview|Address map/);assert.doesNotMatch(html,/embed\/v1|key=/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aerialRequest,aerialImage} from '../website/property-imagery.mjs';
import {propertyViewLinks,propertyImageryMarkup} from '../static/account-visuals.js';
const context={status:'matched',coordinates:{x:-78.69,y:35.81}};
const jpeg=(width=720,height=420)=>new Uint8Array([255,216,255,192,0,17,8,height>>8,height&255,width>>8,width&255,3,1,17,0,2,17,0,3,17,0,...Array(15).fill(0),255,217]);
test('aerial requests derive bounded coordinates and never accept a caller URL',()=>{
 const req=aerialRequest(context),u=new URL(req.url);assert.equal(u.origin,'https://imagery.nationalmap.gov');assert.equal(u.searchParams.get('size'),'720,420');assert.equal(req.options.redirect,'manual');
 for(const c of [{},{status:'unmatched',coordinates:context.coordinates},{status:'matched',coordinates:{x:'-78',y:35}},{status:'matched',coordinates:{x:0,y:0}},{status:'matched',coordinates:{x:-156,y:21}}])assert.equal(aerialRequest(c),null);
});
test('JPEG validation bounds dimensions, rejects HTML and permits provider padding after EOI',async()=>{
 const response=bytes=>new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
 const image=await aerialImage(response(new Uint8Array([...jpeg(),0,0,0])));assert.equal(atob(image.split(',')[1]).length,jpeg().length);
 for(const b of [new TextEncoder().encode('<html>'),jpeg(9000,420),new Uint8Array(300001)])await assert.rejects(aerialImage(response(b)));
 await assert.rejects(aerialImage(new Response(jpeg(),{headers:{'Content-Type':'text/html'}})));
});
test('Google links retain address search and offer exploration only for current matched coordinates',()=>{
 const links=propertyViewLinks({property_address:'12 Test Street',property_context:context});assert.equal(new URL(links.search).searchParams.get('query'),'12 Test Street');assert.equal(new URL(links.street).searchParams.get('viewpoint'),'35.81,-78.69');assert.equal(propertyViewLinks({property_address:'12 Test Street',property_context:{...context,stale:true}}).street,undefined);assert.equal(links.satellite,undefined);
 const fallback=propertyViewLinks({property_address:'A & B Street',city:'Raleigh'});assert.equal(new URL(fallback.search).searchParams.get('query'),'A & B Street, Raleigh');assert.equal(fallback.satellite,undefined);
 assert.deepEqual(propertyViewLinks({}),{});
 assert.deepEqual(propertyViewLinks({property_context:context}),{});
});
test('imagery states distinguish coverage, source and approximate location',()=>{
 const ui={esc:v=>String(v||'').replaceAll('"','&quot;')};
 const html=propertyImageryMarkup({id:'test',property_address:'12 Test Street',property_context:context},ui);assert.match(html,/USGS \/ USDA NAIP/);assert.match(html,/Not live/);assert.match(html,/Find address on Google Maps/);assert.doesNotMatch(html,/<iframe|key=/);
 assert.doesNotMatch(propertyImageryMarkup({id:'test',property_context:{}},ui),/id="property-aerial"/);
});

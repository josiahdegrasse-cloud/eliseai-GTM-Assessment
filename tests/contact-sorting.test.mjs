import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactFit,sortContacts} from '../static/workflow.js';
const lead=(id,name,points,assessed=3)=>({id,name,research_brief:{sources:assessed?[{id:'S1',name_matched:true}]:[],classification:{kind:points===null?'unclassified':points===0?'software_vendor':'housing_operator',label:points===0?'Software provider':'Housing operator',evidence:points===null?[]:[{kind:points===0?'software_vendor':'housing_operator',quote:'Published operating model.',source_id:'S1'}]}}});
const rows=[lead('u','Aaron',null,0),lead('h','Zoe',45),lead('l','Beth',0),lead('p','Chris',30)];
test('fit sorting keeps unknowns last in both directions and preserves input',()=>{
 assert.deepEqual(sortContacts(rows,'fit-desc').map(l=>l.id),['p','h','l','u']);
 assert.deepEqual(sortContacts(rows,'fit-asc').map(l=>l.id),['l','p','h','u']);
 assert.deepEqual(rows.map(l=>l.id),['u','h','l','p']);
});
test('name sorting ignores fit and score labels distinguish unknown from low',()=>{
 assert.deepEqual(sortContacts(rows,'name-asc').map(l=>l.id),['u','l','p','h']);
 assert.deepEqual(sortContacts(rows,'name-desc').map(l=>l.id),['h','p','l','u']);
 assert.deepEqual(rows.map(contactFit).map(f=>f.tone),['unknown','high','low','high']);
 assert.equal(contactFit(rows[2]).label,'Low fit');assert.equal(contactFit(rows[0]).score,null);
});
test('newest sorting and equal-score ties are deterministic',()=>{
 const a={...lead('a','Alpha',40),created_at:'2026-09-01'},b={...lead('b','Beta',40),created_at:'2026-09-29'};
 assert.deepEqual(sortContacts([a,b],'newest').map(l=>l.id),['b','a']);
 assert.deepEqual(sortContacts([b,a],'fit-desc').map(l=>l.id),['a','b']);
});

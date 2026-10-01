import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {demoInquiryCleanup} from '../website/demo-inquiry-cleanup.mjs';
const rows=JSON.parse(readFileSync(new URL('../test-data/legacy-example-inputs.json',import.meta.url)));
const original=rows.find(r=>r.sample_key==='hessam.nadji');
test('retained older brokerage demo loses its shipped request even after research refresh',()=>{
 const l={...original,sample_lead:true,company_snapshot:false,draft_version:20};const next=demoInquiryCleanup(l,'C',rows);
 assert.equal(next.inquiry,'');assert.equal(next.draft_version,0);assert.equal(next.sample_focus,'No inbound email context');
});
test('cleanup preserves imported and custom messages and high-priority requests',()=>{
 const l={...original,sample_lead:true};assert.equal(demoInquiryCleanup({...l,sample_lead:false},'C',rows),null);assert.equal(demoInquiryCleanup({...l,inquiry:'My own inquiry'},'C',rows),null);assert.equal(demoInquiryCleanup(l,'A',rows),null);assert.equal(demoInquiryCleanup(l,null,rows),null);
});
test('edited drafts remain intact and are flagged when sample context is cleared',()=>{
 const l={...original,sample_lead:true,reviewed:true,draft:'My reviewed wording'};const next=demoInquiryCleanup(l,'C',rows);assert.equal(next.draft,l.draft);assert.equal(next.draft_stale,true);assert.equal(next.reviewed,false);
});

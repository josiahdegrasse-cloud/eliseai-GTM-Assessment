import {test} from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import {leadsCSV} from '../static/export.js';
test('CSV exposes understandable fit, dates, context and source columns',()=>{
 const rows=Papa.parse(leadsCSV([{name:'TEST Contact',fit:{label:'Possible fit',reason:'Residential operations only.'},qualifications:{process:'Shared inbox',scope:'Five communities',role:'Operations',timing:'October'},company_snapshot:true,company_fetched_at:'2026-09-29',research_brief:{sources:[{title:'About',url:'https://company.com/about',excerpt:'Published company context.'}]}}]),{header:true}).data;
 assert.equal(rows[0].company_fit,'Fit unclear');assert.equal(rows[0].fit_reason,'Available evidence does not establish a clear operating model.');assert.equal(rows[0].current_workflow,'Shared inbox');assert.equal(rows[0].research_basis,'Saved sample snapshot');assert.equal(rows[0].source_urls,'https://company.com/about');assert.equal(rows[0].company_retrieved_at,'2026-09-29');
});
test('CSV preserves multiline wording and neutralizes spreadsheet formulas',()=>{
 const row=Papa.parse(leadsCSV([{name:'=HYPERLINK("https://untrusted.com")',draft:'Hi,\n\n"Thanks"',notes:' \t+1+1'}]),{header:true}).data[0];
 assert.ok(row.name.startsWith("'="));assert.ok(row.notes.startsWith("'"));assert.equal(row.draft,'Hi,\n\n"Thanks"');assert.equal(row.company_fit,'Fit unclear');
});

test('exports distinguish unknown readiness from a confirmed zero and label both score scales',()=>{
 const rows=Papa.parse(leadsCSV([{priority:{fit_assessment:{points:50},readiness_assessment:{points:null}}},{priority:{fit_assessment:{points:50},readiness_assessment:{points:0}}}]),{header:true}).data;
 assert.equal(rows[0].company_fit_points,'');assert.equal(rows[0].company_fit_max,'');assert.equal(rows[0].legacy_buying_readiness_points,'');assert.equal(rows[1].legacy_buying_readiness_points,'0');assert.equal(rows[1].legacy_buying_readiness_max,'50');
});

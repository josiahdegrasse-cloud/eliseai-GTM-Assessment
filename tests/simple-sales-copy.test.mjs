import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intake,qualify,draftFor,presentLead} from '../website/domain.mjs';
import {fitHeaderMarkup,sourcePanelMarkup} from '../static/research.js';
const company='Acme Housing',text='Acme Housing manages apartment communities. We own and manage 2,000 apartment homes in eight U.S. markets.';
const make=(inquiry='')=>qualify(intake({name:'Jordan Lee',email:'jordan@example.invalid',company,website:'acmehousing.com',inquiry}),{evidence:[{verified:true,title:company,url:'https://acmehousing.com/about',text,date:new Date().toISOString()}]},{},[]);
test('drafts are deterministic, short, and trace the specific detail to its source',()=>{
 const lead=make(),a=draftFor(lead,true,false,lead.research_brief),b=draftFor(lead,true,false,lead.research_brief);
 assert.equal(a.draft,b.draft);assert.match(a.draft,/Acme Housing operates across eight U.S. markets/);
 assert.ok(a.draft.split(/\s+/).length<80);assert.equal((a.draft.match(/\?/g)||[]).length,1);
 assert.ok(a.draft_basis.find(x=>x.sentence?.includes('eight U.S. markets')&&x.source.excerpt.includes(x.quote)));
 assert.doesNotMatch(a.draft,/Your company overview|How does your team|budget|decision.maker/);
});
test('a specific inbound request keeps its topic while using verified company context',()=>{
 const lead=make('We need help handling maintenance requests.');
 assert.match(lead.draft,/Thanks for reaching out about maintenance requests/);
 assert.match(lead.draft,/capture maintenance requests and route them/);
 assert.match(lead.question,/walkthrough of maintenance requests/);
 assert.match(lead.draft,/eight U.S. markets/);
 assert.doesNotMatch(lead.draft,/book tours|2,000/);
 assert.ok(lead.draft.split(/\s+/).length<85);
});
test('fit explanation uses one sourced rule and never resurrects saved point totals',()=>{
 const lead={...make(),score:100,lead_fit:{score:100},company_fit:{score:100}},ui={esc:String,icon:()=>'',date:String};
 const html=fitHeaderMarkup(lead,ui)+sourcePanelMarkup(lead,ui,'score');
 assert.match(html,/PRIORITY RUBRIC/);assert.match(html,/Medium priority/);assert.match(html,/data-panel-source="S1"/);
 assert.doesNotMatch(html,/100\/100|possible points|%|Refresh pending/);
 const unknown=presentLead({...lead,evidence:[]});assert.equal(unknown.company_fit.label,'Fit unclear');
});
test('new writer does not overwrite reviewed or edited emails during a policy migration',()=>{
 for(const extra of [{reviewed:true},{draft_edited:true}]){
  const lead=presentLead({...make(),draft:'My exact wording',draft_version:13,draft_research_signature:'older writer rules',...extra});
  assert.equal(lead.draft,'My exact wording');assert.equal(lead.draft_stale,true);
 }
});
